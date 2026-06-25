import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// 学生端：获取即将到来的考试 (未来30天)
router.get('/upcoming', async (req, res) => {
  try {
    const { class_name } = req.query
    let sql = `
      SELECT id, course_name, DATE_FORMAT(exam_date, '%Y-%m-%d') as exam_date, exam_time, duration, location, class_name, description, created_at, updated_at FROM exams
      WHERE exam_date >= CURRENT_DATE
    `
    const params = []
    if (class_name) {
      sql += ' AND class_name = ?'
      params.push(class_name)
    }
    sql += ' ORDER BY exam_date ASC, exam_time ASC LIMIT 20'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取考试日程失败' })
  }
})

// 学生端：获取指定班级的考试日程
router.get('/class/:className', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, course_name, DATE_FORMAT(exam_date, '%Y-%m-%d') as exam_date, exam_time, duration, location, class_name, description, created_at, updated_at FROM exams WHERE class_name = ? ORDER BY exam_date ASC, exam_time ASC`,
      [req.params.className]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取班级考试日程失败' })
  }
})

// 管理端：获取所有考试日程 (需admin)
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { class_name, status } = req.query
    let sql = 'SELECT id, course_name, DATE_FORMAT(exam_date, \'%Y-%m-%d\') as exam_date, exam_time, duration, location, class_name, description, created_at, updated_at FROM exams WHERE 1=1'
    const params = []
    let idx = 1
    if (class_name) {
      sql += ` AND class_name = ?`
      params.push(class_name)
      idx++
    }
    if (status) {
      if (status === 'upcoming') {
        sql += ' AND exam_date >= CURRENT_DATE'
      } else if (status === 'past') {
        sql += ' AND exam_date < CURRENT_DATE'
      }
    }
    sql += ' ORDER BY exam_date ASC, exam_time ASC'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取考试列表失败' })
  }
})

// 管理端：新增考试
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { courseName, examDate, examTime, duration, location, classNames, description } = req.body
    if (!courseName || !examDate || !classNames) {
      return res.status(400).json({ message: '课程名称、考试日期和班级为必填' })
    }
    // classNames 可以是逗号分隔的字符串，为每个班级创建一条记录
    const classes = classNames.split(',').map(c => c.trim()).filter(Boolean)
    const results = []
    for (const cls of classes) {
      const result = await pool.query(
        `INSERT INTO exams (course_name, exam_date, exam_time, duration, location, class_name, description)
         VALUES (?,?,?,?,?,?,?)`,
        [courseName, examDate, examTime || '09:00', duration || 120, location || '', cls, description || '']
      )
      const insertedId = result.insertId
      const newRow = await pool.query(
        'SELECT id, course_name, DATE_FORMAT(exam_date, \'%Y-%m-%d\') as exam_date, exam_time, duration, location, class_name, description, created_at, updated_at FROM exams WHERE id = ?',
        [insertedId]
      )
      results.push(newRow.rows[0])
    }
    res.status(201).json({ message: `已为 ${classes.length} 个班级创建考试`, data: results })
  } catch (e) {
    res.status(500).json({ message: '新增考试失败' })
  }
})

// 管理端：获取班级列表（用于考试配置下拉）— 必须放在 /:id 路由之前！
router.get('/classes/list', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT class_name FROM students WHERE class_name IS NOT NULL AND class_name != '' ORDER BY class_name`
    )
    res.json(result.rows.map(r => r.class_name))
  } catch (e) {
    res.status(500).json({ message: '获取班级列表失败' })
  }
})

// 管理端：更新考试
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { courseName, examDate, examTime, duration, location, className, classNames, description } = req.body
    const cls = className || (Array.isArray(classNames) ? classNames[0] : classNames)
    await pool.query(
      `UPDATE exams SET course_name=?, exam_date=?, exam_time=?, duration=?, location=?,
       class_name=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [courseName, examDate, examTime, duration || 120, location, cls, description, req.params.id]
    )
    const result = await pool.query(
      'SELECT id, course_name, DATE_FORMAT(exam_date, \'%Y-%m-%d\') as exam_date, exam_time, duration, location, class_name, description, created_at, updated_at FROM exams WHERE id = ?',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '考试记录不存在' })
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '更新考试失败' })
  }
})

// 管理端：删除考试
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM exams WHERE id=?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ message: '考试记录不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

// 管理端：批量删除考试
router.post('/batch-delete', adminMiddleware, async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !ids.length) return res.status(400).json({ message: '请选择要删除的考试' })
    const placeholders = ids.map(() => '?').join(',')
    const result = await pool.query(`DELETE FROM exams WHERE id IN (${placeholders})`, ids)
    res.json({ message: `成功删除 ${result.affectedRows} 条考试安排` })
  } catch (e) {
    res.status(500).json({ message: '批量删除失败' })
  }
})

export default router
