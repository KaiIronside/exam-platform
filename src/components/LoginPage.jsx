// src/components/LoginPage.jsx
import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

function ImageWithFallback({ src, alt, className, fallbackText }) {
  const [errored, setErrored] = useState(false)
  if (errored) {
    return (
      <div className={`image-placeholder ${className || ''}`}>
        <span className="placeholder-icon">🏫</span>
        <span>{fallbackText || alt}</span>
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onError={() => setErrored(true)} />
}

/* Các phân tử SVG inline in chìm phía sau form */
function ChemBgDecor() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', overflow: 'visible', zIndex: 0,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Vòng benzene góc trên trái */}
      <g transform="translate(18,18)" fill="none" stroke="#065f46" strokeWidth="1.2" opacity="0.13">
        <polygon points="0,-22 19,-11 19,11 0,22 -19,11 -19,-11" />
        <circle cx="0" cy="0" r="10" strokeDasharray="3,2.5" />
      </g>
      {/* H2O góc trên phải */}
      <g transform="translate(calc(100% - 30px),22)" fill="none" stroke="#065f46" strokeWidth="1.1" opacity="0.13">
        <circle cx="0" cy="0" r="8" />
        <circle cx="-20" cy="16" r="5.5" />
        <circle cx="20" cy="16" r="5.5" />
        <line x1="-5" y1="5" x2="-15" y2="12" />
        <line x1="5" y1="5" x2="15" y2="12" />
        <text x="0" y="3.5" textAnchor="middle" fontSize="6" fontFamily="monospace" fill="#065f46" stroke="none">O</text>
        <text x="-20" y="20" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="#065f46" stroke="none">H</text>
        <text x="20" y="20" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="#065f46" stroke="none">H</text>
      </g>
      {/* Công thức góc dưới trái */}
      <text x="14" y="calc(100% - 16px)" fontSize="11" fontFamily="monospace" fill="#065f46" opacity="0.12">PV=nRT</text>
      {/* CO2 góc dưới phải */}
      <g transform="translate(calc(100% - 28px), calc(100% - 26px))" fill="none" stroke="#065f46" strokeWidth="1.1" opacity="0.13">
        <circle cx="-28" cy="0" r="7" />
        <circle cx="0" cy="0" r="8.5" />
        <circle cx="28" cy="0" r="7" />
        <line x1="-21" y1="-2.5" x2="-8.5" y2="-2.5" />
        <line x1="-21" y1="2.5" x2="-8.5" y2="2.5" />
        <line x1="21" y1="-2.5" x2="8.5" y2="-2.5" />
        <line x1="21" y1="2.5" x2="8.5" y2="2.5" />
        <text x="-28" y="3" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="#065f46" stroke="none">O</text>
        <text x="0" y="3" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="#065f46" stroke="none">C</text>
        <text x="28" y="3" textAnchor="middle" fontSize="5.5" fontFamily="monospace" fill="#065f46" stroke="none">O</text>
      </g>
    </svg>
  )
}

/* Badge nhỏ hiện công thức hoá học trang trí */
function ChemBadge({ formula, style }) {
  return (
    <span className="badge badge-chem" style={{ fontSize: '0.72rem', ...style }}>
      {formula}
    </span>
  )
}

