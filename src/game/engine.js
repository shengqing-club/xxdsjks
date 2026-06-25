/**
 * 泡泡工坊 V3 - 游戏引擎
 * 原始玩法（发射→同色同级合成→连锁反应→彩虹消除）+ 双彩虹融合 + 道具
 */
import {
  BUBBLE_COLORS, BUBBLE_LEVELS, CANVAS_WIDTH, CANVAS_HEIGHT,
  DANGER_LINE_Y, LAUNCHER_X, LAUNCHER_Y, GAME_STATES, GAME_MODES,
  CHAIN_MULTIPLIERS, DOUBLE_RAINBOW_FUSION, MILESTONES,
} from './config.js'
import PhysicsWorld from './physics.js'
import Renderer from './renderer.js'
import audio from './audio.js'
import particles from './particles.js'
import shop from './shop.js'

const PHYSICS_STEP = 1000 / 60
const MAX_PHYSICS_STEPS = 3

class GameEngine {
  constructor(canvas, settings = {}) {
    this.canvas = canvas
    this.physics = new PhysicsWorld(settings)
    this.renderer = new Renderer(canvas)
    this.state = GAME_STATES.MENU
    this.mode = GAME_MODES.CLASSIC
    this.score = 0
    this.chainCount = 0
    this.swapCount = 3
    this._settings = settings

    // 发射器
    this.currentColorIndex = 0
    this.currentLevel = 1
    this.nextColorIndex = 1
    this.nextLevel = 1
    this._launchedBubbles = []
    this._pointerX = LAUNCHER_X
    this._pointerY = CANVAS_HEIGHT / 2
    this._dangerTimer = 0
    this._dangerActive = false

    this._animFrame = null
    this._lastTime = 0
    this._accumulator = 0
    this._lastMilestoneCheck = 0
    this._slowMo = 0

    // 回调
    this.onScoreChange = null
    this.onGameOver = null
    this.onStateChange = null
    this.onRainbowFusion = null
    this.onDoubleRainbowFusion = null
    this.onItemUse = null

    // ===== 道具效果 =====
    this._itemEffects = { preciseAim: 0, timeStop: 0, freezeActive: false, damageBoost: 1 }
    this._pendingAreaClear = false
    this._pendingLightningChain = false
    // 重力翻转冷却期（结束后2秒内不检测警戒线，让泡泡有时间回落）
    this._gravityFlipGrace = 0

    this._bindInput()
  }

  _bindInput() {
    this._onPointerMove = (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const scaleX = CANVAS_WIDTH / rect.width, scaleY = CANVAS_HEIGHT / rect.height
      if (e.touches && e.touches.length > 0) {
        this._pointerX = (e.touches[0].clientX - rect.left) * scaleX
        this._pointerY = (e.touches[0].clientY - rect.top) * scaleY
      } else {
        this._pointerX = (e.clientX - rect.left) * scaleX
        this._pointerY = (e.clientY - rect.top) * scaleY
      }
    }
    this._onPointerDown = (e) => {
      e.preventDefault()
      audio.init(); audio.resume()
      if (this.state !== GAME_STATES.PLAYING) return
      if (this._pendingAreaClear || this._pendingLightningChain) return
      this._launch()
    }
    this._onContextMenu = (e) => { e.preventDefault() }
    this.canvas.addEventListener('mousemove', this._onPointerMove)
    this.canvas.addEventListener('touchmove', this._onPointerMove, { passive: true })
    this.canvas.addEventListener('mousedown', this._onPointerDown)
    this.canvas.addEventListener('touchstart', this._onPointerDown, { passive: false })
    this.canvas.addEventListener('contextmenu', this._onContextMenu)
  }
  _unbindInput() {
    this.canvas.removeEventListener('mousemove', this._onPointerMove)
    this.canvas.removeEventListener('touchmove', this._onPointerMove)
    this.canvas.removeEventListener('mousedown', this._onPointerDown)
    this.canvas.removeEventListener('touchstart', this._onPointerDown)
    this.canvas.removeEventListener('contextmenu', this._onContextMenu)
  }

