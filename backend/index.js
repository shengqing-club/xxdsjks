import express from 'express'
import cors from 'cors'
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

const app = express()

app.use(cors())
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

// 健康检查
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() })
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected', message: e.message })
  }
})

// 仅在直接运行时启动 HTTP 服务器
const PORT = 8081
if (process.env.NETLIFY_DEV !== 'true' && !process.env.LAMBDA_TASK_ROOT) {
  import('http').then(({ createServer }) => {
    const httpServer = createServer(app)
    httpServer.listen(PORT, () => {
      console.log(`后端服务器运行在 http://localhost:${PORT}`)
      console.log('API 基础路径: /api')
    })
  })
}

export default app
