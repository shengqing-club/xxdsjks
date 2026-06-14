import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// ====== 分组 CRUD ======

// 创建分组（管理员）
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { name, description, class_name } = req.body
    if (!name || !class_name) {
      return res.status(400).json({ message: '分组名称和班级不能为空' })
    }
    const result = await pool.query(
      `INSERT INTO groups (name, description, class_name, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, description || '', class_name, req.user.username]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '创建分组失败' })
  }
})

// 获取分组列表
router.get('/', async (req, res) => {
  try {
    const { class_name, include_disbanded } = req.query
    let sql = 'SELECT * FROM groups WHERE 1=1'
    const params = []
    let idx = 1
    if (class_name) {
      sql += ` AND class_name = $${idx++}`
      params.push(class_name)
    }
    if (include_disbanded !== 'true') {
      sql += ` AND is_active = true`
    }
    sql += ' ORDER BY created_at DESC'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取分组列表失败' })
  }
})

// 获取单个分组详情（含成员）
router.get('/:id', async (req, res) => {
  try {
    const groupResult = await pool.query('SELECT * FROM groups WHERE id = $1', [req.params.id])
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: '分组不存在' })
    }
    const group = groupResult.rows[0]

    const membersResult = await pool.query(
      `SELECT gm.*, s.name as student_name, s.class_name
       FROM group_members gm
       LEFT JOIN students s ON gm.student_id = s.student_id
       WHERE gm.group_id = $1
       ORDER BY gm.role DESC, gm.joined_at ASC`,
      [req.params.id]
    )

    // 统计活跃度
    const statsResult = await pool.query(
      `SELECT COUNT(*) as message_count,
              COUNT(DISTINCT sender_id) as active_members
       FROM group_chat_messages WHERE group_id = $1`,
      [req.params.id]
    )

    res.json({
      ...group,
      members: membersResult.rows,
      stats: statsResult.rows[0]
    })
  } catch (e) {
    res.status(500).json({ message: '获取分组详情失败' })
  }
})

// 更新分组信息（管理员或组长）
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body
    const groupId = req.params.id
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    // 检查权限
    if (!isAdmin) {
      const leaderCheck = await pool.query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2 AND role = $3',
        [groupId, userId, 'leader']
      )
      if (leaderCheck.rows.length === 0) {
        return res.status(403).json({ message: '无权修改此分组' })
      }
    }

    const result = await pool.query(
      'UPDATE groups SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [name, description, groupId]
    )
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '更新分组失败' })
  }
})

// 解散分组（管理员）
router.delete('/:id', adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const groupId = req.params.id

    // 1. 标记分组为解散状态
    await client.query(
      'UPDATE groups SET is_active = false, disbanded_at = CURRENT_TIMESTAMP WHERE id = $1',
      [groupId]
    )

    // 2. 清空分组聊天消息
    await client.query('DELETE FROM group_chat_messages WHERE group_id = $1', [groupId])

    // 3. 清空分组文件
    await client.query('DELETE FROM group_files WHERE group_id = $1', [groupId])

    // 4. 移除分组成员
    await client.query('DELETE FROM group_members WHERE group_id = $1', [groupId])

    await client.query('COMMIT')
    res.json({ message: '分组已解散，相关数据已清理' })
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ message: '解散分组失败' })
  } finally {
    client.release()
  }
})

// ====== 成员管理 ======

// 添加成员到分组（管理员或组长）
router.post('/:id/members', async (req, res) => {
  try {
    const groupId = req.params.id
    const { student_id } = req.body
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    // 检查权限
    if (!isAdmin) {
      const leaderCheck = await pool.query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2 AND role = $3',
        [groupId, userId, 'leader']
      )
      if (leaderCheck.rows.length === 0) {
        return res.status(403).json({ message: '无权添加成员' })
      }
    }

    // 检查分组是否活跃
    const groupCheck = await pool.query('SELECT is_active FROM groups WHERE id = $1', [groupId])
    if (groupCheck.rows.length === 0 || !groupCheck.rows[0].is_active) {
      return res.status(400).json({ message: '分组不存在或已解散' })
    }

    // 获取学生信息
    const studentResult = await pool.query(
      'SELECT student_id, name, class_name FROM students WHERE student_id = $1',
      [student_id]
    )
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: '学生不存在' })
    }
    const student = studentResult.rows[0]

    const result = await pool.query(
      `INSERT INTO group_members (group_id, student_id, student_name, role)
       VALUES ($1,$2,$3,$4) ON CONFLICT (group_id, student_id) DO NOTHING RETURNING *`,
      [groupId, student_id, student.name, 'member']
    )
    if (result.rows.length === 0) {
      return res.status(400).json({ message: '该学生已在分组中' })
    }
    res.status(201).json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '添加成员失败' })
  }
})

// 从分组移除成员（管理员或组长）
router.delete('/:id/members/:student_id', async (req, res) => {
  try {
    const groupId = req.params.id
    const studentId = req.params.student_id
    const userId = req.user.studentId || req.user.username
    const isAdmin = !!req.user.username && !req.user.studentId

    // 检查权限（不能移除自己）
    if (!isAdmin) {
      if (studentId === userId) {
        return res.status(403).json({ message: '不能移除自己' })
      }
      const leaderCheck = await pool.query(
        'SELECT 1 FROM group_members WHERE group_id = $1 AND student_id = $2 AND role = $3',
        [groupId, userId, 'leader']
      )
      if (leaderCheck.rows.length === 0) {
        return res.status(403).json({ message: '无权移除成员' })
      }
    }

    await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND student_id = $2',
      [groupId, studentId]
    )
    res.json({ message: '移除成功' })
  } catch (e) {
    res.status(500).json({ message: '移除成员失败' })
  }
})

// ====== 组长任命 ======

// 任命组长（管理员）
router.post('/:id/leader/:student_id', adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const groupId = req.params.id
    const studentId = req.params.student_id

    // 取消现有组长
    await client.query(
      "UPDATE group_members SET role = 'member' WHERE group_id = $1 AND role = 'leader'",
      [groupId]
    )

    // 设置新组长
    const result = await client.query(
      "UPDATE group_members SET role = 'leader' WHERE group_id = $1 AND student_id = $2 RETURNING *",
      [groupId, studentId]
    )

    // 更新 groups 表的 leader_id
    await client.query(
      'UPDATE groups SET leader_id = $1 WHERE id = $2',
      [studentId, groupId]
    )

    await client.query('COMMIT')
    res.json(result.rows[0])
  } catch (e) {
    await client.query('ROLLBACK')
    res.status(500).json({ message: '任命组长失败' })
  } finally {
    client.release()
  }
})

// 获取学生所在分组
router.get('/student/:student_id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, gm.role as member_role
       FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.student_id = $1 AND g.is_active = true
       ORDER BY g.created_at DESC`,
      [req.params.student_id]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取学生分组失败' })
  }
})

// 获取分组活跃度统计（管理员）
router.get('/stats/overview', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        g.id, g.name, g.class_name, g.is_active,
        COUNT(DISTINCT gm.student_id) as member_count,
        COUNT(DISTINCT gcm.id) as message_count,
        COUNT(DISTINCT gcm.sender_id) as active_members,
        MAX(gcm.created_at) as last_activity
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN group_chat_messages gcm ON g.id = gcm.group_id
      GROUP BY g.id, g.name, g.class_name, g.is_active
      ORDER BY g.created_at DESC
    `)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取统计失败' })
  }
})

export default router
