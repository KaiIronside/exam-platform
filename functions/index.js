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
      A: q.A,
      B: q.B,
      C: q.C,
      D: q.D,
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

exports.submitExam = onCall(
  {
    region: 'asia-southeast1',
  },
  async (request) => {
    const data = request.data || {}

    const {
      examId,
      studentInfo,
      answers,
      violations,
      durationUsedSeconds,
    } = data

    if (!examId) {
      throw new HttpsError('invalid-argument', 'Thiếu examId.')
    }

    if (!studentInfo || !studentInfo.studentName || !studentInfo.className) {
      throw new HttpsError('invalid-argument', 'Thiếu thông tin học sinh.')
    }

    if (!answers || typeof answers !== 'object') {
      throw new HttpsError('invalid-argument', 'Thiếu answers.')
    }

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

    const submission = {
      examId,
      examTitle: exam.title || '',
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
      exam,
      studentInfo,
      violations: Number(violations || 0),
      durationUsedSeconds: Number(durationUsedSeconds || 0),
      ...grade,
    }
  }
)