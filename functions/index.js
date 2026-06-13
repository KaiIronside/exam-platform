const { onCall, HttpsError } = require('firebase-functions/v2/https')
const admin = require('firebase-admin')

admin.initializeApp()

const db = admin.firestore()

const OPTION_KEYS = ['A', 'B', 'C', 'D']

const DEFAULT_CUSTOM_PARTIAL_MAP = {
  0: 0,
  1: 0.1,
  2: 0.25,
  3: 0.5,
  4: 1,
}

function normalizeType(value) {
  return String(value || 'mcq').trim().toLowerCase()
}

function normalizePartialMode(value, questionType) {
  const mode = String(value || '').trim().toLowerCase()

  if (!mode) {
    return questionType === 'multi' ? 'custom' : 'none'
  }

  return mode
}

function normalizeNumeric(value) {
  return String(value || '')
    .trim()
    .replace(',', '.')
    .replace(/\s+/g, '')
}

function parseCorrectList(q) {
  if (Array.isArray(q.correctList) && q.correctList.length > 0) {
    return q.correctList.map(x => String(x).toUpperCase().trim())
  }

  return String(q.correct || '')
    .toUpperCase()
    .split(/[,\s;|/]+/)
    .map(x => x.trim())
    .filter(Boolean)
}

function normalizePartialScoreMap(map) {
  if (!map || typeof map !== 'object') {
    return { ...DEFAULT_CUSTOM_PARTIAL_MAP }
  }

  const result = {}

  for (let i = 0; i <= 4; i++) {
    const value = map[i] ?? map[String(i)]
    const score = Number(value)

    result[i] = Number.isNaN(score)
      ? DEFAULT_CUSTOM_PARTIAL_MAP[i]
      : score
  }

  return result
}

function getMultiScore(correctOptionCount, point, partialMode, partialScoreMap) {
  if (partialMode === 'none') {
    return correctOptionCount === 4 ? point : 0
  }

  if (partialMode === 'all-or-nothing') {
    return correctOptionCount === 4 ? point : 0
  }

  if (partialMode === 'linear') {
    return (correctOptionCount / 4) * point
  }

  if (partialMode === 'custom') {
    const map = normalizePartialScoreMap(partialScoreMap)
    const customScore = Number(map[correctOptionCount] ?? 0)
    return Math.min(customScore, point)
  }

  return correctOptionCount === 4 ? point : 0
}

function gradeSingleQuestion(q, studentAnswer) {
  const type = normalizeType(q.questionType)
  const point = typeof q.point === 'number' ? q.point : Number(q.point) || 1
  const partialMode = normalizePartialMode(q.partialMode, type)

  if (type === 'mcq') {
    const answer = String(studentAnswer || '').toUpperCase()
    const correct = String(q.correct || '').toUpperCase()
    const isCorrect = Boolean(answer && answer === correct)

    return {
      earned: isCorrect ? point : 0,
      isCorrect,
      isBlank: !answer,
      detail: {
        correctOptionCount: isCorrect ? 1 : 0,
        maxOptionCount: 1,
        partialMode: 'none',
      },
    }
  }

  if (type === 'tf') {
    const answer = String(studentAnswer || '').toLowerCase()
    const correct = String(q.correct || '').toLowerCase()
    const isCorrect = Boolean(answer && answer === correct)

    return {
      earned: isCorrect ? point : 0,
      isCorrect,
      isBlank: !answer,
      detail: {
        correctOptionCount: isCorrect ? 1 : 0,
        maxOptionCount: 1,
        partialMode: 'none',
      },
    }
  }

  if (type === 'numeric') {
    const answer = normalizeNumeric(studentAnswer)
    const correct = normalizeNumeric(q.correct)
    const isCorrect = Boolean(answer && answer === correct)

    return {
      earned: isCorrect ? point : 0,
      isCorrect,
      isBlank: !answer,
      detail: {
        correctOptionCount: isCorrect ? 1 : 0,
        maxOptionCount: 1,
        partialMode: 'none',
      },
    }
  }

  if (type === 'multi') {
    const correctList = parseCorrectList(q)

    const selectedList = Array.isArray(studentAnswer)
      ? studentAnswer.map(x => String(x).toUpperCase())
      : String(studentAnswer || '')
          .toUpperCase()
          .split(/[,\s;|/]+/)
          .map(x => x.trim())
          .filter(Boolean)

    const correctSet = new Set(correctList)
    const selectedSet = new Set(selectedList)

    let correctOptionCount = 0

    for (const key of OPTION_KEYS) {
      const shouldSelect = correctSet.has(key)
      const didSelect = selectedSet.has(key)

      if (shouldSelect === didSelect) {
        correctOptionCount++
      }
    }

    const earned = getMultiScore(
      correctOptionCount,
      point,
      partialMode,
      q.partialScoreMap
    )

    const isCorrect = correctOptionCount === 4
    const isBlank = selectedList.length === 0

    return {
      earned,
      isCorrect,
      isBlank,
      detail: {
        correctOptionCount,
        maxOptionCount: 4,
        selectedList,
        correctList,
        partialMode,
        partialScoreMap: normalizePartialScoreMap(q.partialScoreMap),
      },
    }
  }

  return {
    earned: 0,
    isCorrect: false,
    isBlank: true,
    detail: {
      partialMode: 'none',
    },
  }
}

