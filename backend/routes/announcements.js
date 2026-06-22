import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取活跃公告（所有登录用户可见）
router.get('/active', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM announcements WHERE is_active = 1 ORDER BY priority DESC, created_at DESC LIMIT 5'
    )
    res.json(result.rows)
  } catch (e) {
    console.error('获取公告失败:', e)
    res.status(500).json({ message: '获取公告失败' })
  }
})

// 管理员：获取所有公告
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC')
    res.json(result.rows)
  } catch (e) {
    console.error('获取公告列表失败:', e)
    res.status(500).json({ message: '获取公告失败' })
  }
})

// 管理员：新增公告
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, type, priority } = req.body
    if (!title || !title.trim()) return res.status(400).json({ message: '公告标题不能为空' })
    const result = await pool.query(
      `INSERT INTO announcements (title, content, type, priority)
       VALUES (?,?,?,?)`,
      [title.trim(), content, type || '通知', priority || 0]
    )
    // 自动生成通知给所有学生（批量插入，避免 N+1 查询）
    try {
      const students = await pool.query('SELECT student_id FROM students')
      if (students.rows.length > 0) {
        for (const s of students.rows) {
          await pool.query(
            `INSERT INTO notifications (receiver_id, title, content, type)
             VALUES (?, ?, ?, ?)`,
            [s.student_id, `新公告: ${title}`, content, type || '通知']
          )
        }
      }
    } catch (e) {
      console.error('公告通知发送失败:', e)
    }

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT * FROM announcements WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    console.error('发布公告失败:', e)
    res.status(500).json({ message: '发布失败' })
  }
})

// 管理员：更新公告
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, type, is_active, priority } = req.body
    await pool.query(
      `UPDATE announcements SET title=?, content=?, type=?, is_active=?, priority=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [title, content, type, is_active ? 1 : 0, priority, req.params.id]
    )
    const result = await pool.query('SELECT * FROM announcements WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '公告不存在' })
    res.json(result.rows[0])
  } catch (e) {
    console.error('更新公告失败:', e)
    res.status(500).json({ message: '更新失败' })
  }
})

// 管理员：删除公告
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM announcements WHERE id=?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ message: '公告不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error('删除公告失败:', e)
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
