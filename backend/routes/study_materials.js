import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { createChunkedDownloadHandler } from '../utils/chunkedDownload.js'

const router = Router()
router.use(authMiddleware)

// 使用 memoryStorage（兼容 Netlify serverless 环境）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// ========== 分片上传（绕过 Netlify 6MB payload 限制） ==========

// 初始化分片上传
router.post('/upload/chunked/init', async (req, res) => {
  try {
    const { fileName, fileSize, fileType, totalChunks, title, course_name, class_name, version_group } = req.body
    if (!fileName || !totalChunks) return res.status(400).json({ message: '参数不完整' })

    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId
    const uploaderRole = req.user.studentId ? 'student' : 'admin'

    const uploadId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

    // 存储上传会话信息到临时表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_sessions (
        upload_id TEXT PRIMARY KEY,
        file_name TEXT,
        file_size BIGINT,
        file_type TEXT,
        total_chunks INT,
        received_chunks INT DEFAULT 0,
        title TEXT,
        course_name TEXT,
        class_name TEXT,
        uploader_id TEXT,
        uploader_name TEXT,
        uploader_role TEXT,
        version_group TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // 确保 version_group 列存在
    try {
      await pool.query(`ALTER TABLE upload_sessions ADD COLUMN IF NOT EXISTS version_group TEXT`)
    } catch (e) { /* ignore */ }

    await pool.query(
      `INSERT INTO upload_sessions (upload_id, file_name, file_size, file_type, total_chunks, title, course_name, class_name, uploader_id, uploader_name, uploader_role, version_group)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [uploadId, fileName, fileSize, fileType, parseInt(totalChunks), title || fileName, course_name || null, class_name || null, uploaderId, uploaderName, uploaderRole, version_group || null]
    )

    res.json({ uploadId, chunkSize: 4 * 1024 * 1024 }) // 每片 4MB
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '初始化失败' })
  }
})

// 完成分片上传（合并所有分片）—— 必须在 :chunkIndex 路由之前
router.post('/upload/chunked/:uploadId/complete', async (req, res) => {
  try {
    const { uploadId } = req.params

    const session = await pool.query('SELECT * FROM upload_sessions WHERE upload_id = $1', [uploadId])
    if (session.rows.length === 0) return res.status(404).json({ message: '上传会话不存在' })
    const s = session.rows[0]

    if (s.received_chunks < s.total_chunks) {
      return res.status(400).json({ message: `分片不完整：${s.received_chunks}/${s.total_chunks}` })
    }

    // 读取所有分片并合并
    const chunks = await pool.query(
      'SELECT chunk_index, chunk_data FROM upload_chunks WHERE upload_id = $1 ORDER BY chunk_index',
      [uploadId]
    )

    const totalBuffer = Buffer.concat(chunks.rows.map(c => c.chunk_data))

    // 生成版本组 ID（首次上传）
    const versionGroup = s.version_group || `vg-${Date.now()}-${Math.round(Math.random()*1e9)}`
    // 计算版本号
    let versionNumber = 1
    if (s.version_group) {
      const verRes = await pool.query(
        'SELECT MAX(version_number) as max_ver FROM study_materials WHERE version_group = $1',
        [s.version_group]
      )
      versionNumber = (verRes.rows[0].max_ver || 0) + 1
      // 将旧版本标记为非最新
      await pool.query(
        'UPDATE study_materials SET is_latest = false WHERE version_group = $1',
        [s.version_group]
      )
    }

    // 插入到 study_materials
    const result = await pool.query(
      `INSERT INTO study_materials
        (title, file_url, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, file_data, version_group, version_number, is_latest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [s.title, `stored-in-db://${s.file_name}`, s.file_name, s.file_size, s.file_type, s.course_name, s.class_name, s.uploader_id, s.uploader_name, s.uploader_role, totalBuffer, versionGroup, versionNumber, true]
    )

    // 发通知
    if (s.class_name) {
      try {
        const students = await pool.query('SELECT student_id FROM students WHERE class_name = $1', [s.class_name])
        for (const st of students.rows) {
          await pool.query(
            `INSERT INTO notifications (receiver_id, title, content, type) VALUES ($1, $2, $3, 'material')`,
            [st.student_id, `新复习资料: ${s.title}`, `课程「${s.course_name || '通用'}」上传了新的复习资料，请及时下载复习。`, 'material']
          )
        }
      } catch (e) { console.error('通知发送失败:', e.message) }
    }

    // 清理临时数据
    await pool.query('DELETE FROM upload_chunks WHERE upload_id = $1', [uploadId])
    await pool.query('DELETE FROM upload_sessions WHERE upload_id = $1', [uploadId])

    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '合并失败: ' + e.message })
  }
})

