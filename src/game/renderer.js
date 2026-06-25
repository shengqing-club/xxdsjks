/**
 * 泡泡工坊 V3 - Canvas 渲染器
 * 双彩虹融合特效 + 即时反馈 + 道具HUD
 */
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, DANGER_LINE_Y, BUBBLE_COLORS, BUBBLE_LEVELS,
  RAINBOW_HUE_SPEED, FUSION_CONFIG, DOUBLE_RAINBOW_FUSION,
  MILESTONES, GAME_STATES, FEEDBACK_CONFIG,
} from './config.js'
import particles from './particles.js'

const BUBBLE_RADIUS_MAP = BUBBLE_LEVELS.map(l => l.radius)

class Renderer {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.canvas.width = CANVAS_WIDTH
    this.canvas.height = CANVAS_HEIGHT
    this._frameTime = 0.016
    this._time = 0

    // 震动
    this.shakeAmount = 0
    this.shakeOffsetX = 0
    this.shakeOffsetY = 0

    // 发射器预览
    this._currentColorIndex = 0
    this._nextColorIndex = 1
    this._launcherAngle = Math.PI / 2
    this.dangerFlash = 0

    // ===== V3: 反馈系统 =====
    this.trailPoints = []
    this.ripples = []
    this.flashes = []
    this.scoreTexts = []
    this.chainPulse = null
    this.milestone = null
    this.fusionGlow = null
    this.fusionWaves = []
    this.doubleRainbowGlow = null
    this.doubleRainbowFlash = 0
    this.screenFlash = 0
    this._engineState = {}

