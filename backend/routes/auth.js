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
    const adminResult = await pool.query('SELECT * FROM admins WHERE username = ?', [username])
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0]
      const valid = await bcrypt.compare(password, admin.password_hash)
      if (!valid) return res.status(401).json({ message: '用户名或密码错误' })
      const token = signToken({ id: admin.id, username: admin.username, display_name: admin.display_name, role: 'admin' })
      return res.json({ token, user: { id: admin.id, username: admin.username, displayName: admin.display_name, role: 'admin' } })
    }
    // 再尝试学生表
    const studentResult = await pool.query('SELECT * FROM students WHERE student_id = ?', [username])
    if (studentResult.rows.length === 0) {
      return res.status(401).json({ message: '用户名或学号不存在' })
    }
    const student = studentResult.rows[0]
    const valid = await bcrypt.compare(password, student.password_hash)
    if (!valid) return res.status(401).json({ message: '密码错误' })
    const token = signToken({ id: student.id, studentId: student.student_id, name: student.name, display_name: student.name, role: 'student' })
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

// 修改密码
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) return res.status(400).json({ message: '请输入旧密码和新密码' })
    if (newPassword.length < 6) return res.status(400).json({ message: '新密码长度不能少于6位' })

    const userId = parseInt(req.user.id)
    const role = req.user.role

    if (role === 'admin') {
      const result = await pool.query('SELECT password_hash FROM admins WHERE id = ?', [userId])
      if (result.rows.length === 0) return res.status(404).json({ message: '用户不存在' })
      const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash)
      if (!valid) return res.status(401).json({ message: '旧密码错误' })
      const newHash = await bcrypt.hash(newPassword, 10)
      await pool.query('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, userId])
    } else if (role === 'student') {
      const result = await pool.query('SELECT password_hash FROM students WHERE id = ?', [userId])
      if (result.rows.length === 0) return res.status(404).json({ message: '用户不存在' })
      const valid = await bcrypt.compare(oldPassword, result.rows[0].password_hash)
      if (!valid) return res.status(401).json({ message: '旧密码错误' })
      const newHash = await bcrypt.hash(newPassword, 10)
      await pool.query('UPDATE students SET password_hash = ? WHERE id = ?', [newHash, userId])
    } else {
      return res.status(403).json({ message: '未知角色' })
    }

    res.json({ message: '密码修改成功' })
  } catch (e) {
    console.error('修改密码失败:', e)
    res.status(500).json({ message: '修改密码失败' })
  }
})

export default router
