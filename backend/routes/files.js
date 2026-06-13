import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { createChunkedDownloadHandler } from '../utils/chunkedDownload.js'

const router = Router()
router.use(authMiddleware)

// 使用 memoryStorage（兼容 Netlify serverless 环境）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
})

// 确保 file_data 列存在
const ensureFileDataColumn = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='files' AND column_name='file_data'`
    )
    if (rows.length === 0) {
      await pool.query('ALTER TABLE files ADD COLUMN file_data BYTEA')
      console.log('已添加 files.file_data 列')
    }
  } catch (e) {
    console.error('添加 file_data 列失败:', e.message)
  }
}
ensureFileDataColumn()

// ========== 设置路由（必须在 /:id 路由之前，避免被参数匹配拦截） ==========

let studentUploadEnabled = true
router.get('/setting/student-upload', (req, res) => {
  res.json({ enabled: studentUploadEnabled })
})
router.post('/setting/student-upload', (req, res) => {
  studentUploadEnabled = req.body.enabled
  res.json({ enabled: studentUploadEnabled })
})

const DANGEROUS_EXTENSIONS = ['exe', 'dll', 'bat', 'cmd', 'sh', 'msi', 'scr', 'vbs', 'js', 'jar', 'apk', 'ipa']
let dangerousFileBlockEnabled = true

router.get('/setting/dangerous-file-block', (req, res) => {
  res.json({ enabled: dangerousFileBlockEnabled, extensions: DANGEROUS_EXTENSIONS })
})
router.post('/setting/dangerous-file-block', (req, res) => {
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
    if (category) { sql += ' AND category = $1'; params.push(category) }
    sql += ' ORDER BY created_at DESC'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    console.error('获取文件列表失败:', e)
    res.status(500).json({ message: '获取文件列表失败' })
  }
})

// ========== 分片上传 ==========

router.post('/upload/chunked/init', async (req, res) => {
  try {
    const { fileName, fileSize, fileType, totalChunks, category, uploaderRole, uploaderId, uploaderName } = req.body
    if (!fileName || !totalChunks) return res.status(400).json({ message: '参数不完整' })

    const uploadId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_sessions (
        upload_id TEXT PRIMARY KEY,
        file_name TEXT, file_size BIGINT, file_type TEXT, total_chunks INT, received_chunks INT DEFAULT 0,
        title TEXT, course_name TEXT, class_name TEXT, uploader_id TEXT, uploader_name TEXT, uploader_role TEXT,
        category TEXT, version_group TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    try {
      await pool.query(`ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS category TEXT`)
    } catch (e) { /* ignore */ }

    await pool.query(
      `INSERT INTO upload_sessions (upload_id, file_name, file_size, file_type, total_chunks, uploader_id, uploader_name, uploader_role, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [uploadId, fileName, fileSize, fileType, parseInt(totalChunks),
       uploaderId || req.user.studentId || req.user.username,
       uploaderName || req.user.name || '',
       uploaderRole || (req.user.studentId ? 'student' : 'admin'),
       category || 'general']
    )

    res.json({ uploadId, chunkSize: 4 * 1024 * 1024 })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '初始化失败' })
  }
})

// 完成分片上传
router.post('/upload/chunked/:uploadId/complete', async (req, res) => {
  try {
    const { uploadId } = req.params

    const session = await pool.query('SELECT * FROM upload_sessions WHERE upload_id = $1', [uploadId])
    if (session.rows.length === 0) return res.status(404).json({ message: '上传会话不存在' })
    const s = session.rows[0]

    if (s.received_chunks < s.total_chunks) {
      return res.status(400).json({ message: `分片不完整：${s.received_chunks}/${s.total_chunks}` })
    }

    const chunks = await pool.query(
      'SELECT chunk_index, chunk_data FROM upload_chunks WHERE upload_id = $1 ORDER BY chunk_index', [uploadId]
    )

    const totalBuffer = Buffer.concat(chunks.rows.map(c => c.chunk_data))
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9)

    const result = await pool.query(
      `INSERT INTO files (filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at`,
      [uniqueName, s.file_name, s.file_size, s.file_type, s.category || 'general', s.uploader_role, s.uploader_id, s.uploader_name, totalBuffer]
    )

    await pool.query('DELETE FROM upload_chunks WHERE upload_id = $1', [uploadId])
    await pool.query('DELETE FROM upload_sessions WHERE upload_id = $1', [uploadId])

    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '合并失败: ' + e.message })
  }
})