function gradeExam(questions, answers) {
  let score = 0
  let totalScore = 0
  let correctCount = 0
  let wrongCount = 0
  let blankCount = 0

  const topicStats = {}
  const sectionStats = {}
  const questionResults = []

  for (const q of questions) {
    const qid = String(q.order || q.id)
    const point = typeof q.point === 'number' ? q.point : Number(q.point) || 1
    const topic = q.topic || 'Chưa phân loại'
    const section = q.section || 'Phần I'
    const type = normalizeType(q.questionType)
    const partialMode = normalizePartialMode(q.partialMode, type)

    totalScore += point

    if (!topicStats[topic]) {
      topicStats[topic] = {
        correct: 0,
        total: 0,
        score: 0,
        totalScore: 0,
      }
    }

    if (!sectionStats[section]) {
      sectionStats[section] = {
        correct: 0,
        total: 0,
        score: 0,
        totalScore: 0,
      }
    }

    topicStats[topic].total++
    topicStats[topic].totalScore += point
    sectionStats[section].total++
    sectionStats[section].totalScore += point

    const studentAnswer = answers[qid]
    const result = gradeSingleQuestion(q, studentAnswer)

    score += result.earned
    topicStats[topic].score += result.earned
    sectionStats[section].score += result.earned

    if (result.isBlank) {
      blankCount++
    } else if (result.isCorrect) {
      correctCount++
      topicStats[topic].correct++
      sectionStats[section].correct++
    } else {
      wrongCount++
    }

    questionResults.push({
      questionId: qid,
      order: q.order,
      question: q.question,
      questionType: type,
      A: q.A || '',
      B: q.B || '',
      C: q.C || '',
      D: q.D || '',
      correct: q.correct,
      correctList: parseCorrectList(q),
      studentAnswer,
      isCorrect: result.isCorrect,
      isBlank: result.isBlank,
      earned: Math.round(result.earned * 100) / 100,
      point,
      explanation: q.explanation || '',
      topic,
      section,
      partialMode,
      partialScoreMap: normalizePartialScoreMap(q.partialScoreMap),
      detail: result.detail,
    })
  }

  const displayScore = totalScore > 0 ? (score / totalScore) * 10 : 0

  return {
    score: Math.round(score * 100) / 100,
    totalScore: Math.round(totalScore * 100) / 100,
    displayScore: Math.round(displayScore * 100) / 100,
    correctCount,
    wrongCount,
    blankCount,
    topicStats,
    sectionStats,
    questionResults,
  }
}

async function isTeacher(uid) {
  if (!uid) return false

  const snap = await db.collection('users').doc(uid).get()

  return snap.exists && snap.data()?.role === 'teacher'
}

function getOptionText(q, key) {
  const value = q?.[key]
  return String(value || '').trim()
}

function getCorrectText(q) {
  const type = normalizeType(q.questionType)

  if (type === 'tf') {
    const correct = String(q.correct || '').toLowerCase()
    return correct === 'true' ? 'Đúng' : 'Sai'
  }

  if (type === 'numeric') {
    return String(q.correct || '').trim()
  }

  if (type === 'multi') {
    const list = parseCorrectList(q)
    return list
      .map(key => {
        const text = getOptionText(q, key)
        return text ? `${key}. ${text}` : key
      })
      .join('; ')
  }

  const key = String(q.correct || '').toUpperCase().trim()
  const text = getOptionText(q, key)

  if (key && text) {
    return `${key}. ${text}`
  }

  return key || String(q.correct || '').trim()
}

