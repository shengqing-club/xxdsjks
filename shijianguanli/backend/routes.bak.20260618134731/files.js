import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { createChunkedDownloadHandler, createStreamingDownloadHandler } from '../utils/chunkedDownload.js'
import { decodeMultipartFilename } from '../utils/decodeFilename.js'
import crypto from 'crypto'

const router = Router()
router.use(authMiddleware)

// 使用 memoryStorage（文件存储在内存中，适合数据库 LONGBLOB 存储）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
})

// 预创建表（启动时执行一次，避免每次 init 都执行 CREATE TABLE）
pool.query(`
  CREATE TABLE IF NOT EXISTS upload_chunks (
    upload_id TEXT, chunk_index INT, chunk_data LONGBLOB, PRIMARY KEY (upload_id, chunk_index)
  )
`).catch(() => {})

pool.query(`
  CREATE TABLE IF NOT EXISTS upload_sessions (
    upload_id TEXT PRIMARY KEY,
    file_name TEXT, file_size BIGINT, file_type TEXT, total_chunks INT, received_chunks INT DEFAULT 0,
    title TEXT, course_name TEXT, class_name TEXT, uploader_id TEXT, uploader_name TEXT, uploader_role TEXT,
    category TEXT, version_group TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(() => {})

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

// ========== 分片上传 ==========

router.post('/upload/chunked/init', async (req, res) => {
  try {
    const { fileName, fileSize, fileType, totalChunks, category, uploaderRole, uploaderId, uploaderName } = req.body
    if (!fileName || !totalChunks) return res.status(400).json({ message: '参数不完整' })

    const uploadId = crypto.randomBytes(12).toString('hex')

    await pool.query(
      `INSERT INTO upload_sessions (upload_id, file_name, file_size, file_type, total_chunks, uploader_id, uploader_name, uploader_role, category)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uploadId, fileName, fileSize, fileType, parseInt(totalChunks),
       uploaderId || req.user.studentId || req.user.username,
       uploaderName || req.user.name || '',
       uploaderRole || (req.user.studentId ? 'student' : 'admin'),
       category || 'general']
    )

    res.json({ uploadId, chunkSize: 4 * 1024 * 1024 })
  } catch (e) {
    res.status(500).json({ message: '初始化失败: ' + e.message })
  }
})

// 完成分片上传（在内存中合并分片，MySQL 不支持 bytea_agg）
router.post('/upload/chunked/:uploadId/complete', async (req, res) => {
  try {
    const { uploadId } = req.params

    const session = await pool.query('SELECT * FROM upload_sessions WHERE upload_id = ?', [uploadId])
    if (session.rows.length === 0) return res.status(404).json({ message: '上传会话不存在' })
    const s = session.rows[0]

    if (s.received_chunks < s.total_chunks) {
      return res.status(400).json({ message: `分片不完整：${s.received_chunks}/${s.total_chunks}` })
    }

    // MySQL 不支持 bytea_agg，在内存中合并分片
    const chunksResult = await pool.query(
      'SELECT chunk_data FROM upload_chunks WHERE upload_id = ? ORDER BY chunk_index',
      [uploadId]
    )
    const chunks = chunksResult.rows.map(r => r.chunk_data).filter(Boolean)
    if (chunks.length === 0) return res.status(500).json({ message: '合并数据失败' })

    const mergedData = Buffer.concat(chunks.map(c => Buffer.isBuffer(c) ? c : Buffer.from(c)))

    const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex')

    const result = await pool.query(
      `INSERT INTO files (filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, file_data)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uniqueName, s.file_name, s.file_size, s.file_type, s.category || 'general', s.uploader_role, s.uploader_id, s.uploader_name, mergedData]
    )

    await pool.query('DELETE FROM upload_chunks WHERE upload_id = ?', [uploadId])
    await pool.query('DELETE FROM upload_sessions WHERE upload_id = ?', [uploadId])

    const insertedId = result.insertId
    const newRow = await pool.query(
      'SELECT id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at FROM files WHERE id = ?',
      [insertedId]
    )

    res.status(201).json(newRow.rows[0])
  } catch (e) {
    res.status(500).json({ message: '合并失败: ' + e.message })
  }
})

// 上传单个分片
router.post('/upload/chunked/:uploadId/:chunkIndex', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.params
    if (!req.file) return res.status(400).json({ message: '无文件数据' })

    await pool.query(
      'INSERT INTO upload_chunks (upload_id, chunk_index, chunk_data) VALUES (?,?,?) ON DUPLICATE KEY UPDATE chunk_data = ?',
      [uploadId, parseInt(chunkIndex), req.file.buffer, req.file.buffer]
    )

    await pool.query('UPDATE upload_sessions SET received_chunks = received_chunks + 1 WHERE upload_id = ?', [uploadId])

    res.json({ chunkIndex: parseInt(chunkIndex) })
  } catch (e) {
    res.status(500).json({ message: '分片上传失败: ' + e.message })
  }
})

// 上传文件 (内存存储 → MySQL LONGBLOB)
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
      return res.status(400).json({ message: `禁止上传危险文件类型：.${originalName.split('.').pop().toLowerCase()}` })
    }

    const uniqueName = Date.now() + '-' + crypto.randomBytes(4).toString('hex')

    const result = await pool.query(
      `INSERT INTO files (filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, file_data)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [uniqueName, originalName, file.size, file.mimetype, category || 'general', uploaderRole || 'admin', uploaderId || '', uploaderName || '', file.buffer]
    )

    const insertedId = result.insertId
    const newRow = await pool.query(
      'SELECT id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at FROM files WHERE id = ?',
      [insertedId]
    )
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    res.status(500).json({ message: '上传失败: ' + e.message })
  }
})

