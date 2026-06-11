<template>
  <Transition name="easter-fade">
    <div v-if="visible" class="easter-overlay" @click.self="close">
      <!-- 粒子画布 -->
      <canvas class="particle-canvas" ref="particleCanvas"></canvas>

      <!-- 主内容 -->
      <div class="easter-content" ref="contentRef">
        <!-- 背景光晕 -->
        <div class="content-glow" ref="glowRef"></div>

        <!-- 动态GIF -->
        <div class="gif-wrapper" ref="gifRef">
          <img src="/cute_cat.gif" alt="easter egg" class="gif-img" />
        </div>

        <!-- 彩蛋文字 -->
        <p class="easter-hint" ref="hintRef">恭喜你发现了隐藏彩蛋 !</p>

        <!-- 星星打分 -->
        <div class="star-row" ref="starRowRef">
          <span
            v-for="i in 5"
            :key="i"
            class="star-item"
            :class="{ active: hoveredStar >= i }"
            @mouseenter="hoveredStar = i"
            @mouseleave="hoveredStar = 0"
          >★</span>
        </div>

        <!-- 音乐控制 -->
        <div class="music-control" @click="toggleMusic" ref="musicRef">
          <div class="music-disc" :class="{ spinning: isPlaying }">
            <div class="disc-inner"></div>
          </div>
          <span class="music-label">{{ isPlaying ? '正在播放 ♪' : '点击播放音乐' }}</span>
        </div>

        <!-- 关闭按钮 -->
        <button class="close-btn" @click="close" title="关闭">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- 音乐 -->
      <audio ref="audioRef" src="/bgm.mp3" loop preload="auto"></audio>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onBeforeUnmount, nextTick, watch } from 'vue'
import anime from 'animejs'

const visible    = ref(false)
const isPlaying  = ref(false)
const hoveredStar = ref(0)
const audioRef   = ref(null)
const contentRef = ref(null)
const glowRef    = ref(null)
const gifRef     = ref(null)
const hintRef    = ref(null)
const starRowRef = ref(null)
const musicRef   = ref(null)
const particleCanvas = ref(null)
let canvasAnim   = null
let particles    = []

// ===== 暴露触发方法给父组件 =====
const trigger = () => {
  visible.value = true
  nextTick(() => {
    playMusic()
    playEnterAnimation()
  })
}
defineExpose({ trigger })

// ===== 粒子画布 =====
function initParticleCanvas() {
  const canvas = particleCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight

  const colors = ['rgba(100,130,255,', 'rgba(180,100,255,', 'rgba(255,180,100,', 'rgba(100,255,180,']

  particles = Array.from({ length: 60 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    r:     Math.random() * 3 + 1,
    vx:    (Math.random() - 0.5) * 0.8,
    vy:    (Math.random() - 0.5) * 0.8 - 0.3,
    alpha: Math.random() * 0.5 + 0.1,
    color: colors[Math.floor(Math.random() * colors.length)],
    life:  Math.random()
  }))

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.x += p.vx
      p.y += p.vy
      p.life += 0.005
      if (p.life > 1) { p.life = 0; p.y = canvas.height + 10; p.x = Math.random() * canvas.width }
      if (p.y < -10) p.y = canvas.height + 10
      if (p.x < -10) p.x = canvas.width + 10
      if (p.x > canvas.width + 10) p.x = -10

      const alpha = p.alpha * Math.sin(p.life * Math.PI)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = p.color + alpha + ')'
      ctx.fill()

      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * 2.5, 0, Math.PI * 2)
      ctx.fillStyle = p.color + (alpha * 0.2) + ')'
      ctx.fill()
    })
    canvasAnim = requestAnimationFrame(draw)
  }
  draw()
}

// ===== 内容入场动效 =====
function playEnterAnimation() {
  nextTick(() => {
    const tl = anime.timeline({ defaults: { easing: 'easeOutQuart' } })

    tl.add({
      targets: gifRef.value,
      opacity: [0, 1],
      scale: [0.5, 1],
      rotate: [-10, 0],
      duration: 800
    })
    .add({
      targets: hintRef.value,
      opacity: [0, 1],
      translateY: [20, 0],
      duration: 500
    }, '-=400')
    .add({
      targets: '.star-item',
      opacity: [0, 1],
      scale: [0, 1],
      rotate: ['-180deg', '0deg'],
      duration: 400,
      delay: anime.stagger(80),
      easing: 'easeOutBack'
    }, '-=200')
    .add({
      targets: musicRef.value,
      opacity: [0, 1],
      translateY: [15, 0],
      duration: 400
    }, '-=200')

    // 光晕持续脉冲
    anime({
      targets: glowRef.value,
      scale: [1, 1.15, 1],
      opacity: [0.5, 1, 0.5],
      duration: 3500,
      loop: true,
      easing: 'easeInOutQuad'
    })

    // GIF 浮动
    anime({
      targets: gifRef.value,
      translateY: [0, -10, 0],
      duration: 4000,
      loop: true,
      easing: 'easeInOutQuad'
    })

    // 初始化粒子
    initParticleCanvas()
  })
}

