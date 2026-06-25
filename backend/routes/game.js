import { Router } from 'express'
import pool from '../db.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.js'

const router = Router()

// ========== 排行榜 ==========

// 提交分数（需登录）— 每人每模式只保留最高分
router.post('/scores', authMiddleware, async (req, res) => {
  try {
    const { score, mode } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'
    const userRole = req.user.role || 'student'
    const gameMode = mode || 'classic'

    if (!score || score < 0) {
      return res.status(400).json({ message: '无效的分数' })
    }

    // INSERT ... ON DUPLICATE KEY UPDATE: 仅当新分数更高时才更新
    await pool.query(
      `INSERT INTO game_scores (user_id, user_name, user_role, score, mode)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         score = IF(VALUES(score) > score, VALUES(score), score),
         user_name = VALUES(user_name),
         user_role = VALUES(user_role),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, userName, userRole, score, gameMode]
    )

    // 返回该用户各模式最高分
    const { rows: bestRows } = await pool.query(
      `SELECT mode, MAX(score) as best_score FROM game_scores
       WHERE user_id = ? GROUP BY mode`,
      [userId]
    )

    res.json({
      message: '分数已提交',
      bestScores: bestRows
    })
  } catch (e) {
    console.error('提交分数失败:', e)
    res.status(500).json({ message: '提交失败' })
  }
})

// 获取排行榜（公开）
// 提交分数 + 排位更新（一站式）
router.post('/submit', authMiddleware, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    const { score, mode } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'
    const userRole = req.user.role || 'student'
    const gameMode = mode || 'classic'

    if (!score || score < 0) {
      return res.status(400).json({ message: '无效的分数' })
    }

    await conn.query('BEGIN')

    // 1. 保存分数
    await conn.query(
      `INSERT INTO game_scores (user_id, user_name, user_role, score, mode)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         score = IF(VALUES(score) > score, VALUES(score), score),
         user_name = VALUES(user_name),
         user_role = VALUES(user_role),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, userName, userRole, score, gameMode]
    )

    await conn.query('COMMIT')

    const { rows: bestRows } = await pool.query(
      `SELECT mode, MAX(score) as best_score FROM game_scores
       WHERE user_id = ? GROUP BY mode`,
      [userId]
    )

    res.json({
      message: '分数已提交',
      bestScores: bestRows,
    })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('提交失败:', e)
    res.status(500).json({ message: '提交失败' })
  } finally {
    conn.release()
  }
})

/** 段位阈值配置 */
const TIER_THRESHOLDS = [
  { tier: 'black_iron', division: 3, name: '黑铁 III', icon: '🪨', color: '#4A4A4A', min: 0 },
  { tier: 'black_iron', division: 2, name: '黑铁 II', icon: '🪨', color: '#4A4A4A', min: 2000 },
  { tier: 'black_iron', division: 1, name: '黑铁 I', icon: '🪨', color: '#4A4A4A', min: 5000 },
  { tier: 'bronze', division: 3, name: '青铜 III', icon: '🔶', color: '#CD7F32', min: 10000 },
  { tier: 'bronze', division: 2, name: '青铜 II', icon: '🔶', color: '#CD7F32', min: 20000 },
  { tier: 'bronze', division: 1, name: '青铜 I', icon: '🔶', color: '#CD7F32', min: 35000 },
  { tier: 'silver', division: 3, name: '白银 III', icon: '⚪', color: '#C0C0C0', min: 55000 },
  { tier: 'silver', division: 2, name: '白银 II', icon: '⚪', color: '#C0C0C0', min: 80000 },
  { tier: 'silver', division: 1, name: '白银 I', icon: '⚪', color: '#C0C0C0', min: 115000 },
  { tier: 'gold', division: 3, name: '黄金 III', icon: '🟡', color: '#FFD700', min: 160000 },
  { tier: 'gold', division: 2, name: '黄金 II', icon: '🟡', color: '#FFD700', min: 215000 },
  { tier: 'gold', division: 1, name: '黄金 I', icon: '🟡', color: '#FFD700', min: 285000 },
  { tier: 'platinum', division: 3, name: '铂金 III', icon: '💎', color: '#4ECDC4', min: 370000 },
  { tier: 'platinum', division: 2, name: '铂金 II', icon: '💎', color: '#4ECDC4', min: 470000 },
  { tier: 'platinum', division: 1, name: '铂金 I', icon: '💎', color: '#4ECDC4', min: 590000 },
  { tier: 'diamond', division: 3, name: '钻石 III', icon: '💠', color: '#9B59B6', min: 730000 },
  { tier: 'diamond', division: 2, name: '钻石 II', icon: '💠', color: '#9B59B6', min: 900000 },
  { tier: 'diamond', division: 1, name: '钻石 I', icon: '💠', color: '#9B59B6', min: 1100000 },
  { tier: 'king', division: 0, name: '王者', icon: '👑', color: '#E74C3C', min: 1350000 },
]

