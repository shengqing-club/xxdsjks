import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// ========== 段位阈值表（与 game.js 保持一致） ==========
const TIER_THRESHOLDS = [
  { tier: 'black_iron', division: 3, name: '黑铁 III', icon: '\u{1FAA8}', color: '#4A4A4A', min: 0 },
  { tier: 'black_iron', division: 2, name: '黑铁 II', icon: '\u{1FAA8}', color: '#4A4A4A', min: 2000 },
  { tier: 'black_iron', division: 1, name: '黑铁 I', icon: '\u{1FAA8}', color: '#4A4A4A', min: 5000 },
  { tier: 'bronze', division: 3, name: '青铜 III', icon: '\u{1F536}', color: '#CD7F32', min: 10000 },
  { tier: 'bronze', division: 2, name: '青铜 II', icon: '\u{1F536}', color: '#CD7F32', min: 20000 },
  { tier: 'bronze', division: 1, name: '青铜 I', icon: '\u{1F536}', color: '#CD7F32', min: 35000 },
  { tier: 'silver', division: 3, name: '白银 III', icon: '\u{26AA}', color: '#C0C0C0', min: 55000 },
  { tier: 'silver', division: 2, name: '白银 II', icon: '\u{26AA}', color: '#C0C0C0', min: 80000 },
  { tier: 'silver', division: 1, name: '白银 I', icon: '\u{26AA}', color: '#C0C0C0', min: 115000 },
  { tier: 'gold', division: 3, name: '黄金 III', icon: '\u{1F7E1}', color: '#FFD700', min: 160000 },
  { tier: 'gold', division: 2, name: '黄金 II', icon: '\u{1F7E1}', color: '#FFD700', min: 215000 },
  { tier: 'gold', division: 1, name: '黄金 I', icon: '\u{1F7E1}', color: '#FFD700', min: 285000 },
  { tier: 'platinum', division: 3, name: '铂金 III', icon: '\u{1F48E}', color: '#4ECDC4', min: 370000 },
  { tier: 'platinum', division: 2, name: '铂金 II', icon: '\u{1F48E}', color: '#4ECDC4', min: 470000 },
  { tier: 'platinum', division: 1, name: '铂金 I', icon: '\u{1F48E}', color: '#4ECDC4', min: 590000 },
  { tier: 'diamond', division: 3, name: '钻石 III', icon: '\u{1F4A0}', color: '#9B59B6', min: 730000 },
  { tier: 'diamond', division: 2, name: '钻石 II', icon: '\u{1F4A0}', color: '#9B59B6', min: 900000 },
  { tier: 'diamond', division: 1, name: '钻石 I', icon: '\u{1F4A0}', color: '#9B59B6', min: 1100000 },
  { tier: 'king', division: 0, name: '王者', icon: '\u{1F451}', color: '#E74C3C', min: 1350000 },
]

// ========== 工具函数 ==========

/** 根据 total_score 返回最高满足的段位对象 */
function getTierByScore(totalScore) {
  let result = TIER_THRESHOLDS[0]
  for (const t of TIER_THRESHOLDS) {
    if (totalScore >= t.min) {
      result = t
    }
  }
  return result
}

/** 返回当前段位和下一段位的阈值信息，用于计算进度条百分比 */
function getNextTierThreshold(totalScore) {
  const current = getTierByScore(totalScore)
  const currentIdx = TIER_THRESHOLDS.findIndex(t => t.tier === current.tier && t.division === current.division)
  const next = TIER_THRESHOLDS[currentIdx + 1]
  if (!next) {
    // 已达最高段位（王者）
    return {
      currentTier: current.name,
      currentMin: current.min,
      nextTier: null,
      nextMin: null,
      progress: 100,
    }
  }
  const progress = Math.min(100, Math.round(((totalScore - current.min) / (next.min - current.min)) * 100))
  return {
    currentTier: current.name,
    currentMin: current.min,
    nextTier: next.name,
    nextMin: next.min,
    progress,
  }
}

/** 获取或创建排位记录 */
async function getOrCreateRank(conn, userId, userName, userRole, season) {
  const { rows } = await conn.query(
    'SELECT * FROM game_ranks WHERE user_id = ? AND season = ?',
    [userId, season]
  )
  if (rows.length > 0) return rows[0]

  await conn.query(
    `INSERT INTO game_ranks (user_id, user_name, user_role, season, tier, division, stars, max_stars, total_score, protection_cards, promotion_wins, promotion_needed, in_promotion, games_played, games_won, win_streak)
     VALUES (?, ?, ?, ?, 'black_iron', 3, 0, 0, 0, 0, 0, 0, FALSE, 0, 0, 0)`,
    [userId, userName, userRole, season]
  )
  const { rows: newRows } = await conn.query(
    'SELECT * FROM game_ranks WHERE user_id = ? AND season = ?',
    [userId, season]
  )
  return newRows[0]
}

