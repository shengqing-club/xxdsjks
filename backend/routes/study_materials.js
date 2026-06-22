import { Router } from 'express'
import multer from 'multer'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import { decodeMultipartFilename } from '../utils/decodeFilename.js'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const router = Router()
router.use(authMiddleware)

// ========== 上传配置：文件存磁盘，数据库只存路径 ==========
const UPLOAD_DIR = path.resolve('uploads/study_materials')
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + crypto.randomBytes(8).toString('hex'))
  }
})

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

// 确保 study_materials 表有必要的列
const ensureColumns = async () => {
  try {
    const { rows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='study_materials' AND column_name='file_path' AND table_schema = DATABASE()`
    )
    if (rows.length === 0) {
      await pool.query('ALTER TABLE study_materials ADD COLUMN file_path VARCHAR(500)')
      console.log('已添加 study_materials.file_path 列')
    }
    const verRows = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='study_materials' AND column_name='version_group' AND table_schema = DATABASE()`
    )
    if (verRows.rows.length === 0) {
      await pool.query('ALTER TABLE study_materials ADD COLUMN version_group TEXT')
      await pool.query('ALTER TABLE study_materials ADD COLUMN version_number INT DEFAULT 1')
      await pool.query('ALTER TABLE study_materials ADD COLUMN is_latest TINYINT(1) DEFAULT 1')
      console.log('已添加版本管理列')
    }
  } catch (e) {
    // 忽略列已存在等错误
  }
}
ensureColumns().catch(() => {})

// MIME 推断
function guessMimeType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase()
  const map = {
    'rar': 'application/x-rar-compressed', 'zip': 'application/zip', '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar', 'gz': 'application/gzip', 'pdf': 'application/pdf',
    'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'mp4': 'video/mp4', 'mp3': 'audio/mpeg', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'txt': 'text/plain; charset=utf-8',
  }
  return map[ext] || 'application/octet-stream'
}

// 获取复习资料列表（支持分页和搜索）
router.get('/', async (req, res) => {
  try {
    const { class_name, course_name, keyword, page, pageSize } = req.query
    let whereSql = 'WHERE 1=1'
    const params = []
    if (class_name) { whereSql += ` AND class_name = ?`; params.push(class_name) }
    if (course_name) { whereSql += ` AND course_name = ?`; params.push(course_name) }
    if (keyword) { whereSql += ` AND (file_name LIKE ? OR title LIKE ?)`; params.push(`%${keyword}%`, `%${keyword}%`) }

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM study_materials ${whereSql}`, params)
    const total = parseInt(countResult.rows[0].total)

    const queryParams = [...params]
    let sql = `SELECT id, title, COALESCE(file_name, title, '未命名') as original_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, version_group, version_number, is_latest, created_at FROM study_materials ${whereSql} ORDER BY created_at DESC`
    if (page && pageSize) {
      const offset = (parseInt(page) - 1) * parseInt(pageSize)
      sql += ` LIMIT ? OFFSET ?`
      queryParams.push(parseInt(pageSize), offset)
    }
    const result = await pool.query(sql, queryParams)
    res.json({ list: result.rows, total })
  } catch (e) {
    res.status(500).json({ message: '获取复习资料失败' })
  }
})

// 上传复习资料（文件存磁盘，数据库只存路径，零内存拷贝，支持版本管理）
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请选择文件' })

    const originalName = decodeMultipartFilename(req.file.originalname)
    const ext = originalName.split('.').pop().toLowerCase()
    const dangerousExts = ['exe', 'dll', 'bat', 'cmd', 'sh', 'msi', 'scr', 'vbs', 'js', 'jar', 'apk', 'ipa']
    if (dangerousExts.includes(ext)) {
      fs.unlink(req.file.path, () => {})
      return res.status(400).json({ message: `禁止上传危险文件类型：.${ext}` })
    }

    const { title, course_name, class_name, version_group } = req.body
    if (!title) return res.status(400).json({ message: '请输入资料标题' })

    const uploaderId = req.user.studentId || req.user.username
    const uploaderName = req.user.name || uploaderId
    const uploaderRole = req.user.studentId ? 'student' : 'admin'

    // 版本管理逻辑
    let versionGroup = version_group || `vg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    let versionNumber = 1
    if (version_group) {
      const verRes = await pool.query('SELECT MAX(version_number) as max_ver FROM study_materials WHERE version_group = ?', [version_group])
      versionNumber = (verRes.rows[0].max_ver || 0) + 1
      await pool.query('UPDATE study_materials SET is_latest = 0 WHERE version_group = ?', [version_group])
    }

    // 文件留在磁盘，数据库只存路径
    const result = await pool.query(
      `INSERT INTO study_materials
        (title, file_url, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, file_path, version_group, version_number, is_latest)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title,
        `stored-in-fs://${path.basename(req.file.path)}`,
        originalName,
        req.file.size,
        req.file.mimetype,
        course_name || null,
        class_name || null,
        uploaderId,
        uploaderName,
        uploaderRole,
        req.file.path,
        versionGroup,
        versionNumber,
        1
      ]
    )

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT id, title, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, version_group, version_number, is_latest, created_at FROM study_materials WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {})
    res.status(500).json({ message: '上传失败: ' + e.message })
  }
})

