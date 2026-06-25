import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取当前用户的通知（登录用户）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE receiver_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取通知失败' })
  }
})

// 获取未读通知数量
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const result = await pool.query(
      `SELECT COUNT(*) as c FROM notifications 
       WHERE receiver_id = ? AND is_read = 0`,
      [userId]
    )
    res.json({ count: parseInt(result.rows[0].c) })
  } catch (e) {
    res.status(500).json({ message: '获取未读数量失败' })
  }
})

// 标记单条通知已读
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const result = await pool.query(
      `UPDATE notifications SET is_read = 1 
       WHERE id = ? AND receiver_id = ?`,
      [req.params.id, userId]
    )
    if (result.affectedRows === 0) return res.status(404).json({ message: '通知不存在' })
    res.json({ message: '已标记已读' })
  } catch (e) {
    res.status(500).json({ message: '操作失败' })
  }
})

// 全部标记已读
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    await pool.query(
      `UPDATE notifications SET is_read = 1 
       WHERE receiver_id = ? AND is_read = 0`,
      [userId]
    )
    res.json({ message: '已全部标记已读' })
  } catch (e) {
    res.status(500).json({ message: '操作失败' })
  }
})

// 删除通知（用户自己可删）
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const result = await pool.query(
      `DELETE FROM notifications 
       WHERE id = ? AND receiver_id = ?`,
      [req.params.id, userId]
    )
    if (result.affectedRows === 0) return res.status(404).json({ message: '通知不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