  // ===== 游戏启动 =====
  start(mode) {
    this.mode = mode || GAME_MODES.CLASSIC
    this.state = GAME_STATES.PLAYING
    this.score = 0
    this.chainCount = 0
    this._lastMilestoneCheck = 0
    this._launchedBubbles = []
    this._dangerTimer = 0
    this._dangerActive = false
    this._slowMo = 0
    this._gravityFlipGrace = 0
    this._itemEffects = { preciseAim: 0, timeStop: 0, freezeActive: false, damageBoost: 1 }
    this._pendingAreaClear = false
    this._pendingLightningChain = false
    this.swapCount = this._settings?.swapCount ?? 3
    this.renderer.clearEffects()
    this.physics.clearBubbles()
    particles.clear()
    audio.resume()

    this.currentColorIndex = this._randomColor(); this.currentLevel = 1
    this.nextColorIndex = this._randomColor(); this.nextLevel = 1
    this.renderer.setBubblePreview(this.currentColorIndex, this.nextColorIndex)

    if (this.onScoreChange) this.onScoreChange(this.score)
    if (this.onStateChange) this.onStateChange(this.state)
    this.startLoop()
  }

  startLoop() {
    this.stopLoop()
    this._lastTime = performance.now(); this._accumulator = 0
    const loop = (now) => {
      if (this.state !== GAME_STATES.PLAYING) { this._animFrame = null; return }
      let frameDt = (now - this._lastTime) / 1000
      this._lastTime = now; frameDt = Math.min(frameDt, 0.1)
      if (this._slowMo > 0) { this._slowMo = Math.max(0, this._slowMo - frameDt); frameDt *= 0.3 }
      this._accumulator += frameDt * 1000
      let steps = 0
      while (this._accumulator >= PHYSICS_STEP && steps < MAX_PHYSICS_STEPS) {
        this.physics.update(PHYSICS_STEP / 1000)
        this._accumulator -= PHYSICS_STEP; steps++
      }
      if (this._accumulator > PHYSICS_STEP * MAX_PHYSICS_STEPS) this._accumulator = 0
      this._update(frameDt); this._render()
      this._animFrame = requestAnimationFrame(loop)
    }
    this._animFrame = requestAnimationFrame(loop)
  }
  stopLoop() { if (this._animFrame) { cancelAnimationFrame(this._animFrame); this._animFrame = null } }

  // ===== 每帧更新 =====
  _update(dt) {
    if (this.state !== GAME_STATES.PLAYING) return

    this.renderer.update(dt)
    if (this._itemEffects.timeStop > 0) this._itemEffects.timeStop -= dt
    if (this._itemEffects.preciseAim > 0) this._itemEffects.preciseAim = Math.max(0, this._itemEffects.preciseAim - dt)
    if (this._gravityFlipGrace > 0) this._gravityFlipGrace = Math.max(0, this._gravityFlipGrace - dt)

    this._processCollisions()
    this._checkLaunchedBubbles()
    this._checkGameOver(dt)
  }

  _render() {
    if (this.state === GAME_STATES.MENU) return
    const dx = this._pointerX - LAUNCHER_X, dy = this._pointerY - LAUNCHER_Y
    const angle = Math.atan2(dy, dx)
    this.renderer.setLauncherAngle(angle)
    this.renderer.render(this.physics.getAllBubbles().map(d => ({
      bubble: { x: d.body.position.x, y: d.body.position.y, colorIndex: d.colorIndex, level: d.level }
    })), {
      mode: this.mode, score: this.score, chainCount: this.chainCount,
      dangerActive: this._dangerActive,
      timeStopActive: this._itemEffects.timeStop > 0,
      preciseAimActive: this._itemEffects.preciseAim > 0,
      isSlowMo: this._slowMo > 0,
    })
  }

  // ===== 连点发射 =====
  _launch() {
    const dx = this._pointerX - LAUNCHER_X, dy = this._pointerY - LAUNCHER_Y
    const angle = Math.atan2(dy, dx)
    if (angle < 0.15 || angle > Math.PI - 0.15) return

    const launchSpeed = this._settings?.launchSpeed || 12
    const data = this.physics.createBubble(LAUNCHER_X, LAUNCHER_Y, this.currentColorIndex, this.currentLevel)
    this.physics.launchBubble(data, angle, launchSpeed)
    this._launchedBubbles.push(data)
    audio.playLaunch()

    this.currentColorIndex = this.nextColorIndex; this.currentLevel = 1
    this.nextColorIndex = this._randomColor(); this.nextLevel = 1
    this.renderer.setBubblePreview(this.currentColorIndex, this.nextColorIndex)
  }

  _checkLaunchedBubbles() {
    for (let i = this._launchedBubbles.length - 1; i >= 0; i--) {
      const b = this._launchedBubbles[i]
      if (!this.physics.bubbles.has(b.body.id)) {
        this._launchedBubbles.splice(i, 1)
      } else if (this.physics.isBubbleSettled(b.body.id)) {
        this._launchedBubbles.splice(i, 1)
      }
    }
  }

