import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { decodeMultipartFilename } from '../utils/decodeFilename.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const router = Router()
router.use(authMiddleware)

// ========== 上传配置：文件存磁盘，数据库只存路径 ==========
const UPLOAD_DIR = path.resolve('uploads/group_files')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex'))
  }
})

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// ========== 分片上传配置 ==========
const CHUNK_DIR = path.resolve('uploads/chunks')
if (!fs.existsSync(CHUNK_DIR)) fs.mkdirSync(CHUNK_DIR, { recursive: true })

const chunkStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const hashDir = path.join(CHUNK_DIR, req.body.hash || 'unknown')
    if (!fs.existsSync(hashDir)) fs.mkdirSync(hashDir, { recursive: true })
    cb(null, hashDir)
  },
  filename: (req, file, cb) => {
    cb(null, req.body.chunkIndex || '0')
  }
})
const chunkUpload = multer({ storage: chunkStorage, limits: { fileSize: 3 * 1024 * 1024 } })

// MIME 推断
function guessMimeType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  const map = {
    'rar': 'application/x-rar-compressed', 'zip': 'application/zip', '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar', 'gz': 'application/gzip', 'pdf': 'application/pdf',
    'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'mp4': 'video/mp4', 'mp3': 'audio/mpeg', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'txt': 'text/plain; charset=utf-8',
  }
  return map[ext] || 'application/octet-stream'
}

