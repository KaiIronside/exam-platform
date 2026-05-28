import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ─────────────────────────────────────────────────────────────────
// HƯỚNG DẪN DEPLOY GITHUB PAGES:
//
// Nếu repo của bạn tên là "exam-platform" và deploy tại:
//   https://username.github.io/exam-platform/
// thì đặt base: '/exam-platform/'
//
// Nếu là custom domain hoặc repo dạng username.github.io (root):
//   base: '/'
// ─────────────────────────────────────────────────────────────────
export default defineConfig({
  plugins: [react()],
  base: '/exam-platform/',
})