  _swapBubble() {
    if (this.swapCount <= 0) return; this.swapCount--
    const tc = this.currentColorIndex
    this.currentColorIndex = this.nextColorIndex
    this.nextColorIndex = tc
    this.renderer.setBubblePreview(this.currentColorIndex, this.nextColorIndex)
    audio.playClick()
  }

  _randomColor() { return Math.floor(Math.random() * BUBBLE_COLORS.length) }

  // ===== 碰撞/合成逻辑 =====
  _processCollisions() {
    const collisions = this.physics.drainCollisions()
    const processed = new Set()
    let existingIds = new Set(this.physics.getAllBubbles().map(b => b.body.id))
    // 延迟融合队列：避免在碰撞循环中修改物理世界导致状态不一致
    const deferredFusions = []

    for (const { bodyA, bodyB, dataA, dataB } of collisions) {
      if (!existingIds.has(bodyA.id) || !existingIds.has(bodyB.id)) continue
      if (!dataA || !dataB) continue
      const pairKey = bodyA.id < bodyB.id ? `${bodyA.id}:${bodyB.id}` : `${bodyB.id}:${bodyA.id}`
      if (processed.has(pairKey)) continue
      processed.add(pairKey)

      // 双彩虹融合：收集到延迟队列，等所有合并处理完再统一执行
      if (dataA.level === 5 && dataB.level === 5 && dataA.colorIndex !== dataB.colorIndex) {
        deferredFusions.push({ bodyA, bodyB, dataA, dataB })
        existingIds.delete(bodyA.id); existingIds.delete(bodyB.id)
        continue
      }

      // 原始：同色同级合成
      if (dataA.colorIndex === dataB.colorIndex && dataA.level === dataB.level) {
        this._mergeBubbles(bodyA, bodyB, dataA, dataB)
        existingIds.delete(bodyA.id); existingIds.delete(bodyB.id)
      } else {
        audio.playBounce(dataA.level)
      }
    }

    // 所有合并处理完成后，统一处理双彩虹融合（此时物理世界状态一致）
    for (const { bodyA, bodyB, dataA, dataB } of deferredFusions) {
      try {
        if (this.physics.bubbles.has(bodyA.id) && this.physics.bubbles.has(bodyB.id)) {
          this._onDoubleRainbowFusion(bodyA, bodyB, dataA, dataB)
        }
      } catch (e) {
        console.error('双彩虹融合异常:', e)
        // 安全回退：至少移除两个 L5 泡泡，避免残留
        try { this.physics.removeBubble(bodyA.id) } catch (_) {}
        try { this.physics.removeBubble(bodyB.id) } catch (_) {}
      }
    }
  }

  _mergeBubbles(bodyA, bodyB, dataA, dataB) {
    const newLevel = dataA.level + 1
    const midX = (bodyA.position.x + bodyB.position.x) / 2
    const midY = (bodyA.position.y + bodyB.position.y) / 2
    const color = BUBBLE_COLORS[dataA.colorIndex]

    this.renderer.addFlash(midX, midY, color ? color.base : '#FFF')
    this.renderer.addRipple(midX, midY)
    particles.burst(midX, midY, color ? color.base : '#FFF', 12)
    audio.playMerge(dataA.level)

    this.physics.removeBubble(bodyA.id)
    this.physics.removeBubble(bodyB.id)

    if (newLevel > BUBBLE_LEVELS.length) {
      // L5+L5同色 → 经典彩虹消除
      this._onRainbowPop(midX, midY, dataA.colorIndex)
    } else {
      const newBubble = this.physics.createBubble(midX, midY, dataA.colorIndex, newLevel)
      const scoreMultiplier = this._settings?.scoreMultiplier || 1.0
      this.score += Math.floor(BUBBLE_LEVELS[newLevel - 1].score * scoreMultiplier)
      this.renderer.addScoreText(midX, midY - 20, Math.floor(BUBBLE_LEVELS[newLevel - 1].score * scoreMultiplier), false)
      if (this.onScoreChange) this.onScoreChange(this.score)
      this._checkChainReaction(newBubble)
    }
  }

