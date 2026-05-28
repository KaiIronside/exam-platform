// src/components/StudentHome.jsx
import { useEffect, useState } from 'react'
import {
  collection, getDocs, orderBy, query, where,
} from 'firebase/firestore'
import { db } from '../firebase'

function ImageWithFallback({ src, alt, className, fallbackText }) {
  const [errored, setErrored] = useState(false)
  if (errored) {
    return (
      <div className={`image-placeholder ${className || ''}`}>
        <span className="placeholder-icon">⚗️</span>
        <span>{fallbackText || alt}</span>
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setErrored(true)} />
}

function ChemBadge({ formula }) {
  return (
    <span className="badge badge-chem" style={{ fontSize: '0.72rem' }}>{formula}</span>
  )
}

/* ── Minigame cân bằng phương trình ── */
const QUESTIONS = [
  {
    parts: ['Fe', 'O₂', 'Fe₂O₃'],
    arrows: ['+', '→'],
    answers: [4, 3, 2],
    hint: 'Cân bằng Fe trước: vế phải 2 Fe → vế trái 4 Fe. Sau đó tính O.',
  },
  {
    parts: ['H₂', 'O₂', 'H₂O'],
    arrows: ['+', '→'],
    answers: [2, 1, 2],
    hint: '1 O₂ cho 2 O → 2 H₂O. 2 H₂O cần 4 H → 2 H₂.',
  },
  {
    parts: ['Na', 'H₂O', 'NaOH', 'H₂'],
    arrows: ['+', '→', '+'],
    answers: [2, 2, 2, 1],
    hint: '2 Na → 2 NaOH. 2 H₂O còn 2 H dư → 1 H₂.',
  },
  {
    parts: ['Al', 'HCl', 'AlCl₃', 'H₂'],
    arrows: ['+', '→', '+'],
    answers: [2, 6, 2, 3],
    hint: '2 Al → 2 AlCl₃ cần 6 Cl → 6 HCl. 6 H → 3 H₂.',
  },
  {
    parts: ['CH₄', 'O₂', 'CO₂', 'H₂O'],
    arrows: ['+', '→', '+'],
    answers: [1, 2, 1, 2],
    hint: '1 CH₄ → 1 CO₂ + 2 H₂O. Đếm O bên phải: 4 O → 2 O₂.',
  },
  {
    parts: ['N₂', 'H₂', 'NH₃'],
    arrows: ['+', '→'],
    answers: [1, 3, 2],
    hint: '1 N₂ → 2 NH₃ cần 6 H → 3 H₂.',
  },
  {
    parts: ['C', 'O₂', 'CO₂'],
    arrows: ['+', '→'],
    answers: [1, 1, 1],
    hint: 'Phản ứng đốt cháy carbon đơn giản: tỉ lệ 1:1:1.',
  },
  {
    parts: ['CaCO₃', 'CaO', 'CO₂'],
    arrows: ['→', '+'],
    answers: [1, 1, 1],
    hint: 'Phản ứng phân hủy: tỉ lệ 1:1:1, đã cân bằng ngay.',
  },
  {
    parts: ['Mg', 'O₂', 'MgO'],
    arrows: ['+', '→'],
    answers: [2, 1, 2],
    hint: 'O₂ cho 2 O → 2 MgO → cần 2 Mg.',
  },
  {
    parts: ['Zn', 'HCl', 'ZnCl₂', 'H₂'],
    arrows: ['+', '→', '+'],
    answers: [1, 2, 1, 1],
    hint: '1 Zn → 1 ZnCl₂ cần 2 Cl → 2 HCl. 2 H → 1 H₂.',
  },
]

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function BalanceGame() {
  const [order] = useState(() => shuffle(QUESTIONS.map((_, i) => i)))
  const [qIdx, setQIdx] = useState(0)
  const [vals, setVals] = useState({})
  const [result, setResult] = useState(null) // null | 'correct' | 'wrong'
  const [score, setScore] = useState({ right: 0, total: 0 })
  const [streak, setStreak] = useState(0)

  const q = QUESTIONS[order[qIdx % order.length]]

  function handleChange(i, value) {
    setVals(v => ({ ...v, [i]: value }))
  }

  function handleCheck() {
    if (result) return
    const allFilled = q.answers.every((_, i) => vals[i] && vals[i].trim() !== '')
    if (!allFilled) return
    const ok = q.answers.every((ans, i) => parseInt(vals[i]) === ans)
    setResult(ok ? 'correct' : 'wrong')
    setScore(s => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
    setStreak(s => (ok ? s + 1 : 0))
  }

  function handleNext() {
    setQIdx(i => i + 1)
    setVals({})
    setResult(null)
  }

  function getInputStyle(i) {
    if (!result) {
      return {
        width: 34, height: 34, textAlign: 'center', fontSize: 14, fontWeight: 700,
        border: '1.5px solid var(--green-border)',
        borderRadius: 6,
        background: 'white',
        color: 'var(--green-dark)',
        outline: 'none',
        fontFamily: 'var(--font-mono)',
      }
    }
    const correct = parseInt(vals[i]) === q.answers[i]
    return {
      width: 34, height: 34, textAlign: 'center', fontSize: 14, fontWeight: 700,
      border: `1.5px solid ${correct ? '#0F6E56' : '#993C1D'}`,
      borderRadius: 6,
      background: correct ? '#E1F5EE' : '#FAECE7',
      color: correct ? '#085041' : '#4A1B0C',
      outline: 'none',
      fontFamily: 'var(--font-mono)',
    }
  }

  return (
    <div>
      <div className="divider" />
      <p className="text-xs text-gray text-center mb-8" style={{ fontFamily: 'var(--font-mono)' }}>
        ⚗ Cân bằng phương trình — điền hệ số thích hợp
      </p>

      {/* Phương trình */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap', gap: 4, marginBottom: 12, fontFamily: 'var(--font-mono)',
      }}>
        {q.parts.map((part, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              min="1"
              max="20"
              value={vals[i] || ''}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
              disabled={!!result}
              placeholder="?"
              style={getInputStyle(i)}
            />
            <span style={{ fontSize: 15, color: 'var(--green-dark)', userSelect: 'none' }}>
              {part}
            </span>
            {i < q.arrows.length && (
              <span style={{
                fontSize: 15, margin: '0 2px',
                color: q.arrows[i] === '→' ? 'var(--green-mid)' : 'var(--gray-600)',
                userSelect: 'none',
              }}>
                {q.arrows[i]}
              </span>
            )}
          </span>
        ))}
      </div>

      {/* Feedback */}
      {result && (
        <div style={{
          marginBottom: 8,
          padding: '6px 10px',
          borderRadius: 6,
          background: result === 'correct' ? '#E1F5EE' : '#FAECE7',
          border: `1px solid ${result === 'correct' ? '#9FE1CB' : '#F5C4B3'}`,
        }}>
          <p style={{
            textAlign: 'center', fontSize: '0.78rem',
            fontFamily: 'var(--font-mono)', margin: 0,
            color: result === 'correct' ? '#085041' : '#993C1D',
          }}>
            {result === 'correct'
              ? `✓ Chính xác!${streak >= 2 ? ` 🔥 ${streak} liên tiếp` : ''}`
              : `✗ Đáp án: ${q.answers.join(' — ')}`}
          </p>
          {result === 'wrong' && (
            <p style={{
              textAlign: 'center', fontSize: '0.71rem',
              fontFamily: 'var(--font-mono)', margin: '4px 0 0',
              color: '#7A3820', opacity: 0.85,
            }}>
              💡 {q.hint}
            </p>
          )}
        </div>
      )}

      {/* Nút */}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 8 }}>
        {!result && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleCheck}
            disabled={!q.answers.every((_, i) => vals[i]?.trim())}
          >
            ✓ Kiểm tra
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={handleNext}>
          {result ? 'Câu tiếp →' : 'Bỏ qua'}
        </button>
      </div>

      {/* Điểm số */}
      <p className="text-xs text-gray text-center" style={{ fontFamily: 'var(--font-mono)' }}>
        Đúng: {score.right} / {score.total}
        {streak >= 3 && (
          <span style={{ marginLeft: 6, color: 'var(--green-mid)', fontWeight: 600 }}>
            🔥 {streak} streak
          </span>
        )}
      </p>
    </div>
  )
}

