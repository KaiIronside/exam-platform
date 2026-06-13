// src/components/ExamUpload.jsx
import { useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../firebase'
import { parseExcelFile } from '../utils/excelParser'

const COLUMNS = [
  { col: 'question', desc: 'Nội dung câu hỏi', req: true },
  { col: 'questionType', desc: 'mcq / multi / tf / numeric', req: false },
  { col: 'A', desc: 'Đáp án A', req: false },
  { col: 'B', desc: 'Đáp án B', req: false },
  { col: 'C', desc: 'Đáp án C', req: false },
  { col: 'D', desc: 'Đáp án D', req: false },
  { col: 'correct', desc: 'Đáp án đúng', req: true },
  { col: 'section', desc: 'Phần I, II...', req: false },
  { col: 'topic', desc: 'Este, Amin...', req: false },
  { col: 'explanation', desc: 'Giải thích đáp án', req: false },
  { col: 'point', desc: '0.25 / 1 / 2...', req: false },
  { col: 'partialMode', desc: 'none / custom / linear / all-or-nothing', req: false },
  { col: 'partialScoreMap', desc: '0:0,1:0.1,2:0.25,3:0.5,4:1', req: false },
]

function normalizeQuestionForAI(q) {
  return {
    question: q.question || '',
    questionType: q.questionType || 'mcq',
    A: q.A || '',
    B: q.B || '',
    C: q.C || '',
    D: q.D || '',
    correct: q.correct || '',
    correctList: q.correctList || [],
    topic: q.topic || '',
    section: q.section || '',
  }
}

export default function ExamUpload({ user, onUploaded }) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState('Hóa học')
  const [grade, setGrade] = useState('THPT')
  const [duration, setDuration] = useState(45)
  const [isActive, setIsActive] = useState(true)
  const [allowReview, setAllowReview] = useState(true)
  const [generateAiExplanations, setGenerateAiExplanations] = useState(false)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState([])
  const [progress, setProgress] = useState('')

  const fileInputRef = useRef(null)

  async function enrichQuestionsWithAI(questions) {
    if (!generateAiExplanations) {
      return questions
    }

    const generateExplanation = httpsCallable(functions, 'generateQuestionExplanation')
    const result = []

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const existingExplanation = String(q.explanation || '').trim()

      if (existingExplanation) {
        result.push(q)
        continue
      }

      setProgress(`AI đang tạo giải thích câu ${i + 1}/${questions.length}...`)

      try {
        const res = await generateExplanation({
          question: normalizeQuestionForAI(q),
        })

        const explanation = String(res.data?.explanation || '').trim()

        result.push({
          ...q,
          explanation: explanation || 'Chưa có giải thích phù hợp cho câu này.',
        })
      } catch (err) {
        console.error('AI explanation failed:', err)

        result.push({
          ...q,
          explanation: 'Chưa có giải thích phù hợp cho câu này.',
        })
      }
    }

    return result
  }

  async function handleUpload(e) {
    e.preventDefault()
    setMessage('')
    setErrors([])
    setProgress('')

    if (!user?.uid) {
      setErrors(['Bạn cần đăng nhập giáo viên trước khi upload.'])
      return
    }

    if (!title.trim()) {
      setErrors(['Vui lòng nhập tên đề.'])
      return
    }

    if (!file) {
      setErrors(['Vui lòng chọn file Excel.'])
      return
    }

    const safeDuration = Math.max(1, Number(duration) || 45)

    setLoading(true)

    try {
      setProgress('Đang đọc file Excel...')

      const { questions, errors: parseErrors } = await parseExcelFile(file)

      if (parseErrors.length > 0) {
        setErrors(parseErrors)
        return
      }

      if (questions.length === 0) {
        setErrors(['Không có câu hỏi hợp lệ trong file Excel.'])
        return
      }

      if (questions.length > 450) {
        setErrors([
          'File có quá nhiều câu hỏi. Bản hiện tại khuyên dùng dưới 450 câu để tránh giới hạn batch write của Firestore.',
        ])
        return
      }

      const cleanTitle = title.trim()

      const finalQuestions = await enrichQuestionsWithAI(questions)

      setProgress('Đang tạo đề thi trên Firestore...')

      const examRef = await addDoc(collection(db, 'exams'), {
        title: cleanTitle,
        subject: subject.trim() || 'Hóa học',
        grade: grade.trim() || 'THPT',
        duration: safeDuration,
        isActive,
        allowReview,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        questionCount: finalQuestions.length,
      })

      const batch = writeBatch(db)

      finalQuestions.forEach((q, index) => {
        const privateRef = doc(collection(db, 'questionsPrivate'))
        const publicRef = doc(collection(db, 'questionsPublic'))

        const baseData = {
          examId: examRef.id,
          order: index + 1,
          question: q.question,
          questionType: q.questionType || 'mcq',
          A: q.A || '',
          B: q.B || '',
          C: q.C || '',
          D: q.D || '',
          section: q.section || 'Phần I',
          topic: q.topic || 'Chưa phân loại',
          point: q.point || 1,
          createdAt: serverTimestamp(),
        }

        batch.set(privateRef, {
          ...baseData,
          correct: q.correct,
          correctList: q.correctList || [],
          explanation: q.explanation || '',
          partialMode: q.partialMode || 'none',
          partialScoreMap: q.partialScoreMap || {},
        })

        batch.set(publicRef, baseData)
      })

      await batch.commit()

      await updateDoc(examRef, {
        questionCount: finalQuestions.length,
      })

      setMessage(`Upload thành công ${finalQuestions.length} câu hỏi cho đề "${cleanTitle}".`)
      setTitle('')
      setDuration(45)
      setFile(null)
      setErrors([])
      setProgress('')

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      onUploaded && onUploaded()
    } catch (err) {
      console.error(err)
      setErrors(['Upload thất bại: ' + err.message])
    } finally {
      setLoading(false)
      setProgress('')
    }
  }

  return (
    <section className="card">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ color: 'var(--green-dark)' }}>Upload đề bằng Excel</h2>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--green-mid)',
              opacity: 0.75,
            }}
          >
            .xlsx / .xls · Mỗi hàng = 1 câu hỏi
          </p>
        </div>
      </div>

      {message && (
        <div className="alert alert-success mb-16">
          {message}
        </div>
      )}

      {errors.length > 0 && (
        <div className="alert alert-error mb-16">
          <div>
            <strong>Có lỗi:</strong>
            <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
              {errors.map((err, idx) => (
                <li
                  key={idx}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                  }}
                >
                  {err}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {progress && (
        <div className="alert alert-info mb-16">
          {progress}
        </div>
      )}

      <form onSubmit={handleUpload}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Tên đề</label>
            <input
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Đề luyện tập số 1"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Môn học</label>
            <input
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Hóa học"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Khối / lớp</label>
            <input
              className="form-input"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="THPT"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Thời gian làm bài, phút</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <label className="form-checkbox mb-16">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={loading}
          />
          <span>Mở đề cho học sinh làm ngay</span>
        </label>

        <label className="form-checkbox mb-16">
          <input
            type="checkbox"
            checked={allowReview}
            onChange={(e) => setAllowReview(e.target.checked)}
            disabled={loading}
          />
          <span>Cho học sinh xem lại bài sau khi nộp</span>
        </label>

        <label className="form-checkbox mb-16">
          <input
            type="checkbox"
            checked={generateAiExplanations}
            onChange={(e) => setGenerateAiExplanations(e.target.checked)}
            disabled={loading}
          />
          <span>Tự tạo giải thích AI cho câu chưa có explanation</span>
        </label>

        <div className="form-group">
          <label className="form-label">File Excel</label>
          <input
            ref={fileInputRef}
            type="file"
            className="form-input"
            accept=".xlsx,.xls"
            disabled={loading}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          {file && (
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--green-mid)',
                marginTop: '4px',
              }}
            >
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <button className="btn btn-primary btn-lg" disabled={loading}>
          {loading ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 16,
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              Đang upload...
            </>
          ) : (
            'Upload đề'
          )}
        </button>
      </form>

      <div className="divider" />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ color: 'var(--green-dark)' }}>Định dạng file Excel</h3>
      </div>

      <div className="table-container mb-12">
        <table>
          <thead>
            <tr>
              <th style={{ fontFamily: 'var(--font-mono)' }}>Cột</th>
              <th>Nội dung</th>
              <th>Bắt buộc</th>
            </tr>
          </thead>

          <tbody>
            {COLUMNS.map((c) => (
              <tr key={c.col}>
                <td
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    color: 'var(--green-dark)',
                  }}
                >
                  {c.col}
                </td>
                <td style={{ fontSize: '0.85rem' }}>{c.desc}</td>
                <td>
                  {c.req ? (
                    <span className="badge badge-green" style={{ fontSize: '0.68rem' }}>
                      Có
                    </span>
                  ) : (
                    <span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>
                      Không
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="alert alert-warning"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.82rem',
        }}
      >
        Nếu cột explanation trống và bạn tick AI, hệ thống sẽ gọi Gemini qua Cloud Function rồi lưu explanation vào questionsPrivate.
      </div>
    </section>
  )
}