  _checkChainReaction(bubbleData) {
    if (!bubbleData) return
    const allBubbles = this.physics.getAllBubbles()
    const newX = bubbleData.body.position.x, newY = bubbleData.body.position.y
    const newLevel = bubbleData.level, newColor = bubbleData.colorIndex
    const radius = BUBBLE_LEVELS[newLevel - 1]?.radius || 18

    for (const data of allBubbles) {
      if (data.body.id === bubbleData.body.id) continue
      if (data.colorIndex !== newColor || data.level !== newLevel) continue
      const dx = data.body.position.x - newX, dy = data.body.position.y - newY
      if (Math.sqrt(dx * dx + dy * dy) < radius * 2 + 5) {
        this.chainCount++
        this.renderer.addScoreText(newX, newY - 40, this.chainCount + '连击!', true)
        this.renderer.triggerChainPulse(this.chainCount)
        audio.playChain(this.chainCount)
        return
      }
    }
    this.chainCount = 0
  }

  // 经典彩虹消除：同色L5+L5→6级越界，高倍率得分
  _onRainbowPop(x, y, colorIndex) {
    const baseScore = BUBBLE_LEVELS[4].score
    const multiplier = CHAIN_MULTIPLIERS[Math.min(this.chainCount, CHAIN_MULTIPLIERS.length - 1)]
    const scoreMult = this._settings?.scoreMultiplier || 1.0
    const earned = Math.round(baseScore * multiplier * scoreMult)
    this.score += earned
    this.renderer.addScoreText(x, y - 30, earned, true)
    if (this.onScoreChange) this.onScoreChange(this.score)

    particles.fusionBurst(x, y)
    this.renderer.triggerFusionEffect(x, y)
    this.renderer.triggerChainPulse(Math.min(this.chainCount + 1, 6))
    this.renderer.triggerShake(12)
    audio.playFusion()
    this.chainCount = 0

    this._checkMilestone()
    if (this.onRainbowFusion) this.onRainbowFusion({ x, y, finalScore: earned, multiplier })
  }

  // 双彩虹融合：不同色L5+L5碰撞 → 大范围清除 + 震撼特效
  _onDoubleRainbowFusion(bodyA, bodyB, dataA, dataB) {
    const midX = (bodyA.position.x + bodyB.position.x) / 2
    const midY = (bodyA.position.y + bodyB.position.y) / 2
    const cfg = DOUBLE_RAINBOW_FUSION
    const s = this._settings || {}

    const fusionRadius = s.fusionRadius || cfg.radius
    const fusionBaseScore = s.fusionBaseScore || cfg.fusionBaseScore
    const fusionBonusPerBubble = s.fusionBonusPerBubble || cfg.fusionBonusPerBubble
    const MAX_FUSION_ELIMINATE = 12

    this.physics.removeBubble(bodyA.id)
    this.physics.removeBubble(bodyB.id)

    const allBubbles = this.physics.getAllBubbles()
    let eliminatedCount = 0
    for (const data of allBubbles) {
      if (eliminatedCount >= MAX_FUSION_ELIMINATE) break
      const dx = data.body.position.x - midX, dy = data.body.position.y - midY
      if (Math.sqrt(dx * dx + dy * dy) < fusionRadius) {
        eliminatedCount++
        this.physics.removeBubble(data.body.id)
      }
    }
    // 粒子效果：仅一次总爆发
    particles.doubleRainbowBurst(midX, midY)
    const bonusScore = eliminatedCount * fusionBonusPerBubble
    this.chainCount = Math.min(this.chainCount + 2, 6)
    const mult = CHAIN_MULTIPLIERS[Math.min(this.chainCount, CHAIN_MULTIPLIERS.length - 1)]
    const scoreMult = this._settings?.scoreMultiplier || 1.0
    const finalScore = Math.floor((fusionBaseScore + bonusScore) * mult * scoreMult)
    this.score += finalScore
    this.renderer.addScoreText(midX, midY - 30, finalScore, true)
    if (this.onScoreChange) this.onScoreChange(this.score)

    this.renderer.triggerDoubleRainbowEffect(midX, midY)
    this.renderer.triggerShake(cfg.shakeAmount)
    this.renderer.triggerChainPulse(6)
    audio.playDoubleFusion()

    this._checkMilestone()
    if (this.onDoubleRainbowFusion) {
      this.onDoubleRainbowFusion({ x: midX, y: midY, eliminatedCount, finalScore, multiplier: mult })
    }
  }

  // ===== 道具系统 =====
  useItem(itemId) {
    if (this.state !== GAME_STATES.PLAYING) return { success: false, error: '游戏未开始' }
    const info = shop.getItemInfo(itemId)
    if (!info) return { success: false, error: '道具不存在' }
    if (shop.getItemCount(itemId) <= 0) return { success: false, error: '道具数量不足' }
    const result = this._executeItemEffect(itemId)
    if (!result.success) return result
    shop.useItemOnline(itemId)
    audio.playItemUse()
    if (this.onItemUse) this.onItemUse(itemId)
    return { success: true, item: info }
  }

