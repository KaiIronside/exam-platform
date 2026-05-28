// src/components/AdminPage.jsx
import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
} from 'firebase/firestore'
import { db } from '../firebase'
import ExamUpload from './ExamUpload'
import ResultsDashboard from './ResultsDashboard'

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
                    <th>A</th>
                    <th>B</th>
                    <th>C</th>
                    <th>D</th>
                    <th>correct</th>
                    <th>section</th>
                    <th>topic</th>
                    <th>explanation</th>
                    <th>point</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Nội dung câu hỏi</td>
                    <td>Đáp án A</td>
                    <td>Đáp án B</td>
                    <td>Đáp án C</td>
                    <td>Đáp án D</td>
                    <td>A/B/C/D</td>
                    <td>Phần I</td>
                    <td>Este</td>
                    <td>Giải thích</td>
                    <td>0.25</td>
                  </tr>
                </tbody>
              </table>
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