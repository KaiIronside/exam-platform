// src/utils/excelParser.js
import * as XLSX from 'xlsx'

const REQUIRED_HEADERS = ['question', 'A', 'B', 'C', 'D', 'correct']
const VALID_ANSWERS = ['A', 'B', 'C', 'D']

/**
 * Đọc file Excel và trả về mảng câu hỏi đã validate.
 * @param {File} file
 * @returns {Promise<{questions: Array, errors: Array}>}
 */
export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })

        if (rows.length === 0) {
          resolve({ questions: [], errors: ['File Excel trống hoặc không có dữ liệu.'] })
          return
        }

        // Kiểm tra header
        const headers = Object.keys(rows[0]).map(h => h.trim().toLowerCase())
        const missingHeaders = REQUIRED_HEADERS.filter(
          h => !headers.includes(h.toLowerCase())
        )
        if (missingHeaders.length > 0) {
          resolve({
            questions: [],
            errors: [`Thiếu cột bắt buộc: ${missingHeaders.join(', ')}. Vui lòng kiểm tra lại file Excel.`],
          })
          return
        }

        const questions = []
        const errors = []

        rows.forEach((row, idx) => {
          const rowNum = idx + 2 // +2 vì dòng 1 là header
          const q = {}

          // Normalize keys
          for (const key of Object.keys(row)) {
            q[key.trim().toLowerCase()] = String(row[key] || '').trim()
          }

          // Validate required fields
          if (!q.question) {
            errors.push(`Dòng ${rowNum}: Thiếu nội dung câu hỏi.`)
            return
          }
          if (!q.a || !q.b || !q.c || !q.d) {
            errors.push(`Dòng ${rowNum}: Thiếu một hoặc nhiều đáp án (A/B/C/D).`)
            return
          }
          const correct = (q.correct || '').toUpperCase()
          if (!VALID_ANSWERS.includes(correct)) {
            errors.push(`Dòng ${rowNum}: Đáp án đúng "${q.correct}" không hợp lệ. Chỉ chấp nhận A, B, C, D.`)
            return
          }

          const point = parseFloat(q.point)

          questions.push({
            question: q.question,
            A: q.a,
            B: q.b,
            C: q.c,
            D: q.d,
            correct,
            section: q.section || 'Phần I',
            topic: q.topic || 'Chưa phân loại',
            explanation: q.explanation || '',
            point: isNaN(point) ? 0.25 : point,
          })
        })

        resolve({ questions, errors })
      } catch (err) {
        reject(new Error('Không thể đọc file Excel: ' + err.message))
      }
    }

    reader.onerror = () => reject(new Error('Lỗi đọc file.'))
    reader.readAsArrayBuffer(file)
  })
}