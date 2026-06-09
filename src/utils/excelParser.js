// src/utils/excelParser.js
import * as XLSX from 'xlsx'

const REQUIRED_HEADERS = ['question', 'correct']
const VALID_TYPES = ['mcq', 'multi', 'tf', 'numeric']
const VALID_ANSWERS = ['A', 'B', 'C', 'D']
const VALID_PARTIAL_MODES = ['none', 'all-or-nothing', 'linear', 'custom']

const DEFAULT_CUSTOM_PARTIAL_MAP = {
  0: 0,
  1: 0.1,
  2: 0.25,
  3: 0.5,
  4: 1,
}

function normalizeType(value) {
  const type = String(value || 'mcq').trim().toLowerCase()

  const aliases = {
    tracnghiem: 'mcq',
    'trắc nghiệm': 'mcq',
    single: 'mcq',
    choice: 'mcq',
    'chọn 1': 'mcq',
    chon1: 'mcq',

    multiple: 'multi',
    multiselect: 'multi',
    'multi-select': 'multi',
    'chọn nhiều': 'multi',
    chonnhieu: 'multi',

    truefalse: 'tf',
    'true/false': 'tf',
    dungsai: 'tf',
    'đúng/sai': 'tf',

    number: 'numeric',
    so: 'numeric',
    số: 'numeric',
    tuluan: 'numeric',
    'tự luận': 'numeric',
    shortanswer: 'numeric',
    'short-answer': 'numeric',
  }

  return aliases[type] || type
}

function normalizePartialMode(value, questionType) {
  const raw = String(value || '').trim().toLowerCase()

  if (!raw) {
    // Mặc định:
    // - multi dùng custom theo rule bạn muốn: 0, 0.1, 0.25, 0.5, 1
    // - các type khác không dùng partial
    return questionType === 'multi' ? 'custom' : 'none'
  }

  const aliases = {
    no: 'none',
    false: 'none',
    off: 'none',
    khong: 'none',
    'không': 'none',

    all: 'all-or-nothing',
    allornothing: 'all-or-nothing',
    'all or nothing': 'all-or-nothing',
    full: 'all-or-nothing',
    fullonly: 'all-or-nothing',

    deu: 'linear',
    đều: 'linear',
    chiadeu: 'linear',
    'chia đều': 'linear',

    tuybien: 'custom',
    'tùy biến': 'custom',
    tuychinh: 'custom',
    'tùy chỉnh': 'custom',
  }

  return aliases[raw] || raw
}

function normalizeCorrectForTF(value) {
  const v = String(value || '').trim().toLowerCase()

  if (['true', 't', 'đúng', 'dung', 'yes', 'y', '1', 'a'].includes(v)) {
    return 'true'
  }

  if (['false', 'f', 'sai', 'no', 'n', '0', 'b'].includes(v)) {
    return 'false'
  }

  return ''
}

function normalizeNumeric(value) {
  return String(value || '')
    .trim()
    .replace(',', '.')
    .replace(/\s+/g, '')
}

function parseMultiCorrect(value) {
  return String(value || '')
    .toUpperCase()
    .split(/[,\s;|/]+/)
    .map(x => x.trim())
    .filter(Boolean)
}

function parsePartialScoreMap(value) {
  const text = String(value || '').trim()

  if (!text) {
    return { ...DEFAULT_CUSTOM_PARTIAL_MAP }
  }

  const result = {}
  const parts = text.split(/[;,|]+/)

  for (const part of parts) {
    const [rawKey, rawValue] = part.split(':')

    if (rawKey === undefined || rawValue === undefined) continue

    const key = Number(String(rawKey).trim())
    const score = Number(String(rawValue).trim())

    if (
      Number.isInteger(key) &&
      key >= 0 &&
      key <= 4 &&
      !Number.isNaN(score) &&
      score >= 0
    ) {
      result[key] = score
    }
  }

  for (let i = 0; i <= 4; i++) {
    if (result[i] === undefined) {
      result[i] = DEFAULT_CUSTOM_PARTIAL_MAP[i]
    }
  }

  return result
}

