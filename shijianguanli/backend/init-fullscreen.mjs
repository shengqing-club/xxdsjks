import pool from './db.js'

async function init() {
  try {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('fullscreen_text_enabled', 'false')
       ON CONFLICT (key) DO NOTHING`
    )
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('fullscreen_text_content', '西安信息职业大学\n实践考试管理系统\n请等待考试开始')
       ON CONFLICT (key) DO NOTHING`
    )
    console.log('全屏文字设置初始化完成')
  } catch (e) {
    console.error('初始化失败:', e.message)
  } finally {
    await pool.end()
  }
}
init()
