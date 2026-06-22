import { Router } from 'express'
import pool from '../db.js'
import bcrypt from 'bcryptjs'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import xlsx from 'xlsx'
import multer from 'multer'
import crypto from 'crypto'

const router = Router()
router.use(authMiddleware) // 所有路由都需要登录，管理路由单独加 adminMiddleware

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// 生成安全的随机密码
function generateRandomPassword(len = 8) {
  return crypto.randomBytes(len).toString('hex').slice(0, len)
}

// ====== 学生端接口（只需登录） ======

// 根据 studentId 查学生（学生端基本资料用）
router.get('/by-student-id/:studentId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, student_id, name, gender, age, major, class_name, status, created_at FROM students WHERE student_id = ?',
      [req.params.studentId]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '查询失败' })
  }
})

// 获取同班同学（学生端班级一览用，只需登录）
router.get('/classmates', async (req, res) => {
  try {
    const studentId = req.user?.studentId || req.user?.username || ''
    if (!studentId) return res.status(401).json({ message: '无法识别用户身份' })
    const me = await pool.query(
      'SELECT class_name FROM students WHERE student_id = ?',
      [studentId]
    )
    if (me.rows.length === 0) return res.json([])
    const className = me.rows[0].class_name
    if (!className) return res.json([])
    const result = await pool.query(
      'SELECT id, student_id, name, gender, age, major, class_name, status FROM students WHERE class_name = ? ORDER BY student_id',
      [className]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取同班同学失败' })
  }
})

// ====== 管理员接口 ======

// 获取所有学生（带分页）
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { keyword, major, status } = req.query
    let sql = `SELECT id, student_id, name, gender, age, major, class_name, status, created_at
               FROM students WHERE 1=1`
    const params = []
    if (keyword) {
      sql += ` AND (name LIKE ? OR student_id LIKE ? OR major LIKE ?)`
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`)
    }
    if (major) {
      sql += ` AND major = ?`
      params.push(major)
    }
    if (status) {
      sql += ` AND status = ?`
      params.push(status)
    }
    sql += ' ORDER BY student_id'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取学生数据失败' })
  }
})

// 统计：按专业分布
router.get('/stats/major', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT major, COUNT(*) as count FROM students GROUP BY major')
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '统计失败' })
  }
})

// 统计：按性别分布
router.get('/stats/gender', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT gender, COUNT(*) as count FROM students GROUP BY gender')
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '统计失败' })
  }
})

// 新增学生
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { studentId, name, gender, age, major, className, status } = req.body
    const hashedPassword = await bcrypt.hash('123456', 10)
    const result = await pool.query(
      `INSERT INTO students (student_id, name, gender, age, major, class_name, password_hash, status)
       VALUES (?,?,?,?,?,?,?,?)`,
      [studentId, name, gender, age, major, className, hashedPassword, status || '在读']
    )
    const insertedId = result.insertId
    const newRow = await pool.query('SELECT * FROM students WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    res.status(500).json({ message: '添加失败' })
  }
})

// 更新学生
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { name, gender, age, major, className, status } = req.body
    await pool.query(
      `UPDATE students SET name=?, gender=?, age=?, major=?, class_name=?, status=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [name, gender, age, major, className, status, req.params.id]
    )
    const result = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '更新失败' })
  }
})

// 删除学生
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM students WHERE id = ?', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

// 重置单个学生密码
router.post('/:id/reset-password', adminMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body
    const password = newPassword || generateRandomPassword()
    const hashed = await bcrypt.hash(password, 10)
    await pool.query(
      'UPDATE students SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [hashed, req.params.id]
    )
    const result = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json({ message: '密码已重置', newPassword: password, student: result.rows[0] })
  } catch (e) {
    res.status(500).json({ message: '重置失败' })
  }
})

// 批量重置密码
router.post('/batch-reset-password', adminMiddleware, async (req, res) => {
  try {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: '请提供学生ID列表' })
    const results = []
    for (const id of ids) {
      const newPassword = generateRandomPassword()
      const hashed = await bcrypt.hash(newPassword, 10)
      await pool.query(
        'UPDATE students SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [hashed, id]
      )
      const result = await pool.query('SELECT id, student_id, name FROM students WHERE id = ?', [id])
      if (result.rows.length > 0) {
        results.push({ id: result.rows[0].id, student_id: result.rows[0].student_id, name: result.rows[0].name, newPassword })
      }
    }
    res.json({ message: `已重置 ${results.length} 名学生密码`, results })
  } catch (e) {
    res.status(500).json({ message: '批量重置失败' })
  }
})

// 批量导入学生（Excel）
router.post('/import', adminMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: '请上传文件' })
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 })
    if (data.length < 2) return res.status(400).json({ message: '文件内容为空' })

    const headers = data[0].map(h => String(h).trim())
    const colMap = {}
    headers.forEach((h, i) => { colMap[h] = i })
    const required = ['学号', '姓名']
    for (const r of required) {
      if (colMap[r] === undefined) return res.status(400).json({ message: `缺少必填列：${r}` })
    }

    const success = []
    const failed = []
    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      const studentId = String(row[colMap['学号']] || '').trim()
      const name = String(row[colMap['姓名']] || '').trim()
      if (!studentId || !name) {
        failed.push({ row: i + 1, reason: '学号或姓名为空' })
        continue
      }
      try {
        const gender = String(row[colMap['性别']] || '男').trim()
        const age = parseInt(row[colMap['年龄']] || 18, 10)
        const major = String(row[colMap['专业']] || '').trim()
        const className = String(row[colMap['班级']] || '').trim()
        const status = String(row[colMap['状态']] || '在读').trim()
        const rawPwd = String(row[colMap['密码']] || '').trim()
        const password = rawPwd ? await bcrypt.hash(rawPwd, 10) : await bcrypt.hash('123456', 10)

        const existing = await pool.query('SELECT id FROM students WHERE student_id = ?', [studentId])
        if (existing.rows.length > 0) {
          await pool.query(
            'UPDATE students SET name=?, gender=?, age=?, major=?, class_name=?, status=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE student_id=?',
            [name, gender, age, major, className, status, password, studentId]
          )
          success.push({ studentId, name, action: '更新' })
        } else {
          await pool.query(
            'INSERT INTO students (student_id, name, gender, age, major, class_name, status, password_hash) VALUES (?,?,?,?,?,?,?,?)',
            [studentId, name, gender, age, major, className, status, password]
          )
          success.push({ studentId, name, action: '新增' })
        }
      } catch (e) {
        failed.push({ row: i + 1, reason: e.message })
      }
    }
    res.json({ message: `导入完成：成功 ${success.length} 条，失败 ${failed.length} 条`, success, failed })
  } catch (e) {
    res.status(500).json({ message: '导入失败' })
  }
})

export default router
