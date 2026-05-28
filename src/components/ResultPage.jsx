// src/components/ResultPage.jsx
import { classifyTopics, formatScore, getGrade } from '../utils/grading'

function pct(correct, total) {
  if (!total) return 0
  return Math.round((correct / total) * 100)
}

/* Nhãn nhỏ phân loại chủ đề hoá học */
function TopicBar({ title, items, emptyText, accent }) {
  const colors = {
    strong:      { bg: '#ecfdf5', border: 'var(--green-border)', head: '#15803d', fill: 'progress-fill' },
    needPractice:{ bg: '#fffbeb', border: '#fcd34d', head: '#d97706', fill: 'progress-fill progress-fill-yellow' },
    needReview:  { bg: '#fef2f2', border: '#fca5a5', head: '#dc2626', fill: 'progress-fill progress-fill-red' },
  }
  const c = colors[accent] || colors.strong

  return (
    <div className="card card-sm card-flat" style={{ background: c.bg, borderColor: c.border }}>
      <h3 className="mb-12" style={{ color: c.head }}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {items.map(item => (
            <div key={item.topic}>
              <div className="flex justify-between text-sm mb-8">
                <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{item.topic}</strong>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(item.pct)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className={item.pct >= 80 ? 'progress-fill' : item.pct >= 50 ? 'progress-fill progress-fill-yellow' : 'progress-fill progress-fill-red'}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* Phần tử trang trí bảng tuần hoàn mini dựa trên điểm */
function ScoreElement({ score }) {
  // Ánh xạ điểm → nguyên tố hoá học theo phong cách vui
  const el =
    score >= 9   ? { sym: 'Au', name: 'Vàng',    z: 79, color: '#fef3c7', border: '#fbbf24', text: '#92400e' } :
    score >= 8   ? { sym: 'Ag', name: 'Bạc',     z: 47, color: '#f3f4f6', border: '#d1d5db', text: '#374151' } :
    score >= 6.5 ? { sym: 'Cu', name: 'Đồng',    z: 29, color: '#fef3c7', border: '#f59e0b', text: '#92400e' } :
    score >= 5   ? { sym: 'Fe', name: 'Sắt',     z: 26, color: '#dbeafe', border: '#93c5fd', text: '#1e40af' } :
                   { sym: 'Pb', name: 'Chì',     z: 82, color: '#f3f4f6', border: '#9ca3af', text: '#6b7280' }

  return (
    <div style={{
      width: 60, height: 60, margin: '0 auto 8px',
      background: el.color, border: `2px solid ${el.border}`,
      borderRadius: 10, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: '0.55rem', color: el.text, fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>{el.z}</span>
      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: el.text, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{el.sym}</span>
      <span style={{ fontSize: '0.42rem', color: el.text, lineHeight: 1.4 }}>{el.name}</span>
    </div>
  )
}

export default function ResultPage({ result, onBackHome }) {
  const grade = getGrade(result.displayScore)
  const topicGroups = classifyTopics(result.topicStats || {})

  return (
    <div className="page">
      <div className="container">

        {/* ── Điểm + tổng quan ── */}
        <section className="card mb-24">
          <div className="grid-2" style={{ alignItems: 'center' }}>
            <div className="text-center">
              {/* Nguyên tố tương ứng điểm */}
              <ScoreElement score={result.displayScore} />

              <div className={`score-circle ${grade.cssClass}`}>
                <div className="score-number">{formatScore(result.displayScore)}</div>
                <div className="score-denom">/10</div>
              </div>

              <h1 className="mt-16" style={{ color: grade.color }}>{grade.label}</h1>

              <p className="text-gray mt-8" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                {result.studentInfo?.studentName} · {result.studentInfo?.className}
              </p>

              {/* Phản ứng trang trí dựa trên kết quả */}
              <p style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                color: 'var(--green-mid)', marginTop: '8px', opacity: 0.7,
              }}>
                {result.displayScore >= 8
                  ? 'Au³⁺ + 3e⁻ → Au ✓'
                  : result.displayScore >= 5
                  ? 'Fe²⁺ + 2e⁻ → Fe'
                  : 'Pb²⁺ + 2e⁻ → Pb'}
              </p>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>⚗️</span>
                <h2 style={{ color: 'var(--green-dark)' }}>{result.exam?.title}</h2>
              </div>
              <p className="text-gray mt-8">
                Kết quả đã được lưu vào hệ thống.
              </p>

              {/* Phân chia điểm dạng công thức */}
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
                background: '#ecfdf5', border: '1px solid var(--green-border)',
                borderRadius: 8, padding: '8px 12px', margin: '12px 0',
                color: 'var(--green-dark)',
              }}>
                Đúng: {result.correctCount} × {result.exam?.pointPerQuestion || 0.25}đ
                = {(result.correctCount * (result.exam?.pointPerQuestion || 0.25)).toFixed(2)}đ
              </div>

              <div className="stats-grid mt-16">
                {[
                  { val: result.correctCount, label: 'Câu đúng', color: '#ecfdf5', border: 'var(--green-border)', text: 'var(--green-primary)' },
                  { val: result.wrongCount,   label: 'Câu sai',  color: '#fef2f2', border: '#fca5a5',            text: '#dc2626' },
                  { val: result.blankCount,   label: 'Bỏ trống', color: '#fffbeb', border: '#fcd34d',            text: '#d97706' },
                  { val: result.violations,   label: 'Vi phạm',  color: '#f3f4f6', border: '#d1d5db',            text: '#6b7280' },
                ].map(s => (
                  <div key={s.label} className="card card-sm stat-card" style={{
                    background: s.color, borderColor: s.border,
                  }}>
                    <div className="stat-value" style={{ color: s.text, fontFamily: 'var(--font-mono)' }}>{s.val}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-12 mt-24 no-print">
                <button className="btn btn-primary" onClick={onBackHome}>
                  🏠 Về trang chọn đề
                </button>
                <button className="btn btn-secondary" onClick={() => window.print()}>
                  🖨️ In kết quả
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Phân tích theo chủ đề ── */}
        <section className="grid-3 mb-24">
          <TopicBar accent="strong"       title="💪 Điểm mạnh"      items={topicGroups.strong}      emptyText="Chưa có chủ đề nào đạt trên 80%." />
          <TopicBar accent="needPractice" title="📖 Cần luyện thêm" items={topicGroups.needPractice} emptyText="Không có chủ đề ở mức trung bình." />
          <TopicBar accent="needReview"   title="🔥 Cần ôn gấp"     items={topicGroups.needReview}   emptyText="Không có chủ đề yếu." />
        </section>

        {/* ── Xem lại bài làm ── */}
        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.2rem' }}>🔬</span>
            <h2 style={{ color: 'var(--green-dark)' }}>Xem lại bài làm</h2>
          </div>

          <div className="flex flex-col gap-16">
            {result.questionResults?.map((q, idx) => (
              <div key={q.questionId} className="card card-sm card-flat" style={{
                borderLeft: `4px solid ${q.isCorrect ? '#22c55e' : q.isBlank ? '#fcd34d' : '#dc2626'}`,
              }}>
                <div className="flex justify-between gap-12 mb-12">
                  <strong>Câu {idx + 1}: {q.question}</strong>
                  <span className={`badge ${q.isCorrect ? 'badge-green' : q.isBlank ? 'badge-yellow' : 'badge-red'}`}>
                    {q.isCorrect ? '✓ Đúng' : q.isBlank ? '— Bỏ trống' : '✗ Sai'}
                  </span>
                </div>

                <div className="flex flex-col gap-8">
                  {['A', 'B', 'C', 'D'].map(key => {
                    const cls =
                      key === q.correct ? 'answer-option show-correct' :
                      key === q.studentAnswer && key !== q.correct ? 'answer-option wrong' :
                      'answer-option'
                    return (
                      <div key={key} className={cls}>
                        <span className="answer-key">{key}</span>
                        <span style={{ fontFamily: q[key]?.match(/[A-Z][a-z]?\d*/) ? 'var(--font-mono)' : 'inherit', fontSize: '0.93rem' }}>
                          {q[key]}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <p className="text-sm text-gray mt-12" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                  Bài làm: <strong>{q.studentAnswer || '—'}</strong>
                  {' · '}Đáp án đúng: <strong style={{ color: '#15803d' }}>{q.correct}</strong>
                </p>

                {q.explanation && (
                  <div className="alert alert-info mt-16" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                    💡 {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}