// src/components/ExamReview.jsx
import { useEffect, useMemo, useState } from 'react'
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'

const OPTION_KEYS = ['A', 'B', 'C', 'D']

function getDateText(value) {
  if (!value) return '—'
  if (value.toDate) return value.toDate().toLocaleString('vi-VN')
  return new Date(value).toLocaleString('vi-VN')
}

function normalizeType(value) {
  return String(value || 'mcq').trim().toLowerCase()
}

function getTypeLabel(type) {
  const t = normalizeType(type)

  if (t === 'mcq') return 'Trắc nghiệm'
  if (t === 'multi') return 'Chọn nhiều'
  if (t === 'tf') return 'Đúng / Sai'
  if (t === 'numeric') return 'Nhập số'

  return t || 'Không rõ'
}

function getCorrectText(q) {
  const type = normalizeType(q.questionType)

  if (type === 'tf') {
    const value = String(q.correct || '').toLowerCase()
    if (value === 'true') return 'Đúng'
    if (value === 'false') return 'Sai'
    return q.correct || '—'
  }

  if (type === 'numeric') {
    return String(q.correct || '—')
  }

  if (type === 'multi') {
    const list = Array.isArray(q.correctList) && q.correctList.length > 0
      ? q.correctList
      : String(q.correct || '')
          .toUpperCase()
          .split(/[,\s;|/]+/)
          .map(x => x.trim())
          .filter(Boolean)

    if (list.length === 0) return '—'

    return list
      .map(key => {
        const text = q[key] || ''
        return text ? `${key}. ${text}` : key
      })
      .join('; ')
  }

  const key = String(q.correct || '').toUpperCase().trim()
  const text = q[key] || ''

  if (!key) return '—'
  return text ? `${key}. ${text}` : key
}

function getPartialMapText(map) {
  if (!map || typeof map !== 'object') return '—'

  const parts = []

  for (let i = 0; i <= 4; i++) {
    const value = map[i] ?? map[String(i)]
    if (value !== undefined && value !== null && value !== '') {
      parts.push(`${i}:${value}`)
    }
  }

  return parts.length > 0 ? parts.join(', ') : '—'
}

function getPoint(q) {
  const n = Number(q.point)
  return Number.isNaN(n) ? 1 : n
}