/**
 * Đọc file Excel và trả về mảng câu hỏi đã validate.
 *
 * Header:
 * question | questionType | A | B | C | D | correct | section | topic | explanation | point | partialMode | partialScoreMap
 *
 * questionType:
 * - mcq
 * - multi
 * - tf
 * - numeric
 *
 * partialMode:
 * - none
 * - all-or-nothing
 * - linear
 * - custom
 *
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
          resolve({
            questions: [],
            errors: ['File Excel trống hoặc không có dữ liệu.'],
          })
          return
        }

        const headers = Object.keys(rows[0]).map(h => h.trim().toLowerCase())

        const missingHeaders = REQUIRED_HEADERS.filter(
          h => !headers.includes(h.toLowerCase())
        )

        if (missingHeaders.length > 0) {
          resolve({
            questions: [],
            errors: [
              `Thiếu cột bắt buộc: ${missingHeaders.join(', ')}. Cần tối thiểu question và correct.`,
            ],
          })
          return
        }

        const questions = []
        const errors = []

        rows.forEach((row, idx) => {
          const rowNum = idx + 2
          const q = {}

          for (const key of Object.keys(row)) {
            q[key.trim().toLowerCase()] = String(row[key] ?? '').trim()
          }

          const question = q.question
          const questionType = normalizeType(q.questiontype || q.type || 'mcq')
          const partialMode = normalizePartialMode(q.partialmode, questionType)
          const partialScoreMap = parsePartialScoreMap(q.partialscoremap)

          if (!question) {
            errors.push(`Dòng ${rowNum}: Thiếu nội dung câu hỏi.`)
            return
          }

          if (!VALID_TYPES.includes(questionType)) {
            errors.push(
              `Dòng ${rowNum}: questionType "${q.questiontype}" không hợp lệ. Chỉ nhận mcq, multi, tf, numeric.`
            )
            return
          }

          if (!VALID_PARTIAL_MODES.includes(partialMode)) {
            errors.push(
              `Dòng ${rowNum}: partialMode "${q.partialmode}" không hợp lệ. Chỉ nhận none, all-or-nothing, linear, custom.`
            )
            return
          }

          let correct = ''
          let correctList = []

          if (questionType === 'mcq') {
            if (!q.a || !q.b || !q.c || !q.d) {
              errors.push(`Dòng ${rowNum}: Câu mcq cần đủ A/B/C/D.`)
              return
            }

            correct = String(q.correct || '').toUpperCase().trim()

            if (!VALID_ANSWERS.includes(correct)) {
              errors.push(`Dòng ${rowNum}: Đáp án đúng của mcq phải là A, B, C hoặc D.`)
              return
            }
          }

          if (questionType === 'multi') {
            if (!q.a || !q.b || !q.c || !q.d) {
              errors.push(`Dòng ${rowNum}: Câu multi cần đủ A/B/C/D.`)
              return
            }

            correctList = parseMultiCorrect(q.correct)

            const invalid = correctList.filter(x => !VALID_ANSWERS.includes(x))

            if (correctList.length === 0 || invalid.length > 0) {
              errors.push(`Dòng ${rowNum}: Đáp án multi phải dạng A,C,D hoặc A B C.`)
              return
            }

            correct = correctList.join(',')
          }

          if (questionType === 'tf') {
            correct = normalizeCorrectForTF(q.correct)

            if (!correct) {
              errors.push(
                `Dòng ${rowNum}: Câu đúng/sai cần correct là true/false, đúng/sai, A/B hoặc 1/0.`
              )
              return
            }
          }

          if (questionType === 'numeric') {
            correct = normalizeNumeric(q.correct)

            if (!correct) {
              errors.push(`Dòng ${rowNum}: Câu numeric cần đáp án đúng.`)
              return
            }

            if (correct.length > 4) {
              errors.push(`Dòng ${rowNum}: Đáp án numeric tối đa 4 ký tự.`)
              return
            }

            if (!/^-?\d*\.?\d+$/.test(correct)) {
              errors.push(`Dòng ${rowNum}: Đáp án numeric chỉ nên là số, ví dụ 25 hoặc 3.14.`)
              return
            }
          }

          const point = parseFloat(q.point)

          questions.push({
            question,
            questionType,
            A: q.a || '',
            B: q.b || '',
            C: q.c || '',
            D: q.d || '',
            correct,
            correctList,
            section: q.section || 'Phần I',
            topic: q.topic || 'Chưa phân loại',
            explanation: q.explanation || '',
            point: Number.isNaN(point) ? 1 : point,
            partialMode,
            partialScoreMap,
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