function cleanExplanation(text) {
  let s = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')
    .trim()

  s = s.replace(/^giải thích\s*:\s*/i, '').trim()
  s = s.replace(/^đáp án\s*:\s*/i, '').trim()
  s = s.replace(/^câu giải thích\s*:\s*/i, '').trim()

  const sentences = s.match(/[^.!?。！？]+[.!?。！？]?/g) || []

  if (sentences.length > 0) {
    s = sentences.slice(0, 2).join(' ').trim()
  }

  const words = s.split(/\s+/).filter(Boolean)

  if (words.length > 65) {
    s = words.slice(0, 65).join(' ') + '.'
  }

  if (s && !/[.!?。！？]$/.test(s)) {
    s += '.'
  }

  return s
}

function isBadExplanation(text) {
  const raw = String(text || '').trim()
  const s = raw.toLowerCase()

  if (!s) return true
  if (s.length < 18) return true

  const hasCalculationSignal =
    /[=×*/+\-→]/.test(raw) ||
    /\d/.test(raw) ||
    s.includes('mol') ||
    s.includes('glucose') ||
    s.includes('ethanol') ||
    s.includes('hplc') ||
    s.includes('nồng độ') ||
    s.includes('khối lượng') ||
    s.includes('thể tích') ||
    s.includes('%') ||
    s.includes('hiệu suất') ||
    s.includes('tinh bột') ||
    s.includes('pha loãng') ||
    s.includes('đường chuẩn')

  if (hasCalculationSignal) {
    return false
  }

  const badPhrases = [
    'khớp với dữ kiện',
    'khớp với khái niệm',
    'phù hợp với dữ kiện',
    'phù hợp với kiến thức',
    'phù hợp trực tiếp',
    'kiến thức trọng tâm',
    'đáp án này đúng',
    'là đáp án đúng',
    'là đáp án chính xác',
    'câu hỏi yêu cầu',
    'dựa trên câu hỏi',
    'dựa vào câu hỏi',
    'được hỏi trong câu',
    'theo yêu cầu của đề',
    'vì đáp án này',
  ]

  return badPhrases.some(p => s.includes(p))
}

function smartFallbackExplanation(q) {
  const question = String(q.question || '').toLowerCase()
  const correct = String(q.correct || '').trim()
  const correctUpper = correct.toUpperCase()
  const correctText = getCorrectText(q).toLowerCase()

  if (
    question.includes('lên men') &&
    question.includes('sắn') &&
    question.includes('tinh bột') &&
    question.includes('ethanol') &&
    question.includes('e5')
  ) {
    return 'Tinh bột tạo ethanol theo tỉ lệ 162→92, nên V ethanol = 81×92/162×0,8×0,75/0,789 ≈ 35 L; E5 chứa 5% ethanol nên thu 700 L.'
  }

  if (
    question.includes('hplc') &&
    question.includes('glutamic') &&
    question.includes('0,026') &&
    question.includes('0,0217')
  ) {
    return 'Từ y = 0,026x + 0,0217 suy ra x ≈ 30,5; quy đổi theo pha loãng và khối lượng mẫu cho kết quả khoảng 1,39%.'
  }

  if (question.includes('ph') && question.includes('trung tính')) {
    return 'Dung dịch trung tính ở điều kiện thường có pH bằng 7.'
  }

  if (question.includes('số mol') && question.includes('4') && question.includes('h2')) {
    return 'Số mol được tính theo công thức n = m/M = 4/2 = 2 mol.'
  }

  if (
    question.includes('khối lượng mol') &&
    (question.includes('h2o') || question.includes('h₂o'))
  ) {
    return 'H2O có khối lượng mol M = 2×1 + 16 = 18 g/mol.'
  }

  if (
    question.includes('số nguyên tử h') &&
    (question.includes('h2o') || question.includes('h₂o'))
  ) {
    return 'Trong công thức H2O, chỉ số 2 cho biết phân tử có 2 nguyên tử hiđro.'
  }

  if (
    question.includes('nước') &&
    (correctText.includes('h2o') || correctText.includes('h₂o'))
  ) {
    return 'Nước có công thức hóa học là H2O vì gồm hai nguyên tử H và một nguyên tử O.'
  }

  if (
    question.includes('cháy') &&
    (correctText.includes('o2') || correctText.includes('oxi') || correctText.includes('oxygen'))
  ) {
    return 'Oxi duy trì sự cháy vì nó là chất oxi hóa giúp phản ứng cháy tiếp diễn.'
  }

  if (
    question.includes('na') &&
    (question.includes('kí hiệu') || question.includes('ký hiệu')) &&
    correctText.includes('natri')
  ) {
    return 'Na là kí hiệu hóa học của nguyên tố Natri trong bảng tuần hoàn.'
  }

  if (
    question.includes('axit') &&
    question.includes('ph') &&
    (correctText.includes('nhỏ hơn 7') || correctUpper === 'C')
  ) {
    return 'Dung dịch axit có pH nhỏ hơn 7 do tạo ion H+ trong nước.'
  }

  if (
    question.includes('bazơ') &&
    (correctText.includes('naoh') || correctText.includes('koh') || correctText.includes('ca(oh)2'))
  ) {
    return 'NaOH, KOH và Ca(OH)2 là bazơ vì khi tan trong nước tạo ion OH-.'
  }

  if (
    question.includes('co2') &&
    question.includes('oxit axit')
  ) {
    return 'CO2 là oxit axit vì có thể phản ứng với nước tạo axit cacbonic H2CO3.'
  }

  if (
    question.includes('nacl') &&
    question.includes('bazơ')
  ) {
    return 'NaCl là muối tạo từ axit HCl và bazơ NaOH, không phải bazơ.'
  }

  if (
    question.includes('oxi') &&
    (question.includes('kí hiệu') || question.includes('ký hiệu'))
  ) {
    return 'Kí hiệu hóa học của Oxi là O.'
  }

  if (
    question.includes('cacbon') &&
    question.includes('proton')
  ) {
    return 'Cacbon có số hiệu nguyên tử Z = 6 nên nguyên tử cacbon có 6 proton.'
  }

  return 'Chưa có giải thích phù hợp cho câu này.'
}

