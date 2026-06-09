// src/utils/grading.js
// ─────────────────────────────────────────────────────────────────
// SECURITY NOTE (MVP):
// Chấm điểm ở frontend có nghĩa là đáp án đúng được tải về client
// và có thể bị xem qua DevTools / Network tab.
// Production nên dùng Firebase Cloud Functions để chấm bài phía server.
// ─────────────────────────────────────────────────────────────────

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

/**
 * Tính điểm cho câu multi theo 4 mode:
 * - none: đúng hết mới có điểm
 * - all-or-nothing: đúng hết mới có điểm
 * - linear: đúng x/4 ý thì được x/4 * point
 * - custom: lấy điểm từ partialScoreMap, ví dụ 0:0,1:0.1,2:0.25,3:0.5,4:1
 */
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

    // Nếu giáo viên nhập map vượt quá point thì tự clamp về point.
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
    const isCorrect = answer && answer === correct

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
    const isCorrect = answer && answer === correct

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
    const isCorrect = answer && answer === correct

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

    // Chấm theo 4 ý A/B/C/D:
    // - Nếu ý đúng và học sinh chọn => đúng ý
    // - Nếu ý sai và học sinh không chọn => đúng ý
    // - Nếu ý đúng mà không chọn => sai ý
    // - Nếu ý sai mà lại chọn => sai ý
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

/**
 * Chấm bài và trả về kết quả đầy đủ.
 * @param {Array} questions - mảng câu hỏi từ Firestore
 * @param {Object} answers - { questionId: answer }
 * @returns {Object}
 */
export function gradeExam(questions, answers) {
  let score = 0
  let totalScore = 0
  let correctCount = 0
  let wrongCount = 0
  let blankCount = 0

  const topicStats = {}
  const sectionStats = {}
  const questionResults = []

  for (const q of questions) {
    const qid = q.id
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

/**
 * Xếp loại học lực
 */
export function getGrade(displayScore) {
  if (displayScore >= 9) {
    return { label: 'Xuất sắc', color: '#22c55e', cssClass: 'excellent' }
  }

  if (displayScore >= 8) {
    return { label: 'Giỏi', color: '#1f8f4d', cssClass: 'good' }
  }

  if (displayScore >= 6.5) {
    return { label: 'Khá', color: '#3b82f6', cssClass: 'ok' }
  }

  if (displayScore >= 5) {
    return { label: 'Trung bình', color: '#f59e0b', cssClass: 'average' }
  }

  return { label: 'Yếu', color: '#ef4444', cssClass: 'fail' }
}

/**
 * Phân loại chủ đề theo kết quả
 */
export function classifyTopics(topicStats) {
  const strong = []
  const needPractice = []
  const needReview = []

  for (const [topic, stat] of Object.entries(topicStats)) {
    if (stat.totalScore === 0) continue

    const pct = (stat.score / stat.totalScore) * 100

    if (pct >= 80) {
      strong.push({ topic, ...stat, pct })
    } else if (pct >= 50) {
      needPractice.push({ topic, ...stat, pct })
    } else {
      needReview.push({ topic, ...stat, pct })
    }
  }

  return { strong, needPractice, needReview }
}

/**
 * Format điểm hiển thị
 */
export function formatScore(displayScore) {
  return Number(displayScore || 0).toFixed(1)
}