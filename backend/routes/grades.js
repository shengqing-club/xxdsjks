import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

// 获取指定学生的成绩
router.get('/student/:studentId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM grades WHERE student_id = $1 ORDER BY semester DESC, course_name',
      [req.params.studentId]
    )
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取成绩失败' })
  }
})

// 管理员：获取所有成绩
router.get('/', adminMiddleware, async (req, res) => {
  try {
    const { studentId, semester, major } = req.query
    let sql = `SELECT g.*, s.name as student_name, s.major, s.class_name
               FROM grades g LEFT JOIN students s ON g.student_id = s.student_id WHERE 1=1`
    const params = []
    let idx = 1
    if (studentId) {
      sql += ` AND g.student_id ILIKE $${idx}`
      params.push(`%${studentId}%`)
      idx++
    }
    if (semester) {
      sql += ` AND g.semester = $${idx}`
      params.push(semester)
      idx++
    }
    if (major) {
      sql += ` AND s.major = $${idx}`
      params.push(major)
      idx++
    }
    sql += ' ORDER BY g.student_id, g.semester DESC, g.course_name'
    const result = await pool.query(sql, params)
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取成绩失败' })
  }
})

// 学生端：获取成绩排名（无需管理员权限，仅返回聚合统计数据）
router.get('/ranking/public', async (req, res) => {
  try {
    const { semester, major } = req.query
    let sql = `
      SELECT
        g.student_id,
        s.name,
        s.major,
        s.class_name,
        ROUND(AVG(g.score), 1) as avg_score,
        COUNT(*) as course_count,
        MAX(g.score) as max_score
      FROM grades g
      JOIN students s ON g.student_id = s.student_id
      WHERE 1=1
    `
    const params = []
    let idx = 1
    if (semester) {
      sql += ` AND g.semester = $${idx}`
      params.push(semester)
      idx++
    }
    if (major) {
      sql += ` AND s.major = $${idx}`
      params.push(major)
      idx++
    }
    sql += ' GROUP BY g.student_id, s.name, s.major, s.class_name ORDER BY avg_score DESC'
    const result = await pool.query(sql, params)
    const ranked = result.rows.map((row, i) => ({ ...row, rank: i + 1 }))
    res.json(ranked)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取排名失败' })
  }
})

// 管理员：成绩排名
router.get('/ranking', adminMiddleware, async (req, res) => {
  try {
    const { semester, major } = req.query
    let sql = `
      SELECT
        g.student_id,
        s.name,
        s.major,
        s.class_name,
        ROUND(AVG(g.score), 1) as avg_score,
        ROUND(AVG(
          CASE
            WHEN g.score >= 90 THEN 4.0
            WHEN g.score >= 80 THEN 3.0
            WHEN g.score >= 70 THEN 2.0
            WHEN g.score >= 60 THEN 1.0
            ELSE 0
          END
        ), 2) as gpa,
        COUNT(*) as course_count,
        MAX(g.score) as max_score,
        MIN(g.score) as min_score
      FROM grades g
      JOIN students s ON g.student_id = s.student_id
      WHERE 1=1
    `
    const params = []
    let idx = 1
    if (semester) {
      sql += ` AND g.semester = $${idx}`
      params.push(semester)
      idx++
    }
    if (major) {
      sql += ` AND s.major = $${idx}`
      params.push(major)
      idx++
    }
    sql += ' GROUP BY g.student_id, s.name, s.major, s.class_name ORDER BY avg_score DESC'
    const result = await pool.query(sql, params)
    // 添加排名序号
    const ranked = result.rows.map((row, i) => ({ ...row, rank: i + 1 }))
    res.json(ranked)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取排名失败' })
  }
})

