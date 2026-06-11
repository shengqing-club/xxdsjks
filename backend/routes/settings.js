import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// 获取字幕设置（公开接口）
router.get('/scrolling-text', async (req, res) => {
  try {
    const enabledRes = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'scrolling_text_enabled'"
    )
    const contentRes = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'scrolling_text_content'"
    )
    const modeRes = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'scrolling_text_mode'"
    )
    res.json({
      enabled: enabledRes.rows[0]?.value === 'true',
      content: contentRes.rows[0]?.value || '',
      mode: modeRes.rows[0]?.value || 'normal'
    })
  } catch (e) {
    console.error('获取字幕设置失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 获取全屏文字设置（公开接口）
router.get('/fullscreen-text', async (req, res) => {
  try {
    const enabledRes = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'fullscreen_text_enabled'"
    )
    const contentRes = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'fullscreen_text_content'"
    )
    const fontRes = await pool.query(
      "SELECT value FROM site_settings WHERE key = 'fullscreen_text_font'"
    )
    res.json({
      enabled: enabledRes.rows[0]?.value === 'true',
      content: contentRes.rows[0]?.value || '',
      font: fontRes.rows[0]?.value || 'serif'
    })
  } catch (e) {
    console.error('获取全屏文字设置失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 更新字幕设置（仅管理员）
router.put('/scrolling-text', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { enabled, content, mode } = req.body
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('scrolling_text_enabled', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [String(enabled)]
    )
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('scrolling_text_content', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [content || '']
    )
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('scrolling_text_mode', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [mode || 'normal']
    )
    res.json({ message: '更新成功' })
  } catch (e) {
    console.error('更新字幕设置失败:', e)
    res.status(500).json({ message: '更新失败' })
  }
})

// 更新全屏文字设置（仅管理员）
router.put('/fullscreen-text', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { enabled, content, font } = req.body
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('fullscreen_text_enabled', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [String(enabled)]
    )
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('fullscreen_text_content', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [content || '']
    )
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ('fullscreen_text_font', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
      [font || 'serif']
    )
    res.json({ message: '更新成功' })
  } catch (e) {
    console.error('更新全屏文字设置失败:', e)
    res.status(500).json({ message: '更新失败' })
  }
})

export default router
