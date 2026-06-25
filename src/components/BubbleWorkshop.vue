<template>
  <div class="bubble-workshop" ref="containerRef">
    <!-- 游戏画布 -->
    <canvas
      ref="canvasRef"
      class="game-canvas"
      :class="{ 'pending-item-mode': isPendingItemMode }"
      style="touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none;"
      @contextmenu.prevent
    ></canvas>

    <!-- 道具待确认提示 -->
    <div class="pending-item-hint" v-if="isPendingItemMode && gameState === 'playing'">
      <span v-if="pendingAreaClear">💥 点击选择清除位置</span>
      <span v-else-if="pendingLightningChain">⚡ 点击选择目标泡泡</span>
    </div>

    <!-- 顶部 HUD -->
    <div class="hud" v-if="gameState === 'playing' || gameState === 'paused'">
      <div class="hud-left">
        <div class="mode-badge" :class="mode">{{ modeLabel }}</div>
        <div class="score-display">
          <span class="score-value">{{ score }}</span>
        </div>
      </div>
      <div class="hud-center">
        <div class="hud-item swap-indicator" @click.stop="swapBubble" title="切换泡泡">
          <span class="swap-icon">&#8644;</span>
          <span class="swap-count">{{ swapCount }}</span>
        </div>
        <!-- 排位赛对手信息 -->
        <div class="opponent-hud" v-if="mode === 'ranked' && opponent">
          <div class="opponent-hud-divider">VS</div>
          <div class="opponent-hud-info">
            <span class="opponent-hud-name">{{ opponent.opponent_name }}</span>
            <span class="opponent-hud-score">{{ opponent.opponent_score.toLocaleString() }}</span>
          </div>
        </div>
      </div>
      <div class="hud-right">
        <div class="hud-item bubble-count">
          {{ bubbleCount }}
        </div>
        <button class="hud-btn" @click.stop="togglePause" :title="gameState === 'paused' ? '继续' : '暂停'">
          <span v-if="gameState === 'paused'">&#9654;</span>
          <span v-else>&#10074;&#10074;</span>
        </button>
      </div>
    </div>

    <!-- V3: 道具快捷栏（显示所有拥有的道具） -->
    <div class="quick-item-bar" v-if="gameState === 'playing' && hasAnyItems" @click.stop>
      <button
        v-for="item in quickItems"
        :key="item.id"
        class="quick-item-btn"
        :class="'tier-' + item.tier"
        :title="item.name + '：' + item.desc + '（剩余' + item.count + '个）'"
        @click="useQuickItem(item.id)"
      >
        <span class="qi-icon">{{ item.icon }}</span>
        <span class="qi-badge" v-if="item.count > 1">{{ item.count }}</span>
      </button>
    </div>

    <!-- 菜单界面 -->
    <div class="overlay menu-overlay" v-if="gameState === 'menu'">
      <div class="menu-card">
        <div class="menu-logo">
          <div class="logo-bubbles">
            <span class="lb lb-1"></span>
            <span class="lb lb-2"></span>
            <span class="lb lb-3"></span>
          </div>
          <h1 class="game-title">泡泡工坊</h1>
          <p class="game-subtitle">Bubble Workshop V3</p>
        </div>

        <div class="mode-list">
          <button class="mode-btn" :class="{ active: selectedMode === 'classic' }" @click="selectedMode = 'classic'">
            <div class="mode-icon-wrap classic-icon"><span>&#127919;</span></div>
            <div class="mode-info">
              <span class="mode-name">经典模式</span>
              <span class="mode-desc">泡泡堆积，挑战最高分</span>
            </div>
          </button>
          <button class="mode-btn" :class="{ active: selectedMode === 'zen' }" @click="selectedMode = 'zen'">
            <div class="mode-icon-wrap zen-icon"><span>&#129495;</span></div>
            <div class="mode-info">
              <span class="mode-name">禅意模式</span>
              <span class="mode-desc">无失败，纯粹的放松</span>
            </div>
          </button>
          <button class="mode-btn ranked-entry" :class="{ active: selectedMode === 'ranked' }" @click="selectedMode = 'ranked'">
            <div class="mode-icon-wrap ranked-icon"><span>&#9876;</span></div>
            <div class="mode-info">
              <span class="mode-name">排位赛</span>
              <span class="mode-desc">匹配对手，赢得积分晋升段位</span>
            </div>
            <span class="mode-tag ranked-entry-tag">排位</span>
          </button>
        </div>

        <div class="menu-actions">
          <button class="start-btn" @click="startGame(selectedMode)">开始游戏</button>
          <button class="shop-btn" @click="showShop = true">
            &#128722; 道具商店
            <span class="gold-badge">{{ gold }}</span>
          </button>
        </div>

        <!-- 游戏通告 -->
        <div class="game-announcements" v-if="announcements.length > 0">
          <div class="ann-title">&#128276; 游戏公告</div>
          <div class="ann-list">
            <div class="ann-item" v-for="a in announcements" :key="a.id" :class="'ann-' + a.ann_type">
              <span class="ann-tag">{{ annTypeLabel(a.ann_type) }}</span>
              <span class="ann-title-text">{{ a.title }}</span>
              <span class="ann-content">{{ a.content }}</span>
            </div>
          </div>
        </div>

        <div class="menu-footer">
          <div class="best-score" v-if="highScore > 0">
            <span class="best-label">历史最高</span>
            <span class="best-value">{{ highScore }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 暂停界面 -->
    <div class="overlay pause-overlay" v-if="gameState === 'paused'">
      <div class="overlay-card">
        <div class="overlay-icon">&#9208;</div>
        <h2>游戏暂停</h2>
        <div class="overlay-score">
          <span class="overlay-score-label">当前分数</span>
          <span class="overlay-score-value">{{ score }}</span>
        </div>
        <div class="overlay-actions">
          <button class="action-btn primary" @click="togglePause">继续游戏</button>
          <button class="action-btn ghost" @click="backToMenu">返回菜单</button>
        </div>
      </div>
    </div>

    <!-- 游戏结束界面 -->
    <div class="overlay gameover-overlay" v-if="gameState === 'game_over'">
      <div class="overlay-card">
        <div class="overlay-icon gameover-icon" v-if="mode !== 'ranked'">&#127942;</div>
        <div class="overlay-icon gameover-icon" v-else>{{ rankedResult?.won ? '🎉' : '😞' }}</div>
        <h2 v-if="mode !== 'ranked'">游戏结束</h2>
        <h2 v-else>{{ rankedResult?.won ? '胜利！' : '失败' }}</h2>

        <!-- 排位赛结果 -->
        <template v-if="mode === 'ranked' && rankedResult">
          <div class="ranked-vs">
            <div class="vs-side vs-you"><div class="vs-label">你</div><div class="vs-score">{{ score.toLocaleString() }}</div></div>
            <div class="vs-divider">VS</div>
            <div class="vs-side vs-opponent"><div class="vs-label">{{ opponent?.opponent_name || '对手' }}</div><div class="vs-score">{{ opponent?.opponent_score.toLocaleString() }}</div></div>
          </div>
          <div class="ranked-score-change" :class="{ won: rankedResult.won }">
            <template v-if="rankedResult.won">
              +{{ rankedResult.score.toLocaleString() }} 积分
              <span v-if="rankedResult.streakBonus > 0" class="streak-bonus">+{{ rankedResult.streakBonus.toLocaleString() }} 连胜</span>
            </template>
            <template v-else>+0 积分</template>
          </div>
          <div class="ranked-promo" v-if="rankedResult.isPromotion">🎉 晋升 {{ rankedResult.newTier }}</div>
          <div class="ranked-progress-bar">
            <div class="ranked-progress-label"><span>{{ rankedResult.newTier }}</span><span v-if="rankedResult.nextTier">{{ rankedResult.nextTier }}</span></div>
            <div class="ranked-progress-track"><div class="ranked-progress-fill" :style="{ width: rankedResult.progress + '%' }"></div></div>
            <div class="ranked-progress-text">{{ rankedResult.newTotalScore.toLocaleString() }}<span v-if="rankedResult.nextTierMin"> / {{ rankedResult.nextTierMin.toLocaleString() }}</span></div>
          </div>
        </template>

        <!-- 普通模式结果 -->
        <template v-else>
          <div class="overlay-score">
            <span class="overlay-score-label">最终得分</span>
            <span class="overlay-score-value">{{ score }}</span>
          </div>
          <div class="new-record-badge" v-if="score >= highScore && score > 0"><span>&#11088;</span> 新纪录</div>
          <div class="best-score-inline">历史最高: {{ highScore }}</div>
          <div class="rank-badge" v-if="rankInfo"><span>&#127775;</span> 排名 #{{ rankInfo.rank }}</div>
        </template>

        <div class="overlay-actions">
          <button class="action-btn primary" @click="restartGame">{{ mode === 'ranked' ? '再来一场排位' : '再来一局' }}</button>
          <button class="action-btn ghost" @click="backToMenu">返回菜单</button>
        </div>
      </div>
    </div>

    <!-- 操作提示 -->
    <div class="controls-hint" v-if="gameState === 'playing' && showHint">
      <div class="hint-row"><span class="hint-key">移动鼠标</span><span class="hint-sep">瞄准</span></div>
      <div class="hint-row"><span class="hint-key">点击</span><span class="hint-sep">发射泡泡</span><span class="hint-key">连点</span><span class="hint-sep">连续发射</span></div>
    </div>

    <!-- 双彩虹融合提示 -->
    <div class="fusion-toast" v-if="fusionToast" :class="{ 'double-rainbow': fusionToast.isDouble }">
      <span class="toast-icon">{{ fusionToast.isDouble ? '🌈🌈' : '✨' }}</span>
      <span class="toast-text">{{ fusionToast.text }}</span>
    </div>

    <!-- V3: 道具商店弹窗 -->
    <Teleport to="body">
      <div v-if="showShop" class="shop-overlay" @click.self="showShop = false">
        <div class="shop-modal">
          <div class="shop-header">
            <h2>&#128722; 道具商店</h2>
            <div class="shop-gold">&#128176; {{ gold }}</div>
            <button class="shop-close" @click="showShop = false">&times;</button>
          </div>
          <div class="shop-tabs">
            <button class="shop-tab" :class="{ active: shopTab === 'all' }" @click="shopTab = 'all'">全部</button>
            <button class="shop-tab" :class="{ active: shopTab === 'common' }" @click="shopTab = 'common'">普通</button>
            <button class="shop-tab" :class="{ active: shopTab === 'rare' }" @click="shopTab = 'rare'">稀有</button>
            <button class="shop-tab" :class="{ active: shopTab === 'epic' }" @click="shopTab = 'epic'">史诗</button>
            <button class="shop-tab" :class="{ active: shopTab === 'legendary' }" @click="shopTab = 'legendary'">传说</button>
          </div>
          <div class="shop-items">
            <div v-for="item in filteredShopItems" :key="item.id" class="shop-item" :class="'tier-' + item.tier">
              <div class="shop-item-icon">{{ item.icon }}</div>
              <div class="shop-item-info">
                <div class="shop-item-name">{{ item.name }}<span class="shop-item-tier" :class="'tier-' + item.tier">{{ tierLabels[item.tier] }}</span></div>
                <div class="shop-item-desc">{{ item.desc }}</div>
                <div class="shop-item-own">拥有: {{ backpack[item.id] || 0 }}</div>
              </div>
              <button class="shop-buy-btn" @click="buyItemFn(item.id)" :disabled="gold < item.price">&#128176; {{ item.price }}</button>
            </div>
          </div>
          <div v-if="shopMessage" class="shop-message" :class="{ error: shopMsgError }">{{ shopMessage }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import GameEngine from '../game/engine.js'
import { GAME_MODES, ITEM_SHOP, GAME_STATES, CANVAS_WIDTH, CANVAS_HEIGHT } from '../game/config.js'
import shop from '../game/shop.js'
import { submitScore, getLeaderboard, getRankedOpponent, submitRankedMatch, getUserGold, getUserItems, syncGameData, purchaseItem, useGameItem, addGameGold, getActiveAnnouncements } from '../api/game.js'

const props = defineProps({
  width: { type: Number, default: 400 },
  height: { type: Number, default: 700 },
  gameSettings: { type: Object, default: () => ({}) },
  currentUser: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['scoreChange', 'gameOver', 'stateChange', 'scoreSubmitted', 'rankedResult'])

const containerRef = ref(null)
const canvasRef = ref(null)

const gameState = ref(GAME_STATES.MENU)
const score = ref(0)
const highScore = ref(parseInt(localStorage.getItem('bubble_workshop_high') || '0'))
const mode = ref('classic')
const selectedMode = ref('classic')
const swapCount = ref(3)
const bubbleCount = ref(0)
const showHint = ref(true)
const rankInfo = ref(null)
const scoreSubmitting = ref(false)
const opponent = ref(null)
const rankedResult = ref(null)
const rankedLoading = ref(false)
const showShop = ref(false)
const gold = ref(0)
const announcements = ref([])
const shopMessage = ref('')
const shopItems = ref(ITEM_SHOP)
const backpack = ref({})
const pendingAreaClear = ref(false)
const pendingLightningChain = ref(false)
const fusionToast = ref(null)

// V3: 快捷道具栏
const quickItems = ref([])
const hasAnyItems = ref(false)

function refreshQuickItems() {
  const items = shop.getItems()
  const all = ITEM_SHOP.map(si => ({
    id: si.id, name: si.name, icon: si.icon, tier: si.tier,
    desc: si.desc, count: items[si.id] || 0,
  })).filter(i => i.count > 0)
  quickItems.value = all
  hasAnyItems.value = all.length > 0
}

async function useQuickItem(itemId) {
  if (!game || game.state !== 'playing') return
  const result = game.useItem(itemId)
  if (result.success) {
    refreshQuickItems()
    syncPendingState()
  }
}

const modeLabel = computed(() => {
  const labels = { classic: '经典', zen: '禅意', ranked: '排位赛' }
  return labels[mode.value] || '经典'
})

const isPendingItemMode = computed(() => {
  return pendingAreaClear.value || pendingLightningChain.value
})

let game = null
let hintTimer = null
let bubbleCountInterval = null

function getCanvasCoords(event) {
  const rect = canvasRef.value.getBoundingClientRect()
  const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? event.changedTouches?.[0]?.clientX
  const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? event.changedTouches?.[0]?.clientY
  return {
    x: (clientX - rect.left) * (CANVAS_WIDTH / rect.width),
    y: (clientY - rect.top) * (CANVAS_HEIGHT / rect.height),
  }
}

function onCanvasMouseDown(event) {
  if (!game || game.state !== 'playing') return
  // 道具模式：按需处理
  if (handlePendingItem(event)) return
  // 引擎自己处理发射（通过 _bindInput 绑定的 mousedown）
}

function handlePendingItem(event) {
  if (!game) return false
  const { x: canvasX, y: canvasY } = getCanvasCoords(event)

  if (game.isPendingAreaClear()) {
    game.areaClearAt(canvasX, canvasY)
    syncPendingState()
    return true
  }
  if (game.isPendingLightningChain()) {
    const allBubbles = game.physics.getAllBubbles()
    let nearest = null, minDist = Infinity
    for (const b of allBubbles) {
      const dx = b.body.position.x - canvasX, dy = b.body.position.y - canvasY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < minDist) { minDist = dist; nearest = b }
    }
    if (nearest) game.lightningChain(nearest)
    syncPendingState()
    return true
  }
  return false
}

function syncPendingState() {
  if (game) {
    pendingAreaClear.value = game.isPendingAreaClear()
    pendingLightningChain.value = game.isPendingLightningChain()
  }
}

function setupCanvasEvents() {
  const canvas = canvasRef.value
  if (!canvas) return
  // 只拦截道具相关点击，发射由引擎处理
  canvas.addEventListener('mousedown', onCanvasMouseDown)
}

function cleanupCanvasEvents() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.removeEventListener('mousedown', onCanvasMouseDown)
}

function showFusionToast(text, isDouble = false) {
  fusionToast.value = { text, isDouble }
  setTimeout(() => { fusionToast.value = null }, 2500)
}

onMounted(async () => {
  shop.bindApi({ getUserGold, getUserItems, syncGameData, purchaseItem, useGameItem, addGameGold })
  await shop.loadFromServer()

  // 加载游戏通告
  loadAnnouncements()

  nextTick(() => {
    if (canvasRef.value) {
      game = new GameEngine(canvasRef.value, props.gameSettings)
      setupCanvasEvents()

      game.onScoreChange = (s) => {
        score.value = s
        emit('scoreChange', s)
      }

      game.onRainbowFusion = (data) => {
        showFusionToast(`彩虹融合! +${data.finalScore}`, false)
      }

      game.onDoubleRainbowFusion = (data) => {
        showFusionToast(`双彩虹融合!! +${data.finalScore}`, true)
      }

      game.onGameOver = async (s, h, gameMode) => {
        highScore.value = h
        emit('gameOver', s, h, gameMode)

        if (s <= 0 || scoreSubmitting.value) return
        scoreSubmitting.value = true

        try {
          if (gameMode === 'ranked' && opponent.value) {
            const res = await submitRankedMatch({
              score: s, opponent_type: opponent.value.opponent_type,
              opponent_score: opponent.value.opponent_score, opponent_name: opponent.value.opponent_name,
            })
            rankedResult.value = res.data
            emit('rankedResult', res.data)
          } else {
            await submitScore({ score: s, mode: gameMode || mode.value })
            await fetchRank()
            emit('scoreSubmitted', { score: s, mode: gameMode || mode.value })
          }
          await shop.syncToServer()
        } catch (e) {
          console.warn('提交失败:', e.message)
          if (gameMode !== 'ranked') emit('scoreSubmitted', { score: s, mode: gameMode || mode.value })
        } finally {
          scoreSubmitting.value = false
        }
      }

      game.onStateChange = (state) => {
        gameState.value = state
        emit('stateChange', state)
        pendingAreaClear.value = false
        pendingLightningChain.value = false
        if (state === 'playing') {
          startBubbleCountSync()
          showHint.value = true
          rankInfo.value = null
          if (hintTimer) clearTimeout(hintTimer)
          hintTimer = setTimeout(() => { showHint.value = false }, 6000)
        } else if (state === 'game_over') {
          stopBubbleCountSync()
        } else {
          stopBubbleCountSync()
        }
      }
    }
  })
  refreshShop()
})

onBeforeUnmount(() => {
  _shopUnsub()
  cleanupCanvasEvents()
  if (game) game.destroy()
  if (hintTimer) clearTimeout(hintTimer)
  stopBubbleCountSync()
})

async function fetchRank() {
  try {
    const res = await getLeaderboard({ mode: mode.value, limit: 100 })
    const list = res.data || []
    for (let i = 0; i < list.length; i++) {
      if (list[i].score <= score.value) { rankInfo.value = { rank: i + 1 }; return }
    }
    rankInfo.value = { rank: list.length + 1 }
  } catch (e) { /* 静默 */ }
}

function startBubbleCountSync() {
  stopBubbleCountSync()
  bubbleCountInterval = setInterval(() => {
    if (game) {
      bubbleCount.value = game.getBubbleCount()
      swapCount.value = game.getSwapCount()
      syncPendingState()
    }
  }, 200)
}

function stopBubbleCountSync() {
  if (bubbleCountInterval) { clearInterval(bubbleCountInterval); bubbleCountInterval = null }
}

async function startGame(gameMode) {
  mode.value = gameMode
  pendingAreaClear.value = false
  pendingLightningChain.value = false

  if (gameMode === 'ranked') {
    rankedLoading.value = true
    try {
      const res = await getRankedOpponent()
      opponent.value = res.data
    } catch (e) {
      console.warn('匹配对手失败:', e.message)
      opponent.value = null
    } finally { rankedLoading.value = false }
  } else {
    opponent.value = null
    rankedResult.value = null
  }

  refreshQuickItems()
  game.start(gameMode)
}

function restartGame() {
  rankedResult.value = null
  pendingAreaClear.value = false
  pendingLightningChain.value = false
  game.start(mode.value)
}

function togglePause() { game.togglePause() }
function backToMenu() { game.backToMenu() }

async function loadAnnouncements() {
  try {
    const res = await getActiveAnnouncements()
    announcements.value = res.data || []
  } catch (e) { /* 静默失败 */ }
}

function annTypeLabel(t) {
  return { notice: '通知', event: '活动', reward: '奖励' }[t] || t
}

function swapBubble() {
  if (game && game.state === 'playing' && game.getSwapCount() > 0) {
    game._swapBubble()
    swapCount.value = game.getSwapCount()
  }
}

// ===== V3: 道具商店 =====
const shopTab = ref('all')
const shopMsgError = ref(false)
const tierLabels = { common: '普通', rare: '稀有', epic: '史诗', legendary: '传说' }

const filteredShopItems = computed(() => {
  if (shopTab.value === 'all') return shopItems.value
  return shopItems.value.filter(i => i.tier === shopTab.value)
})

function refreshShop() {
  gold.value = shop.getGold()
  backpack.value = shop.getItems()
  refreshQuickItems()
}

async function buyItemFn(itemId) {
  const result = await shop.buyItemOnline(itemId)
  if (result.success) {
    shopMessage.value = `购买成功: ${result.item.name}`
    shopMsgError.value = false
    refreshShop()
    setTimeout(() => { shopMessage.value = '' }, 2000)
  } else {
    shopMessage.value = result.error
    shopMsgError.value = true
    setTimeout(() => { shopMessage.value = '' }, 2000)
  }
}

const _shopUnsub = shop.onChange(() => refreshShop())
</script>

<style scoped>
.bubble-workshop{position:relative;width:100%;max-width:400px;margin:0 auto;user-select:none;-webkit-user-select:none;font-family:'Noto Sans SC',-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}
.game-canvas{display:block;width:100%;height:auto;border-radius:20px;box-shadow:0 2px 8px rgba(0,0,0,0.05),0 8px 32px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.04);cursor:crosshair;-webkit-tap-highlight-color:transparent;-webkit-touch-callout:none;touch-action:manipulation}
.hud{position:absolute;top:0;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-start;padding:12px 14px;pointer-events:none;z-index:10}
.hud-left{display:flex;flex-direction:column;gap:6px}
.mode-badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:.04em;width:fit-content;box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.mode-badge.classic{background:rgba(232,120,74,0.9);color:#fff}
.mode-badge.zen{background:rgba(120,200,140,0.9);color:#fff}
.mode-badge.ranked{background:rgba(102,126,234,0.9);color:#fff}
.mode-badge.dungeon{background:rgba(255,107,107,0.9);color:#fff}
.score-display{display:flex;align-items:baseline}
.score-value{font-size:30px;font-weight:800;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,0.3);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.hud-center{display:flex;align-items:center;padding-top:2px}
.swap-indicator{pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:6px 12px;border-radius:20px;border:1px solid rgba(255,255,255,0.18);box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:all .15s}
.swap-indicator:active{transform:scale(0.9);background:rgba(255,255,255,0.45)}
.swap-icon{font-size:15px;color:#fff;line-height:1}
.swap-count{font-size:12px;font-weight:700;color:rgba(255,255,255,0.85);font-variant-numeric:tabular-nums}
.opponent-hud{display:flex;align-items:center;gap:6px;background:rgba(0,0,0,0.35);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:4px 10px;border-radius:14px;border:1px solid rgba(255,255,255,0.12);margin-left:4px}
.opponent-hud-divider{font-size:10px;font-weight:800;color:rgba(255,255,255,0.6);letter-spacing:.05em}
.opponent-hud-info{display:flex;flex-direction:column;align-items:center;line-height:1.1}
.opponent-hud-name{font-size:10px;font-weight:600;color:rgba(255,255,255,0.85);max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.opponent-hud-score{font-size:12px;font-weight:700;color:#FFE66D;font-variant-numeric:tabular-nums}
.hud-right{display:flex;align-items:center;gap:6px;padding-top:2px}
.hud-item{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,0.22);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:5px 11px;border-radius:16px;color:#fff;font-size:13px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.12);box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.bubble-count{font-size:11px;font-weight:500}
.hud-btn{pointer-events:auto;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.22);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;line-height:1;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.hud-btn:hover{background:rgba(255,255,255,0.38)}
.hud-btn:active{transform:scale(0.88)}
.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:20;border-radius:20px;overflow:hidden}
.menu-overlay{background:linear-gradient(160deg,rgba(255,250,244,0.98) 0%,rgba(255,238,222,0.98) 100%);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.pause-overlay,.gameover-overlay{background:rgba(40,38,34,0.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.menu-card{text-align:center;padding:2rem 1.5rem 1.75rem;width:100%;max-width:320px}
.menu-logo{margin-bottom:1.5rem}
.logo-bubbles{display:flex;justify-content:center;gap:8px;margin-bottom:14px;height:26px;align-items:flex-end}
.lb{display:block;border-radius:50%;animation:float 3s ease-in-out infinite;box-shadow:0 2px 6px rgba(0,0,0,0.08)}
.lb-1{width:18px;height:18px;background:linear-gradient(135deg,#FF9E9E,#FF6B6B);animation-delay:0s}
.lb-2{width:26px;height:26px;background:linear-gradient(135deg,#8AE3DD,#4ECDC4);animation-delay:0.3s}
.lb-3{width:14px;height:14px;background:linear-gradient(135deg,#FFF4B0,#FFE66D);animation-delay:0.6s}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.game-title{font-size:1.85rem;font-weight:800;color:#2D2A26;margin:0;letter-spacing:.08em;line-height:1.3}
.game-subtitle{font-size:.72rem;color:#A09890;margin:6px 0 0;letter-spacing:.2em;text-transform:uppercase;font-weight:500}
.mode-list{display:flex;flex-direction:column;gap:10px;margin-bottom:1.5rem}
.mode-btn{position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;border:2px solid #EDE5DA;border-radius:16px;background:#fff;cursor:pointer;transition:all .2s ease;text-align:left;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
.mode-btn:hover{border-color:#D8CCC0;transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,0.06)}
.mode-btn.active{border-color:#D46838;background:linear-gradient(135deg,#FFF8F4,#FFF0E6);box-shadow:0 2px 16px rgba(232,120,74,0.15)}
.mode-tag{padding:2px 10px;font-size:.6rem;font-weight:700;color:#fff;border-radius:10px;line-height:1.4;white-space:nowrap}
.mode-icon-wrap{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.classic-icon{background:linear-gradient(135deg,#FFE8D6,#FFD0B4)}
.zen-icon{background:linear-gradient(135deg,#D6F0DA,#B4E6BE)}
.ranked-icon{background:linear-gradient(135deg,#e8e4ff,#d4ccff)!important}
.dungeon-icon{background:linear-gradient(135deg,#ffe0e0,#ffc8c8)}
.mode-info{display:flex;flex-direction:column;justify-content:center;gap:3px;min-height:44px}
.mode-name{font-size:.95rem;font-weight:700;color:#2D2A26;line-height:1.3}
.mode-desc{font-size:.78rem;color:#A09890;line-height:1.4}
.ranked-entry{border-color:#667eea!important;background:linear-gradient(135deg,#f8f6ff,#f0ecff)!important}
.ranked-entry:hover{border-color:#764ba2!important;box-shadow:0 4px 20px rgba(102,126,234,0.2)!important}
.ranked-entry.active{border-color:#667eea!important;background:linear-gradient(135deg,#edebff,#e0d8ff)!important;box-shadow:0 2px 20px rgba(102,126,234,0.25)!important}
.ranked-entry-tag{background:linear-gradient(135deg,#667eea,#764ba2);box-shadow:0 2px 8px rgba(102,126,234,0.4);animation:tagPulse 2s ease-in-out infinite}
.dungeon-entry{border-color:rgba(255,107,107,0.3)}
.dungeon-entry:hover{border-color:rgba(255,107,107,0.6);background:rgba(255,107,107,0.08)}
.dungeon-tag{background:linear-gradient(135deg,#FF6B6B,#E05555);color:#fff;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:6px}
@keyframes tagPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.start-btn{width:100%;padding:15px;border:none;border-radius:14px;background:linear-gradient(135deg,#E8784A 0%,#D46838 100%);color:#fff;font-size:1rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s ease;letter-spacing:.06em;box-shadow:0 4px 20px rgba(232,120,74,0.35)}
.start-btn:hover{transform:translateY(-1px);box-shadow:0 6px 28px rgba(232,120,74,0.45)}
.start-btn:active{transform:translateY(0);box-shadow:0 2px 10px rgba(232,120,74,0.3)}
.menu-footer{margin-top:1.25rem}
.best-score{display:inline-flex;align-items:center;gap:10px;padding:6px 18px;background:rgba(232,120,74,0.06);border:1px solid rgba(232,120,74,0.1);border-radius:20px}
.best-label{font-size:.72rem;color:#A09890;font-weight:500}
.best-value{font-size:.95rem;font-weight:700;color:#D46838;font-variant-numeric:tabular-nums}
.overlay-card{text-align:center;padding:2rem 2rem 1.75rem;background:rgba(255,255,255,0.97);border-radius:20px;width:calc(100% - 48px);max-width:300px;box-shadow:0 16px 48px rgba(0,0,0,0.18)}
.overlay-icon{font-size:2.5rem;margin-bottom:4px;line-height:1.2}
.gameover-icon{font-size:3rem}
.overlay-card h2{font-size:1.2rem;font-weight:700;color:#2D2A26;margin:0 0 8px;letter-spacing:.02em}
.overlay-score{display:flex;flex-direction:column;align-items:center;margin:20px 0 16px}
.overlay-score-label{font-size:.72rem;color:#A09890;text-transform:uppercase;letter-spacing:.12em;font-weight:500}
.overlay-score-value{font-size:2.6rem;font-weight:800;color:#D46838;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1}
.new-record-badge{display:inline-flex;align-items:center;gap:4px;padding:5px 16px;background:linear-gradient(135deg,#FFE66D,#FFB8D0);border-radius:20px;font-size:.78rem;font-weight:700;color:#2D2A26;margin-bottom:6px;animation:glow 2s ease-in-out infinite}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 rgba(255,182,208,0.4)}50%{box-shadow:0 0 0 8px rgba(255,182,208,0)}}
.rank-badge{display:inline-flex;align-items:center;gap:4px;padding:5px 16px;background:rgba(78,170,196,0.12);border:1px solid rgba(78,170,196,0.25);border-radius:20px;font-size:.78rem;font-weight:700;color:#3A8AA0;margin-bottom:6px}
.best-score-inline{font-size:.78rem;color:#A09890;margin-bottom:6px;font-weight:500}
.ranked-vs{display:flex;align-items:center;justify-content:center;gap:12px;margin:16px 0;padding:12px;background:#f8f6f4;border-radius:14px}
.vs-side{text-align:center}
.vs-label{font-size:.7rem;color:#A09890;font-weight:500;margin-bottom:2px}
.vs-score{font-size:1.3rem;font-weight:800;color:#2D2A26;font-variant-numeric:tabular-nums}
.vs-divider{font-size:.8rem;font-weight:800;color:#D46838;background:rgba(212,104,56,0.1);padding:6px 10px;border-radius:10px}
.ranked-score-change{font-size:1.1rem;font-weight:700;margin-bottom:8px;color:#A09890}
.ranked-score-change.won{color:#4ECDC4}
.streak-bonus{display:block;font-size:.75rem;color:#FF6B6B;font-weight:600;margin-top:2px}
.ranked-promo{display:inline-block;padding:6px 16px;background:linear-gradient(135deg,#FFE66D,#FFB8D0);border-radius:20px;font-size:.8rem;font-weight:700;color:#2D2A26;margin-bottom:12px;animation:glow 2s ease-in-out infinite}
.ranked-progress-bar{width:100%;margin-bottom:8px}
.ranked-progress-label{display:flex;justify-content:space-between;font-size:.65rem;color:#A09890;font-weight:500;margin-bottom:4px}
.ranked-progress-track{width:100%;height:8px;background:#f0ece4;border-radius:4px;overflow:hidden;margin-bottom:4px}
.ranked-progress-fill{height:100%;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:4px;transition:width .8s cubic-bezier(0.4,0,0.2,1)}
.ranked-progress-text{font-size:.65rem;color:#A09890;font-weight:500;font-variant-numeric:tabular-nums}
.overlay-actions{display:flex;flex-direction:column;gap:10px}
.action-btn{padding:13px 20px;border-radius:12px;border:none;background:#fff;color:#2D2A26;font-size:.92rem;font-weight:600;font-family:inherit;cursor:pointer;transition:all .15s;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.action-btn:hover{background:#F8F4F0}
.action-btn:active{transform:scale(0.97)}
.action-btn.primary{background:linear-gradient(135deg,#E8784A,#D46838);color:#fff;box-shadow:0 3px 14px rgba(232,120,74,0.3)}
.action-btn.primary:hover{box-shadow:0 5px 22px rgba(232,120,74,0.4)}
.action-btn.ghost{background:rgba(255,255,255,0.6);color:#8A827A;box-shadow:none}
.action-btn.ghost:hover{background:rgba(255,255,255,0.85);color:#5A5550}
.controls-hint{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(40,38,34,0.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:10px 18px;border-radius:14px;pointer-events:none;z-index:10;transition:opacity .6s;box-shadow:0 2px 12px rgba(0,0,0,0.1)}
.hint-row{display:flex;align-items:center;gap:5px;color:rgba(255,255,255,0.7);font-size:.76rem;font-weight:500}
.hint-key{display:inline-block;padding:2px 7px;background:rgba(255,255,255,0.14);border-radius:5px;font-weight:600;color:rgba(255,255,255,0.9);font-size:.74rem}
.hint-sep{color:rgba(255,255,255,0.35);font-size:.68rem}
.menu-actions{display:flex;flex-direction:column;gap:10px;margin-top:16px}
.shop-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 20px;background:linear-gradient(135deg,#FFB800,#FF8C00);color:#fff;border:none;border-radius:12px;font-size:.95rem;font-weight:700;font-family:inherit;cursor:pointer;transition:all .2s;box-shadow:0 2px 8px rgba(255,184,0,0.3)}
.shop-btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(255,184,0,0.4)}
.gold-badge{background:rgba(0,0,0,0.2);padding:2px 10px;border-radius:999px;font-size:.85rem;min-width:40px;text-align:center}
.shop-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px}
.shop-modal{background:#1E1E2E;border:1px solid rgba(255,255,255,0.1);border-radius:16px;width:100%;max-width:480px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden}
.shop-header{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08)}
.shop-header h2{font-size:1.1rem;font-weight:700;color:#fff;margin:0;flex:1}
.shop-gold{font-size:1rem;font-weight:700;color:#FFB800}
.shop-close{background:none;border:none;color:rgba(255,255,255,0.5);font-size:1.5rem;cursor:pointer;padding:0 4px;line-height:1}
.shop-close:hover{color:#fff}
.shop-tabs{display:flex;gap:4px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);overflow-x:auto}
.shop-tab{padding:6px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:rgba(255,255,255,0.6);font-size:.82rem;font-family:inherit;cursor:pointer;white-space:nowrap;transition:all .15s}
.shop-tab:hover{background:rgba(255,255,255,0.1);color:#fff}
.shop-tab.active{background:rgba(232,120,74,0.2);border-color:var(--accent,#E8784A);color:var(--accent,#E8784A)}
.shop-items{flex:1;overflow-y:auto;padding:12px 16px}
.shop-item{display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:8px;transition:all .15s}
.shop-item:hover{background:rgba(255,255,255,0.06)}
.shop-item-icon{font-size:1.5rem;width:40px;text-align:center}
.shop-item-info{flex:1;min-width:0}
.shop-item-name{font-size:.9rem;font-weight:600;color:#fff;display:flex;align-items:center;gap:6px}
.shop-item-tier{font-size:.65rem;padding:1px 6px;border-radius:4px;font-weight:700}
.shop-item-tier.tier-common{background:rgba(160,160,160,0.2);color:#A0A0A0}
.shop-item-tier.tier-rare{background:rgba(78,205,196,0.2);color:#4ECDC4}
.shop-item-tier.tier-epic{background:rgba(201,177,255,0.2);color:#C9B1FF}
.shop-item-tier.tier-legendary{background:rgba(255,184,0,0.2);color:#FFB800}
.shop-item-desc{font-size:.75rem;color:rgba(255,255,255,0.45);margin-top:2px}
.shop-item-own{font-size:.7rem;color:rgba(255,255,255,0.3);margin-top:2px}
.shop-buy-btn{padding:8px 16px;background:linear-gradient(135deg,#FFB800,#FF8C00);color:#fff;border:none;border-radius:8px;font-size:.85rem;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;transition:all .15s}
.shop-buy-btn:hover:not(:disabled){transform:scale(1.05)}
.shop-buy-btn:disabled{opacity:.4;cursor:not-allowed}
.shop-message{padding:10px 16px;background:rgba(78,205,196,0.1);color:#4ECDC4;font-size:.85rem;text-align:center;border-top:1px solid rgba(255,255,255,0.06)}
.shop-message.error{background:rgba(255,107,107,0.1);color:#FF6B6B}
.pending-item-hint{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:10px 24px;background:rgba(40,38,34,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-radius:16px;color:#fff;font-size:.95rem;font-weight:700;pointer-events:none;z-index:15;animation:pendingPulse 1.5s ease-in-out infinite;box-shadow:0 4px 20px rgba(0,0,0,0.2);text-align:center;white-space:nowrap}
@keyframes pendingPulse{0%,100%{opacity:.8;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}}
.game-canvas.pending-item-mode{cursor:pointer}
.dungeon-result{display:flex;flex-direction:column;gap:8px;margin:12px 0;padding:12px 16px;background:rgba(255,107,107,0.06);border:1px solid rgba(255,107,107,0.12);border-radius:12px}
.dungeon-stat{display:flex;justify-content:space-between;align-items:center}
.dungeon-stat-label{font-size:.78rem;color:#A09890;font-weight:500}
.dungeon-stat-value{font-size:.92rem;font-weight:700;color:#2D2A26}
.dungeon-stat-value.gold{color:#FFB800}
.fusion-toast{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);padding:14px 28px;background:rgba(0,0,0,0.8);border-radius:20px;color:#fff;font-size:1.1rem;font-weight:800;z-index:25;pointer-events:none;animation:toastIn .3s ease-out,toastOut .5s 2s ease-out forwards;display:flex;align-items:center;gap:8px;white-space:nowrap}
.fusion-toast.double-rainbow{background:linear-gradient(135deg,rgba(255,107,107,0.9),rgba(102,126,234,0.9));font-size:1.3rem;padding:18px 36px;animation:toastIn .3s ease-out,toastOut .5s 2s ease-out forwards,toastPulse .5s ease-in-out 3}
@keyframes toastIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.5)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes toastOut{from{opacity:1}to{opacity:0}}
@keyframes toastPulse{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.1)}}
.quick-item-bar{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:12;background:rgba(30,30,46,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:4px 6px;border-radius:12px;border:1px solid rgba(255,255,255,0.08)}
.quick-item-btn{position:relative;width:36px;height:36px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;padding:0}
.quick-item-btn:hover:not(:disabled){background:rgba(255,255,255,0.2);transform:scale(1.1)}
.quick-item-btn:active:not(:disabled){transform:scale(0.95)}
.quick-item-btn:disabled{opacity:.35;cursor:not-allowed}
.quick-item-btn.tier-common{border-color:rgba(160,160,160,0.3)}
.quick-item-btn.tier-rare{border-color:rgba(78,205,196,0.4)}
.quick-item-btn.tier-epic{border-color:rgba(201,177,255,0.4)}
.quick-item-btn.tier-legendary{border-color:rgba(255,184,0,0.5);animation:qiLegendaryGlow 2s ease-in-out infinite}
@keyframes qiLegendaryGlow{0%,100%{box-shadow:0 0 4px rgba(255,184,0,0.3)}50%{box-shadow:0 0 12px rgba(255,184,0,0.6)}}
.qi-icon{font-size:16px;line-height:1}
.qi-count{position:absolute;bottom:-2px;right:-2px;background:rgba(0,0,0,0.7);color:#FFE66D;font-size:9px;font-weight:700;padding:0 5px;border-radius:6px;line-height:14px;min-width:14px;text-align:center}
.qi-badge{position:absolute;top:-2px;right:-2px;background:rgba(0,0,0,0.75);color:#FFE66D;font-size:9px;font-weight:700;padding:0 4px;border-radius:6px;line-height:14px;min-width:14px;text-align:center}
@media(max-width:420px){.bubble-workshop{max-width:100%}.game-canvas{border-radius:0;box-shadow:none}.overlay{border-radius:0}.hud{padding:10px 12px}.score-value{font-size:26px}.overlay-card{width:calc(100% - 32px)}}

/* ===== 游戏通告 ===== */
.game-announcements{width:100%;margin-top:10px;padding:8px;background:rgba(255,255,255,0.85);border-radius:8px;border:1px solid rgba(0,0,0,0.08)}
.ann-title{font-size:11px;color:rgba(0,0,0,0.4);text-align:center;margin-bottom:6px;letter-spacing:2px;text-transform:uppercase}
.ann-list{display:flex;flex-direction:column;gap:5px;max-height:130px;overflow-y:auto}
.ann-item{display:flex;flex-wrap:wrap;align-items:center;gap:4px;padding:5px 8px;border-radius:6px;background:rgba(0,0,0,0.04);border-left:3px solid rgba(0,0,0,0.15)}
.ann-item.ann-event{border-left-color:#E6A800;background:rgba(255,184,0,0.12)}
.ann-item.ann-reward{border-left-color:#2EAF9E;background:rgba(78,205,196,0.12)}
.ann-tag{font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(0,0,0,0.08);color:rgba(0,0,0,0.55);white-space:nowrap;flex-shrink:0}
.ann-title-text{font-size:12px;font-weight:700;color:#222;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto}
.ann-content{font-size:10px;color:#555;line-height:1.4;flex-basis:100%;margin-top:1px}
</style>