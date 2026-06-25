<template>
  <Teleport to="body">
    <Transition name="cake-fade">
      <div v-if="isBirthday" class="birthday-cake-container">
        <div class="cake-float-btn" @click="togglePanel" :title="panelOpen ? '收起蛋糕' : '为白雨轩点亮蜡烛'">
          <span class="cake-emoji">🎂</span>
          <span v-if="litCount > 0" class="candle-count">{{ litCount }}</span>
        </div>

        <Transition name="cake-panel">
          <div v-if="panelOpen" class="cake-panel" @click.stop>
            <div class="cake-panel-header">
              <h3>🎂 为白雨轩点亮生日蜡烛</h3>
              <button class="cake-close-btn" @click="panelOpen = false">✕</button>
            </div>
            <p class="cake-desc">点击蜡烛，送上你的生日祝福！每人限一根哦~</p>

            <!-- ===== 蛋糕主体 ===== -->
            <div class="cake-scene">
              <!-- 蛋糕顶部区域：蜡烛插在蛋糕上 -->
              <div class="cake-top-area">
                <div class="candles-on-cake">
                  <div
                    v-for="(candle, index) in candles"
                    :key="'on-' + index"
                    v-show="candle.lit"
                    class="candle-item"
                    :style="getCandleStyle(index)"
                  >
                    <div class="flame">
                      <div class="flame-core"></div>
                    </div>
                    <div class="candle-body"></div>
                    <div class="candle-label">{{ candle.wisher || '匿名' }}</div>
                  </div>
                </div>
              </div>

              <!-- 蛋糕层 -->
              <div class="cake-layers">
                <div class="layer top">
                  <div class="frosting-dots">
                    <span v-for="i in 6" :key="i" class="dot"></span>
                  </div>
                </div>
                <div class="layer middle">
                  <div class="ribbon"></div>
                </div>
                <div class="layer bottom"></div>
              </div>
              <div class="cake-plate"></div>
            </div>

            <!-- ===== 蜡烛选择区 ===== -->
            <div class="pick-section" v-if="myCandleIndex === null">
              <div class="pick-hint">✨ 点击下方蜡烛点亮祝福</div>
              <div class="candles-grid">
                <div
                  v-for="(candle, index) in candles"
                  :key="'pick-' + index"
                  class="pick-candle"
                  :class="{ 'is-lit': candle.lit }"
                  @click="lightCandle(index)"
                >
                  <div class="pick-stick"></div>
                  <div v-if="candle.lit" class="pick-badge">✓</div>
                </div>
              </div>
            </div>

            <!-- ===== 统计 ===== -->
            <div class="cake-footer">
              <div class="stats-text">
                已点亮 <strong>{{ litCount }}</strong> / {{ candles.length }} 根蜡烛
              </div>
              <div class="progress-track">
                <div class="progress-bar" :style="{ width: (litCount / candles.length * 100) + '%' }"></div>
              </div>
              <div v-if="myCandleIndex !== null" class="my-candle-msg">
                ✨ 你已点亮第 {{ myCandleIndex + 1 }} 根蜡烛，感谢你的祝福！
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const TOTAL_CANDLES = 20
const STORAGE_KEY = 'birthday_candles_2026'
const MY_CANDLE_KEY = 'birthday_my_candle_2026'

const isBirthday = ref(false)
const panelOpen = ref(false)
const candles = ref([])
const myCandleIndex = ref(null)

const litCount = computed(() => candles.value.filter(c => c.lit).length)

const togglePanel = () => {
  panelOpen.value = !panelOpen.value
}

// 计算蜡烛在蛋糕顶部的位置
const getCandleStyle = (index) => {
  const litIndices = candles.value.map((c, i) => c.lit ? i : -1).filter(i => i >= 0)
  const pos = litIndices.indexOf(index)
  if (pos === -1) return {}

  const total = litIndices.length
  const containerWidth = 200  // 蛋糕顶部宽度
  const candleWidth = 28      // 每根蜡烛占用的宽度

  if (total === 1) {
    return { left: '50%', transform: 'translateX(-50%)' }
  }

  // 计算起始位置，让所有蜡烛居中排列
  const totalWidth = total * candleWidth
  const startX = (containerWidth - totalWidth) / 2 + candleWidth / 2
  const x = startX + pos * candleWidth

  return {
    left: x + 'px',
    transform: 'translateX(-50%)',
    zIndex: 10 + pos
  }
}

