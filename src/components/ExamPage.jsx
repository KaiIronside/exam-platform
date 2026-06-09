// src/components/ExamPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { gradeExam } from '../utils/grading'

const OPTION_KEYS = ['A', 'B', 'C', 'D']

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function shuffleArray(input) {
  const array = [...input]

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }

  return array
}

function normalizeType(value) {
  return String(value || 'mcq').trim().toLowerCase()
}

function normalizeMultiAnswer(value) {
  return Array.isArray(value) ? value : []
}

export default function ExamPage({ exam, studentInfo, onSubmit, onBack }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem('exam_answers')
    return saved ? JSON.parse(saved) : {}
  })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [violations, setViolations] = useState(() => {
    return Number(localStorage.getItem('exam_violations') || 0)
  })

  const durationSeconds = (Number(exam.duration) || 45) * 60
  const [timeLeft, setTimeLeft] = useState(durationSeconds)

  const startedAtRef = useRef(Date.now())
  const submittedRef = useRef(false)

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true)
      setError('')

      try {
        let snap

        try {
          const q = query(
            collection(db, 'questions'),
            where('examId', '==', exam.id),
            orderBy('order', 'asc')
          )
          snap = await getDocs(q)
        } catch {
          const q = query(collection(db, 'questions'), where('examId', '==', exam.id))
          snap = await getDocs(q)
        }

        const sorted = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => (a.order || 0) - (b.order || 0))

        const orderKey = `question_order_${exam.id}`
        const savedOrder = localStorage.getItem(orderKey)

        let finalQuestions = sorted

        if (savedOrder) {
          const ids = JSON.parse(savedOrder)
          const map = new Map(sorted.map(q => [q.id, q]))
          finalQuestions = ids.map(id => map.get(id)).filter(Boolean)

          const missing = sorted.filter(q => !ids.includes(q.id))
          finalQuestions = [...finalQuestions, ...missing]
        } else {
          finalQuestions = shuffleArray(sorted)
          localStorage.setItem(orderKey, JSON.stringify(finalQuestions.map(q => q.id)))
        }

        setQuestions(finalQuestions)
      } catch (err) {
        console.error(err)
        setError('Không tải được câu hỏi. Kiểm tra Firestore Rules hoặc dữ liệu đề.')
      } finally {
        setLoading(false)
      }
    }

    loadQuestions()
  }, [exam.id])

  useEffect(() => {
    localStorage.setItem('exam_answers', JSON.stringify(answers))
  }, [answers])

  useEffect(() => {
    localStorage.setItem('exam_violations', String(violations))
  }, [violations])

  useEffect(() => {
    if (loading || submittedRef.current) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmit(true)
          return 0
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [loading, questions.length])

  useEffect(() => {
    function addViolation() {
      if (submittedRef.current) return

      setViolations(prev => {
        const next = prev + 1

        if (next >= 3) {
          setTimeout(() => handleSubmit(true), 200)
        }

        return next
      })
    }

    function onVisibilityChange() {
      if (document.hidden) addViolation()
    }

    window.addEventListener('blur', addViolation)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('blur', addViolation)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [questions, answers])

  const currentQuestion = questions[currentIndex]

  const answeredCount = useMemo(() => {
    return Object.values(answers).filter(value => {
      if (Array.isArray(value)) return value.length > 0
      return Boolean(value)
    }).length
  }, [answers])

  function chooseSingle(questionId, value) {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }))
  }

  function toggleMulti(questionId, key) {
    setAnswers(prev => {
      const current = normalizeMultiAnswer(prev[questionId])
      const exists = current.includes(key)

      const next = exists
        ? current.filter(x => x !== key)
        : [...current, key]

      return {
        ...prev,
        [questionId]: next,
      }
    })
  }

  function setNumericAnswer(questionId, value) {
    const cleaned = value
      .replace(',', '.')
      .replace(/[^\d.-]/g, '')
      .slice(0, 4)

    setAnswers(prev => ({
      ...prev,
      [questionId]: cleaned,
    }))
  }

  async function handleSubmit(auto = false) {
    if (submittedRef.current || submitting || questions.length === 0) return

    if (!auto) {
      const ok = window.confirm('Bạn chắc chắn muốn nộp bài?')
      if (!ok) return
    }

    submittedRef.current = true
    setSubmitting(true)

    try {
      const grade = gradeExam(questions, answers)
      const durationUsedSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000)

      const submissionData = {
        examId: exam.id,
        examTitle: exam.title,
        studentName: studentInfo.studentName,
        className: studentInfo.className,
        studentCode: studentInfo.studentCode || '',
        answers,
        score: grade.score,
        totalScore: grade.totalScore,
        displayScore: grade.displayScore,
        correctCount: grade.correctCount,
        wrongCount: grade.wrongCount,
        blankCount: grade.blankCount,
        violations,
        topicStats: grade.topicStats,
        sectionStats: grade.sectionStats,
        submittedAt: serverTimestamp(),
        durationUsedSeconds,
      }

      const ref = await addDoc(collection(db, 'submissions'), submissionData)

      onSubmit({
        id: ref.id,
        exam,
        studentInfo,
        violations,
        durationUsedSeconds,
        ...grade,
      })
    } catch (err) {
      console.error(err)
      alert('Nộp bài thất bại: ' + err.message)
      submittedRef.current = false
      setSubmitting(false)
    }
  }

  function renderAnswerArea(q) {
    const type = normalizeType(q.questionType)

    if (type === 'numeric') {
      return (
        <div>
          <label className="form-label">Nhập đáp án, tối đa 4 ký tự</label>
          <input
            className="form-input"
            value={answers[q.id] || ''}
            onChange={e => setNumericAnswer(q.id, e.target.value)}
            placeholder="Ví dụ: 25"
            inputMode="decimal"
            maxLength={4}
            style={{ maxWidth: '240px', fontSize: '1.4rem', fontWeight: 700 }}
          />
        </div>
      )
    }

    if (type === 'tf') {
      return (
        <div className="flex flex-col gap-12">
          <button
            type="button"
            className={`answer-option ${answers[q.id] === 'true' ? 'selected' : ''}`}
            onClick={() => chooseSingle(q.id, 'true')}
          >
            <span className="answer-key">Đ</span>
            <span>Đúng</span>
          </button>

          <button
            type="button"
            className={`answer-option ${answers[q.id] === 'false' ? 'selected' : ''}`}
            onClick={() => chooseSingle(q.id, 'false')}
          >
            <span className="answer-key">S</span>
            <span>Sai</span>
          </button>
        </div>
      )
    }

    if (type === 'multi') {
      const selected = normalizeMultiAnswer(answers[q.id])

      return (
        <div>
          <div className="alert alert-info mb-16">
            Chọn tất cả ý đúng. Câu này có chấm điểm từng phần theo số ý làm đúng.
          </div>

          <div className="flex flex-col gap-12">
            {OPTION_KEYS.map(key => (
              <button
                key={key}
                type="button"
                className={`answer-option ${selected.includes(key) ? 'selected' : ''}`}
                onClick={() => toggleMulti(q.id, key)}
              >
                <span className="answer-key">{key}</span>
                <span>{q[key]}</span>
              </button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-12">
        {OPTION_KEYS.map(key => (
          <button
            key={key}
            type="button"
            className={`answer-option ${answers[q.id] === key ? 'selected' : ''}`}
            onClick={() => chooseSingle(q.id, key)}
          >
            <span className="answer-key">{key}</span>
            <span>{q[key]}</span>
          </button>
        ))}
      </div>
    )
  }

  function getQuestionTypeLabel(q) {
    const type = normalizeType(q.questionType)

    if (type === 'multi') return 'Chọn nhiều'
    if (type === 'tf') return 'Đúng / Sai'
    if (type === 'numeric') return 'Nhập đáp án'
    return 'Trắc nghiệm'
  }

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <p>Đang tải đề thi...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page">
        <div className="container">
          <div className="card">
            <div className="alert alert-error mb-16">{error}</div>
            <button className="btn btn-secondary" onClick={onBack}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <div className="card text-center">
            <h2>Đề chưa có câu hỏi</h2>
            <p className="text-gray mt-8">Giáo viên cần upload Excel trước.</p>
            <button className="btn btn-secondary mt-16" onClick={onBack}>
              Quay lại
            </button>
          </div>
        </div>
      </div>
    )
  }

  const timerClass = timeLeft <= 60 ? 'danger' : timeLeft <= 300 ? 'warning' : ''

  return (
    <div>
      <header className="exam-header">
        <div>
          <strong>{exam.title}</strong>
          <div className="text-sm text-gray">
            {studentInfo.studentName} · {studentInfo.className}
          </div>
        </div>

        <div className={`timer-display ${timerClass}`}>
          {formatTime(timeLeft)}
        </div>

        <button
          className="btn btn-danger"
          onClick={() => handleSubmit(false)}
          disabled={submitting}
        >
          {submitting ? 'Đang nộp...' : 'Nộp bài'}
        </button>
      </header>

      <main className="page">
        <div className="container">
          <div className="violation-banner mb-16">
            Không chuyển tab/cửa sổ. Vi phạm 3 lần sẽ tự nộp bài. Số lần vi phạm: {violations}/3
          </div>

          <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
            <section className="card">
              <div className="flex justify-between items-center mb-16">
                <div>
                  <div className="flex gap-8 mb-8" style={{ flexWrap: 'wrap' }}>
                    <span className="badge badge-green">
                      Câu {currentIndex + 1}/{questions.length}
                    </span>
                    <span className="badge badge-blue">
                      {getQuestionTypeLabel(currentQuestion)}
                    </span>
                    <span className="badge badge-gray">
                      {currentQuestion.point || 1} điểm
                    </span>
                  </div>

                  <h2 style={{ color: 'var(--green-dark)' }}>
                    {currentQuestion?.question}
                  </h2>
                </div>
              </div>

              {renderAnswerArea(currentQuestion)}

              <div className="flex justify-between mt-24">
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                >
                  Câu trước
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
                  disabled={currentIndex === questions.length - 1}
                >
                  Câu tiếp
                </button>
              </div>
            </section>

            <aside className="card">
              <h3 className="mb-16" style={{ color: 'var(--green-dark)' }}>
                Tiến độ làm bài
              </h3>

              <p className="text-sm text-gray mb-8">
                Đã làm {answeredCount}/{questions.length} câu
              </p>

              <div className="progress-bar mb-16">
                <div
                  className="progress-fill"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>

              <div className="question-nav-grid">
                {questions.map((q, idx) => {
                  const value = answers[q.id]
                  const answered = Array.isArray(value) ? value.length > 0 : Boolean(value)

                  return (
                    <button
                      key={q.id}
                      className={`nav-btn ${answered ? 'answered' : ''} ${idx === currentIndex ? 'current' : ''}`}
                      onClick={() => setCurrentIndex(idx)}
                      type="button"
                    >
                      {idx + 1}
                    </button>
                  )
                })}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}