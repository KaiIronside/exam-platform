// src/components/ResultsDashboard.jsx
import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'

function toDateString(value) {
  if (!value) return ''
  if (value.toDate) return value.toDate().toLocaleString('vi-VN')
  return new Date(value).toLocaleString('vi-VN')
}

function getDisplayScore(sub) {
  if (typeof sub.displayScore === 'number') return sub.displayScore
  if (sub.totalScore > 0) return (sub.score / sub.totalScore) * 10
  return 0
}

function getGradeLabel(score) {
  if (score >= 9) return 'Xuất sắc'
  if (score >= 8) return 'Giỏi'
  if (score >= 6.5) return 'Khá'
  if (score >= 5) return 'Trung bình'
  return 'Yếu'
}

function getGradeBadgeClass(score) {
  if (score >= 9) return 'badge-green'
  if (score >= 8) return 'badge-green'
  if (score >= 6.5) return 'badge-blue'
  if (score >= 5) return 'badge-yellow'
  return 'badge-red'
}

function escapeCsv(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

export default function ResultsDashboard({ refreshKey }) {
  const [submissions, setSubmissions] = useState([])
  const [exams, setExams] = useState([])
  const [selectedExamId, setSelectedExamId] = useState('all')
  const [loading, setLoading] = useState(true)
  const [selectedSubmission, setSelectedSubmission] = useState(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        let subSnap
        try {
          subSnap = await getDocs(query(collection(db, 'submissions'), orderBy('submittedAt', 'desc')))
        } catch {
          subSnap = await getDocs(collection(db, 'submissions'))
        }
        const examSnap = await getDocs(collection(db, 'exams'))
        setSubmissions(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        setExams(examSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [refreshKey])

  const filtered = useMemo(() => {
    if (selectedExamId === 'all') return submissions
    return submissions.filter(sub => sub.examId === selectedExamId)
  }, [submissions, selectedExamId])

  function exportCsv() {
    const headers = ['Thời gian','Họ tên','Lớp','SBD/Mã HS','Đề thi','Điểm /10','Xếp loại','Câu đúng','Câu sai','Bỏ trống','Vi phạm']
    const rows = filtered.map(sub => {
      const score = getDisplayScore(sub)
      return [toDateString(sub.submittedAt), sub.studentName, sub.className, sub.studentCode, sub.examTitle, score.toFixed(1), getGradeLabel(score), sub.correctCount, sub.wrongCount, sub.blankCount, sub.violations]
    })
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ket-qua-thi.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="card">
      <div className="flex justify-between items-center gap-16 mb-16" style={{ flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.1rem' }}>📊</span>
            <h2 style={{ color: 'var(--green-dark)' }}>Kết quả học sinh</h2>
          </div>
          <p className="text-sm text-gray">Xem, lọc và xuất kết quả bài làm.</p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--green-mid)', opacity: 0.7, marginTop: '2px' }}>
            n(HS) = {filtered.length} · x̄ = {filtered.length ? (filtered.reduce((a, s) => a + getDisplayScore(s), 0) / filtered.length).toFixed(2) : '—'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={exportCsv} disabled={filtered.length === 0}>
          📥 Xuất CSV
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">Lọc theo đề</label>
        <select className="form-select" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}>
          <option value="all">Tất cả đề ({submissions.length} bài)</option>
          {exams.map(exam => (
            <option key={exam.id} value={exam.id}>{exam.title}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--green-mid)' }}>
            Đang tải kết quả...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="alert alert-info" style={{ fontFamily: 'var(--font-mono)' }}>
          🧫 Chưa có bài nộp nào.
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Họ tên</th>
                <th>Lớp</th>
                <th>SBD</th>
                <th>Đề</th>
                <th>Điểm</th>
                <th>Xếp loại</th>
                <th>Vi phạm</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(sub => {
                const score = getDisplayScore(sub)
                return (
                  <tr key={sub.id} onClick={() => setSelectedSubmission(sub)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{toDateString(sub.submittedAt)}</td>
                    <td><strong>{sub.studentName}</strong></td>
                    <td><span className="badge badge-chem" style={{ fontSize: '0.68rem' }}>{sub.className}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{sub.studentCode || '—'}</td>
                    <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{sub.examTitle}</td>
                    <td>
                      <strong style={{
                        fontFamily: 'var(--font-mono)', fontSize: '1rem',
                        color: score >= 8 ? 'var(--green-primary)' : score >= 5 ? '#d97706' : '#dc2626',
                      }}>{score.toFixed(1)}</strong>
                    </td>
                    <td><span className={`badge ${getGradeBadgeClass(score)}`}>{getGradeLabel(score)}</span></td>
                    <td>
                      {sub.violations > 0
                        ? <span className="badge badge-red">{sub.violations}</span>
                        : <span style={{ color: 'var(--gray-400)' }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Chi tiết bài nộp ── */}
      {selectedSubmission && (
        <div className="card card-sm mt-24" style={{
          border: '1px solid var(--green-border)',
          background: '#f0fdf4',
        }}>
          <div className="flex justify-between gap-12 mb-16">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem' }}>🔬</span>
                <h3 style={{ color: 'var(--green-dark)' }}>
                  Chi tiết: {selectedSubmission.studentName}
                </h3>
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--green-mid)', marginTop: '2px' }}>
                {selectedSubmission.className} · {selectedSubmission.examTitle} · Điểm: {getDisplayScore(selectedSubmission).toFixed(1)}
              </p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedSubmission(null)}>
              ✕ Đóng
            </button>
          </div>

          <div className="grid-2">
            <div>
              <h4 className="mb-8" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green-dark)' }}>
                📌 Theo chủ đề
              </h4>
              {Object.keys(selectedSubmission.topicStats || {}).length === 0
                ? <p className="text-sm text-gray">Không có dữ liệu.</p>
                : Object.entries(selectedSubmission.topicStats || {}).map(([topic, stat]) => {
                    const percent = stat.total ? (stat.correct / stat.total) * 100 : 0
                    return (
                      <div key={topic} className="mb-16">
                        <div className="flex justify-between text-sm mb-8">
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{topic}</span>
                          <strong style={{ fontFamily: 'var(--font-mono)' }}>{stat.correct}/{stat.total}</strong>
                        </div>
                        <div className="progress-bar">
                          <div
                            className={percent >= 80 ? 'progress-fill' : percent >= 50 ? 'progress-fill progress-fill-yellow' : 'progress-fill progress-fill-red'}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
              }
            </div>

            <div>
              <h4 className="mb-8" style={{ fontFamily: 'var(--font-mono)', color: 'var(--green-dark)' }}>
                📌 Theo phần
              </h4>
              {Object.keys(selectedSubmission.sectionStats || {}).length === 0
                ? <p className="text-sm text-gray">Không có dữ liệu.</p>
                : Object.entries(selectedSubmission.sectionStats || {}).map(([section, stat]) => {
                    const percent = stat.total ? (stat.correct / stat.total) * 100 : 0
                    return (
                      <div key={section} className="mb-16">
                        <div className="flex justify-between text-sm mb-8">
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{section}</span>
                          <strong style={{ fontFamily: 'var(--font-mono)' }}>{stat.correct}/{stat.total}</strong>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })
              }
            </div>
          </div>
        </div>
      )}
    </section>
  )
}