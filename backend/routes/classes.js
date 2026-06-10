import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取所有班级（支持按专业筛选）
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { major_id } = req.query
    let sql = `
      SELECT c.id, c.name, c.description, c.created_at,
             m.id as major_id, m.name as major_name
      FROM classes c
      LEFT JOIN majors m ON c.major_id = m.id
      WHERE 1=1
    `
    const params = []
    if (major_id) {
      sql += ' AND c.major_id = $1'
      params.push(major_id)
    }
    sql += ' ORDER BY c.name'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    console.error('获取班级列表失败:', e)
    res.status(500).json({ message: '获取班级列表失败' })
  }
})

// 管理员：新增班级
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, major_id, description } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ message: '班级名称不能为空' })
    }
    const result = await pool.query(
      `INSERT INTO classes (name, major_id, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), major_id || null, description || '']
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ message: '班级名称已存在' })
    console.error('添加班级失败:', e)
    res.status(500).json({ message: '添加失败' })
  }
})

// 管理员：更新班级
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, major_id, description } = req.body
    const result = await pool.query(
      `UPDATE classes SET name=$1, major_id=$2, description=$3 WHERE id=$4 RETURNING *`,
      [name, major_id || null, description || '', req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '班级不存在' })
    res.json(result.rows[0])
  } catch (e) {
    if (e.code === '23505') return res.status(400).json({ message: '班级名称已存在' })
    console.error('更新班级失败:', e)
    res.status(500).json({ message: '更新失败' })
  }
})

// 管理员：删除班级
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM classes WHERE id=$1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '班级不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error('删除班级失败:', e)
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