/** 获取王者人数限制 */
async function getKingLimit() {
  try {
    const { rows } = await pool.query(
      "SELECT value FROM site_settings WHERE `key` = 'game_king_limit'"
    )
    return parseInt(rows[0]?.value) || 10
  } catch {
    return 10
  }
}

/** 获取当前活跃赛季 */
async function getActiveSeason(conn) {
  const { rows } = await conn.query(
    'SELECT * FROM game_seasons WHERE is_active = TRUE ORDER BY id DESC LIMIT 1'
  )
  return rows?.[0] || null
}

/** 根据游戏表现计算积分变动（纯加法，无扣分） */
async function calcScoreChange(conn, score, gameMode) {
  const { rows } = await conn.query(
    'SELECT MAX(score) as max_score FROM game_scores WHERE mode = ?',
    [gameMode]
  )
  const maxScore = rows[0]?.max_score || 0
  if (maxScore === 0) return 0

  const percentile = score / maxScore
  const isTimed = gameMode === 'timed'

  if (percentile >= 0.9) return isTimed ? 800 : 500
  else if (percentile >= 0.75) return isTimed ? 400 : 250
  else if (percentile >= 0.5) return isTimed ? 180 : 120
  else return 50
}

// ========== API 路由 ==========

// ---------- GET /my：获取我的排位信息 ----------
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '\u73A9\u5BB6'
    const season = await getActiveSeason(pool)
    if (!season) return res.json(null)

    const rank = await getOrCreateRank(pool, userId, userName, req.user.role || 'student', season.season_number)
    const tierInfo = getTierByScore(rank.total_score)
    const nextInfo = getNextTierThreshold(rank.total_score)

    // 排行榜排名
    let position = null
    try {
      const { rows: posRows } = await pool.query(
        'SELECT COUNT(*) as pos FROM game_ranks WHERE season = ? AND total_score > ?',
        [season.season_number, rank.total_score]
      )
      position = (posRows[0]?.pos || 0) + 1
    } catch { /* ignore */ }

    res.json({
      rank,
      tierName: tierInfo.name,
      tierIcon: tierInfo.icon,
      tierColor: tierInfo.color,
      tierKey: tierInfo.tier,
      division: tierInfo.division,
      totalScore: rank.total_score,
      nextTier: nextInfo.nextTier,
      nextTierMin: nextInfo.nextMin,
      progress: nextInfo.progress,
      rankedWins: rank.games_won || 0,
      rankedLosses: (rank.games_played || 0) - (rank.games_won || 0),
      rankedStreak: rank.win_streak || 0,
      position,
    })
  } catch (e) {
    console.error('\u83B7\u53D6\u6392\u4F4D\u4FE1\u606F\u5931\u8D25:', e)
    res.status(500).json({ message: '\u83B7\u53D6\u5931\u8D25' })
  }
})

// ---------- GET /leaderboard：排位排行榜（按 total_score 降序） ----------
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 20 } = req.query
    const season = await getActiveSeason(pool)
    if (!season) return res.json([])

    const { rows } = await pool.query(
      `SELECT user_id, user_name, user_role, total_score, games_played, games_won, win_streak
       FROM game_ranks WHERE season = ?
       ORDER BY total_score DESC LIMIT ?`,
      [season.season_number, parseInt(limit) || 20]
    )

    const result = rows.map((r, idx) => {
      const tierInfo = getTierByScore(r.total_score)
      return {
        ...r,
        tierName: tierInfo.name,
        tierIcon: tierInfo.icon,
        tierColor: tierInfo.color,
        tierKey: tierInfo.tier,
        division: tierInfo.division,
        winRate: r.games_played > 0 ? Math.round((r.games_won / r.games_played) * 100) : 0,
        position: idx + 1,
      }
    })

    res.json(result)
  } catch (e) {
    console.error('\u83B7\u53D6\u6392\u4F4D\u699C\u5931\u8D25:', e)
    res.status(500).json({ message: '\u83B7\u53D6\u5931\u8D25' })
  }
})