// ===== 音乐 =====
function playMusic() {
  if (!audioRef.value) return
  audioRef.value.volume = 0.5
  audioRef.value.play().then(() => { isPlaying.value = true }).catch(() => {})
}
function toggleMusic() {
  if (!audioRef.value) return
  if (isPlaying.value) {
    audioRef.value.pause()
    isPlaying.value = false
  } else {
    audioRef.value.play().then(() => { isPlaying.value = true }).catch(() => {})
  }
  anime({ targets: '.music-disc', scale: [1, 1.2, 1], duration: 300, easing: 'easeOutQuart' })
}

// ===== 关闭 =====
function close() {
  if (audioRef.value) { audioRef.value.pause(); audioRef.value.currentTime = 0 }
  isPlaying.value = false

  anime({
    targets: contentRef.value,
    scale: [1, 0.85],
    opacity: [1, 0],
    duration: 300,
    easing: 'easeInQuad',
    complete: () => { visible.value = false }
  })

  if (canvasAnim) cancelAnimationFrame(canvasAnim)
}

// ===== 星星悬停动效 =====
watch(hoveredStar, (val) => {
  const stars = document.querySelectorAll('.star-item')
  stars.forEach((star, i) => {
    if (i < val) {
      anime({ targets: star, scale: [1, 1.3, 1], rotate: [0, 20, 0], duration: 300, easing: 'easeOutQuart' })
    }
  })
})

onBeforeUnmount(() => {
  if (canvasAnim) cancelAnimationFrame(canvasAnim)
})
</script>

<style scoped>
.easter-overlay {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: 99999;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  background: rgba(8, 8, 18, 0.78);
  backdrop-filter: blur(10px);
}
.particle-canvas {
  position: absolute; top: 0; left: 0;
  pointer-events: none; z-index: 0;
}

/* 过渡 */
.easter-fade-enter-active { transition: opacity 0.5s ease; }
.easter-fade-leave-active { transition: opacity 0.3s ease; }
.easter-fade-enter-from, .easter-fade-leave-to { opacity: 0; }

.easter-content {
  position: relative; z-index: 2;
  display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 40px 48px;
}

.content-glow {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(100, 130, 255, 0.1) 0%, rgba(180, 80, 255, 0.06) 40%, transparent 70%);
  filter: blur(60px); pointer-events: none;
}

.gif-wrapper {
  width: 240px; height: 240px; margin-bottom: 28px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 20px; overflow: hidden;
  box-shadow: 0 0 50px rgba(100, 130, 255, 0.2), 0 20px 60px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.08);
}
.gif-img { width: 100%; height: 100%; object-fit: cover; display: block; }

.easter-hint {
  font-size: 15px; color: rgba(255,255,255,0.6); margin-bottom: 20px;
  font-weight: 400; letter-spacing: 1.5px;
}

/* 星星 */
.star-row { display: flex; gap: 8px; margin-bottom: 24px; }
.star-item {
  font-size: 28px; color: rgba(255,255,255,0.2);
  cursor: pointer; transition: color 0.2s;
  user-select: none; will-change: transform;
}
.star-item.active { color: #fbbf24; text-shadow: 0 0 12px rgba(251,191,36,0.6); }

/* 音乐控制 */
.music-control {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 20px 8px 8px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 40px; cursor: pointer; transition: all 0.3s;
}
.music-control:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
.music-disc {
  width: 36px; height: 36px; border-radius: 50%;
  background: linear-gradient(135deg, #4a5568, #2d3748);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  transition: box-shadow 0.3s;
}
.music-disc.spinning {
  animation: discSpin 3s linear infinite;
  box-shadow: 0 0 16px rgba(100, 130, 255, 0.4);
}
@keyframes discSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.disc-inner { width: 10px; height: 10px; border-radius: 50%; background: rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.2); }
.music-label { font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 400; letter-spacing: 0.3px; }

/* 关闭按钮 */
.close-btn {
  position: absolute; top: 4px; right: 4px;
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.4); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.3s;
}
.close-btn:hover { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); transform: rotate(90deg) scale(1.1); }

@media (max-width: 640px) {
  .gif-wrapper { width: 180px; height: 180px; }
  .easter-content { padding: 24px; }
  .star-item { font-size: 22px; }
}
</style>
