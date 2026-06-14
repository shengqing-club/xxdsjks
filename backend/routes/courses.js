import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取所有课程
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courses ORDER BY name')
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取课程列表失败' })
  }
})

// 管理员：新增课程
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, code, credit, major, description } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ message: '课程名称不能为空' })
    }
    const result = await pool.query(
      `INSERT INTO courses (name, code, credit, major, description)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name.trim(), code || '', credit || 3, major || '', description || '']
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ message: '课程名称或代码已存在' })
    res.status(500).json({ message: '添加失败' })
  }
})

// 管理员：更新课程
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, code, credit, major, description } = req.body
    const result = await pool.query(
      `UPDATE courses SET name=$1, code=$2, credit=$3, major=$4, description=$5 WHERE id=$6 RETURNING *`,
      [name, code || '', credit || 3, major || '', description || '', req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '课程不存在' })
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '更新失败' })
  }
})

// 管理员：删除课程
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM courses WHERE id=$1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '课程不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

// 管理员：批量删除课程
router.post('/batch-delete', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { ids } = req.body
    if (!ids || !ids.length) return res.status(400).json({ message: '请选择要删除的课程' })
    const result = await pool.query('DELETE FROM courses WHERE id = ANY($1)', [ids])
    res.json({ message: `成功删除 ${result.rowCount} 门课程` })
  } catch (e) {
    res.status(500).json({ message: '批量删除失败' })
  }
})

export default router
