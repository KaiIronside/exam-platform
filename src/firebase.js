// src/firebase.js
// ─────────────────────────────────────────────────────────────────
// SECURITY NOTE (MVP):
// - Đây là cấu hình Firebase client-side. API key này được thiết kế
//   để public, nhưng bạn PHẢI cấu hình Firestore Security Rules
//   để bảo vệ dữ liệu.
// - Xem file firestore.rules trong repo để biết thêm chi tiết.
// ─────────────────────────────────────────────────────────────────
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: "AIzaSyArhalMHmTGJijCbsCzGATRGopaGgGIP-A",
  authDomain: "exam-ai-platform-71c4a.firebaseapp.com",
  projectId: "exam-ai-platform-71c4a",
  storageBucket: "exam-ai-platform-71c4a.firebasestorage.app",
  messagingSenderId: "267205996435",
  appId: "1:267205996435:web:64ba2c47fc4acd4ba68266"
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export default app