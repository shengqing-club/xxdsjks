import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取字幕设置（公开接口）
router.get('/scrolling-text', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT `key`, value FROM site_settings WHERE `key` IN ('scrolling_text_enabled', 'scrolling_text_content', 'scrolling_text_mode')"
    )
    const settings = {}
    for (const row of result.rows) settings[row.key] = row.value
    res.json({
      enabled: settings['scrolling_text_enabled'] === 'true',
      content: settings['scrolling_text_content'] || '',
      mode: settings['scrolling_text_mode'] || 'normal'
    })
  } catch (e) {
    console.error('获取字幕设置失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 获取全屏文字设置（公开接口）
router.get('/fullscreen-text', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT `key`, value FROM site_settings WHERE `key` IN ('fullscreen_text_enabled', 'fullscreen_text_content', 'fullscreen_text_font')"
    )
    const settings = {}
    for (const row of result.rows) settings[row.key] = row.value
    res.json({
      enabled: settings['fullscreen_text_enabled'] === 'true',
      content: settings['fullscreen_text_content'] || '',
      font: settings['fullscreen_text_font'] || 'serif'
    })
  } catch (e) {
    console.error('获取全屏文字设置失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 更新字幕设置（仅管理员，使用事务保证原子性）
router.put('/scrolling-text', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    const { enabled, content, mode } = req.body
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO site_settings (\`key\`, value) VALUES ('scrolling_text_enabled', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
      [String(!!enabled)]
    )
    await client.query(
      `INSERT INTO site_settings (\`key\`, value) VALUES ('scrolling_text_content', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
      [content || '']
    )
    await client.query(
      `INSERT INTO site_settings (\`key\`, value) VALUES ('scrolling_text_mode', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
      [mode || 'normal']
    )
    await client.query('COMMIT')
    res.json({ message: '更新成功' })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('更新字幕设置失败:', e)
    res.status(500).json({ message: '更新失败' })
  } finally {
    client.release()
  }
})

// 更新全屏文字设置（仅管理员，使用事务保证原子性）
router.put('/fullscreen-text', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    const { enabled, content, font } = req.body
    await client.query('BEGIN')
    await client.query(
      `INSERT INTO site_settings (\`key\`, value) VALUES ('fullscreen_text_enabled', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
      [String(!!enabled)]
    )
    await client.query(
      `INSERT INTO site_settings (\`key\`, value) VALUES ('fullscreen_text_content', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
      [content || '']
    )
    await client.query(
      `INSERT INTO site_settings (\`key\`, value) VALUES ('fullscreen_text_font', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
      [font || 'serif']
    )
    await client.query('COMMIT')
    res.json({ message: '更新成功' })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('更新全屏文字设置失败:', e)
    res.status(500).json({ message: '更新失败' })
  } finally {
    client.release()
  }
})

export default router