    // 离线背景缓存
    this._bgCanvas = document.createElement('canvas')
    this._bgCanvas.width = CANVAS_WIDTH
    this._bgCanvas.height = CANVAS_HEIGHT
    this._renderStaticBackground()
  }

  _renderStaticBackground() {
    const ctx = this._bgCanvas.getContext('2d')
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT)
    gradient.addColorStop(0, '#FFF5EC')
    gradient.addColorStop(1, '#FFE8D6')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    // 装饰性网格点
    ctx.fillStyle = 'rgba(232,120,74,0.06)'
    ctx.beginPath()
    for (let x = 20; x < CANVAS_WIDTH; x += 40) {
      for (let y = 20; y < CANVAS_HEIGHT; y += 40) {
        ctx.moveTo(x + 1.5, y)
        ctx.arc(x, y, 1.5, 0, Math.PI * 2)
      }
    }
    ctx.fill()
  }

  setBubblePreview(currentColor, nextColor) {
    this._currentColorIndex = currentColor
    this._nextColorIndex = nextColor
  }

  setLauncherAngle(angle) {
    this._launcherAngle = angle || Math.PI / 2
  }

  // ===== V3: 反馈入口 =====
  triggerShake(amount) { this.shakeAmount = Math.max(this.shakeAmount, amount) }
  addTrailPoint(x, y, color) {
    this.trailPoints.push({ x, y, color, alpha: 0.8, size: 6 })
    if (this.trailPoints.length > 12) this.trailPoints.shift()
  }
  addRipple(x, y) {
    this.ripples.push({ x, y, radius: 2, alpha: 0.6, maxRadius: 30 })
    if (this.ripples.length > 8) this.ripples.shift()
  }
  addFlash(x, y, color) {
    this.flashes.push({ x, y, color, alpha: 1, scale: 0.3, lifetime: 0.4 })
    if (this.flashes.length > 12) this.flashes.shift()
  }
  addScoreText(x, y, score, isBig = false) {
    const text = typeof score === 'string' ? score : '+' + score
    const size = typeof score === 'string' ? 28 : Math.min(score / 50 + 12, 36)
    this.scoreTexts.push({ x, y, text, alpha: 1, vy: -1.8, lifetime: isBig ? 1.2 : 0.8, size: isBig ? size * 1.2 : size, isBig })
    if (this.scoreTexts.length > 15) this.scoreTexts.shift()
  }
  triggerChainPulse(chainCount) {
    if (chainCount < 2) return
    const colors = FEEDBACK_CONFIG.chainPulseColors
    const idx = Math.min(chainCount - 2, colors.length - 1)
    this.chainPulse = { chainCount, timer: 0, pulseCount: chainCount >= 6 ? 3 : chainCount >= 4 ? 2 : 1, color: colors[idx], hue: 0 }
  }
  triggerMilestone(score) {
    const m = MILESTONES.find(m => m.score === score)
    if (!m) return
    this.milestone = { text: m.text, color: m.color, scale: 0.5, alpha: 1, lifetime: 2.5 }
  }
  triggerFusionEffect(x, y) {
    this.fusionGlow = { alpha: 1, lifetime: FUSION_CONFIG.glowDuration, duration: FUSION_CONFIG.glowDuration }
    this.fusionWaves.push({ x, y, radius: 50, alpha: 1, maxRadius: 220 })
    this.triggerShake(FUSION_CONFIG.shakeAmount)
  }
  triggerFusionWave(x, y, startRadius = 50) {
    this.fusionWaves.push({ x, y, radius: startRadius, alpha: 1, maxRadius: 250 })
  }
  triggerDoubleRainbowEffect(x, y) {
    // 简化：单层光晕 + 单层冲击波，降低渲染压力
    this.doubleRainbowGlow = { alpha: 1, lifetime: 1.5, duration: 1.5 }
    this.doubleRainbowFlash = 0.5
    this.triggerShake(20)
    this.fusionWaves.push({ x, y, radius: 30, alpha: 1, maxRadius: 250 })
  }
  // ===== 更新 =====
  update(dt) {
    this._frameTime = dt
    this._time += dt
    this._updateShake()
    // 屏幕闪光衰减
    if (this.doubleRainbowFlash > 0) this.doubleRainbowFlash = Math.max(0, this.doubleRainbowFlash - dt)
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - dt)

    // 轨迹
    for (const tp of this.trailPoints) { tp.alpha -= dt * 1.5; tp.size -= dt * 8 }
    while (this.trailPoints.length > 0 && this.trailPoints[0].alpha <= 0) this.trailPoints.shift()
    // 涟漪
    for (const r of this.ripples) { r.radius += dt * 80; r.alpha = Math.max(0, 0.6 * (1 - r.radius / r.maxRadius)) }
    for (let i = this.ripples.length - 1; i >= 0; i--) { if (this.ripples[i].alpha <= 0) this.ripples.splice(i, 1) }
    // 闪光
    for (const f of this.flashes) { f.lifetime -= dt; f.alpha = Math.max(0, f.lifetime / 0.4); f.scale = Math.min(1.5, f.scale + dt * 3) }
    for (let i = this.flashes.length - 1; i >= 0; i--) { if (this.flashes[i].lifetime <= 0) this.flashes.splice(i, 1) }
    // 分数飘字
    for (const st of this.scoreTexts) { st.lifetime -= dt; st.y += st.vy * dt * 60; st.alpha = Math.max(0, st.lifetime / (st.isBig ? 1.2 : 0.8)) }
    for (let i = this.scoreTexts.length - 1; i >= 0; i--) { if (this.scoreTexts[i].lifetime <= 0) this.scoreTexts.splice(i, 1) }
    // 连锁脉冲
    if (this.chainPulse) {
      this.chainPulse.timer += dt
      if (this.chainPulse.timer > this.chainPulse.pulseCount * 0.6) this.chainPulse = null
      if (this.chainPulse) this.chainPulse.hue += dt * 300
    }
    // 里程碑
    if (this.milestone) {
      this.milestone.lifetime -= dt
      this.milestone.scale = this.milestone.lifetime > 2.0 ? Math.min(1.2, this.milestone.scale + dt * 2) : this.milestone.scale
      this.milestone.alpha = this.milestone.lifetime > 2.0 ? 1 : Math.max(0, this.milestone.lifetime / 2.0)
      if (this.milestone.lifetime <= 0) this.milestone = null
    }
    // 融合光晕
    if (this.fusionGlow) {
      this.fusionGlow.lifetime -= dt
      this.fusionGlow.alpha = Math.max(0, this.fusionGlow.lifetime / this.fusionGlow.duration)
      if (this.fusionGlow.lifetime <= 0) this.fusionGlow = null
    }
    // 双彩虹光晕
    if (this.doubleRainbowGlow) {
      this.doubleRainbowGlow.lifetime -= dt
      this.doubleRainbowGlow.alpha = Math.max(0, this.doubleRainbowGlow.lifetime / this.doubleRainbowGlow.duration)
      if (this.doubleRainbowGlow.lifetime <= 0) this.doubleRainbowGlow = null
    }
    // 融合冲击波
    for (const w of this.fusionWaves) { w.radius += dt * 300; w.alpha = Math.max(0, 1 - w.radius / w.maxRadius) }
    for (let i = this.fusionWaves.length - 1; i >= 0; i--) { if (this.fusionWaves[i].alpha <= 0) this.fusionWaves.splice(i, 1) }

    particles.update(dt)
  }

  _updateShake() {
    if (this.shakeAmount > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeAmount * 2
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeAmount * 2
      this.shakeAmount *= 0.85
    } else {
      this.shakeAmount = 0; this.shakeOffsetX = 0; this.shakeOffsetY = 0
    }
  }

  clearEffects() {
    this.trailPoints.length = 0; this.ripples.length = 0; this.flashes.length = 0
    this.scoreTexts.length = 0; this.chainPulse = null; this.milestone = null
    this.fusionGlow = null; this.fusionWaves.length = 0
    this.doubleRainbowGlow = null; this.doubleRainbowFlash = 0; this.screenFlash = 0
    this.shakeAmount = 0; this.shakeOffsetX = 0; this.shakeOffsetY = 0
    particles.clear()
  }

  // ===== 主渲染 =====
  render(bodies, engineState) {
    this._engineState = engineState || {}
    const ctx = this.ctx
    ctx.save()
    ctx.translate(this.shakeOffsetX, this.shakeOffsetY)

    // 背景
    ctx.drawImage(this._bgCanvas, 0, 0)

    // V3: 双彩虹屏幕闪光
    if (this.doubleRainbowFlash > 0) {
      const hue = (this._time * 300) % 360
      ctx.fillStyle = `hsla(${hue}, 100%, 70%, ${this.doubleRainbowFlash * 0.3})`
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    // 警戒线（原版：active 参数控制闪烁 + dangerFlash 遮罩）
    this._drawDangerLine(ctx, this._engineState.dangerActive)

    // 轨迹
    this._renderTrails(ctx)
    // 涟漪
    this._renderRipples(ctx)

    // 泡泡
    for (const body of bodies) {
      if (body.bubble) this._drawBubble(ctx, body.bubble)
    }

    // 闪光
    this._renderFlashes(ctx)
    // 融合冲击波
    this._renderFusionWaves(ctx)
    // 分数飘字
    this._renderScoreTexts(ctx)
    // 粒子
    particles.render(ctx)
    // 连锁脉冲
    this._renderChainPulse(ctx)
    // 里程碑
    this._renderMilestone(ctx)
    // 融合光晕
    this._renderFusionGlow(ctx)
    // 双彩虹光晕
    this._renderDoubleRainbowGlow(ctx)
    // 发射器
    this._drawLauncher(ctx)

    // V3: 慢动作指示器
    if (engineState && engineState.isSlowMo) {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }

    ctx.restore()
  }

  _drawDangerLine(ctx, active) {
    const alpha = active ? 0.4 + Math.sin(this._time * 6) * 0.3 : 0.15
    ctx.strokeStyle = `rgba(255,80,80,${alpha})`
    ctx.lineWidth = 2
    ctx.setLineDash([10, 8])
    ctx.beginPath()
    ctx.moveTo(0, DANGER_LINE_Y)
    ctx.lineTo(CANVAS_WIDTH, DANGER_LINE_Y)
    ctx.stroke()
    ctx.setLineDash([])

    if (this.dangerFlash > 0) {
      ctx.fillStyle = `rgba(255,80,80,${this.dangerFlash * 0.15})`
      ctx.fillRect(0, 0, CANVAS_WIDTH, DANGER_LINE_Y)
    }
  }

  // ===== 泡泡绘制 =====
  _drawBubble(ctx, bubble) {
    const { x, y, colorIndex, level } = bubble
    const radius = BUBBLE_RADIUS_MAP[level - 1]
    if (radius === undefined) return
    const isRainbow = level === 5

    ctx.save()
    if (isRainbow) {
      const hue = (this._time * RAINBOW_HUE_SPEED) % 360
      const pulse = 1 + Math.sin(this._time * 4) * 0.06
      const r = radius * pulse
      const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.5)
      glow.addColorStop(0, `hsla(${hue}, 80%, 70%, 0.4)`)
      glow.addColorStop(1, `hsla(${hue}, 80%, 70%, 0)`)
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill()
      const bodyGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r)
      bodyGrad.addColorStop(0, `hsla(${hue}, 90%, 85%, 1)`)
      bodyGrad.addColorStop(0.5, `hsla(${(hue + 40) % 360}, 85%, 65%, 1)`)
      bodyGrad.addColorStop(1, `hsla(${(hue + 80) % 360}, 80%, 55%, 1)`)
      ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = `hsla(${hue}, 70%, 50%, 0.5)`; ctx.lineWidth = 2; ctx.stroke()
    } else {
      const color = BUBBLE_COLORS[colorIndex]
      if (!color) { ctx.restore(); return }
      const glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 1.3)
      glow.addColorStop(0, color.glow); glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, radius * 1.3, 0, Math.PI * 2); ctx.fill()
      const bodyGrad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius)
      bodyGrad.addColorStop(0, color.light); bodyGrad.addColorStop(0.6, color.base); bodyGrad.addColorStop(1, color.dark)
      ctx.fillStyle = bodyGrad; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = color.dark; ctx.lineWidth = 1.5; ctx.stroke()
    }
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
    ctx.beginPath(); ctx.arc(x - radius * 0.25, y - radius * 0.25, radius * 0.35, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // ===== 发射器 =====
  _drawLauncher(ctx) {
    const lx = CANVAS_WIDTH / 2, ly = 50
    const color = BUBBLE_COLORS[this._currentColorIndex]
    const radius = BUBBLE_RADIUS_MAP[0]
    if (!color) return

    // 瞄准线（跟随鼠标/手指）
    const aimLen = this._engineState.preciseAimActive ? 300 : 120
    ctx.strokeStyle = 'rgba(45,42,38,0.2)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6])
    ctx.beginPath(); ctx.moveTo(lx, ly)
    ctx.lineTo(lx + Math.cos(this._launcherAngle) * aimLen, ly + Math.sin(this._launcherAngle) * aimLen)
    ctx.stroke(); ctx.setLineDash([])

    // 底座
    ctx.fillStyle = '#DDD0C0'; ctx.beginPath(); ctx.arc(lx, ly, 22, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#C0B0A0'; ctx.lineWidth = 2; ctx.stroke()

    // 当前泡泡预览
    const previewGrad = ctx.createRadialGradient(lx - radius * 0.2, ly - radius * 0.2, radius * 0.1, lx, ly, radius)
    previewGrad.addColorStop(0, color.light); previewGrad.addColorStop(1, color.base)
    ctx.fillStyle = previewGrad; ctx.beginPath(); ctx.arc(lx, ly, radius, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = color.dark; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath(); ctx.ellipse(lx - radius * 0.2, ly - radius * 0.25, radius * 0.15, radius * 0.1, -0.5, 0, Math.PI * 2); ctx.fill()

    // 下一个泡泡预览
    const nextColor = BUBBLE_COLORS[this._nextColorIndex]
    if (nextColor) {
      const nx = CANVAS_WIDTH - 40, ny = 30
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(nx, ny, 13, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = nextColor.base; ctx.beginPath(); ctx.arc(nx, ny, 10, 0, Math.PI * 2); ctx.fill()
    }
  }

  // ===== 内部渲染 =====
  _renderTrails(ctx) {
    for (const tp of this.trailPoints) {
      if (tp.alpha <= 0) continue
      ctx.globalAlpha = tp.alpha; ctx.fillStyle = tp.color
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tp.size, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  _renderRipples(ctx) {
    for (const r of this.ripples) {
      if (r.alpha <= 0) continue
      ctx.globalAlpha = r.alpha; ctx.strokeStyle = '#FFF'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  _renderFlashes(ctx) {
    for (const f of this.flashes) {
      if (f.alpha <= 0) continue
      ctx.globalAlpha = f.alpha; ctx.strokeStyle = f.color; ctx.lineWidth = 2
      const len = 20 * f.scale; ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const a = (Math.PI / 2) * i
        ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + Math.cos(a) * len, f.y + Math.sin(a) * len)
      }
      ctx.stroke()
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, 8 * f.scale, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  _renderScoreTexts(ctx) {
    ctx.textAlign = 'center'
    for (const st of this.scoreTexts) {
      if (st.alpha <= 0) continue
      ctx.globalAlpha = st.alpha
      ctx.font = `bold ${st.size}px "Noto Sans SC", "Microsoft YaHei", sans-serif`
      const isBig = st.isBig
      if (isBig) {
        const hue = (this._time * 200) % 360
        ctx.fillStyle = `hsl(${hue}, 100%, 60%)`
      } else {
        ctx.fillStyle = '#FFE66D'
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3
      ctx.strokeText(st.text, st.x, st.y); ctx.fillText(st.text, st.x, st.y)
    }
    ctx.globalAlpha = 1
  }

  _renderChainPulse(ctx) {
    if (!this.chainPulse) return
    const { timer, pulseCount, color, hue } = this.chainPulse
    const pulseIdx = Math.floor(timer / 0.3)
    if (pulseIdx >= pulseCount) return
    const phase = (timer % 0.3) / 0.3
    const alpha = 1 - phase
    let borderColor = color
    if (color === null) borderColor = `hsl(${hue % 360}, 100%, 60%)`
    ctx.strokeStyle = borderColor; ctx.globalAlpha = alpha
    ctx.lineWidth = 4 + phase * 4
    ctx.strokeRect(2, 2, CANVAS_WIDTH - 4, CANVAS_HEIGHT - 4)
    ctx.globalAlpha = 1
  }

  _renderMilestone(ctx) {
    if (!this.milestone) return
    const { text, color, scale, alpha } = this.milestone
    ctx.save()
    ctx.globalAlpha = alpha; ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50)
    ctx.scale(scale, scale); ctx.textAlign = 'center'
    ctx.font = 'bold 40px "Noto Sans SC", "Microsoft YaHei", sans-serif'
    if (color === null) {
      ctx.fillStyle = `hsl(${(this._time * 120) % 360}, 100%, 60%)`
    } else {
      ctx.fillStyle = color
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4
    ctx.strokeText(text, 0, 0); ctx.fillText(text, 0, 0)
    ctx.restore()
  }

  _renderFusionGlow(ctx) {
    if (!this.fusionGlow) return
    const { alpha } = this.fusionGlow
    const hue = (this._time * 120) % 360
    ctx.save(); ctx.globalAlpha = alpha * 0.4
    const gradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT * 0.8)
    gradient.addColorStop(0, `hsla(${hue + 60}, 100%, 70%, 0.8)`)
    gradient.addColorStop(0.3, `hsla(${hue + 30}, 100%, 60%, 0.5)`)
    gradient.addColorStop(0.6, `hsla(${hue}, 100%, 50%, 0.2)`)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.restore()
  }

  _renderDoubleRainbowGlow(ctx) {
    if (!this.doubleRainbowGlow) return
    const { alpha } = this.doubleRainbowGlow
    const hue = (this._time * 200) % 360
    ctx.save(); ctx.globalAlpha = alpha * 0.5
    const gradient = ctx.createRadialGradient(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_HEIGHT)
    gradient.addColorStop(0, `hsla(${hue + 90}, 100%, 80%, 0.9)`)
    gradient.addColorStop(0.2, `hsla(${hue + 45}, 100%, 70%, 0.7)`)
    gradient.addColorStop(0.4, `hsla(${hue}, 100%, 60%, 0.5)`)
    gradient.addColorStop(0.7, `hsla(${hue - 45}, 100%, 50%, 0.2)`)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.restore()
  }

  _renderFusionWaves(ctx) {
    for (const w of this.fusionWaves) {
      if (w.alpha <= 0) continue
      ctx.globalAlpha = w.alpha; ctx.strokeStyle = '#FFF'
      ctx.lineWidth = 3 * (1 - w.radius / w.maxRadius)
      ctx.beginPath(); ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1
  }


}

export default Renderer