// 确保 group_files 表有 file_path 列
const ensureColumns = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='group_files' AND column_name='file_path' AND table_schema = DATABASE()`
    )
    if (rows.length === 0) {
      await pool.query('ALTER TABLE group_files ADD COLUMN file_path VARCHAR(500)')
      console.log('已添加 group_files.file_path 列')
    }
  } catch (e) {}
}
ensureColumns().catch(() => {})

// 获取分组文件列表
router.get('/:group_id', async (req, res) => {
  try {
    const groupId = req.params.group_id
    const userId = req.user.studentId || req.user.username

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?', [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权访问此文件库' })
    }

    const result = await pool.query(
      `SELECT id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, created_at
       FROM group_files WHERE group_id = ? ORDER BY created_at DESC`, [groupId]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取文件列表失败' })
  }
})

// 上传文件到分组（文件存磁盘，数据库只存路径）
router.post('/:group_id/upload', upload.single('file'), async (req, res) => {
  try {
    const groupId = req.params.group_id
    const userId = req.user.studentId || req.user.username
    const userName = req.user.name || userId

    if (!req.file) return res.status(400).json({ message: '请选择文件' })

    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = ?', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      fs.unlink(req.file.path, () => {})
      return res.status(400).json({ message: '分组不存在或已解散' })
    }

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?', [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
      fs.unlink(req.file.path, () => {})
      return res.status(403).json({ message: '无权上传文件' })
    }

    const originalName = decodeMultipartFilename(req.file.originalname)
    const diskFileName = path.basename(req.file.path)

    const result = await pool.query(
      `INSERT INTO group_files
       (group_id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, file_path)
       VALUES (?,?,?,?,?,?,?,?)`,
      [groupId, diskFileName, originalName, req.file.size, req.file.mimetype, userId, userName, req.file.path]
    )

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT id, group_id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, created_at FROM group_files WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {})
    res.status(500).json({ message: '上传失败' })
  }
})

// ========== 分片上传：接收单个分片 ==========
router.post('/:group_id/upload/chunk', chunkUpload.single('chunk'), async (req, res) => {
  try {
    const { hash, chunkIndex, totalChunks } = req.body
    if (!hash || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ message: '缺少必要参数: hash, chunkIndex, totalChunks' })
    }
    if (!req.file) {
      return res.status(400).json({ message: '未接收到分片文件' })
    }
    res.json({ received: Number(chunkIndex) })
  } catch (e) {
    res.status(500).json({ message: '分片上传失败: ' + e.message })
  }
})

// ========== 分片上传：合并所有分片 ==========
router.post('/:group_id/upload/merge', async (req, res) => {
  try {
    const groupId = req.params.group_id
    const userId = req.user.studentId || req.user.username
    const userName = req.user.name || userId
    const { hash, totalChunks, fileName, fileSize, fileType } = req.body
    if (!hash || !totalChunks || !fileName) {
      return res.status(400).json({ message: '缺少必要参数: hash, totalChunks, fileName' })
    }

    // 权限检查
    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = ?', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      return res.status(400).json({ message: '分组不存在或已解散' })
    }
    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ?', [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权上传文件' })
    }

    const total = Number(totalChunks)
    const hashDir = path.join(CHUNK_DIR, hash)
    if (!fs.existsSync(hashDir)) return res.status(400).json({ message: '分片目录不存在' })

    // Stream merge
    const finalPath = path.join(UPLOAD_DIR, Date.now() + '-' + crypto.randomBytes(8).toString('hex'))
    const writeStream = fs.createWriteStream(finalPath)
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(hashDir, String(i))
      if (!fs.existsSync(chunkPath)) { writeStream.close(); return res.status(400).json({ message: `分片 ${i} 缺失` }) }
      const chunkStream = fs.createReadStream(chunkPath)
      await new Promise((resolve, reject) => { chunkStream.pipe(writeStream, { end: false }); chunkStream.on('end', resolve); chunkStream.on('error', reject) })
    }
    writeStream.end()
    await new Promise((resolve, reject) => { writeStream.on('finish', resolve); writeStream.on('error', reject) })
    fs.rmSync(hashDir, { recursive: true, force: true })

    const mimeType = fileType || guessMimeType(fileName)
    const result = await pool.query(
      `INSERT INTO group_files (group_id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, file_path) VALUES (?,?,?,?,?,?,?,?)`,
      [groupId, path.basename(finalPath), fileName, fileSize || 0, mimeType, userId, userName, finalPath]
    )

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT id, group_id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, created_at FROM group_files WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    res.status(500).json({ message: '合并分片失败: ' + e.message })
  }
})

// ========== 分片上传：查询进度 ==========
router.get('/:group_id/upload/progress/:hash', async (req, res) => {
  try {
    const hashDir = path.join(CHUNK_DIR, req.params.hash)
    if (!fs.existsSync(hashDir)) return res.json({ uploadedChunks: [] })
    const files = fs.readdirSync(hashDir)
    res.json({ uploadedChunks: files.map(f => Number(f)).filter(n => !isNaN(n)).sort((a, b) => a - b) })
  } catch (e) {
    res.status(500).json({ message: '查询分片进度失败' })
  }
})

// 下载分组文件（优先磁盘流式读取，兼容旧 BLOB）
router.get('/download/:file_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT original_name, file_type, file_path FROM group_files WHERE id = ?', [req.params.file_id])
    if (result.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    const file = result.rows[0]

    const contentType = file.file_type || guessMimeType(file.original_name)
    const encodedName = encodeURIComponent(file.original_name || 'download')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    // 优先磁盘文件
    if (file.file_path && fs.existsSync(file.file_path)) {
      const stat = fs.statSync(file.file_path)
      res.setHeader('Content-Length', stat.size)
      return fs.createReadStream(file.file_path).pipe(res)
    }

    // 向后兼容 BLOB
    const blobResult = await pool.query('SELECT file_data FROM group_files WHERE id = ?', [req.params.file_id])
    if (blobResult.rows.length === 0 || !blobResult.rows[0].file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }
    const fileBuffer = Buffer.isBuffer(blobResult.rows[0].file_data) ? blobResult.rows[0].file_data : Buffer.from(blobResult.rows[0].file_data)
    res.setHeader('Content-Length', fileBuffer.length)
    res.end(fileBuffer)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: '下载失败' })
  }
})

// 删除分组文件（同时删除磁盘文件）
router.delete('/:file_id', async (req, res) => {
  try {
    const fileId = req.params.file_id
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    const fileResult = await pool.query('SELECT * FROM group_files WHERE id = ?', [fileId])
    if (fileResult.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    const file = fileResult.rows[0]

    if (!isAdmin && file.uploader_id !== userId) {
      const leaderCheck = await pool.query(
        'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ? AND role = ?',
        [file.group_id, userId, 'leader']
      )
      if (leaderCheck.rows.length === 0) return res.status(403).json({ message: '无权删除此文件' })
    }

    if (file.file_path) fs.unlink(file.file_path, () => {})
    await pool.query('DELETE FROM group_files WHERE id = ?', [fileId])
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