/** AI 难度配置（按段位，分数范围） */
const AI_DIFFICULTY = {
  'black_iron_3': { min: 500, max: 2500 },
  'black_iron_2': { min: 1500, max: 4000 },
  'black_iron_1': { min: 3000, max: 6000 },
  'bronze_3': { min: 5000, max: 9000 },
  'bronze_2': { min: 7000, max: 12000 },
  'bronze_1': { min: 9000, max: 15000 },
}

/** 根据总分获取段位 */
function getTierByScore(totalScore) {
  let result = TIER_THRESHOLDS[0]
  for (const t of TIER_THRESHOLDS) {
    if (totalScore >= t.min) result = t
  }
  return result
}

/** 获取下一段位阈值 */
function getNextTierThreshold(totalScore) {
  for (let i = 0; i < TIER_THRESHOLDS.length; i++) {
    if (totalScore < TIER_THRESHOLDS[i].min) {
      return { next: TIER_THRESHOLDS[i], current: TIER_THRESHOLDS[i === 0 ? 0 : i - 1] }
    }
  }
  return { next: null, current: TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1] }
}

// ========== 排位赛匹配 ==========

/** 获取活跃赛季 */
async function getActiveSeason(conn) {
  const { rows } = await conn.query('SELECT * FROM game_seasons WHERE is_active = TRUE ORDER BY id DESC LIMIT 1')
  return rows?.[0] || null
}

/** 获取或创建排位记录 */
async function getOrCreateRank(conn, userId, userName, userRole, seasonNum) {
  const { rows } = await conn.query('SELECT * FROM game_ranks WHERE user_id = ? AND season = ?', [userId, seasonNum])
  if (rows.length > 0) return rows[0]
  await conn.query(
    "INSERT INTO game_ranks (user_id, user_name, user_role, season, tier, division, total_score) VALUES (?, ?, ?, ?, 'black_iron', 3, 0)",
    [userId, userName, userRole, seasonNum])
  const { rows: newRows } = await conn.query('SELECT * FROM game_ranks WHERE user_id = ? AND season = ?', [userId, seasonNum])
  return newRows[0]
}