// ========== 下载文件 ==========

router.get('/:id/download', async (req, res) => {
  try {
    // 先查询元数据（不包含 file_data），避免大文件加载到内存
    const metaResult = await pool.query(
      'SELECT id, original_name, file_type, file_size, file_data IS NOT NULL as has_data FROM files WHERE id = ?',
      [req.params.id]
    )
    if (metaResult.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    const meta = metaResult.rows[0]

    if (!meta.has_data) {
      return res.status(404).json({ message: '文件内容已丢失（该文件可能是在旧版系统上传的）' })
    }

    const fileSize = parseInt(meta.file_size, 10) || 0

    // 超过 2MB 的文件禁止直接下载，前端应使用分片下载
    if (fileSize > 2 * 1024 * 1024) {
      return res.status(413).json({
        message: '文件过大，请使用分片下载',
        fileSize: fileSize,
        useChunked: true
      })
    }

    // 小文件才查询 file_data
    const result = await pool.query('SELECT file_data FROM files WHERE id = ?', [req.params.id])
    const file = result.rows[0]
    const fileBuffer = Buffer.isBuffer(file.file_data)
      ? file.file_data
      : Buffer.from(file.file_data)

    let contentType = meta.file_type || 'application/octet-stream'
    if (!contentType || contentType === 'application/x-compressed') {
      const ext = (meta.original_name || '').split('.').pop().toLowerCase()
      const mimeMap = {
        'rar': 'application/x-rar-compressed', 'zip': 'application/zip', '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar', 'gz': 'application/gzip', 'pdf': 'application/pdf',
        'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'mp4': 'video/mp4', 'mp3': 'audio/mpeg', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'gif': 'image/gif', 'txt': 'text/plain; charset=utf-8',
      }
      contentType = mimeMap[ext] || 'application/octet-stream'
    }

    res.json({
      base64: fileBuffer.toString('base64'),
      fileName: meta.original_name || 'download',
      fileType: contentType,
      fileSize: fileBuffer.length
    })
  } catch (e) {
    res.status(500).json({ message: '下载失败' })
  }
})

// 分片下载文件（兼容 Netlify 6MB 限制）
router.get('/:id/download/chunk', createChunkedDownloadHandler({
  tableName: 'files',
  idColumn: 'id',
  dataColumn: 'file_data',
  nameColumn: 'original_name',
  typeColumn: 'file_type'
}))

// 流式下载文件（非 Serverless 环境，直接二进制流，无 base64 开销）
router.get('/:id/download/stream', createStreamingDownloadHandler({
  tableName: 'files',
  idColumn: 'id',
  dataColumn: 'file_data',
  nameColumn: 'original_name',
  typeColumn: 'file_type'
}))

// 删除文件
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM files WHERE id = ?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ message: '文件不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export { isDangerousFile }
export default router
