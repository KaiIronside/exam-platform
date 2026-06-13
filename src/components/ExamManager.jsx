// src/components/ExamManager.jsx
import { useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import ExamReview from './ExamReview'

async function deleteByExamId(collectionName, examId) {
  const snap = await getDocs(
    query(collection(db, collectionName), where('examId', '==', examId))
  )

  let batch = writeBatch(db)
  let count = 0

  for (const item of snap.docs) {
    batch.delete(doc(db, collectionName, item.id))
    count++

    // Firestore batch giới hạn 500 operations, dùng 450 cho an toàn.
    if (count >= 450) {
      await batch.commit()
      batch = writeBatch(db)
      count = 0
    }
  }

  if (count > 0) {
    await batch.commit()
  }

  return snap.size
}

function getDateText(value) {
  if (!value) return '—'
  if (value.toDate) return value.toDate().toLocaleString('vi-VN')
  return new Date(value).toLocaleString('vi-VN')
}

export default function ExamManager({ onChanged }) {
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [selectedExam, setSelectedExam] = useState(null)

  async function loadExams() {
    setLoading(true)
    setError('')

    try {
      let snap

      try {
        snap = await getDocs(
          query(collection(db, 'exams'), orderBy('createdAt', 'desc'))
        )
      } catch {
        snap = await getDocs(collection(db, 'exams'))
      }

      const rows = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0
          const bTime = b.createdAt?.toMillis?.() || 0
          return bTime - aTime
        })

      setExams(rows)

      if (selectedExam) {
        const updatedSelected = rows.find(x => x.id === selectedExam.id)
        setSelectedExam(updatedSelected || null)
      }
    } catch (err) {
      console.error(err)
      setError('Không tải được danh sách đề: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleActive(exam) {
    setBusyId(exam.id)

    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        isActive: !exam.isActive,
      })

      await loadExams()
      onChanged?.()
    } catch (err) {
      console.error(err)
      alert('Cập nhật trạng thái đề thất bại: ' + err.message)
    } finally {
      setBusyId('')
    }
  }

  async function toggleReview(exam) {
    setBusyId(exam.id)

    try {
      await updateDoc(doc(db, 'exams', exam.id), {
        allowReview: !(exam.allowReview === true),
      })

      await loadExams()
      onChanged?.()
    } catch (err) {
      console.error(err)
      alert('Cập nhật quyền xem lại thất bại: ' + err.message)
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteExam(exam) {
    const ok = window.confirm(
      `Xóa đề "${exam.title}"?\n\nThao tác này sẽ xóa đề + câu hỏi public/private.\nKết quả học sinh trong submissions vẫn được giữ lại.`
    )

    if (!ok) return

    const finalOk = window.confirm(
      'Xác nhận lần cuối: sau khi xóa đề, học sinh sẽ không còn thấy đề này nữa.'
    )

    if (!finalOk) return

    setBusyId(exam.id)

    try {
      await deleteByExamId('questionsPublic', exam.id)
      await deleteByExamId('questionsPrivate', exam.id)
      await deleteDoc(doc(db, 'exams', exam.id))

      if (selectedExam?.id === exam.id) {
        setSelectedExam(null)
      }

      await loadExams()
      onChanged?.()

      alert('Đã xóa đề thành công.')
    } catch (err) {
      console.error(err)
      alert('Xóa đề thất bại: ' + err.message)
    } finally {
      setBusyId('')
    }
  }

  if (loading) {
    return (
      <section className="card">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Đang tải danh sách đề...</p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <div className="flex justify-between items-center gap-16 mb-16" style={{ flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ color: 'var(--green-dark)' }}>
              Quản lý đề thi
            </h2>

            <p className="text-sm text-gray">
              Giáo viên có thể xem đề, khóa/mở đề, bật/tắt xem lại bài và xóa đề.
            </p>
          </div>

          <button className="btn btn-secondary" onClick={loadExams} disabled={!!busyId}>
            Tải lại
          </button>
        </div>

        {error && (
          <div className="alert alert-error mb-16">
            {error}
          </div>
        )}

        {exams.length === 0 ? (
          <div className="alert alert-info">
            Chưa có đề thi nào.
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tên đề</th>
                  <th>Môn</th>
                  <th>Khối</th>
                  <th>Số câu</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th>Xem lại</th>
                  <th>Thao tác</th>
                </tr>
              </thead>

              <tbody>
                {exams.map(exam => (
                  <tr key={exam.id}>
                    <td>
                      <strong>{exam.title}</strong>
                      {selectedExam?.id === exam.id && (
                        <div className="text-xs text-green mt-8">
                          Đang xem đề này
                        </div>
                      )}
                    </td>

                    <td>{exam.subject || 'Hóa học'}</td>
                    <td>{exam.grade || 'THPT'}</td>
                    <td>{exam.questionCount || 0}</td>
                    <td>{getDateText(exam.createdAt)}</td>

                    <td>
                      <span className={`badge ${exam.isActive ? 'badge-green' : 'badge-gray'}`}>
                        {exam.isActive ? 'Đang mở' : 'Đã khóa'}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${exam.allowReview === true ? 'badge-green' : 'badge-red'}`}>
                        {exam.allowReview === true ? 'Cho xem' : 'Không cho xem'}
                      </span>
                    </td>

                    <td>
                      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setSelectedExam(exam)

                            setTimeout(() => {
                              const el = document.getElementById('exam-review-panel')
                              if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                              }
                            }, 50)
                          }}
                          disabled={busyId === exam.id}
                        >
                          Xem đề
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleActive(exam)}
                          disabled={busyId === exam.id}
                        >
                          {exam.isActive ? 'Khóa đề' : 'Mở đề'}
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => toggleReview(exam)}
                          disabled={busyId === exam.id}
                        >
                          {exam.allowReview === true ? 'Tắt xem lại' : 'Bật xem lại'}
                        </button>

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteExam(exam)}
                          disabled={busyId === exam.id}
                        >
                          Xóa đề
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedExam && (
        <div id="exam-review-panel">
          <ExamReview
            exam={selectedExam}
            onClose={() => setSelectedExam(null)}
          />
        </div>
      )}
    </>
  )
}