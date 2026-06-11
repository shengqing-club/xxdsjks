import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// 使用 memoryStorage（兼容 Netlify serverless 环境）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// 确保 study_materials 表有 file_data 列
const ensureFileDataColumn = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='study_materials' AND column_name='file_data'`
    )
    if (rows.length === 0) {
      await pool.query('ALTER TABLE study_materials ADD COLUMN file_data BYTEA')
      console.log('已添加 study_materials.file_data 列')
    }
  } catch (e) {
    console.error('检查/添加 file_data 列失败:', e.message)
  }
}
ensureFileDataColumn()

// 获取复习资料列表（支持分页和搜索）
router.get('/', async (req, res) => {
  try {
    const { class_name, course_name, keyword, page, pageSize } = req.query
    let whereSql = 'WHERE 1=1'
    const params = []
    let idx = 1
    if (class_name) {
      whereSql += ` AND class_name = $${idx++}`
      params.push(class_name)
    }
    if (course_name) {
      whereSql += ` AND course_name = $${idx++}`
      params.push(course_name)
    }
    if (keyword) {
      whereSql += ` AND (file_name ILIKE $${idx++} OR title ILIKE $${idx++})`
      params.push(`%${keyword}%`, `%${keyword}%`)
    }

    // 总数
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM study_materials ${whereSql}`, params)
    const total = parseInt(countResult.rows[0].total)

    // 分页查询 - 复制params用于分页，避免修改原数组
    const queryParams = [...params]
    let sql = `SELECT id, title, COALESCE(file_name, title, '未命名') as original_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, created_at FROM study_materials ${whereSql} ORDER BY created_at DESC`
    if (page && pageSize) {
      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      sql += ` LIMIT $${idx++} OFFSET $${idx++}`
      queryParams.push(parseInt(pageSize), offset)
    }
    const result = await pool.query(sql, queryParams)
    res.json({ list: result.rows, total })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取复习资料失败' })
  }
})

// 上传复习资料（存入数据库）
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择文件' })
    console.log('[UPLOAD-DEBUG] file:', req.file.originalname, 'size:', req.file.size, 'buffer type:', typeof req.file.buffer, 'buffer length:', req.file.buffer?.length)

    const { title, course_name, class_name } = req.body
    if (!title) return res.status(400).json({ message: '请输入资料标题' })

    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId
    const uploaderRole = req.user.studentId ? 'student' : 'admin'

    // 修复 multer 中文文件名编码问题：originalname 可能按 Latin-1 解码了 UTF-8 字节
    let originalName = req.file.originalname
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8')
    } catch { /* 如果转码失败则保持原样 */ }

    const result = await pool.query(
      `INSERT INTO study_materials
        (title, file_url, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, file_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        title,
        `stored-in-db://${originalName}`,
        originalName,
        req.file.size,
        req.file.mimetype,
        course_name || null,
        class_name || null,
        uploaderId,
        uploaderName,
        uploaderRole,
        req.file.buffer
      ]
    )
    console.log('[UPLOAD-DEBUG] inserted id:', result.rows[0].id, 'file_data length:', result.rows[0].file_data?.length)

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
    console.error('[UPLOAD-ERROR]', e)
    res.status(500).json({ message: '上传失败: ' + e.message })
  }
})

// 下载复习资料（从数据库读取）
router.get('/download/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM study_materials WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })
    const material = result.rows[0]

    if (!material.file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }

    res.setHeader('Content-Type', material.file_type || 'application/octet-stream')
    // RFC 6266: ASCII 回退 + UTF-8 编码文件名
    const encodedName = encodeURIComponent(material.file_name || 'download').replace(/['()]/g, escape)
    res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodedName}`)
    res.setHeader('Content-Length', material.file_size)
    res.send(material.file_data)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '下载失败' })
  }
})

// 删除复习资料
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    const result = await pool.query('SELECT * FROM study_materials WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })

    const material = result.rows[0]
    if (material.uploader_id !== userId && !isAdmin) {
      return res.status(403).json({ message: '无权删除此资料' })
    }

    await pool.query('DELETE FROM study_materials WHERE id = $1', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
