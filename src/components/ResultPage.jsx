// src/components/ResultPage.jsx
import { classifyTopics, formatScore, getGrade } from '../utils/grading'

const OPTION_KEYS = ['A', 'B', 'C', 'D']

function ResultGroup({ title, items, emptyText }) {
  return (
    <div className="card card-sm card-flat">
      <h3 className="mb-12" style={{ color: 'var(--green-dark)' }}>
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-gray">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-8">
          {items.map(item => (
            <div key={item.topic}>
              <div className="flex justify-between text-sm mb-8">
                <strong>{item.topic}</strong>
                <span>{Math.round(item.pct)}%</span>
              </div>

              <div className="progress-bar">
                <div
                  className={
                    item.pct >= 80
                      ? 'progress-fill'
                      : item.pct >= 50
                        ? 'progress-fill progress-fill-yellow'
                        : 'progress-fill progress-fill-red'
                  }
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

function formatStudentAnswer(q) {
  if (q.questionType === 'multi') {
    return Array.isArray(q.studentAnswer) && q.studentAnswer.length > 0
      ? q.studentAnswer.join(', ')
      : 'Không chọn'
  }

  if (q.questionType === 'tf') {
    if (q.studentAnswer === 'true') return 'Đúng'
    if (q.studentAnswer === 'false') return 'Sai'
    return 'Không chọn'
  }

  return q.studentAnswer || 'Không chọn'
}

function formatCorrectAnswer(q) {
  if (q.questionType === 'multi') {
    return Array.isArray(q.correctList) ? q.correctList.join(', ') : q.correct
  }

  if (q.questionType === 'tf') {
    return q.correct === 'true' ? 'Đúng' : 'Sai'
  }

  return q.correct
}

function renderReviewOptions(q) {
  if (q.questionType === 'numeric') {
    return (
      <div className="grid-2">
        <div className="card card-sm card-flat">
          <p className="text-sm text-gray">Đáp án của bạn</p>
          <strong className={q.isCorrect ? 'text-green' : 'text-red'}>
            {formatStudentAnswer(q)}
          </strong>
        </div>

        <div className="card card-sm card-flat">
          <p className="text-sm text-gray">Đáp án đúng</p>
          <strong>{formatCorrectAnswer(q)}</strong>
        </div>
      </div>
    )
  }

  if (q.questionType === 'tf') {
    return (
      <div className="flex flex-col gap-8">
        {[
          { key: 'true', label: 'Đúng', viewKey: 'Đ' },
          { key: 'false', label: 'Sai', viewKey: 'S' },
        ].map(opt => {
          const isCorrect = q.correct === opt.key
          const isStudent = q.studentAnswer === opt.key

          const className = isCorrect
            ? 'answer-option show-correct'
            : isStudent && !isCorrect
              ? 'answer-option wrong'
              : 'answer-option'

          return (
            <div key={opt.key} className={className}>
              <span className="answer-key">{opt.viewKey}</span>
              <span>{opt.label}</span>
            </div>
          )
        })}
      </div>
    )
  }

  if (q.questionType === 'multi') {
    const correctSet = new Set(q.correctList || [])
    const selectedSet = new Set(Array.isArray(q.studentAnswer) ? q.studentAnswer : [])

    return (
      <div className="flex flex-col gap-8">
        {OPTION_KEYS.map(key => {
          const shouldSelect = correctSet.has(key)
          const didSelect = selectedSet.has(key)

          let className = 'answer-option'

          if (shouldSelect && didSelect) {
            className = 'answer-option show-correct'
          } else if (!shouldSelect && didSelect) {
            className = 'answer-option wrong'
          } else if (shouldSelect && !didSelect) {
            className = 'answer-option show-correct'
          }

          return (
            <div key={key} className={className}>
              <span className="answer-key">{key}</span>
              <span>{q[key]}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {OPTION_KEYS.map(key => {
        const className =
          key === q.correct
            ? 'answer-option show-correct'
            : key === q.studentAnswer && key !== q.correct
              ? 'answer-option wrong'
              : 'answer-option'

        return (
          <div key={key} className={className}>
            <span className="answer-key">{key}</span>
            <span>{q[key]}</span>
          </div>
        )
      })}
    </div>
  )
}

function getTypeLabel(type) {
  if (type === 'multi') return 'Chọn nhiều'
  if (type === 'tf') return 'Đúng / Sai'
  if (type === 'numeric') return 'Nhập đáp án'
  return 'Trắc nghiệm'
}

export default function ResultPage({ result, onBackHome }) {
  const grade = getGrade(result.displayScore)
  const topicGroups = classifyTopics(result.topicStats || {})

  return (
    <div className="page">
      <div className="container">
        <section className="card mb-24">
          <div className="grid-2" style={{ alignItems: 'center' }}>
            <div className="text-center">
              <div className={`score-circle ${grade.cssClass}`}>
                <div className="score-number">{formatScore(result.displayScore)}</div>
                <div className="score-denom">/10</div>
              </div>

              <h1 className="mt-16" style={{ color: grade.color }}>
                {grade.label}
              </h1>

              <p className="text-gray mt-8">
                {result.studentInfo?.studentName} · {result.studentInfo?.className}
              </p>
            </div>

            <div>
              <h2 style={{ color: 'var(--green-dark)' }}>
                {result.exam?.title}
              </h2>

              <p className="text-gray mt-8">
                Kết quả đã được lưu vào hệ thống.
              </p>

              <div className="stats-grid mt-24">
                <div className="card card-sm stat-card">
                  <div className="stat-value">{result.correctCount}</div>
                  <div className="stat-label">Câu đúng hoàn toàn</div>
                </div>

                <div className="card card-sm stat-card">
                  <div className="stat-value">{result.wrongCount}</div>
                  <div className="stat-label">Câu chưa đúng</div>
                </div>

                <div className="card card-sm stat-card">
                  <div className="stat-value">{result.blankCount}</div>
                  <div className="stat-label">Bỏ trống</div>
                </div>

                <div className="card card-sm stat-card">
                  <div className="stat-value">{result.violations}</div>
                  <div className="stat-label">Vi phạm</div>
                </div>
              </div>

              <div className="flex gap-12 mt-24 no-print">
                <button className="btn btn-primary" onClick={onBackHome}>
                  Về trang chọn đề
                </button>

                <button className="btn btn-secondary" onClick={() => window.print()}>
                  In kết quả
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid-3 mb-24">
          <ResultGroup
            title="Điểm mạnh"
            items={topicGroups.strong}
            emptyText="Chưa có chủ đề nào đạt trên 80%."
          />

          <ResultGroup
            title="Cần luyện thêm"
            items={topicGroups.needPractice}
            emptyText="Không có chủ đề ở mức trung bình."
          />

          <ResultGroup
            title="Cần ôn gấp"
            items={topicGroups.needReview}
            emptyText="Không có chủ đề yếu."
          />
        </section>

        <section className="card">
          <h2 className="mb-16" style={{ color: 'var(--green-dark)' }}>
            Xem lại bài làm
          </h2>

          <div className="flex flex-col gap-16">
            {result.questionResults?.map((q, idx) => (
              <div key={q.questionId} className="card card-sm card-flat">
                <div className="flex justify-between gap-12 mb-12">
                  <div>
                    <div className="flex gap-8 mb-8" style={{ flexWrap: 'wrap' }}>
                      <span className="badge badge-blue">
                        {getTypeLabel(q.questionType)}
                      </span>

                      <span className="badge badge-gray">
                        {q.earned}/{q.point} điểm
                      </span>

                      {q.questionType === 'multi' && (
                        <span className="badge badge-purple">
                          Đúng {q.detail?.correctOptionCount || 0}/4 ý
                        </span>
                      )}
                    </div>

                    <strong>Câu {idx + 1}: {q.question}</strong>
                  </div>

                  <span className={`badge ${q.isCorrect ? 'badge-green' : q.isBlank ? 'badge-yellow' : 'badge-red'}`}>
                    {q.isCorrect ? 'Đúng hoàn toàn' : q.isBlank ? 'Bỏ trống' : 'Chưa đúng'}
                  </span>
                </div>

                {renderReviewOptions(q)}

                <p className="text-sm text-gray mt-12">
                  Đáp án của bạn: <strong>{formatStudentAnswer(q)}</strong> ·
                  Đáp án đúng: <strong>{formatCorrectAnswer(q)}</strong>
                </p>

                {q.explanation && (
                  <div className="alert alert-info mt-16">
                    {q.explanation}
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