// ========== 分片上传：接收单个分片 ==========
router.post('/upload/chunk', upload.single('chunk'), async (req, res) => {
  try {
    const { hash, chunkIndex, totalChunks } = req.body
    if (!hash || chunkIndex === undefined || !totalChunks) {
      return res.status(400).json({ message: '缺少必要参数' })
    }
    // 分片由 chunkedUpload.js 发送到 uploads/chunks/{hash}/{chunkIndex}
    // 但这里的 multer 配置指向 uploads/study_materials，需要手动移动
    if (req.file) {
      const hashDir = path.resolve(path.join('uploads/chunks', hash))
      if (!fs.existsSync(hashDir)) fs.mkdirSync(hashDir, { recursive: true })
      const destPath = path.join(hashDir, String(chunkIndex))
      fs.renameSync(req.file.path, destPath)
    }
    res.json({ received: Number(chunkIndex) })
  } catch (e) {
    res.status(500).json({ message: '分片上传失败: ' + e.message })
  }
})

// ========== 分片上传：合并所有分片 ==========
router.post('/upload/merge', async (req, res) => {
  try {
    const { hash, totalChunks, fileName, fileSize, fileType, title, course_name, class_name, version_group } = req.body
    if (!hash || !totalChunks || !fileName || !title) {
      return res.status(400).json({ message: '缺少必要参数' })
    }

    const total = Number(totalChunks)
    const hashDir = path.resolve(path.join('uploads/chunks', hash))
    if (!fs.existsSync(hashDir)) return res.status(400).json({ message: '分片目录不存在' })

    // Stream merge
    const finalPath = path.join(UPLOAD_DIR, Date.now() + '-' + crypto.randomBytes(8).toString('hex'))
    const writeStream = fs.createWriteStream(finalPath)
    for (let i = 0; i < total; i++) {
      const chunkPath = path.join(hashDir, String(i))
      if (!fs.existsSync(chunkPath)) { writeStream.close(); return res.status(400).json({ message: `分片 ${i} 缺失` }) }
      const chunkStream = fs.createReadStream(chunkPath)
      await new Promise((resolve, reject) => { chunkStream.pipe(writeStream, { end: false }); chunkStream.on('end', resolve); chunkStream.on('error', reject) })
    }
    writeStream.end()
    await new Promise((resolve, reject) => { writeStream.on('finish', resolve); writeStream.on('error', reject) })
    fs.rmSync(hashDir, { recursive: true, force: true })

    const uploaderId = req.user?.studentId || req.user?.username || ''
    const uploaderName = req.user?.name || uploaderId
    const uploaderRole = req.user?.studentId ? 'student' : 'admin'

    let versionGroup = version_group || `vg-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`
    let versionNumber = 1
    if (version_group) {
      const verRes = await pool.query('SELECT MAX(version_number) as max_ver FROM study_materials WHERE version_group = ?', [version_group])
      versionNumber = (verRes.rows[0].max_ver || 0) + 1
      await pool.query('UPDATE study_materials SET is_latest = 0 WHERE version_group = ?', [version_group])
    }

    const result = await pool.query(
      `INSERT INTO study_materials (title, file_url, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, file_path, version_group, version_number, is_latest)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [title, `stored-in-fs://${path.basename(finalPath)}`, fileName, fileSize || 0, fileType || 'application/octet-stream', course_name || null, class_name || null, uploaderId, uploaderName, uploaderRole, finalPath, versionGroup, versionNumber, 1]
    )

    const insertedId = result.insertId
    const newRow = await pool.query('SELECT id, title, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, version_group, version_number, is_latest, created_at FROM study_materials WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    res.status(500).json({ message: '合并分片失败: ' + e.message })
  }
})

// ========== 秒传：通过 SHA-256 哈希检查文件是否已存在 ==========
router.post('/check-hash', async (req, res) => {
  try {
    const { hash, fileName, fileSize } = req.body
    if (!hash) return res.status(400).json({ message: '缺少 hash 参数' })

    const result = await pool.query(
      'SELECT id, title, file_name, file_size, file_type, course_name, class_name, uploader_id, uploader_name, uploader_role, version_group, version_number, is_latest, created_at FROM study_materials WHERE file_name = ? AND file_size = ? AND is_latest = 1 ORDER BY created_at DESC LIMIT 1',
      [fileName, fileSize]
    )

    if (result.rows.length > 0) {
      const existing = result.rows[0]
      const filePath = await pool.query('SELECT file_path FROM study_materials WHERE id = ?', [existing.id])
      if (filePath.rows.length > 0 && filePath.rows[0].file_path && fs.existsSync(filePath.rows[0].file_path)) {
        return res.json({ exists: true, file: existing })
      }
    }

    res.json({ exists: false })
  } catch (e) {
    res.status(500).json({ message: '检查文件哈希失败: ' + e.message })
  }
})

// ========== 分片上传：查询进度 ==========
router.get('/upload/progress/:hash', async (req, res) => {
  try {
    const hashDir = path.resolve(path.join('uploads/chunks', req.params.hash))
    if (!fs.existsSync(hashDir)) return res.json({ uploadedChunks: [] })
    const files = fs.readdirSync(hashDir)
    res.json({ uploadedChunks: files.map(f => Number(f)).filter(n => !isNaN(n)).sort((a, b) => a - b) })
  } catch (e) {
    res.status(500).json({ message: '查询进度失败' })
  }
})

// 下载复习资料（优先磁盘流式读取，兼容旧 BLOB 数据）
router.get('/download/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT file_name, file_type, file_path FROM study_materials WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })
    const material = result.rows[0]

    const contentType = material.file_type || guessMimeType(material.file_name)
    const encodedName = encodeURIComponent(material.file_name || 'download')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    // 优先磁盘文件
    if (material.file_path && fs.existsSync(material.file_path)) {
      const stat = fs.statSync(material.file_path)
      res.setHeader('Content-Length', stat.size)
      return fs.createReadStream(material.file_path).pipe(res)
    }

    // 向后兼容 BLOB
    const blobResult = await pool.query('SELECT file_data FROM study_materials WHERE id = ?', [req.params.id])
    if (blobResult.rows.length === 0 || !blobResult.rows[0].file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }
    const fileBuffer = Buffer.isBuffer(blobResult.rows[0].file_data) ? blobResult.rows[0].file_data : Buffer.from(blobResult.rows[0].file_data)
    res.setHeader('Content-Length', fileBuffer.length)
    res.end(fileBuffer)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: '下载失败' })
  }
})

