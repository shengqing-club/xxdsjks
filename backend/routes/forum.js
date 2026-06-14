import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// ========== 帖子 ==========

// 获取帖子列表（支持分页、分类筛选、搜索）
router.get('/posts', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, category, keyword } = req.query
    const offset = (page - 1) * pageSize
    let whereSql = 'WHERE 1=1'
    const params = []
    let paramIdx = 1

    if (category && category !== '全部') {
      whereSql += ` AND p.category = $${paramIdx++}`
      params.push(category)
    }
    if (keyword) {
      whereSql += ` AND (p.title ILIKE $${paramIdx} OR p.content ILIKE $${paramIdx})`
      params.push(`%${keyword}%`)
      paramIdx++
    }

    const countResult = await pool.query(`SELECT COUNT(*) as total FROM forum_posts p ${whereSql}`, params)

    // is_liked 参数化（防止SQL注入）
    const userId = req.user.studentId || req.user.username
    const isLikedSql = userId
      ? `(SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id AND user_id = $${paramIdx++}) as is_liked`
      : '0 as is_liked'
    if (userId) params.push(userId)

    const result = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) as comment_count,
              ${isLikedSql}
       FROM forum_posts p ${whereSql}
       ORDER BY p.pinned DESC, p.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, parseInt(pageSize), offset]
    )
    res.json({ list: result.rows, total: parseInt(countResult.rows[0].total), page: parseInt(page), pageSize: parseInt(pageSize) })
  } catch (e) {
    res.status(500).json({ message: '获取帖子列表失败' })
  }
})

// 获取帖子详情
router.get('/posts/:id', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const result = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count,
              (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) as comment_count,
              (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id AND user_id = $1) as is_liked
       FROM forum_posts p WHERE p.id = $2`,
      [userId, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '帖子不存在' })
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '获取帖子详情失败' })
  }
})

// 发帖
router.post('/posts', async (req, res) => {
  try {
    const { title, content, category } = req.body
    if (!title || !title.trim()) return res.status(400).json({ message: '标题不能为空' })
    if (!content || !content.trim()) return res.status(400).json({ message: '内容不能为空' })
    const userId = req.user.studentId || req.user.username
    const userName = req.user.name || userId
    const userRole = req.user.studentId ? 'student' : 'admin'
    const result = await pool.query(
      `INSERT INTO forum_posts (title, content, category, author_id, author_name, author_role)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title.trim(), content.trim(), category || '综合', userId, userName, userRole]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '发帖失败' })
  }
})

// 删除帖子（管理员或作者本人）
router.delete('/posts/:id', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const post = await pool.query('SELECT author_id FROM forum_posts WHERE id = $1', [req.params.id])
    if (post.rows.length === 0) return res.status(404).json({ message: '帖子不存在' })
    if (post.rows[0].author_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权删除此帖子' })
    }
    await pool.query('DELETE FROM forum_comments WHERE post_id = $1', [req.params.id])
    await pool.query('DELETE FROM forum_likes WHERE post_id = $1', [req.params.id])
    await pool.query('DELETE FROM forum_posts WHERE id = $1', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

// 置顶/取消置顶（管理员）
router.put('/posts/:id/pin', adminMiddleware, async (req, res) => {
  try {
    const { pinned } = req.body
    const result = await pool.query('UPDATE forum_posts SET pinned = $1 WHERE id = $2 RETURNING *', [pinned, req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '帖子不存在' })
    res.json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '操作失败' })
  }
})

// ========== 评论 ==========

// 获取帖子评论列表
router.get('/posts/:id/comments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM forum_comments WHERE post_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取评论失败' })
  }
})

// 发表评论
router.post('/posts/:id/comments', async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !content.trim()) return res.status(400).json({ message: '评论内容不能为空' })
    const userId = req.user.studentId || req.user.username
    const userName = req.user.name || userId
    const userRole = req.user.studentId ? 'student' : 'admin'
    const result = await pool.query(
      `INSERT INTO forum_comments (post_id, content, author_id, author_name, author_role)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, content.trim(), userId, userName, userRole]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    res.status(500).json({ message: '评论失败' })
  }
})

// 删除评论（管理员或作者本人）
router.delete('/comments/:id', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const comment = await pool.query('SELECT author_id FROM forum_comments WHERE id = $1', [req.params.id])
    if (comment.rows.length === 0) return res.status(404).json({ message: '评论不存在' })
    if (comment.rows[0].author_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: '无权删除此评论' })
    }
    await pool.query('DELETE FROM forum_comments WHERE id = $1', [req.params.id])
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

// ========== 点赞 ==========

// 点赞/取消点赞
router.post('/posts/:id/like', async (req, res) => {
  try {
    const userId = req.user.studentId || req.user.username
    const existing = await pool.query(
      'SELECT id FROM forum_likes WHERE post_id = $1 AND user_id = $2',
      [req.params.id, userId]
    )
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM forum_likes WHERE post_id = $1 AND user_id = $2', [req.params.id, userId])
      res.json({ liked: false })
    } else {
      await pool.query(
        'INSERT INTO forum_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.params.id, userId]
      )
      res.json({ liked: true })
    }
  } catch (e) {
    res.status(500).json({ message: '操作失败' })
  }
})

// 获取点赞用户列表
router.get('/posts/:id/likes', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT user_id, user_name FROM forum_likes WHERE post_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    )
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取点赞列表失败' })
  }
})

export default router
