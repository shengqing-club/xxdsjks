import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// 使用 memoryStorage（兼容 Netlify serverless 环境）
// 支持所有文件类型，最大50MB
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

// 下载文件
router.get('/:id/download', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
    const file = result.rows[0]

    if (!file.file_data) {
      return res.status(404).json({ message: '文件内容已丢失（该文件可能是在旧版系统上传的）' })
    }

    // 确保 file_data 是 Buffer（pg BYTEA 类型已是 Buffer）
    const fileBuffer = Buffer.isBuffer(file.file_data)
      ? file.file_data
      : Buffer.from(file.file_data)

    // 根据 file_type 或文件名推断 Content-Type
    let contentType = file.file_type || 'application/octet-stream'
    // 对无法识别的类型统一用 octet-stream，避免浏览器误判
    if (!contentType || contentType === 'application/x-compressed') {
      const ext = (file.original_name || '').split('.').pop().toLowerCase()
      const mimeMap = {
        'rar': 'application/x-rar-compressed',
        'zip': 'application/zip',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'txt': 'text/plain; charset=utf-8',
      }
      contentType = mimeMap[ext] || 'application/octet-stream'
    }

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`)
    res.setHeader('Content-Length', fileBuffer.length)  // 用实际 Buffer 长度，非数据库存储的 file_size 字符串
    res.end(fileBuffer)
  } catch (e) {
    console.error('下载失败:', e)
    res.status(500).json({ message: '下载失败' })
  }
})

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

// 学生上传权限设置
let studentUploadEnabled = true
router.get('/setting/student-upload', (req, res) => {
  res.json({ enabled: studentUploadEnabled })
})
router.post('/setting/student-upload', (req, res) => {
  studentUploadEnabled = req.body.enabled
  res.json({ enabled: studentUploadEnabled })
})

export default router