// ---------- GET /top-kings：王者 Top N ----------
router.get('/top-kings', async (req, res) => {
  try {
    const kingLimit = await getKingLimit()
    const season = await getActiveSeason(pool)
    if (!season) return res.json([])

    const { rows } = await pool.query(
      `SELECT user_id, user_name, total_score, games_played, games_won, win_streak
       FROM game_ranks WHERE season = ? AND tier = 'king'
       ORDER BY total_score DESC LIMIT ?`,
      [season.season_number, kingLimit]
    )

    const result = rows.map((r, idx) => {
      const tierInfo = getTierByScore(r.total_score)
      return {
        ...r,
        tierName: tierInfo.name,
        tierIcon: tierInfo.icon,
        tierColor: tierInfo.color,
        position: idx + 1,
      }
    })

    res.json(result)
  } catch (e) {
    console.error('\u83B7\u53D6\u738B\u8005\u699C\u5355\u5931\u8D25:', e)
    res.status(500).json({ message: '\u83B7\u53D6\u5931\u8D25' })
  }
})

// ---------- GET /history：排位变动历史 ----------
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { limit = 20 } = req.query
    const season = await getActiveSeason(pool)
    if (!season) return res.json([])

    const { rows } = await pool.query(
      `SELECT * FROM game_rank_history WHERE user_id = ? AND season = ?
       ORDER BY id DESC LIMIT ?`,
      [userId, season.season_number, parseInt(limit) || 20]
    )
    res.json(rows)
  } catch (e) {
    console.error('\u83B7\u53D6\u6392\u4F4D\u5386\u53F2\u5931\u8D25:', e)
    res.status(500).json({ message: '\u83B7\u53D6\u5931\u8D25' })
  }
})