// 上传单个分片 —— 必须在 complete 路由之后
router.post('/upload/chunked/:uploadId/:chunkIndex', upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex } = req.params
    if (!req.file) return res.status(400).json({ message: '无文件数据' })

    await pool.query(`
      CREATE TABLE IF NOT EXISTS upload_chunks (
        upload_id TEXT,
        chunk_index INT,
        chunk_data BYTEA,
        PRIMARY KEY (upload_id, chunk_index)
      )
    `)

    await pool.query(
      'INSERT INTO upload_chunks (upload_id, chunk_index, chunk_data) VALUES ($1, $2, $3) ON CONFLICT (upload_id, chunk_index) DO UPDATE SET chunk_data = $3',
      [uploadId, parseInt(chunkIndex), req.file.buffer]
    )

    await pool.query(
      'UPDATE upload_sessions SET received_chunks = received_chunks + 1 WHERE upload_id = $1',
      [uploadId]
    )

    res.json({ chunkIndex: parseInt(chunkIndex) })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '分片上传失败' })
  }
})

// 确保 study_materials 表有必要的列
const ensureColumns = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='study_materials' AND column_name='file_data'`
    )
    if (rows.length === 0) {
      await pool.query('ALTER TABLE study_materials ADD COLUMN file_data BYTEA')
      console.log('已添加 study_materials.file_data 列')
    }
    // 添加版本相关列
    const verRows = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='study_materials' AND column_name='version_group'`
    )
    if (verRows.length === 0) {
      await pool.query('ALTER TABLE study_materials ADD COLUMN version_group TEXT')
      await pool.query('ALTER TABLE study_materials ADD COLUMN version_number INT DEFAULT 1')
      await pool.query('ALTER TABLE study_materials ADD COLUMN is_latest BOOLEAN DEFAULT true')
      console.log('已添加版本管理列')
    }
  } catch (e) {
    console.error('检查/添加列失败:', e.message)
  }
}
ensureColumns()

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
    let sql = `SELECT id, title, COALESCE(file_name, title, '未命名') as original_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, version_group, version_number, is_latest, created_at FROM study_materials ${whereSql} ORDER BY created_at DESC`
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

    // 修复 multer 中文文件名编码问题
    let originalName = req.file.originalname
    try { originalName = Buffer.from(originalName, 'latin1').toString('utf8') } catch {}

    // 危险文件校验
    const ext = originalName.split('.').pop().toLowerCase()
    const dangerousExts = ['exe', 'dll', 'bat', 'cmd', 'sh', 'msi', 'scr', 'vbs', 'js', 'jar', 'apk', 'ipa']
    if (dangerousExts.includes(ext)) {
      return res.status(400).json({ message: `禁止上传危险文件类型：.${ext}` })
    }

    console.log('[UPLOAD-DEBUG] file:', req.file.originalname, 'size:', req.file.size, 'buffer type:', typeof req.file.buffer, 'buffer length:', req.file.buffer?.length)

    const { title, course_name, class_name } = req.body
    if (!title) return res.status(400).json({ message: '请输入资料标题' })

    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId
    const uploaderRole = req.user.studentId ? 'student' : 'admin'

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

    // 确保 file_data 是 Buffer
    const fileBuffer = Buffer.isBuffer(material.file_data)
      ? material.file_data
      : Buffer.from(material.file_data)

    // 判断是否为 serverless 环境（Netlify Functions）
    const isServerless = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT
    if (isServerless) {
      // serverless 环境返回 base64，前端解码
      res.json({
        base64: fileBuffer.toString('base64'),
        fileName: material.file_name || 'download',
        fileType: material.file_type || 'application/octet-stream',
        fileSize: fileBuffer.length
      })
    } else {
      // 传统服务器直接返回二进制
      res.setHeader('Content-Type', material.file_type || 'application/octet-stream')
      const encodedName = encodeURIComponent(material.file_name || 'download').replace(/['()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
      res.setHeader('Content-Disposition', `attachment; filename="download"; filename*=UTF-8''${encodedName}`)
      res.setHeader('Content-Length', fileBuffer.length)
      res.end(fileBuffer)
    }
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '下载失败' })
  }
})

// 分片下载复习资料（绕过 Netlify 6MB 限制）
router.get('/download/:id/chunk', createChunkedDownloadHandler({
  tableName: 'study_materials',
  idColumn: 'id',
  dataColumn: 'file_data',
  nameColumn: 'file_name',
  typeColumn: 'file_type'
}))

// 获取版本历史
router.get('/:id/versions', async (req, res) => {
  try {
    const result = await pool.query('SELECT version_group FROM study_materials WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })
    const vg = result.rows[0].version_group
    if (!vg) return res.json({ versions: [] })

    const versions = await pool.query(
      `SELECT id, title, file_name, file_size, file_type, version_number, is_latest, uploader_name, created_at
       FROM study_materials WHERE version_group = $1 ORDER BY version_number DESC`,
      [vg]
    )
    res.json({ versions: versions.rows })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取版本历史失败' })
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