const loadCandles = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      candles.value = JSON.parse(saved)
    } else {
      candles.value = Array.from({ length: TOTAL_CANDLES }, () => ({
        lit: false,
        wisher: ''
      }))
    }
    const myCandle = localStorage.getItem(MY_CANDLE_KEY)
    if (myCandle !== null) {
      myCandleIndex.value = parseInt(myCandle)
    }
  } catch (e) {
    candles.value = Array.from({ length: TOTAL_CANDLES }, () => ({ lit: false, wisher: '' }))
  }
}

const saveCandles = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(candles.value))
}

const lightCandle = (index) => {
  if (!isBirthday.value) return
  if (myCandleIndex.value !== null) return
  if (candles.value[index].lit) return

  const userName = localStorage.getItem('user')
    ? JSON.parse(localStorage.getItem('user')).name || JSON.parse(localStorage.getItem('user')).username || '匿名'
    : '匿名'

  candles.value[index].lit = true
  candles.value[index].wisher = userName
  myCandleIndex.value = index

  saveCandles()
  localStorage.setItem(MY_CANDLE_KEY, String(index))
}

onMounted(() => {
  const now = new Date()
  isBirthday.value = (now.getMonth() === 5 && now.getDate() === 25)
  if (isBirthday.value) {
    loadCandles()
  }
})
</script>

<style scoped>
.birthday-cake-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9990;
}

.cake-float-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff6b9d, #ff8e53);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(255, 107, 157, 0.4);
  transition: all 0.3s ease;
  position: relative;
}
.cake-float-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 28px rgba(255, 107, 157, 0.5);
}

.cake-emoji {
  font-size: 28px;
}

.candle-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ffd700;
  color: #333;
  font-size: 11px;
  font-weight: 700;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 面板 ===== */
.cake-panel {
  position: absolute;
  bottom: 70px;
  right: 0;
  width: 380px;
  background: linear-gradient(180deg, #fff9f0 0%, #fff0f5 40%, #f0f0ff 100%);
  border-radius: 20px;
  padding: 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 182, 193, 0.2);
}

.cake-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.cake-panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
  font-family: 'KaiTi', 'STKaiti', '楷体', serif;
}
.cake-close-btn {
  background: rgba(0,0,0,0.05);
  border: none;
  font-size: 16px;
  cursor: pointer;
  color: #999;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s;
}
.cake-close-btn:hover {
  color: #333;
  background: rgba(0,0,0,0.1);
}

.cake-desc {
  font-size: 13px;
  color: #999;
  margin: 0 0 20px;
  text-align: center;
}

/* ===== 蛋糕场景 ===== */
.cake-scene {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 16px;
}

/* 蛋糕顶部区域 - 蜡烛插在这里 */
.cake-top-area {
  position: relative;
  width: 200px;
  height: 0;
}

.candles-on-cake {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 200px;
  height: 60px;
}

.candle-item {
  position: absolute;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: candlePop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes candlePop {
  from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.5); }
  to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
}