/** 获取对手信息 */
router.get('/ranked/opponent', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'
    const userRole = req.user.role || 'student'

    const season = await getActiveSeason(pool)
    if (!season) return res.status(400).json({ message: '暂无活跃赛季' })

    const rank = await getOrCreateRank(pool, userId, userName, userRole, season.season_number)
    const currentTier = getTierByScore(rank.total_score)
    const tierKey = `${currentTier.tier}_${currentTier.division}`

    // 获取限时模式时长
    const { rows: durRows } = await pool.query("SELECT value FROM site_settings WHERE `key` = 'game_timed_duration'")
    const timeLimit = parseInt(durRows[0]?.value) || 180

    // 青铜 I 及以下：匹配 AI
    const isAI = (
      currentTier.tier === 'black_iron' ||
      (currentTier.tier === 'bronze' && currentTier.division >= 2)
    )

    if (isAI) {
      const aiCfg = AI_DIFFICULTY[tierKey] || AI_DIFFICULTY['bronze_1']
      const aiScore = Math.floor(Math.random() * (aiCfg.max - aiCfg.min + 1)) + aiCfg.min
      return res.json({
        opponent_type: 'ai',
        opponent_name: `人机 (${currentTier.name})`,
        opponent_score: aiScore,
        opponent_tier: currentTier.name,
        opponent_tier_icon: currentTier.icon,
        time_limit: timeLimit,
      })
    }

    // 青铜 II 及以上：匹配真人镜像
    const { rows: ghosts } = await pool.query(
      `SELECT gs.user_id, gs.user_name, gs.score, gr.tier, gr.division
       FROM game_scores gs
       JOIN game_ranks gr ON gs.user_id = gr.user_id AND gr.season = ?
       WHERE gs.mode = 'timed'
         AND gs.user_id != ?
         AND gr.tier = ?
         AND gr.division = ?
       ORDER BY gs.score DESC
       LIMIT 20`,
      [season.season_number, userId, currentTier.tier, currentTier.division]
    )

    if (ghosts.length === 0) {
      // 同大段降级匹配
      const { rows: ghosts2 } = await pool.query(
        `SELECT gs.user_id, gs.user_name, gs.score, gr.tier, gr.division
         FROM game_scores gs
         JOIN game_ranks gr ON gs.user_id = gr.user_id AND gr.season = ?
         WHERE gs.mode = 'timed'
           AND gs.user_id != ?
           AND gr.tier = ?
         ORDER BY gs.score DESC
         LIMIT 20`,
        [season.season_number, userId, currentTier.tier]
      )

      if (ghosts2.length === 0) {
        // 无镜像数据，降级为 AI
        const aiCfg = AI_DIFFICULTY['bronze_1']
        const aiScore = Math.floor(Math.random() * (aiCfg.max - aiCfg.min + 1)) + aiCfg.min
        return res.json({
          opponent_type: 'ai',
          opponent_name: `人机 (${currentTier.name})`,
          opponent_score: aiScore,
          opponent_tier: currentTier.name,
          opponent_tier_icon: currentTier.icon,
          time_limit: timeLimit,
        })
      }

      const pick = ghosts2[Math.floor(Math.random() * ghosts2.length)]
      const ghostTier = getTierByScore(pick.score * 10) // 估算段位
      return res.json({
        opponent_type: 'ghost',
        opponent_name: pick.user_name || '神秘对手',
        opponent_score: pick.score,
        opponent_tier: ghostTier.name,
        opponent_tier_icon: ghostTier.icon,
        time_limit: timeLimit,
      })
    }

    const pick = ghosts[Math.floor(Math.random() * ghosts.length)]
    const ghostTier = getTierByScore(pick.score * 10)
    return res.json({
      opponent_type: 'ghost',
      opponent_name: pick.user_name || '神秘对手',
      opponent_score: pick.score,
      opponent_tier: ghostTier.name,
      opponent_tier_icon: ghostTier.icon,
      time_limit: timeLimit,
    })
  } catch (e) {
    console.error('匹配对手失败:', e)
    res.status(500).json({ message: '匹配失败' })
  }
})

