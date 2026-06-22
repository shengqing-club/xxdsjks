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
      sql += ' AND c.major_id = ?'
      params.push(major_id)
    }
    sql += ' ORDER BY c.name'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
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
       VALUES (?, ?, ?)`,
      [name.trim(), major_id || null, description || '']
    )
    const insertedId = result.insertId
    const newRow = await pool.query('SELECT * FROM classes WHERE id = ?', [insertedId])
    res.status(201).json(newRow.rows[0])
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: '班级名称已存在' })
    res.status(500).json({ message: '添加失败' })
  }
})

// 管理员：更新班级
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    const { name, major_id, description } = req.body
    // 先查旧名称
    const oldRes = await client.query('SELECT name FROM classes WHERE id=?', [req.params.id])
    if (oldRes.rows.length === 0) return res.status(404).json({ message: '班级不存在' })
    const oldName = oldRes.rows[0].name

    await client.query('BEGIN')
    await client.query(
      `UPDATE classes SET name=?, major_id=?, description=? WHERE id=?`,
      [name, major_id || null, description || '', req.params.id]
    )
    // 如果班级名称变更，同步更新 students.class_name
    if (oldName !== name) {
      await client.query('UPDATE students SET class_name=? WHERE class_name=?', [name, oldName])
    }
    await client.query('COMMIT')
    const result = await client.query('SELECT * FROM classes WHERE id = ?', [req.params.id])
    res.json(result.rows[0])
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: '班级名称已存在' })
    res.status(500).json({ message: '更新失败' })
  } finally {
    client.release()
  }
})

// 管理员：删除班级（同时清除学生引用）
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM classes WHERE id=?', [req.params.id])
    if (result.affectedRows === 0) return res.status(404).json({ message: '班级不存在' })
    // 清除学生表中对该班级的引用
    // MySQL 不支持 RETURNING，上面已经删除成功，但我们需要 className 来清除引用
    // 这里改为先查询再删除
    const classRow = await pool.query('SELECT name FROM classes WHERE id = ?', [req.params.id])
    if (classRow.rows.length > 0) {
      const className = classRow.rows[0].name
      await pool.query('UPDATE students SET class_name = NULL WHERE class_name = ?', [className])
    }
    res.json({ message: '删除成功' })
  } catch (e) {
    console.error('删除班级失败:', e)
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
