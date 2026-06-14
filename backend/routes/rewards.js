import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// 获取奖惩列表（管理员可看全部，学生只看自己的）
router.get('/', async (req, res) => {
  try {
    const isAdmin = !req.user.studentId
    const userId = req.user.studentId || req.user.username
    let sql, params
    if (isAdmin) {
      sql = 'SELECT * FROM rewards_punishments ORDER BY created_at DESC'
      params = []
    } else {
      sql = 'SELECT * FROM rewards_punishments WHERE student_id = $1 ORDER BY created_at DESC'
      params = [userId]
    }
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取奖惩记录失败' })
  }
})

// 管理员：新增奖惩
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { studentId, studentName, className, type, category, reason, points } = req.body
    const result = await pool.query(
      `INSERT INTO rewards_punishments (student_id, student_name, class_name, type, category, reason, points, awarded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [studentId, studentName, className, type, category, reason, points || 0, req.user.username || '管理员']
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '添加失败' })
  }
})

// 管理员：删除奖惩
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM rewards_punishments WHERE id = $1', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
