import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// 获取分组文件列表
router.get('/:group_id', async (req, res) => {
  try {
    const groupId = req.params.group_id
    const userId = req.user.studentId || req.user.username

    // 检查权限
    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.username !== 'admin') {
      return res.status(403).json({ message: '无权访问此文件库' })
    }

    const result = await pool.query(
      `SELECT id, file_name, original_name, file_size, file_type,
       uploader_id, uploader_name, created_at
       FROM group_files WHERE group_id = $1 ORDER BY created_at DESC`,
      [groupId]
    )
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取文件列表失败' })
  }
})

// 上传文件到分组
router.post('/:group_id/upload', upload.single('file'), async (req, res) => {
  try {
    const groupId = req.params.group_id
    const userId = req.user.studentId || req.user.username
    const userName = req.user.name || userId

    if (!req.file) return res.status(400).json({ message: '请选择文件' })

    // 检查权限
    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = $1', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      return res.status(400).json({ message: '分组不存在或已解散' })
    }

    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2',
      [groupId, userId]
    )
    if (memberCheck.rows.length === 0 && req.user.username !== 'admin') {
      return res.status(403).json({ message: '无权上传文件' })
    }

    let originalName = req.file.originalname
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8')
    } catch {}

    const result = await pool.query(
      `INSERT INTO group_files
       (group_id, file_name, original_name, file_size, file_type, uploader_id, uploader_name, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        groupId,
        `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        originalName,
        req.file.size,
        req.file.mimetype,
        userId,
        userName,
        req.file.buffer
      ]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '上传失败' })
  }
})

// 下载分组文件
router.get('/download/:file_id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM group_files WHERE id = $1', [req.params.file_id])
    if (result.rows.length === 0) {
      return res.status(404).json({ message: '文件不存在' })
    }
    const file = result.rows[0]

    if (!file.file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }

    const fileBuffer = Buffer.isBuffer(file.file_data) ? file.file_data : Buffer.from(file.file_data)

    res.setHeader('Content-Type', file.file_type || 'application/octet-stream')
    const encodedName = encodeURIComponent(file.original_name || 'download').replace(/['()]/g, escape)
    res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodedName}`)
    res.setHeader('Content-Length', fileBuffer.length)

    const isServerless = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT
    if (isServerless) {
      res.json({
        base64: fileBuffer.toString('base64'),
        fileName: file.original_name || 'download',
        fileType: file.file_type || 'application/octet-stream',
        fileSize: fileBuffer.length
      })
    } else {
      res.end(fileBuffer)
    }
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '下载失败' })
  }
})

// 删除分组文件
router.delete('/:file_id', async (req, res) => {
  try {
    const fileId = req.params.file_id
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    const fileResult = await pool.query('SELECT * FROM group_files WHERE id = $1', [fileId])
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ message: '文件不存在' })
    }
    const file = fileResult.rows[0]

    // 检查权限（上传者或管理员或组长）
    if (!isAdmin && file.uploader_id !== userId) {
      const leaderCheck = await pool.query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2 AND role = $3',
        [file.group_id, userId, 'leader']
      )
      if (leaderCheck.rows.length === 0) {
        return res.status(403).json({ message: '无权删除此文件' })
      }
    }

    await pool.query('DELETE FROM group_files WHERE id = $1', [fileId])
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