async function generateGeminiExplanation(q) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return smartFallbackExplanation(q)
  }

  const type = normalizeType(q.questionType)
  const correctText = getCorrectText(q)

  const prompt = `
Bạn là giáo viên Hóa học THPT và luyện thi học sinh khá giỏi.

Nhiệm vụ: giải thích vì sao đáp án đúng là "${correctText}" bằng KIẾN THỨC HÓA HỌC CỤ THỂ.

Luật bắt buộc:
- Với câu lý thuyết: viết 1 câu tiếng Việt, tối đa 30 từ.
- Với bài tính: được viết 1-2 câu ngắn, tối đa 65 từ.
- Bài tính phải có công thức, tỉ lệ phản ứng, phép thế số hoặc bước quy đổi chính.
- Cấm nói chung chung như: "khớp với dữ kiện", "phù hợp với kiến thức", "đáp án này đúng".
- Không mở đầu bằng "Chọn..." nếu không cần.
- Không giải thích mẹo làm bài, chỉ giải thích kiến thức hoặc phép tính.

Ví dụ tốt:
Câu hỏi: "pH của dung dịch trung tính là bao nhiêu?"
Đáp án đúng: "7"
Giải thích: "Dung dịch trung tính ở điều kiện thường có pH bằng 7."

Ví dụ tốt:
Câu hỏi: "Khí nào cần thiết cho sự cháy?"
Đáp án đúng: "A. O2"
Giải thích: "Oxi duy trì sự cháy vì nó là chất oxi hóa giúp phản ứng cháy tiếp diễn."

Ví dụ tốt:
Câu hỏi: "Tính số mol của 4 gam H2, biết M H2 = 2 g/mol."
Đáp án đúng: "2"
Giải thích: "Số mol được tính theo công thức n = m/M = 4/2 = 2 mol."

Ví dụ tốt:
Câu hỏi: "Lên men 225 kg sắn khô chứa 36% tinh bột... Tính thể tích xăng E5 thu được."
Đáp án đúng: "700"
Giải thích: "Tinh bột tạo ethanol theo tỉ lệ 162→92, nên V ethanol = 81×92/162×0,8×0,75/0,789 ≈ 35 L; E5 chứa 5% ethanol nên thu 700 L."

Ví dụ tốt:
Câu hỏi: "Một mẫu nước mắm được phân tích hàm lượng glutamic acid bằng HPLC..."
Đáp án đúng: "1.39"
Giải thích: "Từ y = 0,026x + 0,0217 suy ra x ≈ 30,5; quy đổi theo pha loãng và khối lượng mẫu cho kết quả khoảng 1,39%."

Câu hỏi thật:
${q.question}

Loại câu hỏi: ${type}

Các lựa chọn:
A. ${q.A || ''}
B. ${q.B || ''}
C. ${q.C || ''}
D. ${q.D || ''}

Đáp án đúng: ${correctText}

Chỉ trả về phần giải thích, không thêm tiêu đề.
`.trim()

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.15,
          topP: 0.8,
          maxOutputTokens: 180,
        },
      }),
    })

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text())
      return smartFallbackExplanation(q)
    }

    const json = await response.json()

    const rawText =
      json?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join(' ')
        .trim() || ''

    const cleaned = cleanExplanation(rawText)

    if (isBadExplanation(cleaned)) {
      const fallback = smartFallbackExplanation(q)

      return isBadExplanation(fallback)
        ? 'Chưa có giải thích phù hợp cho câu này.'
        : fallback
    }

    return cleaned
  } catch (err) {
    console.error('generateGeminiExplanation failed:', err)
    return smartFallbackExplanation(q)
  }
}