// 管理员：成绩统计（按分数段）
router.get('/stats/distribution', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE score >= 90) as excellent,
        COUNT(*) FILTER (WHERE score >= 80 AND score < 90) as good,
        COUNT(*) FILTER (WHERE score >= 70 AND score < 80) as medium,
        COUNT(*) FILTER (WHERE score >= 60 AND score < 70) as pass,
        COUNT(*) FILTER (WHERE score < 60) as fail
      FROM grades
    `)
    const r = result.rows[0]
    res.json({
      excellent: Number(r.excellent) || 0,
      good: Number(r.good) || 0,
      medium: Number(r.medium) || 0,
      pass: Number(r.pass) || 0,
      fail: Number(r.fail) || 0,
    })
  } catch (e) {
    res.status(500).json({ message: '获取统计失败' })
  }
})

// 管理员：按班级统计成绩
router.get('/stats/by-class', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.class_name,
        COUNT(DISTINCT s.student_id) as student_count,
        COUNT(*) as grade_count,
        ROUND(AVG(g.score), 1) as avg_score,
        MAX(g.score) as max_score,
        MIN(g.score) as min_score,
        ROUND(AVG(
          CASE
            WHEN g.score >= 90 THEN 4.0
            WHEN g.score >= 80 THEN 3.0
            WHEN g.score >= 70 THEN 2.0
            WHEN g.score >= 60 THEN 1.0
            ELSE 0
          END
        ), 2) as avg_gpa,
        COUNT(*) FILTER (WHERE g.score >= 90) as excellent,
        COUNT(*) FILTER (WHERE g.score >= 80 AND g.score < 90) as good,
        COUNT(*) FILTER (WHERE g.score >= 70 AND g.score < 80) as medium,
        COUNT(*) FILTER (WHERE g.score >= 60 AND g.score < 70) as pass_count,
        COUNT(*) FILTER (WHERE g.score < 60) as fail
      FROM grades g
      JOIN students s ON g.student_id = s.student_id
      WHERE s.class_name IS NOT NULL AND s.class_name != ''
      GROUP BY s.class_name
      ORDER BY avg_score DESC
    `)
    res.json(result.rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '获取班级统计失败' })
  }
})

// 课程类型统计
router.get('/stats/course-type', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT course_type as name, COUNT(*) as value FROM grades GROUP BY course_type ORDER BY value DESC
    `)
    res.json(result.rows)
  } catch (e) {
    res.status(500).json({ message: '获取课程统计失败' })
  }
})

// 管理员：新增成绩
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { studentId, courseName, score, semester, courseType } = req.body
    const result = await pool.query(
      `INSERT INTO grades (student_id, course_name, score, course_type, semester)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [studentId, courseName, score, courseType || '必修', semester]
    )
    res.status(201).json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '添加失败' })
  }
})

// 管理员：批量导入成绩
router.post('/batch-import', adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    const { grades: gradeList } = req.body
    if (!gradeList || !gradeList.length) {
      return res.status(400).json({ message: '没有可导入的数据' })
    }
    await client.query('BEGIN')
    let imported = 0
    let errors = 0
    for (const g of gradeList) {
      try {
        await client.query(
          `INSERT INTO grades (student_id, course_name, score, course_type, semester)
           VALUES ($1,$2,$3,$4,$5)`,
          [g.studentId, g.courseName, g.score, g.courseType || '必修', g.semester]
        )
        imported++
      } catch {
        errors++
      }
    }
    await client.query('COMMIT')
    res.json({ message: `导入完成：成功 ${imported} 条，失败 ${errors} 条`, imported, errors })
  } catch (e) {
    await client.query('ROLLBACK')
    console.error(e)
    res.status(500).json({ message: '批量导入失败' })
  } finally {
    client.release()
  }
})

// 管理员：更新成绩
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { studentId, courseName, score, semester, courseType } = req.body
    const result = await pool.query(
      `UPDATE grades SET student_id=$1, course_name=$2, score=$3, course_type=$4, semester=$5, updated_at=CURRENT_TIMESTAMP
       WHERE id=$6 RETURNING *`,
      [studentId, courseName, score, courseType, semester, req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ message: '成绩记录不存在' })
    res.json(result.rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: '更新失败' })
  }
})

// 管理员：删除成绩
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM grades WHERE id=$1 RETURNING id', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ message: '成绩记录不存在' })
    res.json({ message: '删除成功' })
  } catch (e) {
    res.status(500).json({ message: '删除失败' })
  }
})

export default router
