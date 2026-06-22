import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import multer from 'multer'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const router = Router()

// ========== 上传配置：文件存磁盘，数据库只存路径 ==========
const UPLOAD_DIR = path.resolve('uploads/photo_wall')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex'))
  }
})

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } })

// 照片墙开关
const PHOTO_WALL_KEY = 'photo_wall_enabled'

async function getPhotoWallEnabled() {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE `key` = ?", [PHOTO_WALL_KEY])
    if (result.rows.length > 0) return result.rows[0].value === 'true'
  } catch (e) {
    console.error('读取照片墙设置失败:', e)
  }
  return true
}

async function setPhotoWallEnabled(enabled) {
  try {
    await pool.query(
      `INSERT INTO site_settings (\`key\`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [PHOTO_WALL_KEY, String(enabled)]
    )
  } catch (e) {
    console.error('保存照片墙设置失败:', e)
  }
}

// 确保 photo_wall 表有 file_path 列
const ensureColumns = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='photo_wall' AND column_name='file_path' AND table_schema = DATABASE()`
    )
    if (rows.length === 0) {
      await pool.query('ALTER TABLE photo_wall ADD COLUMN file_path VARCHAR(500)')
      console.log('已添加 photo_wall.file_path 列')
    }
  } catch (e) {}
}
ensureColumns().catch(() => {})

router.get('/setting', authMiddleware, async (req, res) => {
  const enabled = await getPhotoWallEnabled()
  res.json({ enabled })
})

router.post('/setting', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '无权限' })
  const enabled = !!req.body.enabled
  await setPhotoWallEnabled(enabled)
  res.json({ enabled })
})

// 上传照片（文件存磁盘，数据库只存路径）
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const enabled = await getPhotoWallEnabled()
    if (!enabled) {
      if (req.file) fs.unlink(req.file.path, () => {})
      return res.status(403).json({ message: '照片墙功能已关闭' })
    }
    if (!req.file) return res.status(400).json({ message: '请选择照片' })
    if (!req.file.mimetype.startsWith('image/')) {
      fs.unlink(req.file.path, () => {})
      return res.status(400).json({ message: '只能上传图片文件' })
    }

    const { description, is_public } = req.body
    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId

    const result = await pool.query(
      `INSERT INTO photo_wall (file_type, file_size, description, is_public, uploader_id, uploader_name, file_path)
       VALUES (?,?,?,?,?,?,?)`,
      [req.file.mimetype, req.file.size, description || '', is_public === 'true' || is_public === true ? 1 : 0, uploaderId, uploaderName, req.file.path]
    )

    const insertedId = result.insertId
    const newRow = await pool.query(
      'SELECT id, description, is_public, uploader_id, uploader_name, created_at FROM photo_wall WHERE id = ?',
      [insertedId]
    )
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    console.error('上传照片失败:', e)
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {})
    res.status(500).json({ message: '上传失败' })
  }
})

// 获取照片列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    const enabled = await getPhotoWallEnabled()
    if (!enabled) return res.json({ enabled: false, photos: [] })

    const userId = req.user.studentId || req.user.username
    const isAdmin = req.user.role === 'admin'

    let query, params
    if (isAdmin) {
      query = `SELECT id, file_type, file_size, description, is_public, uploader_id, uploader_name, created_at FROM photo_wall ORDER BY created_at DESC`
      params = []
    } else {
      query = `SELECT id, file_type, file_size, description, is_public, uploader_id, uploader_name, created_at FROM photo_wall WHERE is_public = 1 OR uploader_id = ? ORDER BY created_at DESC`
      params = [userId]
    }
    const result = await pool.query(query, params)
    res.json({ enabled: true, photos: result.rows })
  } catch (e) {
    console.error('获取照片列表失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 下载/查看照片（优先磁盘流式读取，兼容旧 BLOB）
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT file_type, file_path FROM photo_wall WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '照片不存在' })
    const photo = result.rows[0]
    const fileType = photo.file_type || 'image/png'

    res.setHeader('Content-Type', fileType)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    // 优先磁盘文件
    if (photo.file_path && fs.existsSync(photo.file_path)) {
      const stat = fs.statSync(photo.file_path)
      res.setHeader('Content-Length', stat.size)
      return fs.createReadStream(photo.file_path).pipe(res)
    }

    // 向后兼容 BLOB
    const blobResult = await pool.query('SELECT file_data FROM photo_wall WHERE id = ?', [req.params.id])
    if (blobResult.rows.length === 0 || !blobResult.rows[0].file_data) {
      return res.status(404).json({ message: '照片内容已丢失' })
    }
    const fileBuffer = Buffer.isBuffer(blobResult.rows[0].file_data) ? blobResult.rows[0].file_data : Buffer.from(blobResult.rows[0].file_data)
    res.setHeader('Content-Length', fileBuffer.length)
    res.end(fileBuffer)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: '下载失败' })
  }
})

// 删除照片（同时删除磁盘文件）
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const isAdmin = req.user.role === 'admin'

    const check = await pool.query('SELECT uploader_id, file_path FROM photo_wall WHERE id = ?', [req.params.id])
    if (check.rows.length === 0) return res.status(404).json({ message: '照片不存在' })
    if (!isAdmin && check.rows[0].uploader_id !== userId) {
      return res.status(403).json({ message: '只能删除自己的照片' })
    }

    if (check.rows[0].file_path) fs.unlink(check.rows[0].file_path, () => {})
    await pool.query('DELETE FROM photo_wall WHERE id = ?', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error('删除照片失败:', e)
    res.status(500).json({ message: '删除失败' })
  }
})

router.put('/:id/privacy', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const check = await pool.query('SELECT uploader_id FROM photo_wall WHERE id = ?', [req.params.id])
    if (check.rows.length === 0) return res.status(404).json({ message: '照片不存在' })
    if (check.rows[0].uploader_id !== userId) return res.status(403).json({ message: '只能修改自己的照片' })

    await pool.query('UPDATE photo_wall SET is_public = ? WHERE id = ?', [req.body.is_public ? 1 : 0, req.params.id])
    res.json({ message: '设置成功' })
  } catch (e) {
    console.error('修改照片隐私失败:', e)
    res.status(500).json({ message: '设置失败' })
  }
})

export default router