/** 提交排位赛结果 */
router.post('/ranked/submit', authMiddleware, async (req, res) => {
  const conn = await pool.connect()
  try {
    const { score, opponent_type, opponent_score, opponent_name } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'
    const userRole = req.user.role || 'student'

    if (!score || score < 0) {
      return res.status(400).json({ message: '无效的分数' })
    }

    const season = await getActiveSeason(conn)
    if (!season) return res.status(400).json({ message: '暂无活跃赛季' })

    await conn.query('BEGIN')

    const rank = await getOrCreateRank(conn, userId, userName, userRole, season.season_number)
    const oldTier = getTierByScore(rank.total_score)
    const oldTotalScore = rank.total_score

    // 判定胜负
    const won = score > (opponent_score || 0)
    // 失败安慰分：本局得分的 10%，上限 500
    const scoreGain = won ? score : Math.min(Math.round(score * 0.1), 500)

    // 连胜奖励（胜利时连胜+1，失败时连胜重置）
    let streakBonus = 0
    let newStreak = won ? rank.ranked_streak + 1 : 0
    if (won && newStreak >= 2) {
      streakBonus = newStreak * 500
    }

    const newTotalScore = oldTotalScore + scoreGain + streakBonus
    const newTier = getTierByScore(newTotalScore)
    const isPromotion = newTier.tier !== oldTier.tier || newTier.division !== oldTier.division

    // 王者限制
    if (newTier.tier === 'king' && oldTier.tier !== 'king') {
      const { rows: kc } = await conn.query("SELECT value FROM site_settings WHERE `key` = 'game_king_limit'")
      const kingLimit = parseInt(kc[0]?.value) || 10
      const { rows: cnt } = await conn.query("SELECT COUNT(*) as c FROM game_ranks WHERE season = ? AND tier = 'king'", [season.season_number])
      if (cnt[0].c >= kingLimit) {
        const { rows: last } = await conn.query("SELECT user_id FROM game_ranks WHERE season = ? AND tier = 'king' ORDER BY total_score ASC LIMIT 1", [season.season_number])
        if (last[0]) {
          const diamondMin = TIER_THRESHOLDS.find(t => t.tier === 'diamond' && t.division === 1).min
          await conn.query("UPDATE game_ranks SET tier='diamond', division=1, total_score=? WHERE user_id=? AND season=?",
            [diamondMin, last[0].user_id, season.season_number])
        }
      }
    }

    // 更新排位记录
    await conn.query(
      `UPDATE game_ranks SET
        tier = ?, division = ?, total_score = ?,
        ranked_wins = ranked_wins + ?, ranked_losses = ranked_losses + ?,
        ranked_streak = ?, games_played = games_played + 1,
        games_won = games_won + ?,
        user_name = ?, user_role = ?
       WHERE user_id = ? AND season = ?`,
      [newTier.tier, newTier.division, newTotalScore,
       won ? 1 : 0, won ? 0 : 1,
       newStreak, won ? 1 : 0,
       userName, userRole, userId, season.season_number]
    )

    // 插入历史
    await conn.query(
      `INSERT INTO game_rank_history
       (user_id, season, game_mode, score, stars_before, stars_after, stars_change,
        tier_before, division_before, tier_after, division_after,
        is_promotion, is_demotion, opponent_type, opponent_score, opponent_name, won)
       VALUES (?, ?, 'ranked', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, season.season_number, score, oldTotalScore, newTotalScore, scoreGain + streakBonus,
       oldTier.tier, oldTier.division, newTier.tier, newTier.division,
       isPromotion, false, opponent_type || 'ai', opponent_score || 0, opponent_name || '', won]
    )

    await conn.query('COMMIT')

    // 进度信息
    const { next, current: curThreshold } = getNextTierThreshold(newTotalScore)
    const progress = next
      ? Math.round(((newTotalScore - curThreshold.min) / (next.min - curThreshold.min)) * 100)
      : 100

    res.json({
      won,
      score: scoreGain,
      streakBonus,
      oldTotalScore,
      newTotalScore,
      isPromotion,
      oldTier: oldTier.name,
      oldTierIcon: oldTier.icon,
      newTier: newTier.name,
      newTierIcon: newTier.icon,
      newTierColor: newTier.color,
      newTierKey: newTier.tier,
      newDivision: newTier.division,
      nextTier: next ? next.name : null,
      nextTierMin: next ? next.min : null,
      progress,
      rankedStreak: newStreak,
      rankedWins: rank.ranked_wins + (won ? 1 : 0),
      rankedLosses: rank.ranked_losses + (won ? 0 : 1),
    })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('排位提交失败:', e)
    res.status(500).json({ message: '提交失败' })
  } finally {
    conn.release()
  }
})

router.get('/leaderboard', async (req, res) => {
  try {
    const { mode, limit = 20 } = req.query
    let whereClause = ''
    const params = []

    if (mode && mode !== 'all' && mode !== 'ranked') {
      whereClause = 'WHERE gs.mode = ?'
      params.push(mode)
    }

    // 每人只展示最高分，按 user_id 分组
    const sql = `
      SELECT gs.user_id, gs.user_role,
             COALESCE(s.name, a.display_name, gs.user_name, '玩家') AS user_name,
             MAX(gs.score) as score
      FROM game_scores gs
      LEFT JOIN students s ON gs.user_role = 'student' AND CAST(gs.user_id AS CHAR) = CAST(s.id AS CHAR)
      LEFT JOIN admins a ON gs.user_role = 'admin' AND CAST(gs.user_id AS CHAR) = CAST(a.id AS CHAR)
      ${whereClause}
      GROUP BY gs.user_id, gs.user_role, COALESCE(s.name, a.display_name, gs.user_name)
      ORDER BY score DESC
      LIMIT ?
    `
    params.push(parseInt(limit) || 20)

    const result = await pool.query(sql, params)
    const rows = result.rows || []
    // 添加排名
    res.json(rows.map((r, i) => ({ ...r, position: i + 1 })))
  } catch (e) {
    console.error('获取排行榜失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 获取个人最高分（需登录）
router.get('/my-best', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const result = await pool.query(
      `SELECT mode, MAX(score) as best_score FROM game_scores
       WHERE user_id = ? GROUP BY mode`,
      [userId]
    )
    const best = {}
    for (const row of result.rows) {
      best[row.mode] = row.best_score
    }
    res.json(best)
  } catch (e) {
    console.error('获取个人最高分失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// ========== 游戏参数设置 ==========

// 获取游戏参数（公开）
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT `key`, value FROM site_settings WHERE `key` LIKE 'game_%'"
    )
    const settings = {}
    for (const row of result.rows) {
      settings[row.key] = row.value
    }

    res.json({
      // 物理参数
      gravity: parseFloat(settings['game_gravity']) || 1.2,
      restitution: parseFloat(settings['game_restitution']) || 0.4,
      friction: parseFloat(settings['game_friction']) || 0.05,
      frictionAir: parseFloat(settings['game_friction_air']) || 0.01,
      launchSpeed: parseFloat(settings['game_launch_speed']) || 12,

      // 游戏规则
      swapCount: parseInt(settings['game_swap_count']) || 3,
      dangerLineY: parseInt(settings['game_danger_line_y']) || 80,
      dangerTimeout: parseFloat(settings['game_danger_timeout']) || 1.5,
      gravityFlipDuration: parseInt(settings['game_gravity_flip_duration']) || 5,
      timeStopDuration: parseInt(settings['game_time_stop_duration']) || 8,

      // 得分倍率
      scoreMultiplier: parseFloat(settings['game_score_multiplier']) || 1.0,

      // 副本模式
      dungeonSpeedMult: parseFloat(settings['game_dungeon_speed_mult']) || 1.0,
      dungeonHpMult: parseFloat(settings['game_dungeon_hp_mult']) || 1.0,
      dungeonGoldMult: parseFloat(settings['game_dungeon_gold_mult']) || 1.0,
      dungeonClearGold: parseInt(settings['game_dungeon_clear_gold']) || 500,
      dungeonMaxWave: parseInt(settings['game_dungeon_max_wave']) || 15,

      // 双彩虹融合
      fusionRadius: parseInt(settings['game_fusion_radius']) || 250,
      fusionBaseScore: parseInt(settings['game_fusion_base_score']) || 5000,
      fusionBonusPerBubble: parseInt(settings['game_fusion_bonus_per_bubble']) || 300,
      fusionBaseDamage: parseInt(settings['game_fusion_base_damage']) || 8000,
      fusionSlowMo: parseFloat(settings['game_fusion_slow_mo']) || 0.6,
    })
  } catch (e) {
    console.error('获取游戏参数失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 更新游戏参数（仅管理员）
router.put('/settings', authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect()
  try {
    const settings = req.body
    await client.query('BEGIN')

    const upsertSetting = async (key, value) => {
      await client.query(
        `INSERT INTO site_settings (\`key\`, value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = CURRENT_TIMESTAMP`,
        [key, String(value)]
      )
    }

    const keys = {
      gravity: 'game_gravity',
      restitution: 'game_restitution',
      friction: 'game_friction',
      frictionAir: 'game_friction_air',
      launchSpeed: 'game_launch_speed',
      swapCount: 'game_swap_count',
      dangerLineY: 'game_danger_line_y',
      dangerTimeout: 'game_danger_timeout',
      gravityFlipDuration: 'game_gravity_flip_duration',
      timeStopDuration: 'game_time_stop_duration',
      scoreMultiplier: 'game_score_multiplier',
      // 副本模式
      dungeonSpeedMult: 'game_dungeon_speed_mult',
      dungeonHpMult: 'game_dungeon_hp_mult',
      dungeonGoldMult: 'game_dungeon_gold_mult',
      dungeonClearGold: 'game_dungeon_clear_gold',
      dungeonMaxWave: 'game_dungeon_max_wave',
      // 双彩虹融合
      fusionRadius: 'game_fusion_radius',
      fusionBaseScore: 'game_fusion_base_score',
      fusionBonusPerBubble: 'game_fusion_bonus_per_bubble',
      fusionBaseDamage: 'game_fusion_base_damage',
      fusionSlowMo: 'game_fusion_slow_mo',
    }

    for (const [field, dbKey] of Object.entries(keys)) {
      if (settings[field] !== undefined) {
        await upsertSetting(dbKey, settings[field])
      }
    }

    await client.query('COMMIT')
    res.json({ message: '游戏参数更新成功' })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('更新游戏参数失败:', e)
    res.status(500).json({ message: '更新失败' })
  } finally {
    client.release()
  }
})

