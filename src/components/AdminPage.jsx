// src/components/AdminPage.jsx
import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import ExamUpload from './ExamUpload'
import ResultsDashboard from './ResultsDashboard'
import ExamManager from './ExamManager'

function getDisplayScore(sub) {
  if (typeof sub.displayScore === 'number') return sub.displayScore
  if (sub.totalScore > 0) return (sub.score / sub.totalScore) * 10
  return 0
}

export default function AdminPage({ user, profile, onLogout, onBack }) {
  const [tab, setTab] = useState('overview')
  const [stats, setStats] = useState({
    exams: 0,
    submissions: 0,
    avg: 0,
    max: 0,
    min: 0,
    passRate: 0,
    goodRate: 0,
  })
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    async function loadStats() {
      try {
        const [examSnap, subSnap] = await Promise.all([
          getDocs(collection(db, 'exams')),
          getDocs(collection(db, 'submissions')),
        ])

        const subs = subSnap.docs.map(doc => doc.data())
        const scores = subs.map(getDisplayScore)

        const avg = scores.length
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0

        const max = scores.length ? Math.max(...scores) : 0
        const min = scores.length ? Math.min(...scores) : 0

        const passRate = scores.length
          ? (scores.filter(s => s >= 5).length / scores.length) * 100
          : 0

        const goodRate = scores.length
          ? (scores.filter(s => s >= 8).length / scores.length) * 100
          : 0

        setStats({
          exams: examSnap.size,
          submissions: subSnap.size,
          avg,
          max,
          min,
          passRate,
          goodRate,
        })
      } catch (err) {
        console.error(err)
      }
    }

    loadStats()
  }, [refreshKey])

  return (
    <div className="page">
      <div className="container">
        <header className="card mb-24">
          <div className="flex justify-between items-center gap-16" style={{ flexWrap: 'wrap' }}>
            <div>
              <p className="badge badge-green mb-8">Trang quản trị</p>
              <h1 style={{ color: 'var(--green-dark)' }}>
                Hệ Thống Ôn Thi Hóa Học
              </h1>
              <p className="text-gray mt-8">
                Xin chào, {profile?.name || user?.email}
              </p>
            </div>

            <div className="flex gap-12">
              <button className="btn btn-secondary" onClick={onBack}>
                Trang học sinh
              </button>
              <button className="btn btn-danger" onClick={onLogout}>
                Đăng xuất
              </button>
            </div>
          </div>
        </header>

        <div className="card mb-24">
          <div className="tabs">
            <button
              className={`tab-btn ${tab === 'overview' ? 'active' : ''}`}
              onClick={() => setTab('overview')}
            >
              Tổng quan
            </button>

            <button
              className={`tab-btn ${tab === 'upload' ? 'active' : ''}`}
              onClick={() => setTab('upload')}
            >
              Upload đề
            </button>

            <button
              className={`tab-btn ${tab === 'results' ? 'active' : ''}`}
              onClick={() => setTab('results')}
            >
              Kết quả
            </button>

            <button
              className={`tab-btn ${tab === 'exams' ? 'active' : ''}`}
              onClick={() => setTab('exams')}
            >
              Quản lý đề
            </button>

            <button
              className={`tab-btn ${tab === 'settings' ? 'active' : ''}`}
              onClick={() => setTab('settings')}
            >
              Cài đặt
            </button>
          </div>
        </div>

        {tab === 'overview' && (
          <section className="card">
            <h2 className="mb-16" style={{ color: 'var(--green-dark)' }}>
              Tổng quan hệ thống
            </h2>

            <div className="stats-grid">
              <div className="card card-sm stat-card">
                <div className="stat-value">{stats.exams}</div>
                <div className="stat-label">Tổng số đề</div>
              </div>

              <div className="card card-sm stat-card">
                <div className="stat-value">{stats.submissions}</div>
                <div className="stat-label">Bài nộp</div>
              </div>

              <div className="card card-sm stat-card">
                <div className="stat-value">{stats.avg.toFixed(1)}</div>
                <div className="stat-label">Điểm trung bình</div>
              </div>

              <div className="card card-sm stat-card">
                <div className="stat-value">{stats.max.toFixed(1)}</div>
                <div className="stat-label">Điểm cao nhất</div>
              </div>

              <div className="card card-sm stat-card">
                <div className="stat-value">{stats.min.toFixed(1)}</div>
                <div className="stat-label">Điểm thấp nhất</div>
              </div>

              <div className="card card-sm stat-card">
                <div className="stat-value">{stats.passRate.toFixed(0)}%</div>
                <div className="stat-label">Tỷ lệ ≥ 5</div>
              </div>

              <div className="card card-sm stat-card">
                <div className="stat-value">{stats.goodRate.toFixed(0)}%</div>
                <div className="stat-label">Tỷ lệ ≥ 8</div>
              </div>
            </div>
          </section>
        )}

        {tab === 'upload' && (
          <ExamUpload
            user={user}
            onUploaded={() => setRefreshKey(k => k + 1)}
          />
        )}

        {tab === 'results' && (
          <ResultsDashboard refreshKey={refreshKey} />
        )}

        {tab === 'exams' && (
          <ExamManager onChanged={() => setRefreshKey(k => k + 1)} />
        )}

        {tab === 'settings' && (
          <section className="card">
            <h2 className="mb-16" style={{ color: 'var(--green-dark)' }}>
              Hướng dẫn định dạng Excel
            </h2>

            <p className="text-gray mb-16">
              File Excel cần có hàng đầu tiên là header với các cột sau:
            </p>

            <div className="table-container mb-16">
              <table>
                <thead>
                  <tr>
                    <th>question</th>
                    <th>questionType</th>
                    <th>A</th>
                    <th>B</th>
                    <th>C</th>
                    <th>D</th>
                    <th>correct</th>
                    <th>section</th>
                    <th>topic</th>
                    <th>explanation</th>
                    <th>point</th>
                    <th>partialMode</th>
                    <th>partialScoreMap</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td>Nước có công thức gì?</td>
                    <td>mcq</td>
                    <td>H2O</td>
                    <td>CO2</td>
                    <td>O2</td>
                    <td>NaCl</td>
                    <td>A</td>
                    <td>Phần I</td>
                    <td>Hóa cơ bản</td>
                    <td>Nước là H2O</td>
                    <td>1</td>
                    <td>none</td>
                    <td></td>
                  </tr>

                  <tr>
                    <td>Chọn tất cả chất điện li mạnh</td>
                    <td>multi</td>
                    <td>NaCl</td>
                    <td>HCl</td>
                    <td>CH3COOH</td>
                    <td>KOH</td>
                    <td>A,B,D</td>
                    <td>Phần II</td>
                    <td>Điện li</td>
                    <td>NaCl, HCl, KOH là điện li mạnh</td>
                    <td>1</td>
                    <td>custom</td>
                    <td>0:0,1:0.1,2:0.25,3:0.5,4:1</td>
                  </tr>

                  <tr>
                    <td>Chọn tất cả kim loại</td>
                    <td>multi</td>
                    <td>Fe</td>
                    <td>Cu</td>
                    <td>O2</td>
                    <td>Al</td>
                    <td>A,B,D</td>
                    <td>Phần II</td>
                    <td>Kim loại</td>
                    <td>Fe, Cu, Al là kim loại</td>
                    <td>1</td>
                    <td>linear</td>
                    <td></td>
                  </tr>

                  <tr>
                    <td>Chọn tất cả oxit axit</td>
                    <td>multi</td>
                    <td>CO2</td>
                    <td>SO2</td>
                    <td>CaO</td>
                    <td>P2O5</td>
                    <td>A,B,D</td>
                    <td>Phần II</td>
                    <td>Oxit</td>
                    <td>CO2, SO2, P2O5 là oxit axit</td>
                    <td>1</td>
                    <td>all-or-nothing</td>
                    <td></td>
                  </tr>

                  <tr>
                    <td>CO2 là oxit axit</td>
                    <td>tf</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>true</td>
                    <td>Phần III</td>
                    <td>Oxit</td>
                    <td>CO2 là oxit axit</td>
                    <td>1</td>
                    <td>none</td>
                    <td></td>
                  </tr>

                  <tr>
                    <td>2 + 2 = ?</td>
                    <td>numeric</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td>4</td>
                    <td>Phần IV</td>
                    <td>Tính toán</td>
                    <td>2 + 2 = 4</td>
                    <td>1</td>
                    <td>none</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card card-sm card-flat mb-16">
              <h3 className="mb-12" style={{ color: 'var(--green-dark)' }}>
                Các loại câu hỏi
              </h3>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>questionType</th>
                      <th>Ý nghĩa</th>
                      <th>correct mẫu</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>mcq</td>
                      <td>Trắc nghiệm một đáp án</td>
                      <td>A</td>
                    </tr>

                    <tr>
                      <td>multi</td>
                      <td>Chọn tất cả ý đúng</td>
                      <td>A,C,D</td>
                    </tr>

                    <tr>
                      <td>tf</td>
                      <td>Đúng / Sai</td>
                      <td>true hoặc false</td>
                    </tr>

                    <tr>
                      <td>numeric</td>
                      <td>Nhập đáp án số, tối đa 4 ký tự</td>
                      <td>25 hoặc 3.14</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card card-sm card-flat mb-16">
              <h3 className="mb-12" style={{ color: 'var(--green-dark)' }}>
                4 chế độ partial grading
              </h3>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>partialMode</th>
                      <th>Ý nghĩa</th>
                      <th>Ví dụ</th>
                    </tr>
                  </thead>

                  <tbody>
                    <tr>
                      <td>none</td>
                      <td>Không chấm từng phần. Với multi, đúng đủ 4/4 ý mới có điểm.</td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>all-or-nothing</td>
                      <td>Đúng toàn bộ mới có điểm, sai 1 ý là 0 điểm.</td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>linear</td>
                      <td>Chia đều theo số ý đúng. Đúng 2/4 ý của câu 1 điểm thì được 0.5 điểm.</td>
                      <td></td>
                    </tr>

                    <tr>
                      <td>custom</td>
                      <td>Giáo viên tự chia điểm theo số ý đúng.</td>
                      <td>0:0,1:0.1,2:0.25,3:0.5,4:1</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="alert alert-warning">
              Bản MVP đang chấm điểm ở frontend, nghĩa là đáp án đúng có thể bị xem qua DevTools.
              Bản production nên chuyển phần chấm điểm sang Firebase Cloud Functions.
            </div>
          </section>
        )}
      </div>
    </div>
  )
}