// 上传单个分片
router.post('/upload/chunked/:uploadId/:chunkIndex', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.params
    if (!req.file) return res.status(400).json({ message: '无文件数据' })

    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_chunks (
        upload_id TEXT, chunk_index INT, chunk_data BYTEA, PRIMARY KEY (upload_id, chunk_index)
      )
    `)

    await pool.query(
      'INSERT INTO upload_chunks (upload_id, chunk_index, chunk_data) VALUES ($1,$2,$3) ON CONFLICT (upload_id, chunk_index) DO UPDATE SET chunk_data = $3',
      [uploadId, parseInt(chunkIndex), req.file.buffer]
    )

    await pool.query('UPDATE upload_sessions SET received_chunks = received_chunks + 1 WHERE upload_id = $1', [uploadId])

    res.json({ chunkIndex: parseInt(chunkIndex) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '分片上传失败' })
  }
})

// 上传文件 (内存存储 → Neon BYTEA)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ message: '请选择文件' })

    const { category, uploaderRole, uploaderId, uploaderName, originalFilename } = req.body

    let originalName = originalFilename
    if (!originalName || typeof originalName !== 'string' || !originalName.trim()) {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    }
    originalName = originalName.trim()

    if (isDangerousFile(originalName)) {
      return res.status(400).json({ message: `禁止上传危险文件类型：.${originalName.split('.').pop().toLowerCase()}` })
    }

    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9)

    const result = await pool.query(
      `INSERT INTO files (filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, filename, original_name, file_size, file_type, category, uploader_role, uploader_id, uploader_name, created_at`,
      [uniqueName, originalName, file.size, file.mimetype, category || 'general', uploaderRole || 'admin', uploaderId || '', uploaderName || '', file.buffer]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error('上传失败:', e)
    res.status(500).json({ message: '上传失败: ' + e.message })
  }
})

// ========== 下载文件 ==========

router.get('/:id/download', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    const file = result.rows[0]

    if (!file.file_data) {
      return res.status(404).json({ message: '文件内容已丢失（该文件可能是在旧版系统上传的）' })
    }

    const fileBuffer = Buffer.isBuffer(file.file_data)
      ? file.file_data
      : Buffer.from(file.file_data)

    let contentType = file.file_type || 'application/octet-stream'
    if (!contentType || contentType === 'application/x-compressed') {
      const ext = (file.original_name || '').split('.').pop().toLowerCase()
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

    const encodedName = encodeURIComponent(file.original_name || 'download').replace(/['()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())

    const isServerless = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT
    if (isServerless) {
      res.json({
        base64: fileBuffer.toString('base64'),
        fileName: file.original_name || 'download',
        fileType: contentType,
        fileSize: fileBuffer.length
      })
    } else {
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
      res.setHeader('Content-Length', fileBuffer.length)
      res.end(fileBuffer)
    }
  } catch (e) {
    console.error('下载失败:', e)
    res.status(500).json({ message: '下载失败' })
  }
})

// 分片下载文件（绕过 Netlify 6MB 限制）
router.get('/:id/download/chunk', createChunkedDownloadHandler({
  tableName: 'files',
  idColumn: 'id',
  dataColumn: 'file_data',
  nameColumn: 'original_name',
  typeColumn: 'file_type'
}))

// 删除文件
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM files WHERE id = $1 RETURNING *', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error('删除失败:', e)
    res.status(500).json({ message: '删除失败' })
  }
})

export { isDangerousFile }
export default router
