import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取所有专业（含学生人数）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, CAST(COUNT(s.id) AS UNSIGNED) as student_count
      FROM majors m
      LEFT JOIN students s ON m.name = s.major
      GROUP BY m.id, m.name, m.code, m.description, m.created_at
      ORDER BY m.code
    `)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取专业列表失败' })
  }
})

// 管理员：新增专业
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, code, description } = req.body
    const result = await pool.query(
      `INSERT INTO majors (name, code, description) VALUES (?,?,?)`,
      [name, code, description || '']
    )
    const insertedId = result.insertId
    const newRow = await pool.query('SELECT * FROM majors WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: '专业名称或代码已存在' })
    res.status(500).json({ message: '添加失败' })
  }
})

// 管理员：更新专业
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    const { name, code, description } = req.body
    // 先查旧名称
    const oldRes = await client.query('SELECT name FROM majors WHERE id=?', [req.params.id])
    if (oldRes.rows.length === 0) return res.status(404).json({ message: '专业不存在' })
    const oldName = oldRes.rows[0].name

    await client.query('BEGIN')
    await client.query(
      `UPDATE majors SET name=?, code=?, description=? WHERE id=?`,
      [name, code, description || '', req.params.id]
    )
    // 如果专业名称变更，同步更新 students.major
    if (oldName !== name) {
      await client.query('UPDATE students SET major=? WHERE major=?', [name, oldName])
    }
    await client.query('COMMIT')
    const result = await client.query('SELECT * FROM majors WHERE id = ?', [req.params.id])
    res.json(result.rows[0])
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    res.status(500).json({ message: '更新失败' })
  } finally {
    client.release()
  }
})

// 管理员：删除专业
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM majors WHERE id=?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ message: '专业不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

// 获取专业学生人数统计
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.name, m.code, CAST(COUNT(s.id) AS UNSIGNED) as student_count
      FROM majors m
      LEFT JOIN students s ON m.name = s.major
      GROUP BY m.name, m.code
      ORDER BY student_count DESC
    `)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取统计失败' })
  }
})

export default router
