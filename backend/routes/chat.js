import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// 获取最近聊天消息（支持 since 参数用于轮询）
router.get('/', async (req, res) => {
  try {
    const { since, limit } = req.query
    let sql = 'SELECT * FROM chat_messages'
    const params = []
    if (since) {
      sql += ' WHERE created_at > ?'
      params.push(since)
    }
    sql += ' ORDER BY created_at ASC'
    if (limit) {
      sql += ' LIMIT ?'
      params.push(parseInt(limit) || 100)
    } else {
      sql += ' LIMIT 100'
    }
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取消息失败' })
  }
})

// 发送聊天消息（从 token 中获取用户信息，防止冒充）
router.post('/send', async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ message: '消息不能为空' })
    }
    const senderId = req.user.studentId || req.user.username || ''
    const senderName = req.user.name || req.user.username || '匿名用户'
    const role = req.user.role || 'student'
    const result = await pool.query(
      `INSERT INTO chat_messages (sender_id, sender_name, sender_role, content)
       VALUES (?,?,?,?)`,
      [senderId, senderName, role, content.trim()]
    )

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT * FROM chat_messages WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    console.error('发送聊天消息失败:', e)
    res.status(500).json({ message: '发送失败' })
  }
})

// 获取在线人数（简化：用最近5分钟活跃用户数代替）
router.get('/online-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT sender_id) as count FROM chat_messages
       WHERE created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
    )
    res.json({ count: parseInt(result.rows[0].count) })
  } catch (e) {
    res.json({ count: 0 })
  }
})

// 获取通知（学生端）
router.get('/notifications', async (req, res) => {
  try {
    const studentId = req.user.studentId
    if (!studentId) return res.json([])
    const result = await pool.query(
      'SELECT * FROM notifications WHERE receiver_id = ? ORDER BY created_at DESC LIMIT 50',
      [studentId]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取通知失败' })
  }
})

// 标记通知为已读
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const result = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND receiver_id = ?',
      [req.params.id, userId]
    )
    if (result.affectedRows === 0) return res.status(403).json({ message: '无权操作此通知' })
    res.json({ message: '已标记为已读' })
  } catch (e) {
    res.status(500).json({ message: '标记失败' })
  }
})

// 标记所有通知为已读
router.post('/notifications/read-all', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE receiver_id = ?', [req.user.studentId])
    res.json({ message: '全部已读' })
  } catch (e) {
    res.status(500).json({ message: '标记失败' })
  }
})

// 删除通知
router.delete('/notifications/:id', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND receiver_id = ?',
      [req.params.id, userId]
    )
    if (result.affectedRows === 0) return res.status(403).json({ message: '无权删除此通知' })
    res.json({ message: '已删除' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

// 获取未读通知数
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const studentId = req.user.studentId
    if (!studentId) return res.json({ count: 0 })
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE receiver_id = ? AND is_read = 0',
      [studentId]
    )
    res.json({ count: parseInt(result.rows[0].count) })
  } catch (e) {
    res.status(500).json({ message: '获取失败' })
  }
})

// 管理员：获取所有通知
router.get('/notifications/all', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取通知失败' })
  }
})

// 管理员：发送通知
router.post('/notifications', adminMiddleware, async (req, res) => {
  try {
    const { receiverIds, title, content, type } = req.body
    if (!receiverIds || !receiverIds.length) {
      return res.status(400).json({ message: '请指定接收人' })
    }
    for (const rid of receiverIds) {
      await pool.query(
        `INSERT INTO notifications (receiver_id, title, content, type)
         VALUES (?,?,?,?)`,
        [rid, title, content, type || 'info']
      )
    }
    res.json({ message: `已向 ${receiverIds.length} 人发送通知` })
  } catch (e) {
    res.status(500).json({ message: '发送失败' })
  }
})

// 管理端：清空聊天记录（防止数据库溢出）
router.delete('/clear', adminMiddleware, async (req, res) => {
  try {
    const { olderThanDays } = req.body
    let sql = 'DELETE FROM chat_messages'
    const params = []
    if (olderThanDays) {
      sql += ` WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`
      params.push(olderThanDays)
    }
    const result = await pool.query(sql, params)
    res.json({ message: `已清空聊天记录`, deleted: result.affectedRows })
  } catch (e) {
    res.status(500).json({ message: '清空聊天失败: ' + e.message })
  }
})

// 管理端：清空通知记录
router.delete('/notifications/clear', adminMiddleware, async (req, res) => {
  try {
    const { olderThanDays } = req.body
    let sql = 'DELETE FROM notifications'
    const params = []
    if (olderThanDays) {
      sql += ` WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`
      params.push(olderThanDays)
    }
    const result = await pool.query(sql, params)
    res.json({ message: `已清空通知记录`, deleted: result.affectedRows })
  } catch (e) {
    res.status(500).json({ message: '清空通知失败: ' + e.message })
  }
})

export default router
