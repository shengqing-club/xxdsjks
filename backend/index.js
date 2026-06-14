// 最先加载环境变量，确保后续所有模块都能读取到 process.env
import dotenv from 'dotenv'
const isServerless = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT
if (!isServerless) {
  try { dotenv.config() } catch { /* ignore */ }
}

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'

// 导入 db 和路由
import pool from './db.js'
import authRoutes from './routes/auth.js'
import studentRoutes from './routes/students.js'
import gradeRoutes from './routes/grades.js'
import announcementRoutes from './routes/announcements.js'
import chatRoutes from './routes/chat.js'
import majorRoutes from './routes/majors.js'
import fileRoutes from './routes/files.js'
import examRoutes from './routes/exams.js'
import notificationRoutes from './routes/notifications.js'
import studyMaterialRoutes from './routes/study_materials.js'
import courseRoutes from './routes/courses.js'
import classRoutes from './routes/classes.js'
import groupRoutes from './routes/groups.js'
import groupChatRoutes from './routes/group_chat.js'
import groupFileRoutes from './routes/group_files.js'
import settingsRoutes from './routes/settings.js'
import rewardRoutes from './routes/rewards.js'
import photoWallRoutes from './routes/photo_wall.js'
import forumRoutes from './routes/forum.js'

const app = express()

const isNetlify = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT
const allowedOrigins = process.env.NODE_ENV === 'production' || isNetlify
  ? [
      process.env.FRONTEND_URL || 'https://xxdsjks.netlify.app',
      'https://xxdsjks.netlify.app',
      // 支持 Netlify Deploy Preview 的通配子域名
      ...(process.env.NETLIFY_PREVIEW_URL ? [process.env.NETLIFY_PREVIEW_URL] : [])
    ]
  : true // 开发环境允许所有来源
app.use(cors({
  origin: (origin, callback) => {
    // 开发环境允许所有 localhost 来源，生产环境检查白名单
    if (!origin || (process.env.NODE_ENV !== 'production' && !isNetlify && origin.startsWith('http://localhost'))) {
      return callback(null, true)
    }
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))

// API 限流：每 IP 每分钟最多 100 次请求，上传接口单独限制
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '请求过于频繁，请稍后再试' }
})
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '上传过于频繁，请稍后再试' }
})
app.use('/api/', generalLimiter)
app.use('/api/files/upload', uploadLimiter)
app.use('/api/study-materials/upload', uploadLimiter)
app.use('/api/group-chat/upload', uploadLimiter)
app.use('/api/group-files/upload', uploadLimiter)
// 对 multipart/form-data 请求跳过 json/urlencoded 解析，避免文件上传报错
const skipMultipart = (req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return next()
  }
  next()
}
app.use(skipMultipart)
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// API 路由
app.use('/api/auth', authRoutes)
app.use('/api/students', studentRoutes)
app.use('/api/grades', gradeRoutes)
app.use('/api/announcements', announcementRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/majors', majorRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/exams', examRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/study-materials', studyMaterialRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/classes', classRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/group-chat', groupChatRoutes)
app.use('/api/group-files', groupFileRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/rewards', rewardRoutes)
app.use('/api/photo-wall', photoWallRoutes)
app.use('/api/forum', forumRoutes)

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message })
  }
})

// 定时清理过期的分片上传临时数据（超过 24 小时的）
async function cleanupStaleUploads() {
  try {
    const result = await pool.query(
      "DELETE FROM upload_sessions WHERE created_at < NOW() - INTERVAL '24 hours' RETURNING upload_id"
    )
    if (result.rows.length > 0) {
      const ids = result.rows.map(r => r.upload_id)
      await pool.query('DELETE FROM upload_chunks WHERE upload_id = ANY($1)', [ids])
      console.log(`[cleanup] 清理了 ${result.rows.length} 个过期上传会话`)
    }
  } catch (e) {
    console.error('[cleanup] 清理失败:', e.message)
  }
}

// 仅在直接运行（非 Netlify Functions）时启动 HTTP 服务器
const PORT = process.env.PORT || 8081
if (!isNetlify) {
  import('http').then(({ createServer }) => {
    const httpServer = createServer(app)
    httpServer.listen(PORT, () => {
      console.log(`后端服务器运行在 http://localhost:${PORT}`)
      console.log('API 基础路径: /api')
      // 启动时立即清理一次，然后每小时清理
      cleanupStaleUploads()
      setInterval(cleanupStaleUploads, 60 * 60 * 1000)
    })
  })
}

export default app
