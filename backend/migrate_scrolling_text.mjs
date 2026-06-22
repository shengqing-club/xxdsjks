import pool from './db.js'

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('site_settings 表创建成功')

    // 初始化字幕设置
    await pool.query(`
      INSERT INTO site_settings (key, value)
      VALUES ('scrolling_text_enabled', 'false')
      ON CONFLICT (key) DO NOTHING
    `)
    await pool.query(`
      INSERT INTO site_settings (key, value)
      VALUES ('scrolling_text_content', '欢迎使用学生信息管理系统')
      ON CONFLICT (key) DO NOTHING
    `)
    console.log('字幕设置初始化完成')
  } catch (e) {
    console.error('迁移失败:', e)
  } finally {
    await pool.end()
  }
}

migrate()
