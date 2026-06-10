import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// 使用 memoryStorage（兼容 Netlify serverless 环境）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

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

    res.setHeader('Content-Type', file.file_type || 'application/octet-stream')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`)
    res.setHeader('Content-Length', file.file_size)
    res.send(file.file_data)
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
