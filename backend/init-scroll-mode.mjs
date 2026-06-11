import pool from './db.js'

async function init() {
  try {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('scrolling_text_mode', 'normal')
       ON CONFLICT (key) DO NOTHING`
    )
    console.log('滚动字幕模式初始化完成')
  } catch (e) {
    console.error('初始化失败:', e.message)
  } finally {
    await pool.end()
  }
}
init()