export default function ExamReview({ exam, onClose }) {
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState('all')

  async function loadQuestions() {
    if (!exam?.id) return

    setLoading(true)
    setError('')

    try {
      let snap

      try {
        snap = await getDocs(
          query(
            collection(db, 'questionsPrivate'),
            where('examId', '==', exam.id),
            orderBy('order', 'asc')
          )
        )
      } catch (err) {
        console.warn('Query with orderBy failed, fallback to unsorted query:', err)

        snap = await getDocs(
          query(
            collection(db, 'questionsPrivate'),
            where('examId', '==', exam.id)
          )
        )
      }

      const rows = snap.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      setQuestions(rows)
    } catch (err) {
      console.error(err)
      setError('Không tải được nội dung đề: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [exam?.id])

  const stats = useMemo(() => {
    const total = questions.length
    const totalPoint = questions.reduce((sum, q) => sum + getPoint(q), 0)
    const withExplanation = questions.filter(q => String(q.explanation || '').trim()).length
    const withoutExplanation = total - withExplanation

    const byType = questions.reduce((acc, q) => {
      const type = normalizeType(q.questionType)
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    return {
      total,
      totalPoint,
      withExplanation,
      withoutExplanation,
      byType,
    }
  }, [questions])

  const filteredQuestions = useMemo(() => {
    const kw = keyword.trim().toLowerCase()

    return questions.filter(q => {
      const type = normalizeType(q.questionType)

      if (filter !== 'all' && type !== filter) {
        return false
      }

      if (!kw) return true

      const haystack = [
        q.question,
        q.A,
        q.B,
        q.C,
        q.D,
        q.correct,
        q.topic,
        q.section,
        q.explanation,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(kw)
    })
  }, [questions, keyword, filter])

  if (!exam) return null

  return (
    <section className="card mt-24">
      <div className="flex justify-between items-center gap-16 mb-16" style={{ flexWrap: 'wrap' }}>
        <div>
          <p className="badge badge-green mb-8">Xem lại đề đã upload</p>
          <h2 style={{ color: 'var(--green-dark)' }}>
            {exam.title || 'Đề chưa có tên'}
          </h2>

          <p className="text-sm text-gray mt-8">
            Xem nội dung đề, đáp án đúng và explanation đã lưu trong questionsPrivate.
          </p>
        </div>

        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={loadQuestions} disabled={loading}>
            Tải lại đề
          </button>

          <button className="btn btn-danger" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>

      <div className="grid-3 mb-16">
        <div className="card card-sm card-flat">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Tổng số câu</div>
        </div>

        <div className="card card-sm card-flat">
          <div className="stat-value">{stats.totalPoint.toFixed(2)}</div>
          <div className="stat-label">Tổng điểm gốc</div>
        </div>

        <div className="card card-sm card-flat">
          <div className="stat-value">{stats.withExplanation}/{stats.total}</div>
          <div className="stat-label">Có explanation</div>
        </div>
      </div>

      <div className="grid-2 mb-16">
        <div className="card card-sm card-flat">
          <h3 className="mb-12" style={{ color: 'var(--green-dark)' }}>
            Thông tin đề
          </h3>

          <div className="table-container">
            <table>
              <tbody>
                <tr>
                  <td><strong>Môn</strong></td>
                  <td>{exam.subject || 'Hóa học'}</td>
                </tr>

                <tr>
                  <td><strong>Khối</strong></td>
                  <td>{exam.grade || 'THPT'}</td>
                </tr>

                <tr>
                  <td><strong>Thời gian</strong></td>
                  <td>{exam.duration || 0} phút</td>
                </tr>

                <tr>
                  <td><strong>Ngày tạo</strong></td>
                  <td>{getDateText(exam.createdAt)}</td>
                </tr>

                <tr>
                  <td><strong>Trạng thái</strong></td>
                  <td>
                    <span className={`badge ${exam.isActive ? 'badge-green' : 'badge-gray'}`}>
                      {exam.isActive ? 'Đang mở' : 'Đã khóa'}
                    </span>
                  </td>
                </tr>

                <tr>
                  <td><strong>Xem lại bài</strong></td>
                  <td>
                    <span className={`badge ${exam.allowReview === true ? 'badge-green' : 'badge-red'}`}>
                      {exam.allowReview === true ? 'Cho xem' : 'Không cho xem'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card card-sm card-flat">
          <h3 className="mb-12" style={{ color: 'var(--green-dark)' }}>
            Cơ cấu câu hỏi
          </h3>

          <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
            <span className="badge badge-green">MCQ: {stats.byType.mcq || 0}</span>
            <span className="badge badge-green">Multi: {stats.byType.multi || 0}</span>
            <span className="badge badge-green">True/False: {stats.byType.tf || 0}</span>
            <span className="badge badge-green">Numeric: {stats.byType.numeric || 0}</span>
            <span className="badge badge-red">Thiếu explanation: {stats.withoutExplanation}</span>
          </div>

          <div className="alert alert-info mt-16">
            Dữ liệu này chỉ dành cho giáo viên vì có đáp án đúng và explanation private.
          </div>
        </div>
      </div>

      <div className="card card-sm card-flat mb-16">
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Tìm kiếm trong đề</label>
            <input
              className="form-input"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="Nhập từ khóa, đáp án, topic, explanation..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Lọc loại câu</label>
            <select
              className="form-input"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="mcq">Trắc nghiệm</option>
              <option value="multi">Chọn nhiều</option>
              <option value="tf">Đúng / Sai</option>
              <option value="numeric">Nhập số</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-16">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Đang tải câu hỏi private...</p>
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="alert alert-warning">
          Không có câu hỏi nào khớp bộ lọc.
        </div>
      ) : (
        <div className="flex flex-col gap-16">
          {filteredQuestions.map((q, index) => {
            const type = normalizeType(q.questionType)
            const explanation = String(q.explanation || '').trim()

            return (
              <article
                key={q.id}
                className="card card-sm"
                style={{
                  borderLeft: '5px solid var(--green-primary)',
                }}
              >
                <div className="flex justify-between items-center gap-12 mb-12" style={{ flexWrap: 'wrap' }}>
                  <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                    <span className="badge badge-green">
                      Câu {q.order || index + 1}
                    </span>

                    <span className="badge badge-gray">
                      {getTypeLabel(type)}
                    </span>

                    <span className="badge badge-gray">
                      {getPoint(q)} điểm
                    </span>

                    <span className="badge badge-gray">
                      {q.section || 'Chưa có section'}
                    </span>

                    <span className="badge badge-gray">
                      {q.topic || 'Chưa có topic'}
                    </span>
                  </div>

                  {explanation ? (
                    <span className="badge badge-green">Có explanation</span>
                  ) : (
                    <span className="badge badge-red">Thiếu explanation</span>
                  )}
                </div>

                <h3
                  className="mb-16"
                  style={{
                    color: 'var(--gray-800)',
                    lineHeight: 1.5,
                  }}
                >
                  {q.question || 'Câu hỏi trống'}
                </h3>

                {(type === 'mcq' || type === 'multi') && (
                  <div className="grid-2 mb-16">
                    {OPTION_KEYS.map(key => {
                      const text = q[key] || ''
                      const correctRaw = String(q.correct || '').toUpperCase()
                      const correctList = Array.isArray(q.correctList) && q.correctList.length > 0
                        ? q.correctList.map(x => String(x).toUpperCase())
                        : correctRaw
                            .split(/[,\s;|/]+/)
                            .map(x => x.trim())
                            .filter(Boolean)

                      const isCorrectOption = correctList.includes(key)

                      return (
                        <div
                          key={key}
                          className="answer-option"
                          style={{
                            cursor: 'default',
                            borderColor: isCorrectOption
                              ? 'var(--green-primary)'
                              : 'var(--green-border)',
                            background: isCorrectOption
                              ? 'rgba(34, 197, 94, 0.08)'
                              : 'rgba(255,255,255,0.92)',
                          }}
                        >
                          <span className="answer-key">{key}</span>
                          <span>
                            {text || <em className="text-gray">Không có nội dung</em>}
                          </span>

                          {isCorrectOption && (
                            <span className="badge badge-green" style={{ marginLeft: 'auto' }}>
                              Đúng
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="table-container mb-16">
                  <table>
                    <tbody>
                      <tr>
                        <td><strong>Đáp án đúng</strong></td>
                        <td style={{ color: 'var(--green-dark)', fontWeight: 700 }}>
                          {getCorrectText(q)}
                        </td>
                      </tr>

                      <tr>
                        <td><strong>questionType</strong></td>
                        <td>{type}</td>
                      </tr>

                      <tr>
                        <td><strong>partialMode</strong></td>
                        <td>{q.partialMode || 'none'}</td>
                      </tr>

                      <tr>
                        <td><strong>partialScoreMap</strong></td>
                        <td>{getPartialMapText(q.partialScoreMap)}</td>
                      </tr>

                      <tr>
                        <td><strong>Document ID</strong></td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                          {q.id}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div
                  className={`alert ${explanation ? 'alert-info' : 'alert-warning'}`}
                  style={{
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <strong>AI explanation:</strong>
                    <p className="mt-8">
                      {explanation || 'Chưa có explanation cho câu này.'}
                    </p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}