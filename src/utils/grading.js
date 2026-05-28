// src/utils/grading.js
// ─────────────────────────────────────────────────────────────────
// SECURITY NOTE (MVP):
// Chấm điểm ở frontend có nghĩa là đáp án (correct) được tải về
// client và có thể bị xem qua DevTools / Network tab.
// Production nên dùng Firebase Cloud Functions để chấm bài phía
// server và không trả về field "correct" cho student.
// ─────────────────────────────────────────────────────────────────

/**
 * Chấm bài và trả về kết quả đầy đủ.
 * @param {Array} questions - mảng câu hỏi từ Firestore
 * @param {Object} answers - { questionId: "A"|"B"|"C"|"D" }
 * @returns {Object} kết quả chấm bài
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
    const point = typeof q.point === 'number' ? q.point : 0.25
    const topic = q.topic || 'Chưa phân loại'
    const section = q.section || 'Phần I'

    totalScore += point

    if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0, score: 0, totalScore: 0 }
    if (!sectionStats[section]) sectionStats[section] = { correct: 0, total: 0, score: 0, totalScore: 0 }

    topicStats[topic].total++
    topicStats[topic].totalScore += point
    sectionStats[section].total++
    sectionStats[section].totalScore += point

    const studentAnswer = answers[qid] || null
    const isCorrect = studentAnswer === q.correct
    const isBlank = !studentAnswer

    if (isBlank) {
      blankCount++
    } else if (isCorrect) {
      score += point
      correctCount++
      topicStats[topic].correct++
      topicStats[topic].score += point
      sectionStats[section].correct++
      sectionStats[section].score += point
    } else {
      wrongCount++
    }

    questionResults.push({
      questionId: qid,
      order: q.order,
      question: q.question,
      A: q.A,
      B: q.B,
      C: q.C,
      D: q.D,
      correct: q.correct,
      studentAnswer,
      isCorrect,
      isBlank,
      explanation: q.explanation || '',
      topic,
      section,
      point,
    })
  }

  // Điểm hiển thị quy về /10
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
  if (displayScore >= 9) return { label: 'Xuất sắc', color: '#22c55e', cssClass: 'excellent' }
  if (displayScore >= 8) return { label: 'Giỏi', color: var_green_primary(), cssClass: 'good' }
  if (displayScore >= 6.5) return { label: 'Khá', color: '#3b82f6', cssClass: 'ok' }
  if (displayScore >= 5) return { label: 'Trung bình', color: '#f59e0b', cssClass: 'average' }
  return { label: 'Yếu', color: '#ef4444', cssClass: 'fail' }
}

function var_green_primary() { return '#1f8f4d' }

/**
 * Phân loại chủ đề theo kết quả
 */
export function classifyTopics(topicStats) {
  const strong = []
  const needPractice = []
  const needReview = []

  for (const [topic, stat] of Object.entries(topicStats)) {
    if (stat.total === 0) continue
    const pct = (stat.correct / stat.total) * 100
    if (pct >= 80) strong.push({ topic, ...stat, pct })
    else if (pct >= 50) needPractice.push({ topic, ...stat, pct })
    else needReview.push({ topic, ...stat, pct })
  }

  return { strong, needPractice, needReview }
}

/**
 * Format điểm hiển thị
 */
export function formatScore(displayScore) {
  return displayScore.toFixed(1)
}