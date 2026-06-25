import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { decodeMultipartFilename } from '../utils/decodeFilename.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const router = Router()
router.use(authMiddleware)

// ========== 上传配置：文件存磁盘，数据库只存路径 ==========
const UPLOAD_DIR = path.resolve('uploads/files')
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

// MIME 类型推断
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

// ========== 设置路由 ==========

let studentUploadEnabled = true
router.get('/setting/student-upload', authMiddleware, async (req, res) => {
  res.json({ enabled: studentUploadEnabled })
})
router.post('/setting/student-upload', adminMiddleware, (req, res) => {
  studentUploadEnabled = req.body.enabled
  res.json({ enabled: studentUploadEnabled })
})

const DANGEROUS_EXTENSIONS = ['exe', 'dll', 'bat', 'cmd', 'sh', 'msi', 'scr', 'vbs', 'js', 'jar', 'apk', 'ipa']
let dangerousFileBlockEnabled = true

router.get('/setting/dangerous-file-block', authMiddleware, async (req, res) => {
  res.json({ enabled: dangerousFileBlockEnabled, extensions: DANGEROUS_EXTENSIONS })
})
router.post('/setting/dangerous-file-block', authMiddleware, (req, res) => {
  dangerousFileBlockEnabled = req.body.enabled
  res.json({ enabled: dangerousFileBlockEnabled, extensions: DANGEROUS_EXTENSIONS })
})

function isDangerousFile(filename) {
  if (!dangerousFileBlockEnabled) return false
  const ext = filename.split('.').pop().toLowerCase()
  return DANGEROUS_EXTENSIONS.includes(ext)
}

// ========== 文件 CRUD ==========

// 获取文件列表
router.get('/', async (req, res) => {
  try {
    const { category } = req.query
    let sql = 'SELECT id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at FROM files WHERE 1=1'
    const params = []
    if (category) { sql += ' AND category = ?'; params.push(category) }
    sql += ' ORDER BY created_at DESC'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取文件列表失败' })
  }
})

// ========== 文件上传（文件存磁盘，数据库只存路径，零内存拷贝） ==========
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: '请选择文件' })

    const { category, uploaderRole, uploaderId, uploaderName, originalFilename } = req.body

    let originalName = originalFilename
    if (!originalName || typeof originalName !== 'string' || !originalName.trim()) {
      originalName = decodeMultipartFilename(file.originalname)
    }
    originalName = originalName.trim()

    if (isDangerousFile(originalName)) {
      // 删除已上传的临时文件
      fs.unlink(file.path, () => {})
      return res.status(400).json({ message: `禁止上传危险文件类型：.${originalName.split('.').pop().toLowerCase()}` })
    }

    const diskFileName = path.basename(file.path)

    // 数据库只存文件路径，不存文件内容
    const result = await pool.query(
      `INSERT INTO files (filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, file_path)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [diskFileName, originalName, file.size, file.mimetype, category || 'general', uploaderRole || 'admin', uploaderId || '', uploaderName || '', file.path]
    )

    const insertedId = result.insertId
    const newRow = await pool.query(
      'SELECT id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at FROM files WHERE id = ?',
      [insertedId]
    )
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    // 上传失败时清理磁盘文件
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {})
    }
    res.status(500).json({ message: '上传失败: ' + e.message })
  }
})

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
const chunkUpload = multer({ storage: chunkStorage, limits: { fileSize: 3 * 1024 * 1024 } }) // 3MB per chunk max

// ========== 分片上传：接收单个分片 ==========
router.post('/upload/chunk', chunkUpload.single('chunk'), async (req, res) => {
  try {
    const { hash, chunkIndex, totalChunks, fileName, fileSize, fileType } = req.body
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
router.post('/upload/merge', async (req, res) => {
  try {
    const { hash, totalChunks, fileName, fileSize, fileType, category, uploaderRole, uploaderId, uploaderName } = req.body
    if (!hash || !totalChunks || !fileName) {
      return res.status(400).json({ message: '缺少必要参数: hash, totalChunks, fileName' })
    }

    const total = Number(totalChunks)
    const hashDir = path.join(CHUNK_DIR, hash)
    if (!fs.existsSync(hashDir)) {
      return res.status(400).json({ message: '分片目录不存在' })
    }

    // Stream each chunk into the final file to avoid loading all into memory
    const finalPath = path.join(UPLOAD_DIR, Date.now() + '-' + crypto.randomBytes(8).toString('hex'))
    const writeStream = fs.createWriteStream(finalPath)
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(hashDir, String(i))
      if (!fs.existsSync(chunkPath)) {
        writeStream.close()
        return res.status(400).json({ message: `分片 ${i} 缺失` })
      }
      const chunkStream = fs.createReadStream(chunkPath)
      await new Promise((resolve, reject) => {
        chunkStream.pipe(writeStream, { end: false })
        chunkStream.on('end', resolve)
        chunkStream.on('error', reject)
      })
    }
    writeStream.end()

    // Wait for write stream to finish before proceeding
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve)
      writeStream.on('error', reject)
    })

    // Delete the chunks directory after successful merge
    fs.rmSync(hashDir, { recursive: true, force: true })

    // Determine MIME type
    const mimeType = fileType || guessMimeType(fileName)

    // Insert record into files table
    const result = await pool.query(
      `INSERT INTO files (filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, file_path)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [path.basename(finalPath), fileName, fileSize || 0, mimeType, category || 'general', uploaderRole || 'admin', uploaderId || '', uploaderName || '', finalPath]
    )

    const insertedId = result.insertId
    const newRow = await pool.query(
      'SELECT id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at FROM files WHERE id = ?',
      [insertedId]
    )
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    res.status(500).json({ message: '合并分片失败: ' + e.message })
  }
})