// 流式下载
router.get('/download/:id/stream', async (req, res) => {
  try {
    const result = await pool.query('SELECT file_name, file_type, file_path FROM study_materials WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })
    const material = result.rows[0]

    const contentType = material.file_type || guessMimeType(material.file_name)
    const encodedName = encodeURIComponent(material.file_name || 'download')
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
    res.setHeader('Cache-Control', 'public, max-age=3600')

    if (material.file_path && fs.existsSync(material.file_path)) {
      const stat = fs.statSync(material.file_path)
      res.setHeader('Content-Length', stat.size)
      return fs.createReadStream(material.file_path).pipe(res)
    }

    const blobResult = await pool.query('SELECT file_data FROM study_materials WHERE id = ?', [req.params.id])
    if (blobResult.rows.length === 0 || !blobResult.rows[0].file_data) {
      return res.status(404).json({ message: '文件内容已丢失' })
    }
    const fileBuffer = Buffer.isBuffer(blobResult.rows[0].file_data) ? blobResult.rows[0].file_data : Buffer.from(blobResult.rows[0].file_data)
    res.setHeader('Content-Length', fileBuffer.length)
    res.end(fileBuffer)
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ message: '下载失败' })
  }
})

// 获取版本历史
router.get('/:id/versions', async (req, res) => {
  try {
    const result = await pool.query('SELECT version_group FROM study_materials WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })
    const vg = result.rows[0].version_group
    if (!vg) return res.json({ versions: [] })

    const versions = await pool.query(
      `SELECT id, title, file_name, file_size, file_type, version_number, is_latest, uploader_name, created_at
       FROM study_materials WHERE version_group = ? ORDER BY version_number DESC`, [vg]
    )
    res.json({ versions: versions.rows })
  } catch (e) {
    res.status(500).json({ message: '获取版本历史失败' })
  }
})

// 删除复习资料（同时删除磁盘文件）
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    const result = await pool.query('SELECT * FROM study_materials WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '资料不存在' })

    const material = result.rows[0]
    if (material.uploader_id !== userId && !isAdmin) {
      return res.status(403).json({ message: '无权删除此资料' })
    }

    // 删除磁盘文件
    if (material.file_path) fs.unlink(material.file_path, () => {})

    await pool.query('DELETE FROM study_materials WHERE id = ?', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