  _executeItemEffect(itemId) {
    const allBubbles = this.physics.getAllBubbles()
    switch (itemId) {
      case 'color_swap':
        if (this.currentColorIndex !== undefined) {
          this.currentColorIndex = (this.currentColorIndex + 1) % BUBBLE_COLORS.length
          this.renderer.setBubblePreview(this.currentColorIndex, this.nextColorIndex)
        }
        return { success: true }
      case 'precise_aim': this._itemEffects.preciseAim = 10; return { success: true }
      case 'rainbow_pin': {
        const counts = {}; for (const b of allBubbles) counts[b.colorIndex] = (counts[b.colorIndex] || 0) + 1
        let maxCi = 0, maxN = 0; for (const [ci, n] of Object.entries(counts)) { if (n > maxN) { maxN = n; maxCi = parseInt(ci) } }
        for (const b of allBubbles) { if (b.colorIndex === maxCi) this._removeBubble(b) }
        this.chainCount = 0; return { success: true }
      }
      case 'gravity_flip': {
        this.physics.setGravityFlipped(true)
        this._dangerTimer = 0; this._dangerActive = false
        this._gravityFlipGrace = 0
        const duration = (this._settings?.gravityFlipDuration || 3) * 1000
        setTimeout(() => {
          this.physics.setGravityFlipped(false)
          this._dangerTimer = 0; this._dangerActive = false
          this._gravityFlipGrace = 2
        }, duration)
        return { success: true }
      }
      case 'color_bomb': {
        const colors = [...Array(BUBBLE_COLORS.length).keys()].sort(() => Math.random() - 0.5).slice(0, 3)
        for (const b of allBubbles) { if (colors.includes(b.colorIndex)) this._removeBubble(b) }
        this.chainCount = 0; return { success: true }
      }
      case 'area_clear': this._pendingAreaClear = true; return { success: true, needsClick: true }
      case 'freeze_bubble': this._itemEffects.freezeActive = true; return { success: true }
      case 'lightning_chain': this._pendingLightningChain = true; return { success: true, needsClickBubble: true }
      case 'time_stop': this._itemEffects.timeStop = this._settings?.timeStopDuration || 8; return { success: true }
      case 'rainbow_bomb': {
        const toUpgrade = allBubbles.filter(b => b.level === 4)
        if (toUpgrade.length === 0) return { success: false, error: '场上没有L4泡泡' }
        // 最多消除 5 个 L4，不创建任何新物理泡泡，直接消除 + 彩虹特效
        const MAX_ELIMINATE = 5
        const picked = toUpgrade.slice(0, MAX_ELIMINATE)
        let cx = 0, cy = 0
        for (const b of picked) {
          cx += b.body.position.x; cy += b.body.position.y
          // 直接移除 L4 泡泡，不开新泡泡避免物理重叠卡死
          this.physics.removeBubble(b.body.id)
          particles.burst(b.body.position.x, b.body.position.y, BUBBLE_COLORS[b.colorIndex]?.base || '#FFF', 8)
        }
        cx /= picked.length; cy /= picked.length
        // 立即触发彩虹消除特效（纯视觉，零物理开销）
        this._onRainbowPop(cx, cy, picked[0].colorIndex)
        return { success: true }
      }
      case 'screen_clear': for (const b of allBubbles) this._removeBubble(b); this.chainCount = 0; return { success: true }
      default: return { success: false, error: '未知道具' }
    }
  }

  _removeBubble(data) {
    if (!data) return
    this.renderer.addScoreText(data.body.position.x, data.body.position.y - 15, BUBBLE_LEVELS[data.level - 1].score, false)
    particles.burst(data.body.position.x, data.body.position.y, BUBBLE_COLORS[data.colorIndex]?.base || '#FFF', 8)
    this.physics.removeBubble(data.body.id)
  }

  areaClearAt(x, y) {
    const all = this.physics.getAllBubbles()
    for (const b of all) { const dx = b.body.position.x - x, dy = b.body.position.y - y; if (Math.sqrt(dx * dx + dy * dy) < 120) this._removeBubble(b) }
    this.chainCount = 0; this._pendingAreaClear = false
    particles.fusionBurst(x, y)
    this.renderer.triggerFusionEffect(x, y)
  }