// ---------- POST /update：更新排位积分（内部调用） ----------
router.post('/update', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const { score, mode } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '\u73A9\u5BB6'
    const userRole = req.user.role || 'student'
    const gameMode = mode || 'classic'

    // 禅意模式不计排位
    if (gameMode === 'zen') {
      return res.json({ scoreChange: 0, message: '\u7985\u610F\u6A21\u5F0F\u4E0D\u8BA1\u6392\u4F4D\u5206' })
    }

    const season = await getActiveSeason(conn)
    if (!season) {
      return res.json({ scoreChange: 0, message: '\u6682\u65E0\u6D3B\u8DC3\u8D5B\u5B63' })
    }

    await conn.query('BEGIN')

    const rank = await getOrCreateRank(conn, userId, userName, userRole, season.season_number)

    // 计算积分变动
    const scoreChange = await calcScoreChange(conn, score, gameMode)

    const oldTierInfo = getTierByScore(rank.total_score)
    const oldTotalScore = rank.total_score

    // 新总分（纯累加）
    const newTotalScore = oldTotalScore + scoreChange
    const newTierInfo = getTierByScore(newTotalScore)

    const isPromotion = newTierInfo.tier !== oldTierInfo.tier || newTierInfo.division !== oldTierInfo.division

    // 连胜计数
    const winStreak = rank.win_streak + 1

    // 更新排位记录
    await conn.query(
      `UPDATE game_ranks SET
        tier = ?, division = ?, total_score = ?,
        games_played = games_played + 1,
        games_won = games_won + 1,
        win_streak = ?,
        highest_tier = ?,
        highest_division = ?,
        user_name = ?, user_role = ?
       WHERE user_id = ? AND season = ?`,
      [
        newTierInfo.tier, newTierInfo.division, newTotalScore,
        winStreak,
        newTierInfo.tier, newTierInfo.division,
        userName, userRole, userId, season.season_number
      ]
    )

    // 插入历史记录
    await conn.query(
      `INSERT INTO game_rank_history
       (user_id, season, game_mode, score, stars_before, stars_after, stars_change,
        tier_before, division_before, tier_after, division_after,
        is_promotion, is_demotion, is_promotion_match, protection_used)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, season.season_number, gameMode, score,
        oldTotalScore, newTotalScore, scoreChange,
        oldTierInfo.tier, oldTierInfo.division,
        newTierInfo.tier, newTierInfo.division,
        isPromotion, false, false, false
      ]
    )

    await conn.query('COMMIT')

    res.json({
      scoreChange,
      oldTier: oldTierInfo.name,
      newTier: newTierInfo.name,
      oldTotalScore,
      newTotalScore,
      isPromotion,
      tierName: newTierInfo.name,
      tierIcon: newTierInfo.icon,
      tierColor: newTierInfo.color,
      tierKey: newTierInfo.tier,
      division: newTierInfo.division,
    })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('\u66F4\u65B0\u6392\u4F4D\u5931\u8D25:', e)
    res.status(500).json({ message: '\u66F4\u65B0\u5931\u8D25' })
  } finally {
    conn.release()
  }
})

// ========== 赛季管理（管理员） ==========

// ---------- GET /season：获取赛季信息 ----------
router.get('/season', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM game_seasons ORDER BY id DESC LIMIT 1')
    const season = rows[0] || null

    // 获取赛季天数设置
    const { rows: daysRows } = await pool.query(
      "SELECT value FROM site_settings WHERE `key` = 'game_season_duration_days'"
    )
    const avgDays = parseInt(daysRows[0]?.value) || 30

    // 获取王者限制
    const kingLimit = await getKingLimit()

    res.json({ season, seasonDurationDays: avgDays, kingLimit })
  } catch (e) {
    console.error('\u83B7\u53D6\u8D5B\u5B63\u4FE1\u606F\u5931\u8D25:', e)
    res.status(500).json({ message: '\u83B7\u53D6\u5931\u8D25' })
  }
})

// ---------- PUT /season：更新赛季设置 ----------
router.put('/season', authMiddleware, adminMiddleware, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const { seasonDurationDays, kingLimit } = req.body
    await conn.query('BEGIN')

    if (seasonDurationDays) {
      await conn.query(
        "INSERT INTO site_settings (`key`, value) VALUES ('game_season_duration_days', ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP",
        [String(seasonDurationDays)]
      )
    }
    if (kingLimit !== undefined) {
      await conn.query(
        "INSERT INTO site_settings (`key`, value) VALUES ('game_king_limit', ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP",
        [String(kingLimit)]
      )
    }

    // 更新当前赛季结束日期
    const { rows: seasonRows } = await conn.query(
      'SELECT * FROM game_seasons WHERE is_active = TRUE ORDER BY id DESC LIMIT 1'
    )
    if (seasonRows[0] && seasonDurationDays) {
      const newEnd = new Date(seasonRows[0].start_date)
      newEnd.setDate(newEnd.getDate() + parseInt(seasonDurationDays))
      await conn.query(
        'UPDATE game_seasons SET end_date = ? WHERE id = ?',
        [newEnd.toISOString().slice(0, 10), seasonRows[0].id]
      )
    }

    await conn.query('COMMIT')
    res.json({ message: '\u8D5B\u5B63\u8BBE\u7F6E\u5DF2\u66F4\u65B0' })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('\u66F4\u65B0\u8D5B\u5B63\u8BBE\u7F6E\u5931\u8D25:', e)
    res.status(500).json({ message: '\u66F4\u65B0\u5931\u8D25' })
  } finally {
    conn.release()
  }
})

// ---------- POST /season/reset：重置赛季 ----------
router.post('/season/reset', authMiddleware, adminMiddleware, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.query('BEGIN')

    // 结束当前赛季
    const { rows: oldSeasonRows } = await conn.query(
      'SELECT * FROM game_seasons WHERE is_active = TRUE ORDER BY id DESC LIMIT 1'
    )
    const oldSeason = oldSeasonRows[0]
    if (oldSeason) {
      await conn.query('UPDATE game_seasons SET is_active = FALSE WHERE id = ?', [oldSeason.id])
    }

    const oldNum = oldSeason?.season_number || 0
    const newNum = oldNum + 1
    const { rows: daysRows } = await pool.query(
      "SELECT value FROM site_settings WHERE `key` = 'game_season_duration_days'"
    )
    const days = parseInt(daysRows[0]?.value) || 30

    await conn.query(
      `INSERT INTO game_seasons (season_number, season_name, start_date, end_date, is_active)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), TRUE)`,
      [newNum, `\u8D5B\u5B63${newNum}`, days]
    )

    // 软重置所有玩家排位：总分折半，重置统计数据
    await conn.query(`
      UPDATE game_ranks SET
        season = ?,
        total_score = FLOOR(total_score * 0.5),
        protection_cards = 0,
        promotion_wins = 0,
        promotion_needed = 0,
        in_promotion = FALSE,
        games_played = 0,
        games_won = 0,
        win_streak = 0
    `, [newNum])

    // 根据新的 total_score 重新计算 tier 和 division（从高到低更新，确保最高匹配段位生效）
    for (let i = TIER_THRESHOLDS.length - 1; i >= 0; i--) {
      const t = TIER_THRESHOLDS[i]
      await conn.query(
        'UPDATE game_ranks SET tier = ?, division = ? WHERE total_score >= ? AND season = ?',
        [t.tier, t.division, t.min, newNum]
      )
    }

    await conn.query('COMMIT')
    res.json({ message: `\u8D5B\u5B63${newNum}\u5DF2\u5F00\u59CB\uFF01\u6240\u6709\u73A9\u5BB6\u6392\u4F4D\u5DF2\u8F6F\u91CD\u7F6E` })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('\u8D5B\u5B63\u91CD\u7F6E\u5931\u8D25:', e)
    res.status(500).json({ message: '\u91CD\u7F6E\u5931\u8D25' })
  } finally {
    conn.release()
  }
})

export default router