// 加载环境变量
import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import fs from 'fs'
import path from 'path'

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
import gameRoutes from './routes/game.js'
import rankRoutes from './routes/rank.js'

const app = express()
app.set('trust proxy', 1) // 信任 Nginx 反向代理的第一层

// CORS 配置：生产环境通过 FRONTEND_URL 环境变量指定允许的域名
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : true // 未设置时允许所有来源（适用于同域部署）

app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如服务端到服务端、同源请求）
    if (!origin) return callback(null, true)
    // 开发环境允许所有 localhost
    if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost')) {
      return callback(null, true)
    }
    // 允许所有来源（未配置 FRONTEND_URL 时）
    if (allowedOrigins === true) return callback(null, true)
    // 检查白名单
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
  max: 60,
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
const skipBodyParser = (type, parser) => (req, res, next) => {
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return next()
  }
  return parser(req, res, next)
}
app.use(skipBodyParser('json', express.json({ limit: '50mb' })))
app.use(skipBodyParser('urlencoded', express.urlencoded({ limit: '50mb', extended: true })))

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
app.use('/api/game', gameRoutes)
app.use('/api/rank', rankRoutes)

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message })
  }
})

// 定时清理磁盘上传目录中的孤立临时文件（超过 7 天且数据库中没有引用的）
async function cleanupOldUploads() {
  try {
    const uploadDirs = ['uploads/files', 'uploads/study_materials', 'uploads/photo_wall', 'uploads/group_files']
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let cleaned = 0

    for (const dir of uploadDirs) {
      const fullPath = path.resolve(dir)
      if (!fs.existsSync(fullPath)) continue

      const files = fs.readdirSync(fullPath)
      for (const fileName of files) {
        const filePath = path.join(fullPath, fileName)
        try {
          const stat = fs.statSync(filePath)
          if (stat.mtimeMs < sevenDaysAgo) {
            // 检查数据库是否还引用此文件
            const dbCheck = await pool.query(
              "SELECT 1 FROM files WHERE file_path = ? UNION SELECT 1 FROM study_materials WHERE file_path = ? UNION SELECT 1 FROM photo_wall WHERE file_path = ? UNION SELECT 1 FROM group_files WHERE file_path = ? LIMIT 1",
              [filePath, filePath, filePath, filePath]
            )
            if (dbCheck.rows.length === 0) {
              fs.unlinkSync(filePath)
              cleaned++
            }
          }
        } catch (e) { /* 忽略单个文件错误 */ }
      }
    }

    // Clean stale chunk directories (older than 24 hours)
    const chunksDir = path.resolve('uploads/chunks')
    if (fs.existsSync(chunksDir)) {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
      const hashDirs = fs.readdirSync(chunksDir)
      for (const hashDir of hashDirs) {
        const hashPath = path.join(chunksDir, hashDir)
        try {
          const stat = fs.statSync(hashPath)
          if (stat.mtimeMs < oneDayAgo) {
            fs.rmSync(hashPath, { recursive: true, force: true })
            cleaned++
          }
        } catch (e) { /* 忽略单个目录错误 */ }
      }
    }

    if (cleaned > 0) console.log(`[cleanup] 清理了 ${cleaned} 个过期的孤立上传文件`)
  } catch (e) {
    console.error('[cleanup] 清理失败:', e.message)
  }
}

// 启动 HTTP 服务器
const PORT = process.env.PORT || 8081
// 等待数据库就绪后启动服务器
async function waitForDb(maxRetries = 10, delay = 2000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await pool.query('SELECT 1')
      console.log('数据库连接成功')
      return true
    } catch (e) {
      console.log(`数据库连接失败 (${i + 1}/${maxRetries}): ${e.message}`)
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw new Error('数据库连接失败，服务器无法启动')
}

import('http').then(async ({ createServer }) => {
  try {
    await waitForDb()
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }

  const httpServer = createServer(app)
  // 大文件上传/合并需要较长时间，设置服务器超时为 5 分钟
  httpServer.timeout = 300000
  httpServer.keepAliveTimeout = 65000
  httpServer.headersTimeout = 66000
  httpServer.listen(PORT, () => {
    console.log(`后端服务器运行在 http://localhost:${PORT}`)
    console.log('API 基础路径: /api')
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`)
    console.log(`服务器超时: ${httpServer.timeout / 1000}s`)
    // 启动时立即清理一次，然后每小时清理
    cleanupOldUploads()
    setInterval(cleanupOldUploads, 60 * 60 * 1000)
  })
})

export default app
