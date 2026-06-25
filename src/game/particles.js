/**
 * 泡泡工坊 V3 - 粒子系统
 * 双彩虹爆发 + 融合爆发 + 溅射 + 金币掉落 + 伤害数字
 */
import { PARTICLE_CONFIG } from './config.js'

const MAX_PARTICLES = PARTICLE_CONFIG.maxParticles

class ParticleSystem {
  constructor() {
    this.particles = []
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.lifetime -= dt
      if (p.lifetime <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1]
        this.particles.pop()
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += (p.gravity || 0.15) * dt * 60
      p.alpha = Math.max(0, p.lifetime / p.maxLifetime)
      if (p.size > 0.5) p.size -= dt * (p.decayRate || 2)
    }
  }

  burst(x, y, color, count = 15) {
    const { burstSpeed, lifetime } = PARTICLE_CONFIG
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
      const speed = burstSpeed * (0.5 + Math.random() * 0.5)
      this.particles.push({
        x, y, size: 2 + Math.random() * 3,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        alpha: 1, lifetime: lifetime * (0.5 + Math.random() * 0.5),
        maxLifetime: lifetime, gravity: 0.15,
        color, type: 'circle', decayRate: 2,
      })
    }
  }

  fusionBurst(x, y) {
    const colors = ['#FFE66D', '#FF9F43', '#FF6B6B', '#C9B1FF', '#4ECDC4', '#95E1A0', '#FFF']
    for (let i = 0; i < 40; i++) {
      if (this.particles.length >= MAX_PARTICLES) break
      const angle = (Math.PI * 2 * i) / 40 + Math.random() * 0.3
      const speed = 3 + Math.random() * 5
      const color = colors[Math.floor(Math.random() * colors.length)]
      this.particles.push({
        x, y, size: 2 + Math.random() * 4,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        alpha: 1, lifetime: 0.6 + Math.random() * 0.4, maxLifetime: 1.0,
        gravity: 0.1, color, type: 'circle', decayRate: 1.5,
      })
    }
  }

  secondaryBurst(x, y, color) {
    const count = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) break
      const angle = Math.random() * Math.PI * 2
      const speed = 1.5 + Math.random() * 3
      this.particles.push({
        x, y, size: 1.5 + Math.random() * 2.5,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        alpha: 1, lifetime: 0.3 + Math.random() * 0.3, maxLifetime: 0.6,
        gravity: 0.2, color, type: 'circle', decayRate: 3,
      })
    }
  }

  doubleRainbowBurst(x, y) {
    const rainbowColors = ['#FF6B6B', '#FF9F43', '#FFE66D', '#95E1A0', '#4ECDC4', '#54A0FF', '#C9B1FF', '#FF6B6B']
    // 大幅降低粒子数：50 + 15 = 65，避免渲染压力
    for (let i = 0; i < 50; i++) {
      if (this.particles.length >= MAX_PARTICLES) break
      const angle = (Math.PI * 2 * i) / 50
      const speed = 2 + Math.random() * 3
      const ci = Math.floor((i / 50) * rainbowColors.length)
      this.particles.push({
        x, y, size: 2 + Math.random() * 3,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        alpha: 1, lifetime: 0.5 + Math.random() * 0.4, maxLifetime: 0.9,
        gravity: 0.05, color: rainbowColors[ci % rainbowColors.length],
        type: 'circle', decayRate: 1.5,
      })
    }
    for (let i = 0; i < 15; i++) {
      if (this.particles.length >= MAX_PARTICLES) break
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 1.5
      this.particles.push({
        x, y, size: 2 + Math.random() * 3,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        alpha: 1, lifetime: 0.3 + Math.random() * 0.2, maxLifetime: 0.5,
        gravity: 0.3, color: '#FFFFFF', type: 'circle', decayRate: 6,
      })
    }
  }

  rainbowTrail(x, y) {
    if (this.particles.length >= MAX_PARTICLES) return
    const hue = (Date.now() / 10) % 360
    this.particles.push({
      x, y, size: 3 + Math.random() * 2,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      alpha: 1, lifetime: 0.3, maxLifetime: 0.3,
      gravity: 0, color: `hsl(${hue}, 100%, 60%)`,
      type: 'circle', decayRate: 3,
    })
  }

  clear() { this.particles.length = 0 }

  render(ctx) {
    const colorGroups = {}
    for (const p of this.particles) {
      if (p.alpha <= 0) continue
      const key = p.color
      if (!colorGroups[key]) colorGroups[key] = []
      colorGroups[key].push(p)
    }
    ctx.save()
    for (const [key, group] of Object.entries(colorGroups)) {
      ctx.fillStyle = key
      ctx.globalAlpha = 1
      for (const p of group) {
        ctx.globalAlpha = p.alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }
}

const particles = new ParticleSystem()
export default particles