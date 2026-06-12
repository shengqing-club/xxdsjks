import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import multer from 'multer'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// 照片墙全局开关
let photoWallEnabled = true

// 获取照片墙开关状态
router.get('/setting', (req, res) => {
  res.json({ enabled: photoWallEnabled })
})

// 设置照片墙开关（仅管理员）
router.post('/setting', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: '无权限' })
  photoWallEnabled = req.body.enabled
  res.json({ enabled: photoWallEnabled })
})

// 上传照片
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!photoWallEnabled) return res.status(403).json({ message: '照片墙功能已关闭' })
    if (!req.file) return res.status(400).json({ message: '请选择照片' })
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ message: '只能上传图片文件' })

    const { description, is_public } = req.body
    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId

    const result = await pool.query(
      `INSERT INTO photo_wall (file_data, file_type, file_size, description, is_public, uploader_id, uploader_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, description, is_public, uploader_id, uploader_name, created_at`,
      [req.file.buffer, req.file.mimetype, req.file.size, description || '', is_public === 'true' || is_public === true, uploaderId, uploaderName]
    )

    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '上传失败: ' + e.message })
  }
})

// 获取照片列表
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (!photoWallEnabled) return res.json({ enabled: false, photos: [] })

    const userId = req.user.studentId || req.user.username
    const isAdmin = req.user.role === 'admin'

    let query, params
    if (isAdmin) {
      query = `SELECT id, file_type, file_size, description, is_public, uploader_id, uploader_name, created_at
               FROM photo_wall ORDER BY created_at DESC`
      params = []
    } else {
      query = `SELECT id, file_type, file_size, description, is_public, uploader_id, uploader_name, created_at
               FROM photo_wall WHERE is_public = true OR uploader_id = $1 ORDER BY created_at DESC`
      params = [userId]
    }

    const result = await pool.query(query, params)
    res.json({ enabled: true, photos: result.rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 下载/查看照片
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT file_data, file_type, file_size FROM photo_wall WHERE id = $1',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '照片不存在' })

    const photo = result.rows[0]
    const fileBuffer = Buffer.isBuffer(photo.file_data) ? photo.file_data : Buffer.from(photo.file_data)
    const fileType = photo.file_type || 'image/png'
    const isServerless = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT

    if (isServerless) {
      res.json({
        base64: fileBuffer.toString('base64'),
        fileType: fileType,
        fileSize: photo.file_size
      })
    } else {
      res.setHeader('Content-Type', fileType)
      res.setHeader('Content-Length', photo.file_size)
      res.send(fileBuffer)
    }
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '下载失败' })
  }
})

// 删除照片（管理员或上传者本人）
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const isAdmin = req.user.role === 'admin'

    if (!isAdmin) {
      const check = await pool.query('SELECT uploader_id FROM photo_wall WHERE id = $1', [req.params.id])
      if (check.rows.length === 0) return res.status(404).json({ message: '照片不存在' })
      if (check.rows[0].uploader_id !== userId) return res.status(403).json({ message: '只能删除自己的照片' })
    }

    await pool.query('DELETE FROM photo_wall WHERE id = $1', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '删除失败' })
  }
})

// 修改照片隐私设置
router.put('/:id/privacy', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const check = await pool.query('SELECT uploader_id FROM photo_wall WHERE id = $1', [req.params.id])
    if (check.rows.length === 0) return res.status(404).json({ message: '照片不存在' })
    if (check.rows[0].uploader_id !== userId) return res.status(403).json({ message: '只能修改自己的照片' })

    await pool.query('UPDATE photo_wall SET is_public = $1 WHERE id = $2', [req.body.is_public, req.params.id])
    res.json({ message: '设置成功' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '设置失败' })
  }
})

export default router
