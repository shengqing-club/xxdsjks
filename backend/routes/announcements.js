import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取活跃公告（所有登录用户可见）
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM announcements WHERE is_active = true ORDER BY priority DESC, created_at DESC LIMIT 5'
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取公告失败' })
  }
})

// 管理员：获取所有公告
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取公告失败' })
  }
})

// 管理员：新增公告
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, type, priority } = req.body
    const result = await pool.query(
      `INSERT INTO announcements (title, content, type, priority)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, content, type || '通知', priority || 0]
    )
    // 自动生成通知给所有学生
    try {
      const students = await pool.query('SELECT student_id FROM students')
      for (const s of students.rows) {
        await pool.query(
          `INSERT INTO notifications (receiver_id, title, content, type)
           VALUES ($1,$2,$3,$4)`,
          [s.student_id, `新公告: ${title}`, content, type || '通知']
        )
      }
    } catch {}
    res.status(201).json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '发布失败' })
  }
})

// 管理员：更新公告
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, type, is_active, priority } = req.body
    const result = await pool.query(
      `UPDATE announcements SET title=$1, content=$2, type=$3, is_active=$4, priority=$5, updated_at=CURRENT_TIMESTAMP
       WHERE id=$6 RETURNING *`,
      [title, content, type, is_active, priority, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '公告不存在' })
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '更新失败' })
  }
})

// 管理员：删除公告
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM announcements WHERE id=$1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '公告不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
