import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = Router()

// ============ multer 配置 ============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'))
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, uniqueSuffix + ext)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.zip', '.rar']
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件类型，仅支持: ' + allowed.join(', ')))
    }
  }
})

// ============ 路由 ============

// 获取复习资料列表（登录用户可看）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { class_name, course_name } = req.query
    let sql = 'SELECT * FROM study_materials WHERE 1=1'
    const params = []
    let idx = 1
    if (class_name) {
      sql += ` AND class_name = $${idx++}`
      params.push(class_name)
    }
    if (course_name) {
      sql += ` AND course_name = $${idx++}`
      params.push(course_name)
    }
    sql += ' ORDER BY created_at DESC'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取复习资料失败' })
  }
})

// 上传复习资料
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择文件' })

    const { title, course_name, class_name } = req.body
    if (!title) return res.status(400).json({ message: '请输入资料标题' })

    const fileUrl = `/uploads/${req.file.filename}`
    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId
    // 判断角色：有 studentId 说明是 JWT 里带的学生，否则是管理员
    const uploaderRole = req.user.studentId ? 'student' : 'admin'

    const result = await pool.query(
      `INSERT INTO study_materials 
        (title, file_url, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        title,
        fileUrl,
        req.file.originalname,
        req.file.size,
        path.extname(req.file.originalname).slice(1),
        course_name || null,
        class_name || null,
        uploaderId,
        uploaderName,
        uploaderRole
      ]
    )

    // 如果指定了班级，给该班所有学生发通知
    if (class_name) {
      try {
        const students = await pool.query(
          'SELECT student_id FROM students WHERE class_name = $1',
          [class_name]
        )
        for (const s of students.rows) {
          await pool.query(
            `INSERT INTO notifications (receiver_id, title, content, type)
             VALUES ($1, $2, $3, 'material')`,
            [s.student_id, `新复习资料: ${title}`, `课程「${course_name || '通用'}」上传了新的复习资料，请及时下载复习。`, 'material']
          )
        }
      } catch (e) {
        console.error('通知发送失败:', e.message)
      }
    }

    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '上传失败: ' + e.message })
  }
})

// 下载复习资料
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM study_materials WHERE id = $1',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })
    const material = result.rows[0]
    const filePath = path.join(__dirname, '..', material.file_url)
    res.download(filePath, material.file_name)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '下载失败' })
  }
})

// 删除复习资料（发布者或管理员可删）
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    // 查询资料
    const result = await pool.query(
      'SELECT * FROM study_materials WHERE id = $1',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })

    const material = result.rows[0]
    // 权限检查：发布者本人 或 管理员
    if (material.uploader_id !== userId && !isAdmin) {
      return res.status(403).json({ message: '无权删除此资料' })
    }

    // 删除文件
    try {
      const filePath = path.join(__dirname, '..', material.file_url)
      await import('fs').then(fs => {
        fs.unlink(filePath, () => {})
      })
    } catch {}

    await pool.query('DELETE FROM study_materials WHERE id = $1', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