export default function StudentHome({ onStartExam, onAdminClick }) {
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [studentName, setStudentName] = useState('')
  const [className, setClassName] = useState('')
  const [studentCode, setStudentCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadExams() {
      setLoading(true); setError('')
      try {
        let snap
        try {
          snap = await getDocs(query(collection(db, 'exams'), where('isActive', '==', true), orderBy('createdAt', 'desc')))
        } catch {
          snap = await getDocs(query(collection(db, 'exams'), where('isActive', '==', true)))
        }
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setExams(data)
        if (data.length > 0) setSelectedExamId(data[0].id)
      } catch (err) {
        console.error(err)
        setError('Không tải được danh sách đề. Kiểm tra Firestore Rules hoặc kết nối mạng.')
      } finally {
        setLoading(false)
      }
    }
    loadExams()
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    if (!studentName.trim()) { setError('Vui lòng nhập họ tên.'); return }
    if (!className.trim()) { setError('Vui lòng nhập lớp.'); return }
    if (!selectedExamId) { setError('Vui lòng chọn đề thi.'); return }
    onStartExam(exams.find(ex => ex.id === selectedExamId), {
      studentName: studentName.trim(),
      className: className.trim(),
      studentCode: studentCode.trim(),
    })
  }

  return (
    <div className="page">
      <div className="container">

        {/* ── Hero header ── */}
        <header className="card mb-24" style={{ position: 'relative', overflow: 'hidden' }}>
          {/* SVG trang trí góc phải */}
          <svg aria-hidden="true" style={{
            position: 'absolute', right: 0, top: 0, height: '100%', width: 'auto',
            opacity: 0.07, pointerEvents: 'none',
          }} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <g fill="none" stroke="#064e3b" strokeWidth="1.5">
              <polygon points="100,10 134,30 134,70 100,90 66,70 66,30" />
              <circle cx="100" cy="50" r="22" strokeDasharray="5,4" />
              <ellipse cx="100" cy="140" rx="35" ry="14" />
              <ellipse cx="100" cy="140" rx="35" ry="14" transform="rotate(60 100 140)" />
              <ellipse cx="100" cy="140" rx="35" ry="14" transform="rotate(120 100 140)" />
              <circle cx="100" cy="140" r="5" fill="#064e3b" stroke="none" />
            </g>
          </svg>

          <div className="grid-2" style={{ alignItems: 'center', position: 'relative', zIndex: 1 }}>
            <div>
              <div className="flex items-center gap-16 mb-16">
                <div style={{ position: 'relative' }}>
                  <ImageWithFallback
                    src={`${import.meta.env.BASE_URL}logo.png`}
                    alt="Logo trường"
                    className="school-logo"
                    fallbackText=""
                  />
                  <span style={{
                    position: 'absolute', bottom: -4, right: -4,
                    background: 'white', borderRadius: '50%',
                    border: '2px solid var(--green-border)',
                    width: 22, height: 22, fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>⚗️</span>
                </div>
                <div>
                  <p className="badge badge-green mb-8">Hệ thống kiểm tra trực tuyến</p>
                  <h1 style={{ color: 'var(--green-dark)', fontSize: '2rem', lineHeight: 1.15 }}>
                    Nền tảng ôn thi Hóa học
                  </h1>
                </div>
              </div>

              <p className="text-gray mb-12">
                Chọn đề thi, nhập thông tin học sinh và bắt đầu làm bài.
                Hệ thống sẽ tự động chấm điểm và lưu kết quả sau khi nộp.
              </p>

              {/* Dải công thức trang trí */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <ChemBadge formula="H₂SO₄" />
                <ChemBadge formula="NaOH" />
                <ChemBadge formula="C₂H₅OH" />
                <ChemBadge formula="HCl" />
                <ChemBadge formula="CaCO₃" />
              </div>

              <button className="btn btn-ghost btn-sm" onClick={onAdminClick}>
                👨‍🔬 Đăng nhập giáo viên
              </button>
            </div>

            <div className="flex justify-center">
              <ImageWithFallback
                src={`${import.meta.env.BASE_URL}chemistry-hero.png`}
                alt="Minh họa hóa học"
                className="hero-illustration"
                fallbackText="Thêm ảnh tại public/chemistry-hero.png"
              />
            </div>
          </div>
        </header>

        <div className="grid-2">
          {/* ── Form làm bài ── */}
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.3rem' }}>🧪</span>
              <h2 style={{ color: 'var(--green-dark)' }}>Thông tin làm bài</h2>
            </div>

            {/* Phản ứng trang trí */}
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem',
              color: 'var(--green-mid)', opacity: 0.65,
              marginBottom: '14px', textAlign: 'center',
              borderTop: '1px dashed var(--green-border)',
              borderBottom: '1px dashed var(--green-border)',
              padding: '5px 0',
            }}>
              Zn + H₂SO₄ → ZnSO₄ + H₂↑
            </div>

            {error && (
              <div className="alert alert-error mb-16">
                <span>⚠️</span><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Họ và tên</label>
                <input className="form-input" value={studentName}
                  onChange={e => setStudentName(e.target.value)} placeholder="Nguyễn Văn A" />
              </div>
              <div className="form-group">
                <label className="form-label">Lớp</label>
                <input className="form-input" value={className}
                  onChange={e => setClassName(e.target.value)} placeholder="12A1" />
              </div>
              <div className="form-group">
                <label className="form-label">Số báo danh / Mã học sinh</label>
                <input className="form-input" value={studentCode}
                  onChange={e => setStudentCode(e.target.value)} placeholder="Không bắt buộc" />
              </div>
              <div className="form-group">
                <label className="form-label">Chọn đề thi</label>
                <select className="form-select" value={selectedExamId}
                  onChange={e => setSelectedExamId(e.target.value)}
                  disabled={loading || exams.length === 0}
                >
                  {loading && <option>Đang tải đề...</option>}
                  {!loading && exams.length === 0 && <option>Chưa có đề đang mở</option>}
                  {exams.map(exam => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title} — {exam.duration || 45} phút
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary btn-full btn-lg"
                disabled={loading || exams.length === 0}>
                🚀 Bắt đầu làm bài
              </button>
            </form>
          </section>

          {/* ── Danh sách đề ── */}
          <section className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '1.3rem' }}>📋</span>
              <h2 style={{ color: 'var(--green-dark)' }}>Danh sách đề đang mở</h2>
            </div>

            {loading ? (
              <div className="loading-container">
                <div className="loading-spinner" />
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>Đang tải danh sách đề...</p>
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center">
                <div style={{ fontSize: '3rem', marginBottom: '12px', opacity: 0.5 }}>🧫</div>
                <p className="text-gray">Hiện chưa có đề thi nào được mở.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-12">
                {exams.map(exam => (
                  <button
                    key={exam.id}
                    className={`answer-option ${selectedExamId === exam.id ? 'selected' : ''}`}
                    onClick={() => setSelectedExamId(exam.id)}
                    type="button"
                  >
                    <span className="answer-key" style={{ fontSize: '0.75rem', minWidth: 38 }}>
                      {exam.questionCount || 0}
                      <span style={{ fontSize: '0.6rem', display: 'block', fontWeight: 400 }}>câu</span>
                    </span>
                    <span style={{ textAlign: 'left' }}>
                      <strong>{exam.title}</strong>
                      <br />
                      <span className="text-sm text-gray">
                        {exam.subject || 'Hóa học'} · {exam.grade || 'THPT'} · ⏱ {exam.duration || 45} phút
                      </span>
                    </span>
                    {selectedExamId === exam.id && (
                      <span className="badge badge-chem" style={{ marginLeft: 'auto', fontSize: '0.68rem' }}>
                        Đã chọn
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── Minigame cân bằng phương trình ── */}
            <BalanceGame />
          </section>
        </div>
      </div>
    </div>
  )
}