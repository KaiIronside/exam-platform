// src/App.jsx
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

import LoginPage from './components/LoginPage'
import StudentHome from './components/StudentHome'
import ExamPage from './components/ExamPage'
import ResultPage from './components/ResultPage'
import AdminPage from './components/AdminPage'

export default function App() {
  const [page, setPage] = useState(() => localStorage.getItem('exam_app_page') || 'home')
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [selectedExam, setSelectedExam] = useState(() => {
    const saved = localStorage.getItem('selected_exam')
    return saved ? JSON.parse(saved) : null
  })

  const [studentInfo, setStudentInfo] = useState(() => {
    const saved = localStorage.getItem('student_info')
    return saved ? JSON.parse(saved) : null
  })

  const [resultData, setResultData] = useState(() => {
    const saved = localStorage.getItem('result_data')
    return saved ? JSON.parse(saved) : null
  })

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user)

      if (!user) {
        setUserProfile(null)
        setAuthLoading(false)
        return
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists()) {
          setUserProfile({ uid: user.uid, email: user.email, ...snap.data() })
        } else {
          setUserProfile({ uid: user.uid, email: user.email, role: 'student' })
        }
      } catch (err) {
        console.error('Lỗi đọc thông tin user:', err)
        setUserProfile({ uid: user.uid, email: user.email, role: 'student' })
      }

      setAuthLoading(false)
    })

    return () => unsub()
  }, [])

  function navigate(nextPage) {
    setPage(nextPage)
    localStorage.setItem('exam_app_page', nextPage)
  }

  function handleStartExam(exam, info) {
    setSelectedExam(exam)
    setStudentInfo(info)
    setResultData(null)

    localStorage.setItem('selected_exam', JSON.stringify(exam))
    localStorage.setItem('student_info', JSON.stringify(info))
    localStorage.removeItem('result_data')

    navigate('exam')
  }

  function handleSubmitExam(result) {
    setResultData(result)
    localStorage.setItem('result_data', JSON.stringify(result))
    localStorage.removeItem('exam_answers')
    localStorage.removeItem('exam_violations')
    navigate('result')
  }

  function handleBackHome() {
    setSelectedExam(null)
    setStudentInfo(null)
    setResultData(null)

    localStorage.removeItem('selected_exam')
    localStorage.removeItem('student_info')
    localStorage.removeItem('result_data')
    localStorage.removeItem('exam_answers')
    localStorage.removeItem('exam_violations')
    localStorage.setItem('exam_app_page', 'home')

    setPage('home')
  }

  async function handleLogout() {
    await signOut(auth)
    setCurrentUser(null)
    setUserProfile(null)
    navigate('home')
  }

  if (authLoading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <p>Đang tải hệ thống...</p>
      </div>
    )
  }

  if (page === 'admin') {
    if (!currentUser || userProfile?.role !== 'teacher') {
      return (
        <LoginPage
          onLoginSuccess={() => navigate('admin')}
          onBack={() => navigate('home')}
        />
      )
    }

    return (
      <AdminPage
        user={currentUser}
        profile={userProfile}
        onLogout={handleLogout}
        onBack={() => navigate('home')}
      />
    )
  }

  if (page === 'exam') {
    if (!selectedExam || !studentInfo) {
      return (
        <StudentHome
          onStartExam={handleStartExam}
          onAdminClick={() => navigate('admin')}
        />
      )
    }

    return (
      <ExamPage
        exam={selectedExam}
        studentInfo={studentInfo}
        onSubmit={handleSubmitExam}
        onBack={handleBackHome}
      />
    )
  }

  if (page === 'result') {
    if (!resultData) {
      return (
        <StudentHome
          onStartExam={handleStartExam}
          onAdminClick={() => navigate('admin')}
        />
      )
    }

    return (
      <ResultPage
        result={resultData}
        onBackHome={handleBackHome}
      />
    )
  }

  return (
    <StudentHome
      onStartExam={handleStartExam}
      onAdminClick={() => navigate('admin')}
    />
  )
}