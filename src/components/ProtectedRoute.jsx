// src/components/ProtectedRoute.jsx
import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

export default function ProtectedRoute({ children, onUnauthorized }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'authorized' | 'unauthorized'

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setStatus('unauthorized'); return }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        if (snap.exists() && snap.data().role === 'teacher') setStatus('authorized')
        else setStatus('unauthorized')
      } catch {
        setStatus('unauthorized')
      }
    })
    return unsub
  }, [])

  if (status === 'loading') {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        {/* Nguyên tử quay SVG nhỏ trang trí */}
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true" style={{ opacity: 0.35 }}>
          <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="var(--green-primary)" strokeWidth="1.2" />
          <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="var(--green-primary)" strokeWidth="1.2" transform="rotate(60 24 24)" />
          <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="var(--green-primary)" strokeWidth="1.2" transform="rotate(120 24 24)" />
          <circle cx="24" cy="24" r="3.5" fill="var(--green-primary)" />
        </svg>
        <p style={{ color: 'var(--green-mid)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          Đang xác thực...
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)' }}>
          CH₃OH + O₂ → CO₂ + H₂O
        </p>
      </div>
    )
  }

  if (status === 'unauthorized') {
    if (onUnauthorized) onUnauthorized()
    return null
  }

  return children
}