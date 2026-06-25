/**
 * 考试相关共享工具函数
 * 管理端和学生端统一使用，确保时间显示和状态判断完全一致
 */

// ===== 日期处理 =====

/** 从任意格式（ISO datetime / 纯日期字符串）提取 YYYY-MM-DD */
export function normalizeDate(rawDate) {
  if (!rawDate) return ''
  const s = String(rawDate).trim()
  // 已是纯日期格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // ISO datetime（含时区）：先尝试用 Date 解析，再取本地日期
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  // 兜底：取前10位
  return s.slice(0, 10)
}

/** 转为中文日期：6月16日 周三 */
export function formatDateCN(rawDate) {
  const clean = normalizeDate(rawDate)
  if (!clean) return '--'
  const d = new Date(clean + 'T12:00:00')
  if (isNaN(d.getTime())) return clean
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
}

// ===== 时间范围 =====

/** 计算结束时间并返回 "09:00 - 11:00" 格式 */
export function formatTimeRange(exam) {
  const startTime = exam.exam_time || '--'
  if (!exam.duration || Number(exam.duration) <= 0) return startTime
  const [h, m] = startTime.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return startTime
  const totalMinutes = h * 60 + m + Number(exam.duration)
  const endH = Math.floor(totalMinutes / 60) % 24
  const endM = totalMinutes % 60
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  return `${startTime} - ${endTime}`
}

// ===== 考试状态 =====

/** 获取中国时区的当天日期字符串 YYYY-MM-DD（避免 toISOString 的 UTC 偏移问题） */
function getTodayStrCST() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 获取考试状态标签
 * @returns {{ tag: string, type: string }}
 *   type: 'danger' 考试中/今天 | 'warning' 3天内 | 'primary' 未来 | 'info' 已结束
 */
export function getExamStatus(exam) {
  const dateStr = normalizeDate(exam.exam_date)
  if (!dateStr) return { tag: '未知', type: 'info' }

  const todayStr = getTodayStrCST()
  const now = new Date()

  // 已过日期
  if (dateStr < todayStr) return { tag: '已结束', type: 'info' }

  // 今天 → 细分：考试中 / 今天待考 / 今天已结束
  if (dateStr === todayStr) {
    const timeStr = exam.exam_time || '00:00'
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return { tag: '今天待考', type: 'danger' }
    const startMs = h * 60 + m
    const endMs = startMs + (Number(exam.duration) || 120)
    const curMs = now.getHours() * 60 + now.getMinutes()
    if (curMs >= startMs && curMs < endMs) return { tag: '考试中', type: 'danger' }
    if (curMs < startMs) return { tag: '今天待考', type: 'danger' }
    return { tag: '已结束', type: 'info' }
  }

  // 未来日期
  const examDate = new Date(dateStr + 'T12:00:00')
  const todayDate = new Date(todayStr + 'T12:00:00')
  const diffDays = Math.ceil((examDate - todayDate) / 86400000)
  if (diffDays <= 3) return { tag: `${diffDays}天后`, type: 'warning' }
  return { tag: `${diffDays}天后`, type: 'primary' }
}

/** 是否已过（向后兼容） */
export function isPast(dateStr) {
  return normalizeDate(dateStr) < getTodayStrCST()
}

/** 是否是今天 */
export function isToday(dateStr) {
  return normalizeDate(dateStr) === getTodayStrCST()
}

/** 是否在 N 天内 */
export function isWithinDays(dateStr, days) {
  const d = normalizeDate(dateStr)
  const todayStr = getTodayStrCST()
  if (!d || d < todayStr) return false
  const examDate = new Date(d + 'T12:00:00')
  const todayDate = new Date(todayStr + 'T12:00:00')
  const diff = Math.ceil((examDate - todayDate) / 86400000)
  return diff >= 0 && diff <= days
}