  lightningChain(targetData) {
    if (!targetData) return
    const tc = targetData.colorIndex; const all = this.physics.getAllBubbles()
    const visited = new Set(); const queue = [targetData]
    while (queue.length > 0) {
      const cur = queue.shift(); if (visited.has(cur.body.id)) continue
      visited.add(cur.body.id)
      if (cur.colorIndex === tc) {
        this._removeBubble(cur)
        for (const b of all) { if (visited.has(b.body.id) || b.colorIndex !== tc) continue; const dx = b.body.position.x - cur.body.position.x, dy = b.body.position.y - cur.body.position.y; if (Math.sqrt(dx * dx + dy * dy) < 100) queue.push(b) }
      }
    }
    this.chainCount = 0; this._pendingLightningChain = false
    audio.playChain(5)
    this.renderer.triggerChainPulse(5)
  }

  // ===== 里程碑 =====
  _checkMilestone() {
    for (const m of MILESTONES) {
      if (this.score >= m.score && this._lastMilestoneCheck < m.score) {
        this._lastMilestoneCheck = m.score
        this.renderer.triggerMilestone(m.score)
        audio.playMilestone(m.score / 1000)
        shop.markMilestone(m.score)
      }
    }
  }

  // ===== 游戏结束 =====
  _triggerGameOver() {
    this.stopLoop()
    this.state = GAME_STATES.GAME_OVER
    audio.playGameOver()
    if (this.onStateChange) this.onStateChange(this.state)
    const h = Math.max(this.score, parseInt(localStorage.getItem('bubble_workshop_high') || '0'))
    try { localStorage.setItem('bubble_workshop_high', String(h)) } catch {}
    if (this.onGameOver) this.onGameOver(this.score, h, this.mode)
  }

  _checkGameOver(dt) {
    if (this.mode === GAME_MODES.ZEN) return
    if (this._itemEffects.timeStop > 0) return
    // 重力翻转期间 + 结束后的冷静期内跳过警戒线检测
    if (this.physics.engine.gravity.y < 0 || this._gravityFlipGrace > 0) {
      this._dangerActive = false; this._dangerTimer = 0; return
    }
    const allBubbles = this.physics.getAllBubbles()
    for (const data of allBubbles) {
      const dangerLine = this._settings?.dangerLineY || DANGER_LINE_Y
      if (data.body.position.y - (BUBBLE_LEVELS[data.level - 1]?.radius || 18) <= dangerLine) {
        this._dangerActive = true
        this._dangerTimer += dt
        const timeout = this._settings?.dangerTimeout || 1.5
        if (this._dangerTimer >= timeout) { this._triggerGameOver(); return }
        return
      }
    }
    this._dangerActive = false
    this._dangerTimer = 0
  }

  // ===== 公共 API =====
  togglePause() {
    if (this.state === GAME_STATES.PLAYING) { this.state = GAME_STATES.PAUSED; this.stopLoop() }
    else if (this.state === GAME_STATES.PAUSED) { this.state = GAME_STATES.PLAYING; this.startLoop() }
    if (this.onStateChange) this.onStateChange(this.state)
  }
  backToMenu() { this.stopLoop(); this.state = GAME_STATES.MENU; if (this.onStateChange) this.onStateChange(this.state) }
  destroy() { this.stopLoop(); this._unbindInput(); this.physics.destroy(); this.renderer.clearEffects(); particles.clear() }
  getScore() { return this.score }
  getState() { return this.state }
  getMode() { return this.mode }
  getChainCount() { return this.chainCount }
  getCurrentBubble() { return { colorIndex: this.currentColorIndex, level: this.currentLevel } }
  getNextBubble() { return { colorIndex: this.nextColorIndex, level: this.nextLevel } }
  getAimLength() { return this._itemEffects.preciseAim > 0 ? 300 : 120 }
  getItemEffects() { return this._itemEffects }
  getPreciseAimRemaining() { return this._itemEffects.preciseAim > 0 }
  getTimeStopActive() { return this._itemEffects.timeStop > 0 }
  isPendingAreaClear() { return this._pendingAreaClear }
  isPendingLightningChain() { return this._pendingLightningChain }
  getSwapCount() { return this.swapCount }
  getBubbleCount() { return this.physics.bubbleCount }
  getPointerPosition() { return { x: this._pointerX, y: this._pointerY } }
  getIsSlowMo() { return this._slowMo > 0 }
  getLaunchedBubbles() { return this._launchedBubbles }
}

export default GameEngine