// ========== 秒传：通过 SHA-256 哈希检查文件是否已存在 ==========
router.post('/check-hash', async (req, res) => {
  try {
    const { hash, fileName, fileSize } = req.body
    if (!hash) return res.status(400).json({ message: '缺少 hash 参数' })

    // 在 files 表中查找相同 hash 的文件（通过 file_path 间接匹配，或直接查 file_hash 列）
    // 由于现有表没有 file_hash 列，我们通过文件大小 + 文件名来辅助判断
    // 但更好的方案是：先检查 chunks 目录是否已存在完整文件（说明之前已合并过）
    const CHUNK_DIR = path.resolve('uploads/chunks')
    const hashDir = path.join(CHUNK_DIR, hash)
    
    // 检查是否有已存在的文件记录（通过原始文件名和大小匹配）
    const result = await pool.query(
      'SELECT id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at FROM files WHERE original_name = ? AND file_size = ? ORDER BY created_at DESC LIMIT 1',
      [fileName, fileSize]
    )
    
    if (result.rows.length > 0) {
      // 验证磁盘文件确实存在
      const existingFile = result.rows[0]
      const filePath = await pool.query('SELECT file_path FROM files WHERE id = ?', [existingFile.id])
      if (filePath.rows.length > 0 && filePath.rows[0].file_path && fs.existsSync(filePath.rows[0].file_path)) {
        return res.json({ exists: true, file: existingFile })
      }
    }

    res.json({ exists: false })
  } catch (e) {
    res.status(500).json({ message: '检查文件哈希失败: ' + e.message })
  }
})

// ========== 分片上传：查询已上传的分片进度 ==========
router.get('/upload/progress/:hash', async (req, res) => {
  try {
    const { hash } = req.params
    const hashDir = path.join(CHUNK_DIR, hash)
    if (!fs.existsSync(hashDir)) {
      return res.json({ uploadedChunks: [] })
    }
    const files = fs.readdirSync(hashDir)
    const uploadedChunks = files
      .map(f => Number(f))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)
    res.json({ uploadedChunks })
  } catch (e) {
    res.status(500).json({ message: '查询分片进度失败: ' + e.message })
  }
})

// ========== 下载文件（优先从磁盘读取，兼容旧的数据库 BLOB） ==========

router.get('/:id/download', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, original_name, file_type, file_size, file_path FROM files WHERE id = ?',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    const meta = result.rows[0]

    const contentType = meta.file_type || guessMimeType(meta.original_name)
    const encodedName = encodeURIComponent(meta.original_name || 'download')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    // 优先从磁盘文件读取（新上传的文件）
    if (meta.file_path && fs.existsSync(meta.file_path)) {
      const stat = fs.statSync(meta.file_path)
      res.setHeader('Content-Length', stat.size)
      return fs.createReadStream(meta.file_path).pipe(res)
    }

    // 向后兼容：从数据库 BLOB 读取（旧数据）
    const blobResult = await pool.query('SELECT file_data FROM files WHERE id = ?', [req.params.id])
    if (blobResult.rows.length === 0 || !blobResult.rows[0].file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }
    const fileBuffer = Buffer.isBuffer(blobResult.rows[0].file_data)
      ? blobResult.rows[0].file_data
      : Buffer.from(blobResult.rows[0].file_data)
    res.setHeader('Content-Length', fileBuffer.length)
    res.end(fileBuffer)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: '下载失败' })
  }
})

// 流式下载
router.get('/:id/download/stream', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, original_name, file_type, file_size, file_path FROM files WHERE id = ?',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    const meta = result.rows[0]

    const contentType = meta.file_type || guessMimeType(meta.original_name)
    const encodedName = encodeURIComponent(meta.original_name || 'download')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    // 优先从磁盘文件读取
    if (meta.file_path && fs.existsSync(meta.file_path)) {
      const stat = fs.statSync(meta.file_path)
      res.setHeader('Content-Length', stat.size)
      return fs.createReadStream(meta.file_path).pipe(res)
    }

    // 向后兼容：从数据库 BLOB 读取
    const blobResult = await pool.query('SELECT file_data FROM files WHERE id = ?', [req.params.id])
    if (blobResult.rows.length === 0 || !blobResult.rows[0].file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }
    const fileBuffer = Buffer.isBuffer(blobResult.rows[0].file_data)
      ? blobResult.rows[0].file_data
      : Buffer.from(blobResult.rows[0].file_data)
    res.setHeader('Content-Length', fileBuffer.length)
    res.end(fileBuffer)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: '下载失败' })
  }
})

// 删除文件（同时删除磁盘文件）
router.delete('/:id', async (req, res) => {
  try {
    // 先查出文件路径
    const fileResult = await pool.query('SELECT file_path FROM files WHERE id = ?', [req.params.id])
    if (fileResult.rows.length > 0 && fileResult.rows[0].file_path) {
      fs.unlink(fileResult.rows[0].file_path, () => {})
    }

    const result = await pool.query('DELETE FROM files WHERE id = ?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ message: '文件不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export { isDangerousFile }
export default router
