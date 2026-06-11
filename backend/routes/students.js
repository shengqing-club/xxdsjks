import { Router } from 'express'
import pool from '../db.js'
import bcrypt from 'bcryptjs'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'
import xlsx from 'xlsx'
import multer from 'multer'

const router = Router()
router.use(authMiddleware) // 所有路由都需要登录，管理路由单独加 adminMiddleware

const upload = multer({ dest: 'uploads/' })

// ====== 学生端接口（只需登录） ======

// 根据 studentId 查学生（学生端基本资料用）
router.get('/by-student-id/:studentId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, student_id, name, gender, age, major, class_name, status, created_at FROM students WHERE student_id = $1',
      [req.params.studentId]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '查询失败' })
  }
})

// 获取同班同学（学生端班级一览用，只需登录）
router.get('/classmates', async (req, res) => {
  try {
    const studentId = req.user?.studentId || req.user?.username || ''
    if (!studentId) return res.status(401).json({ message: '无法识别用户身份' })
    const me = await pool.query(
      'SELECT class_name FROM students WHERE student_id = $1',
      [studentId]
    )
    if (me.rows.length === 0) return res.json([])
    const className = me.rows[0].class_name
    if (!className) return res.json([])
    const result = await pool.query(
      'SELECT id, student_id, name, gender, age, major, class_name, status FROM students WHERE class_name = $1 ORDER BY student_id',
      [className]
    )
    res.json(result.rows)
  } catch (e) {
    console.error('获取同班同学失败:', e)
    res.status(500).json({ message: '获取同班同学失败' })
  }
})

// ====== 管理端接口（需要管理员权限） ======

// 获取所有学生（支持关键词搜索、专业筛选）
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { keyword, major, status } = req.query
    let sql = 'SELECT id, student_id, name, gender, age, major, class_name, status, created_at FROM students WHERE 1=1'
    const params = []
    let idx = 1
    if (keyword) {
      sql += ` AND (student_id ILIKE $${idx} OR name ILIKE $${idx} OR major ILIKE $${idx} OR class_name ILIKE $${idx})`
      params.push(`%${keyword}%`)
      idx++
    }
    if (major) {
      sql += ` AND major = $${idx}`
      params.push(major)
      idx++
    }
    if (status) {
      sql += ` AND status = $${idx}`
      params.push(status)
      idx++
    }
    sql += ' ORDER BY student_id'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取学生数据失败' })
  }
})

// 获取统计数据（管理端图表用）
router.get('/stats/major', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT major as name, COUNT(*) as value FROM students GROUP BY major ORDER BY value DESC')
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取统计数据失败' })
  }
})

router.get('/stats/gender', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT gender as name, COUNT(*) as value FROM students GROUP BY gender')
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取统计数据失败' })
  }
})

// 获取所有专业（去重）— 必须放在 /:id 路由之前！
router.get('/majors/list', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT DISTINCT major as name FROM students ORDER BY major')
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取专业列表失败' })
  }
})

// 新增学生
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { studentId, name, gender, age, major, className, status, password } = req.body
    const defaultPassword = password || '123456'
    const hash = await bcrypt.hash(defaultPassword, 10)
    const result = await pool.query(
      `INSERT INTO students (student_id, name, gender, age, major, class_name, status, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, student_id, name, gender, age, major, class_name, status`,
      [studentId, name, gender || '男', age || 18, major || '', className || '', status || '在读', hash]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ message: '学号已存在' })
    console.error(e)
    res.status(500).json({ message: '添加失败' })
  }
})

// 更新学生
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { name, gender, age, major, className, status } = req.body
    const result = await pool.query(
      `UPDATE students SET name=$1, gender=$2, age=$3, major=$4, class_name=$5, status=$6, updated_at=CURRENT_TIMESTAMP
       WHERE id=$7 RETURNING id, student_id, name, gender, age, major, class_name, status`,
      [name, gender, age, major, className, status, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '更新失败' })
  }
})

// 删除学生
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM students WHERE id=$1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '删除失败' })
  }
})

// 查看学生密码状态
router.get('/:id/password', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT student_id, name FROM students WHERE id=$1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json({ ...result.rows[0], message: '出于安全考虑，密码仅支持重置' })
  } catch (e) {
    res.status(500).json({ message: '查询失败' })
  }
})

// 重置学生密码（管理端，返回明文新密码方便告知学生）
router.post('/:id/reset-password', adminMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body
    const password = newPassword || Math.random().toString(36).slice(-8)
    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'UPDATE students SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING student_id, name',
      [hash, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '学生不存在' })
    res.json({
      message: '密码重置成功',
      student: result.rows[0],
      newPassword: password
    })
  } catch (e) {
    res.status(500).json({ message: '重置失败' })
  }
})

// 批量重置密码
router.post('/batch-reset-password', adminMiddleware, async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !ids.length) return res.status(400).json({ message: '请选择学生' })
    const results = []
    for (const id of ids) {
      const password = Math.random().toString(36).slice(-8)
      const hash = await bcrypt.hash(password, 10)
      const r = await pool.query(
        'UPDATE students SET password_hash=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING student_id, name',
        [hash, id]
      )
      if (r.rows.length) results.push({ ...r.rows[0], newPassword: password })
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

    const workbook = xlsx.readFile(req.file.path)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 })

    // 删除临时文件
    import('fs').then(fs => fs.promises.unlink(req.file.path).catch(() => {}))

    if (rows.length < 2) return res.status(400).json({ message: 'Excel文件为空或格式错误' })

    const headers = rows[0].map(h => String(h).trim())
    const required = ['学号', '姓名']
    for (const h of required) {
      if (!headers.includes(h)) return res.status(400).json({ message: `缺少必填列：${h}` })
    }

    const colMap = {}
    headers.forEach((h, i) => { colMap[h] = i })

    const success = []
    const failed = []

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row.length || !row[colMap['学号']]) continue

      const studentId = String(row[colMap['学号']] || '').trim()
      const name = String(row[colMap['姓名']] || '').trim()
      const gender = String(row[colMap['性别']] || '男').trim()
      const age = parseInt(row[colMap['年龄']] || 18)
      const major = String(row[colMap['专业']] || '').trim()
      const className = String(row[colMap['班级']] || '').trim()
      const status = String(row[colMap['状态']] || '在读').trim()
      const password = String(row[colMap['密码']] || '123456').trim()

      if (!studentId || !name) {
        failed.push({ row: i + 1, reason: '学号或姓名为空' })
        continue
      }

      try {
        const hash = await bcrypt.hash(password, 10)
        const result = await pool.query(
          `INSERT INTO students (student_id, name, gender, age, major, class_name, status, password_hash)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (student_id) DO UPDATE SET
             name=$2, gender=$3, age=$4, major=$5, class_name=$6, status=$7, password_hash=$8, updated_at=CURRENT_TIMESTAMP
           RETURNING student_id, name`,
          [studentId, name, gender, age, major, className, status, hash]
        )
        success.push(result.rows[0])
      } catch (e) {
        failed.push({ row: i + 1, reason: e.message })
      }
    }

    res.json({
      message: `导入完成：成功 ${success.length} 条，失败 ${failed.length} 条`,
      success,
      failed
    })
  } catch (e) {
    console.error('批量导入失败:', e)
    res.status(500).json({ message: '导入失败：' + e.message })
  }
})

export default router