.flame {
  width: 8px;
  height: 12px;
  background: radial-gradient(ellipse at bottom, #ffd700 0%, #ff8c00 50%, transparent 100%);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  animation: flicker 0.3s ease-in-out infinite alternate;
  position: relative;
  margin-bottom: 1px;
}
.flame-core {
  position: absolute;
  bottom: 1px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 5px;
  background: radial-gradient(ellipse, #fff 0%, #ffd700 100%);
  border-radius: 50%;
}

@keyframes flicker {
  0% { transform: scaleY(1) scaleX(1); opacity: 1; }
  100% { transform: scaleY(1.15) scaleX(0.85); opacity: 0.8; }
}

.candle-body {
  width: 5px;
  height: 22px;
  background: linear-gradient(180deg, #fff8dc, #ffe4b5);
  border-radius: 2px 2px 0 0;
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
}

.candle-label {
  font-size: 8px;
  color: #ff6b9d;
  margin-top: 2px;
  max-width: 40px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
  font-weight: 500;
}

/* ===== 蛋糕层 ===== */
.cake-layers {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 8px;
}
.layer {
  position: relative;
}
.layer.top {
  width: 120px;
  height: 28px;
  background: linear-gradient(180deg, #ffb6d3, #ff9ec6);
  border-radius: 6px 6px 0 0;
}
.frosting-dots {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 10px;
}
.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
}
.layer.middle {
  width: 150px;
  height: 30px;
  background: linear-gradient(180deg, #ffc8dd, #ffb0cc);
  overflow: hidden;
}
.ribbon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 14px;
  background: linear-gradient(90deg, #ff6b9d, #ffd700);
  border-radius: 7px;
  opacity: 0.6;
}
.layer.bottom {
  width: 180px;
  height: 34px;
  background: linear-gradient(180deg, #ffd4e5, #ffbdd4);
  border-radius: 0 0 10px 10px;
}

.cake-plate {
  width: 200px;
  height: 8px;
  background: linear-gradient(180deg, #e0e0e0, #ccc);
  border-radius: 0 0 50% 50% / 0 0 100% 100%;
  margin-top: -1px;
}

/* ===== 蜡烛选择区 ===== */
.pick-section {
  padding: 12px 0 0;
  border-top: 1px dashed rgba(255, 150, 180, 0.3);
  margin-bottom: 12px;
}

.pick-hint {
  text-align: center;
  font-size: 12px;
  color: #ff8e53;
  margin-bottom: 10px;
  font-weight: 500;
}

.candles-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.pick-candle {
  width: 34px;
  height: 42px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 8px;
  background: rgba(255, 215, 0, 0.08);
  border: 1.5px solid rgba(255, 215, 0, 0.2);
  transition: all 0.25s ease;
  position: relative;
}
.pick-candle:hover {
  transform: translateY(-3px);
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.15);
  box-shadow: 0 4px 12px rgba(255, 215, 0, 0.2);
}
.pick-candle.is-lit {
  background: rgba(255, 107, 157, 0.08);
  border-color: rgba(255, 107, 157, 0.2);
  cursor: default;
  opacity: 0.5;
}
.pick-candle.is-lit:hover {
  transform: none;
  box-shadow: none;
}

.pick-stick {
  width: 5px;
  height: 22px;
  background: linear-gradient(180deg, #ffe4b5, #ffd700);
  border-radius: 2px 2px 0 0;
}

.pick-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 10px;
  color: #ff6b9d;
  font-weight: 700;
}

/* ===== 底部统计 ===== */
.cake-footer {
  text-align: center;
}

.stats-text {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}
.stats-text strong {
  color: #ff6b9d;
  font-size: 16px;
}

.progress-track {
  width: 100%;
  height: 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #ff6b9d, #ffd700);
  border-radius: 3px;
  transition: width 0.5s ease;
}

.my-candle-msg {
  font-size: 13px;
  color: #ff8e53;
  font-weight: 500;
  padding: 8px 12px;
  background: rgba(255, 142, 83, 0.08);
  border-radius: 8px;
}

/* ===== 动画过渡 ===== */
.cake-fade-enter-active { animation: cakeFadeIn 0.4s ease; }
.cake-fade-leave-active { animation: cakeFadeIn 0.3s ease reverse; }
@keyframes cakeFadeIn { from { opacity: 0; } to { opacity: 1; } }

.cake-panel-enter-active { animation: cakePanelIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.cake-panel-leave-active { animation: cakePanelIn 0.2s ease reverse; }
@keyframes cakePanelIn {
  from { opacity: 0; transform: translateY(20px) scale(0.9); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (max-width: 440px) {
  .cake-panel {
    width: calc(100vw - 48px);
    right: -12px;
  }
}
</style>