export default function LoginPage({ onLoginSuccess, onBack }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists() || snap.data().role !== 'teacher') {
        await auth.signOut()
        setError('Tài khoản này không có quyền quản trị.')
        setLoading(false)
        return
      }
      onLoginSuccess && onLoginSuccess()
    } catch (err) {
      const msgs = {
        'auth/user-not-found': 'Email không tồn tại.',
        'auth/wrong-password': 'Mật khẩu không đúng.',
        'auth/invalid-email': 'Email không hợp lệ.',
        'auth/invalid-credential': 'Email hoặc mật khẩu không đúng.',
        'auth/too-many-requests': 'Quá nhiều lần thử. Vui lòng thử lại sau.',
      }
      setError(msgs[err.code] || 'Đăng nhập thất bại: ' + err.message)
      setLoading(false)
    }
  }

  return (
    <div className="page" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
    }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>

        {/* ── Header: logo + tiêu đề ── */}
        <div className="text-center mb-24">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
            <div style={{
              position: 'relative',
              width: 80, height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #d1fae5, #6ee7b7)',
              border: '3px solid var(--green-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 18px rgba(16,185,129,0.25)',
            }}>
              <ImageWithFallback
                src={`${import.meta.env.BASE_URL}logo.png`}
                alt="Logo trường"
                className="school-logo"
                fallbackText=""
              />
              {/* Nguyên tử nhỏ trang trí */}
              <span style={{
                position: 'absolute', bottom: -4, right: -4,
                background: 'white', borderRadius: '50%',
                border: '2px solid var(--green-border)',
                width: 24, height: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.9rem',
              }}>⚗️</span>
            </div>
          </div>

          <h1 style={{
            fontSize: '1.65rem', fontWeight: 800,
            color: 'var(--green-dark)', marginBottom: '6px', letterSpacing: '-0.3px',
          }}>
            Trang Quản Trị
          </h1>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.88rem', marginBottom: '10px' }}>
            Hệ Thống Ôn Thi Hóa Học
          </p>

          {/* Dải công thức hoá học trang trí */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <ChemBadge formula="H₂O" />
            <ChemBadge formula="NaCl" />
            <ChemBadge formula="C₆H₁₂O₆" />
            <ChemBadge formula="H₂SO₄" />
            <ChemBadge formula="NH₃" />
          </div>
        </div>

        {/* ── Form card ── */}
        <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>

          {/* SVG trang trí in chìm bên trong card */}
          <ChemBgDecor />

          {/* Nội dung form đặt trên z-index 1 */}
          <div style={{ position: 'relative', zIndex: 1 }}>

            {/* Avatar giáo viên */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--green-primary), var(--green-emerald))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
              }}>👨‍🔬</div>
              <div>
                <p style={{ fontWeight: 700, color: 'var(--gray-800)', marginBottom: '2px' }}>
                  Đăng nhập Giáo viên
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--gray-600)' }}>
                  Dành cho giáo viên &amp; quản trị viên
                </p>
              </div>

              {/* Separator đẩy badge sang phải */}
              <div style={{ flex: 1 }} />
              <span className="badge badge-chem" style={{ fontSize: '0.7rem' }}>
                🔬 Admin
              </span>
            </div>

            {/* Đường phân cách nhỏ với công thức */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px',
            }}>
              <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--green-mid)', opacity: 0.7 }}>
                CH₃COOH → CH₃COO⁻ + H⁺
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--gray-200)' }} />
            </div>

            {error && (
              <div className="alert alert-error mb-16">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="giaovien@truong.edu.vn"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mật khẩu</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-full btn-lg"
                disabled={loading}
                style={{ marginTop: '8px' }}
              >
                {loading ? (
                  <>
                    <span style={{
                      display: 'inline-block', width: 16, height: 16,
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: 'white', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                      verticalAlign: 'middle',
                    }} />
                    {' '}Đang đăng nhập...
                  </>
                ) : '🔐 Đăng nhập'}
              </button>
            </form>

            <div className="divider" />

            <button
              className="btn btn-ghost btn-full btn-sm"
              onClick={onBack}
              type="button"
            >
              ← Quay lại trang học sinh
            </button>
          </div>
        </div>

        {/* ── Mini bảng tuần hoàn trang trí phía dưới ── */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: '6px',
          marginTop: '20px', opacity: 0.55,
        }}>
          {[
            { z: 1, sym: 'H', name: 'Hidro' },
            { z: 6, sym: 'C', name: 'Cacbon' },
            { z: 7, sym: 'N', name: 'Nito' },
            { z: 8, sym: 'O', name: 'Oxi' },
            { z: 11, sym: 'Na', name: 'Natri' },
            { z: 17, sym: 'Cl', name: 'Clo' },
          ].map(el => (
            <div key={el.sym} style={{
              width: 44, height: 44,
              border: '1.5px solid var(--green-border)',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.75)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 0,
            }}>
              <span style={{ fontSize: '0.55rem', color: 'var(--green-mid)', fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>{el.z}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--green-dark)', lineHeight: 1.1, fontFamily: 'var(--font-mono)' }}>{el.sym}</span>
              <span style={{ fontSize: '0.42rem', color: 'var(--gray-600)', lineHeight: 1.3 }}>{el.name}</span>
            </div>
          ))}
        </div>

        {/* Illustration */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', opacity: 0.65 }}>
          <ImageWithFallback
            src={`${import.meta.env.BASE_URL}admin-illustration.png`}
            alt="Admin"
            className="admin-illustration"
            fallbackText="Thêm ảnh tại public/admin-illustration.png"
          />
        </div>
      </div>
    </div>
  )
}