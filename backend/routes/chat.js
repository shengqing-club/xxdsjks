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
      sql += ' WHERE created_at > $1'
      params.push(since)
    }
    sql += ' ORDER BY created_at ASC'
    if (limit) {
      sql += ' LIMIT $' + (params.length + 1)
      params.push(parseInt(limit) || 100)
    } else {
      sql += ' LIMIT 100'
    }
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取消息失败' })
  }
})

// 发送聊天消息（替代 Socket.IO）
router.post('/send', async (req, res) => {
  try {
    const { senderId, senderName, role, content } = req.body
    if (!content || !content.trim()) {
      return res.status(400).json({ message: '消息不能为空' })
    }
    const result = await pool.query(
      `INSERT INTO chat_messages (sender_id, sender_name, sender_role, content)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [senderId || '', senderName || '匿名用户', role || 'student', content.trim()]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error('发送消息失败:', e)
    res.status(500).json({ message: '发送失败: ' + e.message })
  }
})

// 获取在线人数（简化：用最近5分钟活跃用户数代替）
router.get('/online-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT sender_id) as count FROM chat_messages
       WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '5 minutes'`
    )
    res.json({ count: parseInt(result.rows[0].count) })
  } catch (e) {
    res.json({ count: 0 })
  }
})

// 获取通知（学生端）
router.get('/notifications', async (req, res) => {
  try {
    const { studentId } = req.query
    if (!studentId) return res.json([])
    const result = await pool.query(
      'SELECT * FROM notifications WHERE receiver_id = $1 ORDER BY created_at DESC LIMIT 50',
      [studentId]
    )
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取通知失败' })
  }
})

// 标记通知已读
router.put('/notifications/:id/read', async (req, res) => {
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [req.params.id])
    res.json({ message: '已读' })
  } catch (e) {
    res.status(500).json({ message: '操作失败' })
  }
})

// 获取未读通知数
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const { studentId } = req.query
    if (!studentId) return res.json({ count: 0 })
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE receiver_id = $1 AND is_read = false',
      [studentId]
    )
    res.json({ count: parseInt(result.rows[0].count) })
  } catch (e) {
    res.status(500).json({ message: '获取失败' })
  }
})

// 管理员：获取所有通知
router.get('/notifications/all', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200')
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取通知失败' })
  }
})

// 管理员：发送通知
router.post('/notifications', async (req, res) => {
  try {
    const { receiverIds, title, content, type } = req.body
    if (!receiverIds || !receiverIds.length) {
      return res.status(400).json({ message: '请指定接收人' })
    }
    for (const rid of receiverIds) {
      await pool.query(
        `INSERT INTO notifications (receiver_id, title, content, type)
         VALUES ($1,$2,$3,$4)`,
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
      // PostgreSQL 正确语法：用参数构造 interval
      sql += ` WHERE created_at < CURRENT_TIMESTAMP - $1 * INTERVAL '1 day'`
      params.push(olderThanDays)
    }
    const result = await pool.query(sql, params)
    res.json({ message: `已清空聊天记录`, deleted: result.rowCount })
  } catch (e) {
    console.error('清空聊天失败:', e)
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
      sql += ` WHERE created_at < CURRENT_TIMESTAMP - $1 * INTERVAL '1 day'`
      params.push(olderThanDays)
    }
    const result = await pool.query(sql, params)
    res.json({ message: `已清空通知记录`, deleted: result.rowCount })
  } catch (e) {
    console.error('清空通知失败:', e)
    res.status(500).json({ message: '清空通知失败: ' + e.message })
  }
})

export default router
