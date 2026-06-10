import { Router } from 'express'
import pool from '../db.js'
import bcrypt from 'bcryptjs'
import { signToken, authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 用户登录（自动识别管理员/学生）
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    // 先尝试管理员表
    const adminResult = await pool.query('SELECT * FROM admins WHERE username = $1', [username])
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0]
      const valid = await bcrypt.compare(password, admin.password_hash)
      if (!valid) return res.status(401).json({ message: '用户名或密码错误' })
      const token = signToken({ id: admin.id, username: admin.username, role: 'admin' })
      return res.json({ token, user: { id: admin.id, username: admin.username, displayName: admin.display_name, role: 'admin' } })
    }
    // 再尝试学生表
    const studentResult = await pool.query('SELECT * FROM students WHERE student_id = $1', [username])
    if (studentResult.rows.length === 0) {
      return res.status(401).json({ message: '用户名或学号不存在' })
    }
    const student = studentResult.rows[0]
    const valid = await bcrypt.compare(password, student.password_hash)
    if (!valid) return res.status(401).json({ message: '密码错误' })
    const token = signToken({ id: student.id, studentId: student.student_id, name: student.name, role: 'student' })
    return res.json({ token, user: { id: student.id, studentId: student.student_id, displayName: student.name, role: 'student' } })
  } catch (e) {
    console.error('Login error:', e)
    res.status(500).json({ message: '登录失败' })
  }
})

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  res.json({ user: req.user })
})

export default router