// ========== 道具/金币 API ==========

// 获取商店道具列表
router.get('/items', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM game_items WHERE is_active = TRUE ORDER BY price ASC'
    )
    res.json(rows)
  } catch (e) {
    console.error('获取道具列表失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 获取用户金币余额
router.get('/coins', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { rows } = await pool.query(
      'SELECT gold_amount FROM game_user_gold WHERE user_id = ?',
      [userId]
    )
    res.json({ gold: rows[0]?.gold_amount || 0 })
  } catch (e) {
    console.error('获取金币失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 获取用户背包道具
router.get('/my-items', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id
    const { rows } = await pool.query(
      'SELECT item_id, item_count FROM game_user_items WHERE user_id = ? AND item_count > 0',
      [userId]
    )
    // 返回 {itemId: count} 格式
    const result = {}
    for (const row of rows) {
      result[row.item_id] = row.item_count
    }
    res.json(result)
  } catch (e) {
    console.error('获取背包失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 同步客户端数据到服务端（首次使用时同步）
router.post('/sync', authMiddleware, async (req, res) => {
  const conn = await pool.connect()
  try {
    const { gold, items } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'

    await conn.query('BEGIN')

    // 同步金币：如果服务器已有且更大，保留服务器数据；否则用客户端
    const { rows: goldRows } = await conn.query(
      'SELECT gold_amount FROM game_user_gold WHERE user_id = ? FOR UPDATE',
      [userId]
    )
    const serverGold = goldRows[0]?.gold_amount || 0
    const finalGold = Math.max(serverGold, gold || 0)
    if (goldRows.length === 0) {
      await conn.query(
        'INSERT INTO game_user_gold (user_id, user_name, gold_amount) VALUES (?, ?, ?)',
        [userId, userName, finalGold]
      )
    } else {
      await conn.query(
        'UPDATE game_user_gold SET gold_amount = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [finalGold, userName, userId]
      )
    }

    // 同步道具：合并数量
    for (const [itemId, count] of Object.entries(items || {})) {
      const { rows: itemRows } = await conn.query(
        'SELECT item_count FROM game_user_items WHERE user_id = ? AND item_id = ? FOR UPDATE',
        [userId, itemId]
      )
      const serverCount = itemRows[0]?.item_count || 0
      const finalCount = serverCount + count
      if (itemRows.length === 0) {
        await conn.query(
          'INSERT INTO game_user_items (user_id, user_name, item_id, item_count) VALUES (?, ?, ?, ?)',
          [userId, userName, itemId, finalCount]
        )
      } else {
        await conn.query(
          'UPDATE game_user_items SET item_count = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND item_id = ?',
          [finalCount, userName, userId, itemId]
        )
      }
    }

    await conn.query('COMMIT')

    // 返回最终数据
    const { rows: finalGoldRows } = await pool.query(
      'SELECT gold_amount FROM game_user_gold WHERE user_id = ?',
      [userId]
    )
    const { rows: finalItemsRows } = await pool.query(
      'SELECT item_id, item_count FROM game_user_items WHERE user_id = ? AND item_count > 0',
      [userId]
    )
    const finalItems = {}
    for (const row of finalItemsRows) {
      finalItems[row.item_id] = row.item_count
    }

    res.json({
      message: '同步成功',
      gold: finalGoldRows[0]?.gold_amount || 0,
      items: finalItems,
    })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('同步失败:', e)
    res.status(500).json({ message: '同步失败' })
  } finally {
    conn.release()
  }
})

// 购买道具
router.post('/purchase', authMiddleware, async (req, res) => {
  const conn = await pool.connect()
  try {
    const { itemId, price } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'

    if (!itemId || !price) {
      return res.status(400).json({ message: '参数错误' })
    }

    await conn.query('BEGIN')

    // 检查用户金币
    const { rows: goldRows } = await conn.query(
      'SELECT gold_amount FROM game_user_gold WHERE user_id = ? FOR UPDATE',
      [userId]
    )
    const currentGold = goldRows[0]?.gold_amount || 0
    if (currentGold < price) {
      await conn.query('ROLLBACK')
      return res.status(400).json({ message: '金币不足' })
    }

    // 扣减金币
    const newGold = currentGold - price
    if (goldRows.length === 0) {
      await conn.query(
        'INSERT INTO game_user_gold (user_id, user_name, gold_amount) VALUES (?, ?, ?)',
        [userId, userName, newGold]
      )
    } else {
      await conn.query(
        'UPDATE game_user_gold SET gold_amount = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [newGold, userName, userId]
      )
    }

    // 添加道具到背包
    const { rows: itemRows } = await conn.query(
      'SELECT item_count FROM game_user_items WHERE user_id = ? AND item_id = ?',
      [userId, itemId]
    )
    const currentCount = itemRows[0]?.item_count || 0
    if (itemRows.length === 0) {
      await conn.query(
        'INSERT INTO game_user_items (user_id, user_name, item_id, item_count) VALUES (?, ?, ?, ?)',
        [userId, userName, itemId, 1]
      )
    } else {
      await conn.query(
        'UPDATE game_user_items SET item_count = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND item_id = ?',
        [currentCount + 1, userName, userId, itemId]
      )
    }

    await conn.query('COMMIT')

    res.json({
      message: '购买成功',
      gold: newGold,
      itemId,
      count: currentCount + 1,
    })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('购买道具失败:', e)
    res.status(500).json({ message: '购买失败' })
  } finally {
    conn.release()
  }
})

// 使用道具（减少数量）
router.post('/use-item', authMiddleware, async (req, res) => {
  const conn = await pool.connect()
  try {
    const { itemId } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'

    if (!itemId) {
      return res.status(400).json({ message: '请选择道具' })
    }

    await conn.query('BEGIN')

    // 获取当前数量
    const { rows: itemRows } = await conn.query(
      'SELECT item_count FROM game_user_items WHERE user_id = ? AND item_id = ? FOR UPDATE',
      [userId, itemId]
    )
    const currentCount = itemRows[0]?.item_count || 0
    if (currentCount <= 0) {
      await conn.query('ROLLBACK')
      return res.status(400).json({ message: '道具数量不足' })
    }

    // 减少数量
    const newCount = currentCount - 1
    await conn.query(
      'UPDATE game_user_items SET item_count = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND item_id = ?',
      [newCount, userName, userId, itemId]
    )

    await conn.query('COMMIT')

    res.json({
      message: '使用成功',
      itemId,
      count: newCount,
    })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('使用道具失败:', e)
    res.status(500).json({ message: '使用失败' })
  } finally {
    conn.release()
  }
})

// 添加金币（来自副本奖励）
router.post('/add-gold', authMiddleware, async (req, res) => {
  const conn = await pool.connect()
  try {
    const { amount, reason } = req.body
    const userId = req.user.id
    const userName = req.user.display_name || req.user.name || req.user.username || '玩家'

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: '无效的金币数量' })
    }

    await conn.query('BEGIN')

    // 更新金币
    const { rows: goldRows } = await conn.query(
      'SELECT gold_amount FROM game_user_gold WHERE user_id = ? FOR UPDATE',
      [userId]
    )
    const currentGold = goldRows[0]?.gold_amount || 0
    const newGold = currentGold + amount

    if (goldRows.length === 0) {
      await conn.query(
        'INSERT INTO game_user_gold (user_id, user_name, gold_amount) VALUES (?, ?, ?)',
        [userId, userName, newGold]
      )
    } else {
      await conn.query(
        'UPDATE game_user_gold SET gold_amount = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [newGold, userName, userId]
      )
    }

    // 记录发放
    await conn.query(
      'INSERT INTO game_item_distribution (target_user_id, target_user_name, item_id, item_count, gold_added, reason, distributed_by, distributed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, userName, '', 0, amount, reason || '副本奖励', userId, userName]
    )

    await conn.query('COMMIT')

    res.json({
      message: '金币添加成功',
      gold: newGold,
    })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('添加金币失败:', e)
    res.status(500).json({ message: '添加失败' })
  } finally {
    conn.release()
  }
})

// 管理员发放道具/金币
router.post('/admin/distribute', authMiddleware, adminMiddleware, async (req, res) => {
  const conn = await pool.connect()
  try {
    const { targetUserId, targetUserName, itemId, itemCount, goldAdd, reason } = req.body
    const adminId = req.user.id
    const adminName = req.user.display_name || req.user.name || req.user.username || '管理员'

    // 确保数值类型正确
    const goldAmount = Number(goldAdd) || 0
    const itemIdFinal = itemId || null
    const itemCountNum = Number(itemCount) || 0

    // 至少需要发放金币或道具之一
    if (goldAmount <= 0 && !itemIdFinal) {
      return res.status(400).json({ message: '请至少输入发放金币数量或选择发放道具' })
    }

    await conn.query('BEGIN')

    // 发放金币
    if (goldAmount > 0) {
      const { rows: goldRows } = await conn.query(
        'SELECT gold_amount FROM game_user_gold WHERE user_id = ? FOR UPDATE',
        [targetUserId]
      )
      const currentGold = goldRows[0]?.gold_amount || 0
      const newGold = currentGold + goldAmount

      if (goldRows.length === 0) {
        await conn.query(
          'INSERT INTO game_user_gold (user_id, user_name, gold_amount) VALUES (?, ?, ?)',
          [targetUserId, targetUserName, newGold]
        )
      } else {
        await conn.query(
          'UPDATE game_user_gold SET gold_amount = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
          [newGold, targetUserName, targetUserId]
        )
      }
    }

    // 发放道具
    if (itemIdFinal && itemCountNum > 0) {
      const { rows: itemRows } = await conn.query(
        'SELECT item_count FROM game_user_items WHERE user_id = ? AND item_id = ?',
        [targetUserId, itemIdFinal]
      )
      const currentCount = itemRows[0]?.item_count || 0
      const newCount = currentCount + itemCountNum

      if (itemRows.length === 0) {
        await conn.query(
          'INSERT INTO game_user_items (user_id, user_name, item_id, item_count) VALUES (?, ?, ?, ?)',
          [targetUserId, targetUserName, itemIdFinal, newCount]
        )
      } else {
        await conn.query(
          'UPDATE game_user_items SET item_count = ?, user_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND item_id = ?',
          [newCount, targetUserName, targetUserId, itemIdFinal]
        )
      }
    }

    // 记录发放
    await conn.query(
      'INSERT INTO game_item_distribution (target_user_id, target_user_name, item_id, item_count, gold_added, reason, distributed_by, distributed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [targetUserId, targetUserName, itemIdFinal, itemCountNum, goldAmount, reason || '管理员发放', adminId, adminName]
    )

    await conn.query('COMMIT')

    res.json({ message: '发放成功' })
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => {})
    console.error('发放失败:', e)
    res.status(500).json({ message: e.message })
  } finally {
    conn.release()
  }
})

// ========== 游戏通告 API ==========

// 获取活跃通告（前端拉取，无需登录）
router.get('/announcements/active', async (req, res) => {
  try {
    const now = new Date()
    const { rows } = await pool.query(
      `SELECT id, title, content, ann_type, created_at FROM game_announcements
       WHERE is_active = TRUE AND show_in_game = TRUE
         AND (start_time IS NULL OR start_time <= ?)
         AND (end_time IS NULL OR end_time >= ?)
       ORDER BY created_at DESC LIMIT 5`,
      [now, now]
    )
    res.json(rows)
  } catch (e) {
    console.error('获取通告失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 获取所有通告（管理端）
router.get('/announcements', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM game_announcements ORDER BY created_at DESC LIMIT 50'
    )
    res.json(rows)
  } catch (e) {
    console.error('获取通告列表失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

// 创建通告
router.post('/announcements', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { title, content, ann_type, show_in_game, start_time, end_time } = req.body
    const adminId = req.user.id
    const adminName = req.user.display_name || req.user.name || req.user.username || '管理员'

    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容不能为空' })
    }

    const { insertId } = await pool.query(
      `INSERT INTO game_announcements (title, content, ann_type, show_in_game, start_time, end_time, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, content, ann_type || 'notice', show_in_game !== false ? true : false, start_time || null, end_time || null, adminId, adminName]
    )
    res.json({ message: '通告创建成功', id: insertId })
  } catch (e) {
    console.error('创建通告失败:', e)
    res.status(500).json({ message: '创建失败' })
  }
})

// 更新通告
router.put('/announcements/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { title, content, ann_type, is_active, show_in_game, start_time, end_time } = req.body
    await pool.query(
      `UPDATE game_announcements SET
        title = COALESCE(?, title), content = COALESCE(?, content),
        ann_type = COALESCE(?, ann_type), is_active = COALESCE(?, is_active),
        show_in_game = COALESCE(?, show_in_game),
        start_time = ?, end_time = ?
       WHERE id = ?`,
      [title, content, ann_type, is_active, show_in_game, start_time || null, end_time || null, id]
    )
    res.json({ message: '通告更新成功' })
  } catch (e) {
    console.error('更新通告失败:', e)
    res.status(500).json({ message: '更新失败' })
  }
})

// 删除通告
router.delete('/announcements/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM game_announcements WHERE id = ?', [id])
    res.json({ message: '通告已删除' })
  } catch (e) {
    console.error('删除通告失败:', e)
    res.status(500).json({ message: '删除失败' })
  }
})

// ========== 用户列表（用于管理员派发道具） ==========
router.get('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search } = req.query
    const params = []
    let query = ``
    if (search) {
      query = `
        SELECT id, username, display_name, 'admin' as role FROM admins
        WHERE username LIKE ? OR display_name LIKE ?
        UNION ALL
        SELECT id, student_id as username, name as display_name, 'student' as role FROM students
        WHERE student_id LIKE ? OR name LIKE ?
        ORDER BY id ASC LIMIT 100`
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    } else {
      query = `
        SELECT id, username, display_name, 'admin' as role FROM admins
        UNION ALL
        SELECT id, student_id as username, name as display_name, 'student' as role FROM students
        ORDER BY id ASC LIMIT 100`
    }
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (e) {
    console.error('获取用户列表失败:', e)
    res.status(500).json({ message: '获取失败' })
  }
})

export default router