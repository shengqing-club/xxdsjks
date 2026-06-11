import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

// MIME 类型映射
const mimeTypes = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'audio/mpeg': 'mp3',
  'application/zip': 'zip', 'application/x-rar-compressed': 'rar',
}

// 获取分组聊天消息
router.get('/:group_id', async (req, res) => {
  try {
    const groupId = req.params.group_id
    const { since, limit = 100 } = req.query
    const userId = req.user.studentId || req.user.username

    // 检查用户是否在分组中
    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.username !== 'admin') {
      return res.status(403).json({ message: '无权访问此聊天频道' })
    }

    let sql = `SELECT id, group_id, sender_id, sender_name, sender_role,
               content, message_type, file_url, file_name, file_size, created_at,
               CASE WHEN file_data IS NOT NULL THEN true ELSE false END as has_file_data
               FROM group_chat_messages WHERE group_id = $1`
    const params = [groupId]
    if (since) {
      sql += ' AND created_at > $2'
      params.push(new Date(parseInt(since)))
    }
    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1)
    params.push(parseInt(limit))

    const result = await pool.query(sql, params)
    res.json(result.rows.reverse())
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取消息失败' })
  }
})

// 发送文字消息
router.post('/:group_id/send', async (req, res) => {
  try {
    const groupId = req.params.group_id
    const { content } = req.body
    const userId = req.user.studentId || req.user.username
    const userName = req.user.name || userId
    const userRole = req.user.studentId ? 'student' : 'admin'

    if (!content || !content.trim()) {
      return res.status(400).json({ message: '消息内容不能为空' })
    }

    // 检查分组是否活跃且用户在分组中
    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = $1', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      return res.status(400).json({ message: '分组不存在或已解散' })
    }

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.username !== 'admin') {
      return res.status(403).json({ message: '无权在此频道发送消息' })
    }

    const result = await pool.query(
      `INSERT INTO group_chat_messages
       (group_id, sender_id, sender_name, sender_role, content, message_type)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [groupId, userId, userName, userRole, content.trim(), 'text']
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '发送消息失败' })
  }
})

// 发送图片/文件消息
router.post('/:group_id/upload', upload.single('file'), async (req, res) => {
  try {
    const groupId = req.params.group_id
    const userId = req.user.studentId || req.user.username
    const userName = req.user.name || userId
    const userRole = req.user.studentId ? 'student' : 'admin'

    if (!req.file) return res.status(400).json({ message: '请选择文件' })

    // 检查权限
    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = $1', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      return res.status(400).json({ message: '分组不存在或已解散' })
    }

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.username !== 'admin') {
      return res.status(403).json({ message: '无权在此频道上传文件' })
    }

    // 修复中文文件名
    let originalName = req.file.originalname
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8')
    } catch {}

    const isImage = req.file.mimetype.startsWith('image/')
    const messageType = isImage ? 'image' : 'file'

    // 同时保存到 group_files 文件库
    await pool.query(
      `INSERT INTO group_files
       (group_id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        groupId,
        `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        originalName,
        req.file.size,
        req.file.mimetype,
        userId,
        userName,
        req.file.buffer
      ]
    )

    const result = await pool.query(
      `INSERT INTO group_chat_messages
       (group_id, sender_id, sender_name, sender_role, content, message_type, file_url, file_name, file_size, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        groupId, userId, userName, userRole,
        isImage ? '[图片]' : `[文件] ${originalName}`,
        messageType,
        `stored-in-db://${originalName}`,
        originalName,
        req.file.size,
        req.file.buffer
      ]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '上传失败' })
  }
})

// 下载聊天中的文件
router.get('/download/:message_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM group_chat_messages WHERE id = $1 AND message_type IN ($2, $3)',
      [req.params.message_id, 'file', 'image']
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '文件不存在' })
    }
    const msg = result.rows[0]

    if (!msg.file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }

    res.setHeader('Content-Type', 'application/octet-stream')
    const encodedName = encodeURIComponent(msg.file_name || 'download').replace(/['()]/g, escape)
    res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodedName}`)
    res.setHeader('Content-Length', msg.file_size)
    res.send(msg.file_data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '下载失败' })
  }
})

export default router
