import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import multer from 'multer'
import { createChunkedDownloadHandler } from '../utils/chunkedDownload.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// 照片墙开关状态：从数据库 site_settings 表读取
const PHOTO_WALL_KEY = 'photo_wall_enabled'

async function getPhotoWallEnabled() {
  try {
    const result = await pool.query("SELECT value FROM site_settings WHERE key = ?", [PHOTO_WALL_KEY])
    if (result.rows.length > 0) {
      return result.rows[0].value === 'true'
    }
  } catch (e) {
    console.error('读取照片墙设置失败:', e)
  }
  return true // 默认开启
}

async function setPhotoWallEnabled(enabled) {
  try {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [PHOTO_WALL_KEY, String(enabled)]
    )
  } catch (e) {
    console.error('保存照片墙设置失败:', e)
  }
}

// 获取照片墙开关状态
router.get('/setting', authMiddleware, async (req, res) => {
  const enabled = await getPhotoWallEnabled()
  res.json({ enabled })
})

// 设置照片墙开关（仅管理员）
router.post('/setting', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '无权限' })
  const enabled = !!req.body.enabled
  await setPhotoWallEnabled(enabled)
  res.json({ enabled })
})

// 上传照片
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const enabled = await getPhotoWallEnabled()
    if (!enabled) return res.status(403).json({ message: '照片墙功能已关闭' })
    if (!req.file) return res.status(400).json({ message: '请选择照片' })
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: '只能上传图片文件' })

    const { description, is_public } = req.body
    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId

    const result = await pool.query(
      `INSERT INTO photo_wall (file_data, file_type, file_size, description, is_public, uploader_id, uploader_name)
       VALUES (?,?,?,?,?,?,?)`,
      [req.file.buffer, req.file.mimetype, req.file.size, description || '', is_public === 'true' || is_public === true ? 1 : 0, uploaderId, uploaderName]
    )

    const insertedId = result.insertId
    const newRow = await pool.query(
      'SELECT id, description, is_public, uploader_id, uploader_name, created_at FROM photo_wall WHERE id = ?',
      [insertedId]
    )

    res.status(201).json(newRow.rows[0])
  } catch (e) {
    console.error('上传照片失败:', e)
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
      query = `SELECT id, file_type, file_size, description, is_public, uploader_id, uploader_name, created_at
               FROM photo_wall ORDER BY created_at DESC`
      params = []
    } else {
      query = `SELECT id, file_type, file_size, description, is_public, uploader_id, uploader_name, created_at
               FROM photo_wall WHERE is_public = 1 OR uploader_id = ? ORDER BY created_at DESC`
      params = [userId]
    }

    const result = await pool.query(query, params)
    res.json({ enabled: true, photos: result.rows })
  } catch (e) {
    console.error('获取照片列表失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 下载/查看照片
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_data, file_type, file_size FROM photo_wall WHERE id = ?',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '照片不存在' })

    const photo = result.rows[0]
    const fileBuffer = Buffer.isBuffer(photo.file_data) ? photo.file_data : Buffer.from(photo.file_data)
    const fileType = photo.file_type || 'image/png'

    // 超过 2MB 的文件禁止直接下载，前端应使用分片下载
    if (fileBuffer.length > 2 * 1024 * 1024) {
      return res.status(413).json({
        message: '文件过大，请使用分片下载',
        fileSize: fileBuffer.length,
        useChunked: true
      })
    }

    res.json({
      base64: fileBuffer.toString('base64'),
      fileType: fileType,
      fileSize: photo.file_size
    })
  } catch (e) {
    console.error('下载照片失败:', e)
    res.status(500).json({ message: '下载失败' })
  }
})

// 分片下载照片（绕过 Netlify 6MB 限制）
router.get('/download/:id/chunk', createChunkedDownloadHandler({
  tableName: 'photo_wall',
  idColumn: 'id',
  dataColumn: 'file_data',
  nameColumn: "'photo'",
  typeColumn: 'file_type'
}))

// 删除照片（管理员或上传者本人）
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const isAdmin = req.user.role === 'admin'

    if (!isAdmin) {
      const check = await pool.query('SELECT uploader_id FROM photo_wall WHERE id = ?', [req.params.id])
      if (check.rows.length === 0) return res.status(404).json({ message: '照片不存在' })
      if (check.rows[0].uploader_id !== userId) return res.status(403).json({ message: '只能删除自己的照片' })
    }

    await pool.query('DELETE FROM photo_wall WHERE id = ?', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error('删除照片失败:', e)
    res.status(500).json({ message: '删除失败' })
  }
})

// 修改照片隐私设置
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
