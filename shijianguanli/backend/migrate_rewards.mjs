import pool from './db.js'

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rewards_punishments (
        id SERIAL PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        student_name VARCHAR(100),
        class_name VARCHAR(100),
        type VARCHAR(10) NOT NULL CHECK (type IN ('奖励', '惩罚')),
        category VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        points INTEGER DEFAULT 0,
        awarded_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('rewards_punishments 表创建成功')
  } catch (e) {
    console.error('迁移失败:', e)
  } finally {
    await pool.end()
  }
}

migrate()
