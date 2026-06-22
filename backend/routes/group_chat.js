import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { decodeMultipartFilename } from '../utils/decodeFilename.js'
import fs from 'fs'
import path from 'path'

const router = Router()
router.use(authMiddleware)

// 文件存储根目录
const UPLOAD_DIR = '/www/wwwroot/student-system/uploads/group_chat'

// 确保上传目录存在
function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  }
}
ensureUploadDir()

// 使用磁盘存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir()
    cb(null, UPLOAD_DIR)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    cb(null, uniqueName)
  }
})

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

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
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权访问此聊天频道' })
    }

    let sql = `SELECT id, group_id, sender_id, sender_name, sender_role,
               content, message_type, file_url, file_name, file_size, created_at
               FROM group_chat_messages WHERE group_id = ?`
    const params = [groupId]
    if (since) {
      sql += ' AND created_at > ?'
      params.push(new Date(parseInt(since)))
    }
    sql += ' ORDER BY created_at DESC LIMIT ?'
    params.push(parseInt(limit))

    const result = await pool.query(sql, params)
    res.json(result.rows.reverse())
  } catch (e) {
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
    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = ?', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      return res.status(400).json({ message: '分组不存在或已解散' })
    }

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权在此频道发送消息' })
    }

    const result = await pool.query(
      `INSERT INTO group_chat_messages
       (group_id, sender_id, sender_name, sender_role, content, message_type)
       VALUES (?,?,?,?,?,?)`,
      [groupId, userId, userName, userRole, content.trim(), 'text']
    )

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT * FROM group_chat_messages WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
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
    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = ?', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      return res.status(400).json({ message: '分组不存在或已解散' })
    }

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
      return res.status(403).json({ message: '无权在此频道上传文件' })
    }

    const originalName = decodeMultipartFilename(req.file.originalname)

    const isImage = req.file.mimetype.startsWith('image/')
    const messageType = isImage ? 'image' : 'file'

    // 同时保存到 group_files 文件库
    const fileRecord = await pool.query(
      `INSERT INTO group_files
       (group_id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, file_path)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        groupId,
        path.basename(req.file.path),
        originalName,
        req.file.size,
        req.file.mimetype,
        userId,
        userName,
        req.file.path
      ]
    )

    const result = await pool.query(
      `INSERT INTO group_chat_messages
       (group_id, sender_id, sender_name, sender_role, content, message_type, file_url, file_name, file_size, file_path)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        groupId, userId, userName, userRole,
        isImage ? '[图片]' : `[文件] ${originalName}`,
        messageType,
        `stored-in-fs://${path.basename(req.file.path)}`,
        originalName,
        req.file.size,
        req.file.path
      ]
    )

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT * FROM group_chat_messages WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    console.error('Group chat upload error:', e)
    res.status(500).json({ message: '上传失败', error: e.message })
  }
})

// 下载聊天中的文件
router.get('/download/:message_id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_name, file_type, file_size, file_path FROM group_chat_messages WHERE id = ? AND message_type IN (?, ?)',
      [req.params.message_id, 'file', 'image']
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '文件不存在' })
    }
    const msg = result.rows[0]

    if (!msg.file_path || !fs.existsSync(msg.file_path)) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }

    const encodedName = encodeURIComponent(msg.file_name || 'download')
    res.setHeader('Content-Type', msg.file_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    res.sendFile(msg.file_path)
  } catch (e) {
    console.error('Group chat download error:', e)
    res.status(500).json({ message: '下载失败', error: e.message })
  }
})

export default router