exports.generateQuestionExplanation = onCall(
  {
    region: 'asia-southeast1',
    timeoutSeconds: 60,
  },
  async (request) => {
    const uid = request.auth?.uid

    if (!uid) {
      throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập.')
    }

    const teacher = await isTeacher(uid)

    if (!teacher) {
      throw new HttpsError('permission-denied', 'Chỉ giáo viên mới được tạo giải thích AI.')
    }

    const q = request.data?.question || {}

    if (!q.question) {
      throw new HttpsError('invalid-argument', 'Thiếu nội dung câu hỏi.')
    }

    if (!q.correct) {
      throw new HttpsError('invalid-argument', 'Thiếu đáp án đúng.')
    }

    const explanation = await generateGeminiExplanation(q)

    return {
      explanation,
    }
  }
)

exports.submitExam = onCall(
  {
    region: 'asia-southeast1',
  },
  async (request) => {
    const data = request.data || {}

    const {
      examId,
      studentInfo = {},
      answers,
      violations,
      durationUsedSeconds,
    } = data

    if (!examId) {
      throw new HttpsError('invalid-argument', 'Thiếu examId.')
    }

    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập Google để nộp bài.')
    }

    if (!studentInfo || !studentInfo.studentName || !studentInfo.className) {
      throw new HttpsError('invalid-argument', 'Thiếu thông tin học sinh.')
    }

    if (!answers || typeof answers !== 'object') {
      throw new HttpsError('invalid-argument', 'Thiếu answers.')
    }

    const studentUid = request.auth.uid
    const studentEmail = request.auth.token?.email || studentInfo.email || ''

    const examSnap = await db.collection('exams').doc(examId).get()

    if (!examSnap.exists) {
      throw new HttpsError('not-found', 'Không tìm thấy đề thi.')
    }

    const exam = {
      id: examSnap.id,
      ...examSnap.data(),
    }

    if (exam.isActive === false) {
      throw new HttpsError('failed-precondition', 'Đề thi đã bị khóa.')
    }

    const existingSnap = await db
      .collection('submissions')
      .where('examId', '==', examId)
      .where('studentUid', '==', studentUid)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      throw new HttpsError('already-exists', 'Bạn đã nộp bài này rồi.')
    }

    const qSnap = await db
      .collection('questionsPrivate')
      .where('examId', '==', examId)
      .get()

    const questions = qSnap.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    if (questions.length === 0) {
      throw new HttpsError('failed-precondition', 'Đề thi chưa có câu hỏi.')
    }

    const grade = gradeExam(questions, answers)
    const allowReview = exam.allowReview === true

    const safeGrade = allowReview
      ? grade
      : {
          ...grade,
          questionResults: [],
        }

    const submission = {
      examId,
      examTitle: exam.title || '',
      studentUid,
      studentEmail,
      studentName: String(studentInfo.studentName || '').trim(),
      className: String(studentInfo.className || '').trim(),
      studentCode: String(studentInfo.studentCode || '').trim(),
      answers,
      score: grade.score,
      totalScore: grade.totalScore,
      displayScore: grade.displayScore,
      correctCount: grade.correctCount,
      wrongCount: grade.wrongCount,
      blankCount: grade.blankCount,
      violations: Number(violations || 0),
      topicStats: grade.topicStats,
      sectionStats: grade.sectionStats,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      durationUsedSeconds: Number(durationUsedSeconds || 0),
    }

    const subRef = await db.collection('submissions').add(submission)

    return {
      id: subRef.id,
      exam: {
        id: exam.id,
        title: exam.title || '',
        subject: exam.subject || '',
        grade: exam.grade || '',
        duration: exam.duration || 0,
        allowReview,
      },
      studentInfo: {
        ...studentInfo,
        uid: studentUid,
        email: studentEmail,
      },
      violations: Number(violations || 0),
      durationUsedSeconds: Number(durationUsedSeconds || 0),
      ...safeGrade,
    }
  }
)