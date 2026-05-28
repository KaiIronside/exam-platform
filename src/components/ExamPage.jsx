// src/components/ExamPage.jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc, collection, getDocs, orderBy, query,
  serverTimestamp, where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { gradeExam } from '../utils/grading'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* Label phần nhỏ trang trí đầu header */
function ChemLabel({ children }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
      color: 'var(--green-mid)', opacity: 0.75,
    }}>{children}</span>
  )
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
  const [violations, setViolations] = useState(() => Number(localStorage.getItem('exam_violations') || 0))

  const durationSeconds = (Number(exam.duration) || 45) * 60
  const [timeLeft, setTimeLeft] = useState(durationSeconds)
  const startedAtRef = useRef(Date.now())
  const submittedRef = useRef(false)

  useEffect(() => {
    async function loadQuestions() {
      setLoading(true); setError('')
      try {
        let snap
        try {
          snap = await getDocs(query(collection(db, 'questions'), where('examId', '==', exam.id), orderBy('order', 'asc')))
        } catch {
          snap = await getDocs(query(collection(db, 'questions'), where('examId', '==', exam.id)))
        }
        setQuestions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)))
      } catch (err) {
        console.error(err)
        setError('Không tải được câu hỏi. Kiểm tra Firestore Rules hoặc dữ liệu đề.')
      } finally {
        setLoading(false)
      }
    }
    loadQuestions()
  }, [exam.id])

  useEffect(() => { localStorage.setItem('exam_answers', JSON.stringify(answers)) }, [answers])
  useEffect(() => { localStorage.setItem('exam_violations', String(violations)) }, [violations])

  useEffect(() => {
    if (loading || submittedRef.current) return
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); handleSubmit(true); return 0 }
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
        if (next >= 3) setTimeout(() => handleSubmit(true), 200)
        return next
      })
    }
    function onVisibilityChange() { if (document.hidden) addViolation() }
    window.addEventListener('blur', addViolation)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('blur', addViolation)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [questions, answers])

  const currentQuestion = questions[currentIndex]
  const answeredCount = useMemo(() => Object.values(answers).filter(Boolean).length, [answers])

  function chooseAnswer(questionId, value) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
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
        examId: exam.id, examTitle: exam.title,
        studentName: studentInfo.studentName, className: studentInfo.className,
        studentCode: studentInfo.studentCode || '',
        answers, score: grade.score, totalScore: grade.totalScore,
        displayScore: grade.displayScore, correctCount: grade.correctCount,
        wrongCount: grade.wrongCount, blankCount: grade.blankCount,
        violations, topicStats: grade.topicStats, sectionStats: grade.sectionStats,
        submittedAt: serverTimestamp(), durationUsedSeconds,
      }
      const ref = await addDoc(collection(db, 'submissions'), submissionData)
      onSubmit({ id: ref.id, exam, studentInfo, violations, durationUsedSeconds, ...grade })
    } catch (err) {
      console.error(err)
      alert('Nộp bài thất bại: ' + err.message)
      submittedRef.current = false
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true" style={{ opacity: 0.3 }}>
          <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="var(--green-primary)" strokeWidth="1.3" />
          <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="var(--green-primary)" strokeWidth="1.3" transform="rotate(60 24 24)" />
          <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="var(--green-primary)" strokeWidth="1.3" transform="rotate(120 24 24)" />
          <circle cx="24" cy="24" r="3.5" fill="var(--green-primary)" />
        </svg>
        <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--green-mid)' }}>Đang tải đề thi...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page"><div className="container"><div className="card">
        <div className="alert alert-error mb-16">{error}</div>
        <button className="btn btn-secondary" onClick={onBack}>Quay lại</button>
      </div></div></div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="page"><div className="container"><div className="card text-center">
        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🧫</div>
        <h2>Đề chưa có câu hỏi</h2>
        <p className="text-gray mt-8">Giáo viên cần upload Excel trước.</p>
        <button className="btn btn-secondary mt-16" onClick={onBack}>Quay lại</button>
      </div></div></div>
    )
  }

  const timerClass = timeLeft <= 60 ? 'danger' : timeLeft <= 300 ? 'warning' : ''
  const progressPct = (answeredCount / questions.length) * 100

  return (
    <div>
      {/* ── Sticky header ── */}
      <header className="exam-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>⚗️</span>
            <strong style={{ color: 'var(--green-dark)' }}>{exam.title}</strong>
          </div>
          <div className="text-sm text-gray">
            {studentInfo.studentName} · {studentInfo.className}
          </div>
          <ChemLabel>C₆H₁₂O₆ + 6O₂ → 6CO₂ + 6H₂O</ChemLabel>
        </div>

        {/* Timer với vòng progress */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <div className={`timer-display ${timerClass}`}>{formatTime(timeLeft)}</div>
          <div style={{ width: 80, height: 4, background: 'var(--gray-200)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              width: `${(timeLeft / durationSeconds) * 100}%`,
              background: timeLeft <= 60 ? '#dc2626' : timeLeft <= 300 ? '#d97706' : 'var(--green-primary)',
              transition: 'width 1s linear',
            }} />
          </div>
        </div>

        <button className="btn btn-danger" onClick={() => handleSubmit(false)} disabled={submitting}>
          {submitting ? (
            <><span style={{
              display: 'inline-block', width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white',
              borderRadius: '50%', animation: 'spin 0.7s linear infinite',
            }} /> Đang nộp...</>
          ) : '📤 Nộp bài'}
        </button>
      </header>

      <main className="page">
        <div className="container">
          {/* Banner vi phạm */}
          {violations > 0 && (
            <div className="violation-banner mb-16">
              ⚠️ Không chuyển tab/cửa sổ trong khi thi. Vi phạm: <strong>{violations}/3</strong> lần
              {violations >= 2 && ' — Lần tiếp theo sẽ tự nộp bài!'}
            </div>
          )}
          {violations === 0 && (
            <div className="violation-banner mb-16" style={{ background: '#f0fdf4', borderColor: 'var(--green-border)', color: 'var(--green-dark)' }}>
              🔒 Không chuyển tab/cửa sổ. Vi phạm 3 lần sẽ tự nộp bài.
            </div>
          )}

          <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
            {/* ── Câu hỏi ── */}
            <section className="card">
              <div className="flex justify-between items-center mb-16">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span className="badge badge-green">Câu {currentIndex + 1}/{questions.length}</span>
                    {currentQuestion?.topic && (
                      <span className="badge badge-chem" style={{ fontSize: '0.7rem' }}>
                        {currentQuestion.topic}
                      </span>
                    )}
                    {currentQuestion?.section && (
                      <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                        {currentQuestion.section}
                      </span>
                    )}
                  </div>
                  <h2 style={{ color: 'var(--green-dark)', lineHeight: 1.45 }}>
                    {currentQuestion?.question}
                  </h2>
                </div>
              </div>

              <div className="flex flex-col gap-12">
                {['A', 'B', 'C', 'D'].map(key => (
                  <button
                    key={key}
                    type="button"
                    className={`answer-option ${answers[currentQuestion.id] === key ? 'selected' : ''}`}
                    onClick={() => chooseAnswer(currentQuestion.id, key)}
                  >
                    <span className="answer-key">{key}</span>
                    <span style={{ fontFamily: currentQuestion[key]?.match(/[A-Z][a-z]?\d*/) ? 'var(--font-mono)' : 'inherit' }}>
                      {currentQuestion[key]}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex justify-between mt-24">
                <button className="btn btn-secondary"
                  onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}>
                  ← Câu trước
                </button>
                <button className="btn btn-primary"
                  onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
                  disabled={currentIndex === questions.length - 1}>
                  Câu tiếp →
                </button>
              </div>
            </section>

            {/* ── Sidebar tiến độ ── */}
            <aside className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '1rem' }}>🧬</span>
                <h3 style={{ color: 'var(--green-dark)' }}>Tiến độ làm bài</h3>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)', fontSize: '0.8rem',
                color: 'var(--green-mid)', marginBottom: '6px',
              }}>
                <span>Đã làm</span>
                <span>{answeredCount}/{questions.length} câu</span>
              </div>
              <div className="progress-bar mb-16">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>

              {/* Stats nhỏ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div style={{
                  textAlign: 'center', background: '#ecfdf5',
                  borderRadius: 8, padding: '8px 4px',
                  border: '1px solid var(--green-border)',
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--green-primary)', fontFamily: 'var(--font-mono)' }}>
                    {answeredCount}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--gray-600)' }}>Đã trả lời</div>
                </div>
                <div style={{
                  textAlign: 'center', background: '#fef2f2',
                  borderRadius: 8, padding: '8px 4px',
                  border: '1px solid #fca5a5',
                }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#dc2626', fontFamily: 'var(--font-mono)' }}>
                    {questions.length - answeredCount}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--gray-600)' }}>Chưa làm</div>
                </div>
              </div>

              {/* Lưới câu hỏi */}
              <div className="question-nav-grid">
                {questions.map((q, idx) => (
                  <button
                    key={q.id}
                    className={`nav-btn ${answers[q.id] ? 'answered' : ''} ${idx === currentIndex ? 'current' : ''}`}
                    onClick={() => setCurrentIndex(idx)}
                    type="button"
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {/* Chú thích màu */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--gray-600)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--green-primary)' }} />
                  Đã làm
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--gray-600)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid var(--green-primary)' }} />
                  Hiện tại
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--gray-600)' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px solid var(--gray-200)' }} />
                  Chưa làm
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}