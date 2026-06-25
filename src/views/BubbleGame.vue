<template>
  <div class="bubble-game-page" ref="pageRef">
    <div class="game-header">
      <h2>🎈 泡泡工坊</h2>
      <p class="game-subtitle">同色同级泡泡碰撞合成，挑战最高分！</p>
      <div class="header-actions">
        <button class="fullscreen-btn" @click="toggleFullscreen" :title="isFullscreen ? '退出全屏' : '全屏游戏'">
          <span v-if="isFullscreen">&#x2716; 退出全屏</span>
          <span v-else>&#x26F6; 全屏游戏</span>
        </button>
      </div>
    </div>

    <div class="game-main">
      <div class="game-wrapper" v-if="settingsLoaded">
        <BubbleWorkshop
          :gameSettings="gameSettings"
          :currentUser="currentUser"
          @scoreSubmitted="onScoreSubmitted"
          @rankedResult="onRankedResult"
          @gameOver="onGameEnded"
        />
      </div>
      <div class="game-wrapper loading-wrapper" v-else>
        <el-icon class="loading-icon"><Loading /></el-icon>
        <span>加载游戏参数…</span>
      </div>

      <div class="leaderboard-panel">
        <!-- 排位卡片 -->
        <div class="rank-card" v-if="myRank">
          <div class="rank-card-header">
            <span class="rank-tier-icon">{{ myRank.tierIcon }}</span>
            <div class="rank-tier-info">
              <span class="rank-tier-name" :style="{ color: myRank.tierColor }">{{ myRank.tierName }}</span>
              <span class="rank-tier-div" v-if="myRank.tierKey !== 'king'">{{ romanDiv(myRank.division) }}</span>
            </div>
            <span class="rank-position" v-if="myRank.position">#{{ myRank.position }}</span>
          </div>

          <!-- 段位进度条 -->
          <div class="rank-progress-section" v-if="myRank.tierKey !== 'king' && myRank.nextTier">
            <div class="rank-progress-header">
              <span class="rank-progress-label">晋升进度</span>
              <span class="rank-progress-target">{{ myRank.nextTier }}</span>
            </div>
            <div class="rank-progress-track">
              <div class="rank-progress-fill" :style="{ width: myRank.progress + '%' }"></div>
            </div>
            <div class="rank-progress-values">
              <span>{{ myRank.totalScore.toLocaleString() }}</span>
              <span>{{ myRank.nextTierMin.toLocaleString() }}</span>
            </div>
          </div>

          <div class="rank-stats">
            <div class="stat-item">
              <span class="stat-val">{{ myRank.rankedWins }}</span>
              <span class="stat-lbl">胜场</span>
            </div>
            <div class="stat-item">
              <span class="stat-val">{{ myRank.rankedLosses }}</span>
              <span class="stat-lbl">负场</span>
            </div>
            <div class="stat-item">
              <span class="stat-val">{{ myRank.games_played }}</span>
              <span class="stat-lbl">总场次</span>
            </div>
            <div class="stat-item" v-if="myRank.rankedStreak > 1">
              <span class="stat-val fire">🔥 {{ myRank.rankedStreak }}</span>
              <span class="stat-lbl">连胜</span>
            </div>
          </div>
        </div>

        <div class="lb-header">
          <div class="lb-tabs">
            <button :class="{ active: lbTab === 'score' }" @click="lbTab = 'score'">分数榜</button>
            <button :class="{ active: lbTab === 'rank' }" @click="switchRankTab">排位榜</button>
          </div>
          <div class="lb-sub-tabs" v-if="lbTab === 'score'">
            <button :class="{ active: lbMode === 'all' }" @click="switchTab('all')">全部</button>
            <button :class="{ active: lbMode === 'classic' }" @click="switchTab('classic')">经典</button>
            <button :class="{ active: lbMode === 'zen' }" @click="switchTab('zen')">禅意</button>
          </div>
        </div>

        <!-- ===== 手机端：冠军卡片 + 展开按钮 ===== -->
        <template v-if="isMobileDevice">
          <div class="lb-champion-card" v-if="championEntry">
            <div class="champ-crown-row">
              <span class="champ-emoji">👑</span>
              <span class="champ-badge">#1</span>
            </div>
            <div class="champ-avatar-wrap">
              <div class="champ-avatar">{{ championEntry.user_name?.charAt(0) || '?' }}</div>
            </div>
            <div class="champ-name">{{ championEntry.user_name }}</div>
            <div class="champ-score-row">
              <div class="champ-score-main">
                <span class="champ-score-val">{{ lbTab === 'score' ? championEntry.score?.toLocaleString() : championEntry.total_score?.toLocaleString() }}</span>
                <span class="champ-score-unit">{{ lbTab === 'score' ? '分' : '排位分' }}</span>
              </div>
            </div>
            <div class="champ-sub-row" v-if="lbTab === 'rank' && championEntry.tierIcon">
              <span class="champ-sub-stat">{{ championEntry.tierIcon }} {{ championEntry.tierName }}</span>
            </div>
          </div>

          <button class="lb-expand-btn" @click="showFullLeaderboard = true">
            展开完整榜单（{{ lbTab === 'score' ? scoreLeaderboard.length : rankLeaderboard.length }} 人）
          </button>
        </template>

        <!-- ===== 桌面端：完整排行榜 ===== -->
        <template v-else>
        <!-- 分数榜 -->
        <template v-if="lbTab === 'score'">
          <div class="lb-podium" v-if="scoreLeaderboard.length >= 3">
            <div class="podium-item podium-2" v-if="scoreLeaderboard[1]">
              <div class="podium-avatar">&#129352;</div>
              <div class="podium-name">{{ scoreLeaderboard[1].user_name }}</div>
              <div class="podium-score">{{ scoreLeaderboard[1].score.toLocaleString() }}</div>
              <div class="podium-bar second" :style="{ height: podiumHeight(1) + 'px' }"></div>
            </div>
            <div class="podium-item podium-1" v-if="scoreLeaderboard[0]">
              <div class="podium-crown">&#128081;</div>
              <div class="podium-avatar">&#129351;</div>
              <div class="podium-name">{{ scoreLeaderboard[0].user_name }}</div>
              <div class="podium-score">{{ scoreLeaderboard[0].score.toLocaleString() }}</div>
              <div class="podium-bar first" :style="{ height: podiumHeight(0) + 'px' }"></div>
            </div>
            <div class="podium-item podium-3" v-if="scoreLeaderboard[2]">
              <div class="podium-avatar">&#129353;</div>
              <div class="podium-name">{{ scoreLeaderboard[2].user_name }}</div>
              <div class="podium-score">{{ scoreLeaderboard[2].score.toLocaleString() }}</div>
              <div class="podium-bar third" :style="{ height: podiumHeight(2) + 'px' }"></div>
            </div>
          </div>

          <div class="lb-barchart" v-if="scoreLeaderboard.length > 0">
            <div class="barchart-title">
              <span>分数分布</span>
              <span class="barchart-scale">最高 {{ scoreMax.toLocaleString() }}</span>
            </div>
            <div class="barchart-container">
              <div class="barchart-row" v-for="(item, idx) in scoreLeaderboard" :key="'bar-' + item.user_id + '-' + item.mode">
                <div class="barchart-label">
                  <span class="barchart-rank" :class="'top-' + (idx + 1)">{{ idx + 1 }}</span>
                  <span class="barchart-name">{{ item.user_name }}</span>
                </div>
                <div class="barchart-track">
                  <div class="barchart-fill" :class="{ 'barchart-me': item.user_name === currentUser?.display_name }"
                    :style="{ width: scoreBarW(item.score) + '%' }">
                    <span class="barchart-value" v-if="scoreBarW(item.score) > 15">{{ item.score.toLocaleString() }}</span>
                  </div>
                  <span class="barchart-value-outside" v-if="scoreBarW(item.score) <= 15">{{ item.score.toLocaleString() }}</span>
                </div>
                <div class="barchart-diff" v-if="idx > 0">
                  <span class="diff-arrow" :class="{ 'diff-positive': scoreDiff(idx) > 0, 'diff-zero': scoreDiff(idx) === 0 }">
                    {{ scoreDiff(idx) > 0 ? '-' : scoreDiff(idx) < 0 ? '+' : '=' }}
                  </span>
                  <span class="diff-value" v-if="scoreDiff(idx) !== 0">{{ Math.abs(scoreDiff(idx)).toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 排位榜 -->
        <template v-if="lbTab === 'rank'">
          <div class="lb-podium" v-if="rankLeaderboard.length >= 3">
            <div class="podium-item podium-2" v-if="rankLeaderboard[1]">
              <div class="podium-avatar">{{ rankLeaderboard[1].tierIcon }}</div>
              <div class="podium-name">{{ rankLeaderboard[1].user_name }}</div>
              <div class="podium-score">{{ rankLeaderboard[1].total_score.toLocaleString() }}</div>
              <div class="podium-bar second" :style="{ height: rankPodiumH(1) + 'px' }"></div>
            </div>
            <div class="podium-item podium-1" v-if="rankLeaderboard[0]">
              <div class="podium-crown">&#128081;</div>
              <div class="podium-avatar">{{ rankLeaderboard[0].tierIcon }}</div>
              <div class="podium-name">{{ rankLeaderboard[0].user_name }}</div>
              <div class="podium-score">{{ rankLeaderboard[0].total_score.toLocaleString() }}</div>
              <div class="podium-bar first" :style="{ height: rankPodiumH(0) + 'px' }"></div>
            </div>
            <div class="podium-item podium-3" v-if="rankLeaderboard[2]">
              <div class="podium-avatar">{{ rankLeaderboard[2].tierIcon }}</div>
              <div class="podium-name">{{ rankLeaderboard[2].user_name }}</div>
              <div class="podium-score">{{ rankLeaderboard[2].total_score.toLocaleString() }}</div>
              <div class="podium-bar third" :style="{ height: rankPodiumH(2) + 'px' }"></div>
            </div>
          </div>

          <div class="lb-barchart" v-if="rankLeaderboard.length > 0">
            <div class="barchart-title">
              <span>排位分布</span>
              <span class="barchart-scale">最高 {{ rankMax.toLocaleString() }}</span>
            </div>
            <div class="barchart-container">
              <div class="barchart-row rank-row" v-for="(item, idx) in rankLeaderboard" :key="'rank-' + item.user_id">
                <div class="barchart-label">
                  <span class="barchart-rank" :class="'top-' + (idx + 1)">{{ idx + 1 }}</span>
                  <span class="barchart-name">{{ item.user_name }}</span>
                </div>
                <div class="barchart-track">
                  <div class="barchart-fill rank-fill" :class="{ 'barchart-me': item.user_name === currentUser?.display_name }"
                    :style="{ width: rankBarW(item.total_score) + '%', background: item.tierColor }">
                    <span class="barchart-value" v-if="rankBarW(item.total_score) > 20">
                      {{ item.tierIcon }} {{ item.tierName }}
                      <template v-if="item.tier !== 'king'">{{ romanDiv(item.division) }}</template>
                    </span>
                  </div>
                  <span class="barchart-value-outside" v-if="rankBarW(item.total_score) <= 20">
                    {{ item.total_score.toLocaleString() }}
                  </span>
                </div>
                <div class="barchart-diff" v-if="idx > 0">
                  <span class="diff-arrow" :class="{ 'diff-positive': rankDiff(idx) > 0, 'diff-zero': rankDiff(idx) === 0 }">
                    {{ rankDiff(idx) > 0 ? '-' : rankDiff(idx) < 0 ? '+' : '=' }}
                  </span>
                  <span class="diff-value" v-if="rankDiff(idx) !== 0">{{ Math.abs(rankDiff(idx)).toLocaleString() }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
        </template>

        <div class="lb-empty" v-if="(lbTab === 'score' && scoreLeaderboard.length === 0) || (lbTab === 'rank' && rankLeaderboard.length === 0)">
          <div class="lb-empty-icon">&#127919;</div>
          <p>暂无数据</p>
          <span class="lb-empty-hint">快来挑战，成为第一名！</span>
        </div>
      </div>
    </div>

    <!-- 排位赛结果弹窗 -->
    <Teleport to="body">
      <Transition name="rank-popup">
        <div class="rank-result-overlay" v-if="showRankResult" @click="dismissRankResult">
          <div class="rank-result-card" @click.stop>
            <div class="result-icon" v-if="rankResult.won">🎉</div>
            <div class="result-icon" v-else>😞</div>

            <div class="result-title" v-if="rankResult.won">
              胜利！<br>
              <span class="result-tier">+{{ rankResult.score?.toLocaleString() }} 积分</span>
            </div>
            <div class="result-title" v-else>
              失败<br>
              <span class="result-tier-grey">+0 积分</span>
            </div>

            <div v-if="rankResult.streakBonus > 0" class="result-streak">
              🔥 连胜加成 +{{ rankResult.streakBonus.toLocaleString() }}
            </div>

            <div v-if="rankResult.isPromotion" class="result-promo-banner">
              🎉 晋升 {{ rankResult.newTier }}
            </div>

            <div class="result-tier-display" :style="{ color: rankResult.newTierColor }">
              {{ rankResult.newTierIcon }} {{ rankResult.newTier }}
            </div>

            <div class="result-progress" v-if="rankResult.nextTier">
              <div class="result-progress-label">
                <span>{{ rankResult.newTier }}</span>
                <span>{{ rankResult.nextTier }}</span>
              </div>
              <div class="result-progress-track">
                <div class="result-progress-fill" :style="{ width: rankResult.progress + '%' }"></div>
              </div>
              <div class="result-progress-values">
                <span>{{ rankResult.newTotalScore?.toLocaleString() }}</span>
                <span>{{ rankResult.nextTierMin?.toLocaleString() }}</span>
              </div>
            </div>

            <div class="result-stats-row">
              <div class="result-stat">
                <span class="result-stat-val">{{ rankResult.rankedWins }}</span>
                <span class="result-stat-lbl">胜场</span>
              </div>
              <div class="result-stat">
                <span class="result-stat-val">{{ rankResult.rankedLosses }}</span>
                <span class="result-stat-lbl">负场</span>
              </div>
              <div class="result-stat">
                <span class="result-stat-val fire" v-if="rankResult.rankedStreak > 1">🔥 {{ rankResult.rankedStreak }}</span>
                <span class="result-stat-val" v-else>{{ rankResult.rankedStreak }}</span>
                <span class="result-stat-lbl">连胜</span>
              </div>
            </div>

            <button class="result-close-btn" @click="dismissRankResult">确定</button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ===== 手机端完整榜单弹窗 ===== -->
    <Teleport to="body">
      <Transition name="lb-popup">
        <div class="lb-overlay" v-if="showFullLeaderboard" @click.self="showFullLeaderboard = false">
          <div class="lb-modal">
            <div class="lb-modal-header">
              <h3>🏆 {{ lbTab === 'score' ? '分数排行榜' : '排位排行榜' }}</h3>
              <button class="lb-modal-close" @click="showFullLeaderboard = false">✕</button>
            </div>
            <div class="lb-modal-tabs">
              <button :class="{ active: lbTab === 'score' }" @click="lbTab = 'score'">分数榜</button>
              <button :class="{ active: lbTab === 'rank' }" @click="switchRankTab">排位榜</button>
            </div>
            <div class="lb-modal-sub-tabs" v-if="lbTab === 'score'">
              <button :class="{ active: lbMode === 'all' }" @click="switchTab('all')">全部</button>
              <button :class="{ active: lbMode === 'classic' }" @click="switchTab('classic')">经典</button>
              <button :class="{ active: lbMode === 'zen' }" @click="switchTab('zen')">禅意</button>
            </div>
            <div class="lb-modal-body">
              <template v-if="lbTab === 'score'">
                <div class="lb-modal-item" v-for="(item, idx) in scoreLeaderboard" :key="'ms-' + item.user_id"
                  :class="{ 'is-me': item.user_name === currentUser?.display_name, 'is-top': idx < 3 }">
                  <div class="lb-modal-rank" :class="'top-' + (idx + 1)">
                    <span v-if="idx === 0">🥇</span>
                    <span v-else-if="idx === 1">🥈</span>
                    <span v-else-if="idx === 2">🥉</span>
                    <span v-else class="lb-modal-rank-num">{{ idx + 1 }}</span>
                  </div>
                  <div class="lb-modal-info">
                    <span class="lb-modal-name">{{ item.user_name }}</span>
                    <span class="lb-modal-meta" v-if="item.level">最高Lv{{ item.level }}</span>
                  </div>
                  <span class="lb-modal-score">{{ item.score?.toLocaleString() }}</span>
                </div>
              </template>
              <template v-if="lbTab === 'rank'">
                <div class="lb-modal-item" v-for="(item, idx) in rankLeaderboard" :key="'mr-' + item.user_id"
                  :class="{ 'is-me': item.user_name === currentUser?.display_name, 'is-top': idx < 3 }">
                  <div class="lb-modal-rank" :class="'top-' + (idx + 1)">
                    <span v-if="idx === 0">🥇</span>
                    <span v-else-if="idx === 1">🥈</span>
                    <span v-else-if="idx === 2">🥉</span>
                    <span v-else class="lb-modal-rank-num">{{ idx + 1 }}</span>
                  </div>
                  <div class="lb-modal-info">
                    <span class="lb-modal-name">{{ item.user_name }}</span>
                    <span class="lb-modal-meta" :style="{ color: item.tierColor }">{{ item.tierIcon }} {{ item.tierName }}</span>
                  </div>
                  <span class="lb-modal-score">{{ item.total_score?.toLocaleString() }}</span>
                </div>
              </template>
              <div class="lb-modal-empty" v-if="(lbTab === 'score' && scoreLeaderboard.length === 0) || (lbTab === 'rank' && rankLeaderboard.length === 0)">
                <p>暂无排行数据</p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <div class="mobile-scroll-hint" v-if="isMobileDevice && !isFullscreen">
      <span>&#8595;</span> 向下滑动查看排行榜
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import BubbleWorkshop from '../components/BubbleWorkshop.vue'
import { getLeaderboard, getGameSettings, getMyRank, getRankLeaderboard } from '../api/game.js'
import { useAuth } from '../stores/auth.js'
import { Loading } from '@element-plus/icons-vue'

const auth = useAuth()
const pageRef = ref(null)
const currentUser = computed(() => ({
  display_name: auth.displayName?.value || '玩家',
  role: auth.role?.value || 'student',
}))

const gameSettings = ref({})
const settingsLoaded = ref(false)
const scoreLeaderboard = ref([])
const rankLeaderboard = ref([])
const myRank = ref(null)
const lbMode = ref('all')
const lbTab = ref('score')
const isFullscreen = ref(false)
const isMobileDevice = ref(false)
const showFullLeaderboard = ref(false)

// 手机端冠军数据
const championEntry = computed(() => {
  if (lbTab.value === 'score') {
    return scoreLeaderboard.value.length > 0 ? scoreLeaderboard.value[0] : null
  } else {
    return rankLeaderboard.value.length > 0 ? rankLeaderboard.value[0] : null
  }
})
const showRankResult = ref(false)
const rankResult = ref({})

const scoreMax = computed(() => {
  if (scoreLeaderboard.value.length === 0) return 1
  return Math.max(...scoreLeaderboard.value.map(i => i.score))
})
const rankMax = computed(() => {
  if (rankLeaderboard.value.length === 0) return 1
  return Math.max(...rankLeaderboard.value.map(i => i.total_score))
})

onMounted(() => {
  isMobileDevice.value = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0)
  loadGameSettings()
  fetchScoreLeaderboard()
  fetchMyRank()
  fetchRankLeaderboard()
  document.addEventListener('fullscreenchange', onFsChange)
  document.addEventListener('webkitfullscreenchange', onFsChange)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  document.removeEventListener('webkitfullscreenchange', onFsChange)
})

function onFsChange() {
  isFullscreen.value = !!(document.fullscreenElement || document.webkitFullscreenElement)
}

async function toggleFullscreen() {
  try {
    if (!isFullscreen.value) {
      const el = pageRef.value || document.documentElement
      if (el.requestFullscreen) await el.requestFullscreen()
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen()
    } else {
      if (document.exitFullscreen) await document.exitFullscreen()
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen()
    }
  } catch (e) { console.warn('全屏切换失败:', e.message) }
}

function switchTab(mode) { lbMode.value = mode; fetchScoreLeaderboard() }
function switchRankTab() { lbTab.value = 'rank'; fetchRankLeaderboard() }

async function loadGameSettings() {
  try {
    const res = await getGameSettings()
    gameSettings.value = res.data || {}
  } catch (e) { console.warn('加载参数失败:', e.message) }
  finally { settingsLoaded.value = true }
}

async function fetchScoreLeaderboard() {
  try {
    const res = await getLeaderboard({ mode: lbMode.value, limit: 20 })
    scoreLeaderboard.value = res.data || []
  } catch (e) { console.warn('分数榜失败:', e.message) }
}

async function fetchMyRank() {
  try {
    const res = await getMyRank()
    myRank.value = res.data
  } catch (e) { /* 静默 */ }
}

async function fetchRankLeaderboard() {
  try {
    const res = await getRankLeaderboard({ limit: 20 })
    rankLeaderboard.value = res.data || []
  } catch (e) { console.warn('排位榜失败:', e.message) }
}

async function onScoreSubmitted({ score, mode }) {
  if (mode) lbMode.value = mode
  await new Promise(r => setTimeout(r, 300))
  await Promise.all([fetchScoreLeaderboard(), fetchMyRank(), fetchRankLeaderboard()])
}

async function onRankedResult(data) {
  rankResult.value = data
  showRankResult.value = true
  await Promise.all([fetchMyRank(), fetchRankLeaderboard()])
}

function dismissRankResult() {
  showRankResult.value = false
}

async function onGameEnded(score, highScore, mode) {
  // Refresh leaderboard and rank after every game
  await Promise.all([
    fetchScoreLeaderboard(),
    fetchMyRank(),
    fetchRankLeaderboard(),
  ])
}

function scoreBarW(s) { return scoreMax.value === 0 ? 0 : Math.round((s / scoreMax.value) * 100) }
function scoreDiff(idx) { return idx > 0 ? scoreLeaderboard.value[idx - 1].score - scoreLeaderboard.value[idx].score : 0 }
function rankBarW(s) { return rankMax.value === 0 ? 0 : Math.round((s / rankMax.value) * 100) }
function rankDiff(idx) { return idx > 0 ? rankLeaderboard.value[idx - 1].total_score - rankLeaderboard.value[idx].total_score : 0 }

function podiumHeight(idx) {
  if (scoreLeaderboard.value.length <= idx) return 0
  const top3 = scoreLeaderboard.value.slice(0, 3)
  const scores = top3.map(i => i.score)
  const max = Math.max(...scores), min = Math.min(...scores)
  const range = max - min
  if (range === 0) return 48
  return Math.round(20 + ((scoreLeaderboard.value[idx].score - min) / range) * 38)
}

function rankPodiumH(idx) {
  if (rankLeaderboard.value.length <= idx) return 0
  const top3 = rankLeaderboard.value.slice(0, 3)
  const scores = top3.map(i => i.total_score)
  const max = Math.max(...scores), min = Math.min(...scores)
  const range = max - min
  if (range === 0) return 48
  return Math.round(20 + ((rankLeaderboard.value[idx].total_score - min) / range) * 38)
}

function romanDiv(n) {
  return ['', 'I', 'II', 'III'][n] || ''
}
</script>

<style scoped>
.bubble-game-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  min-height: 100dvh;
  padding: 16px;
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  background: linear-gradient(180deg, #fdf8f2 0%, #f8f0e6 100%);
}

.game-header { text-align: center; margin-bottom: 12px; }
.game-header h2 { font-size: 1.4rem; font-weight: 800; color: #2D2A26; margin: 0 0 2px; letter-spacing: 0.04em; }
.game-subtitle { font-size: 0.8rem; color: #A09890; margin: 0 0 8px; }
.header-actions { display: flex; justify-content: center; gap: 8px; }
.fullscreen-btn {
  padding: 6px 16px; border: 1px solid rgba(212,104,56,0.3); border-radius: 20px;
  background: rgba(255,255,255,0.7); color: #D46838; font-size: 0.78rem; font-weight: 600;
  cursor: pointer; transition: all 0.2s; font-family: inherit; backdrop-filter: blur(8px);
}
.fullscreen-btn:hover { background: rgba(212,104,56,0.08); border-color: #D46838; }
.fullscreen-btn:active { transform: scale(0.95); }

.game-main { display: flex; gap: 20px; width: 100%; max-width: 760px; justify-content: center; align-items: flex-start; flex: 1; }
.game-wrapper { flex-shrink: 0; }
.loading-wrapper {
  width: 400px; height: 700px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 12px; color: #A09890; font-size: 0.9rem; border-radius: 20px; background: #faf8f4;
}
.loading-icon { font-size: 2rem; color: #D46838; animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ====== Rank Card ====== */
.rank-card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px 16px 0 0;
  padding: 14px 16px;
  color: #fff;
}
.rank-card-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
}
.rank-tier-icon { font-size: 1.8rem; line-height: 1; }
.rank-tier-info { display: flex; align-items: baseline; gap: 4px; flex: 1; }
.rank-tier-name { font-size: 1rem; font-weight: 700; }
.rank-tier-div { font-size: 0.75rem; opacity: 0.7; font-weight: 600; }
.rank-position {
  font-size: 0.72rem; background: rgba(255,255,255,0.15); padding: 3px 10px; border-radius: 10px; font-weight: 600;
}

/* 段位进度条 */
.rank-progress-section {
  margin-bottom: 10px;
}
.rank-progress-header {
  display: flex; justify-content: space-between; font-size: 0.65rem; opacity: 0.6; margin-bottom: 4px;
}
.rank-progress-target { font-weight: 600; }
.rank-progress-track {
  width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-bottom: 4px;
}
.rank-progress-fill {
  height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 3px; transition: width 0.5s;
}
.rank-progress-values {
  display: flex; justify-content: space-between; font-size: 0.6rem; opacity: 0.4; font-variant-numeric: tabular-nums;
}

.rank-stats { display: flex; gap: 0; }
.stat-item { flex: 1; text-align: center; }
.stat-val { font-size: 0.85rem; font-weight: 700; display: block; }
.stat-val.fire { color: #FF6B6B; }
.stat-lbl { font-size: 0.6rem; opacity: 0.5; }

/* ====== Leaderboard Panel ====== */
.leaderboard-panel {
  width: 300px; background: #fff; border-radius: 20px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03); overflow: hidden; flex-shrink: 0;
}
.leaderboard-panel .rank-card { border-radius: 0; }

.lb-header { padding: 12px 16px 8px; }
.lb-tabs { display: flex; gap: 4px; margin-bottom: 6px; }
.lb-tabs button {
  flex: 1; padding: 6px 0; font-size: 0.72rem; font-weight: 600; border: 1px solid #e8e4dc;
  background: #faf8f4; color: #908878; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-family: inherit;
}
.lb-tabs button:hover { background: #f0ece4; color: #5a5040; }
.lb-tabs button.active {
  background: linear-gradient(135deg, #E8784A, #D46838); color: #fff; border-color: transparent;
  font-weight: 600; box-shadow: 0 2px 8px rgba(212,104,56,0.25);
}
.lb-sub-tabs { display: flex; gap: 3px; }
.lb-sub-tabs button {
  flex: 1; padding: 4px 0; font-size: 0.65rem; font-weight: 500; border: 1px solid #e8e4dc;
  background: #faf8f4; color: #908878; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-family: inherit;
}
.lb-sub-tabs button:hover { background: #f0ece4; color: #5a5040; }
.lb-sub-tabs button.active { background: #D46838; color: #fff; border-color: #D46838; font-weight: 600; }

/* Podium */
.lb-podium { display: flex; justify-content: center; align-items: flex-end; gap: 8px; padding: 20px 16px 0; background: linear-gradient(180deg, #fdf8f2 0%, #fff 60%); }
.podium-item { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; max-width: 85px; }
.podium-avatar { font-size: 1.6rem; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15)); }
.podium-crown { font-size: 1.3rem; line-height: 1; animation: crownBounce 1.5s ease-in-out infinite; }
@keyframes crownBounce { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.1); } }
.podium-name { font-size: 0.7rem; font-weight: 600; color: #2D2A26; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.podium-score { font-size: 0.75rem; font-weight: 700; color: #D46838; font-variant-numeric: tabular-nums; }
.podium-bar { width: 100%; border-radius: 8px 8px 0 0; margin-top: 4px; transition: height 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
.podium-bar.first  { background: linear-gradient(180deg, #FFD700, #FFA500); box-shadow: 0 0 12px rgba(255,215,0,0.4); }
.podium-bar.second { background: linear-gradient(180deg, #C0C0C0, #A0A0A0); box-shadow: 0 0 8px rgba(192,192,192,0.4); }
.podium-bar.third  { background: linear-gradient(180deg, #CD7F32, #A0522D); box-shadow: 0 0 8px rgba(205,127,50,0.4); }

/* Bar chart */
.lb-barchart { padding: 0 0 8px; }
.barchart-title { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px 4px; font-size: 0.72rem; font-weight: 600; color: #A09890; text-transform: uppercase; letter-spacing: 0.06em; }
.barchart-scale { font-size: 0.62rem; color: #c0b8a8; font-weight: 500; }
.barchart-container { padding: 4px 16px; max-height: 320px; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.barchart-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; transition: background 0.15s; }
.barchart-row:hover { background: rgba(212,104,56,0.03); border-radius: 6px; margin: 0 -4px; padding: 5px 4px; }
.barchart-label { width: 64px; display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.barchart-rank { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; font-weight: 700; color: #A09890; border-radius: 50%; background: #f8f4f0; flex-shrink: 0; }
.barchart-rank.top-1 { background: linear-gradient(135deg, #FFD700, #FFA500); color: #fff; }
.barchart-rank.top-2 { background: linear-gradient(135deg, #C0C0C0, #A0A0A0); color: #fff; }
.barchart-rank.top-3 { background: linear-gradient(135deg, #CD7F32, #A0522D); color: #fff; }
.barchart-name { font-size: 0.72rem; font-weight: 500; color: #2D2A26; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.barchart-track { flex: 1; height: 16px; background: #f4f0ea; border-radius: 8px; overflow: hidden; position: relative; }
.barchart-fill { height: 100%; border-radius: 8px; background: linear-gradient(90deg, #E8784A, #D46838); min-width: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1); overflow: visible; }
.barchart-fill.barchart-me { background: linear-gradient(90deg, #FF6B6B, #E05555); box-shadow: 0 0 8px rgba(255,107,107,0.4); }
.rank-fill { background: var(--tier-color, #4A4A4A) !important; }
.barchart-value { font-size: 0.6rem; font-weight: 700; color: #fff; white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
.barchart-value-outside { font-size: 0.65rem; font-weight: 600; color: #D46838; margin-left: 4px; white-space: nowrap; }
.barchart-diff { width: 52px; display: flex; align-items: center; justify-content: flex-end; gap: 2px; flex-shrink: 0; }
.diff-arrow { font-size: 0.6rem; font-weight: 700; line-height: 1; }
.diff-positive { color: #e05555; }
.diff-zero { color: #c0b8a8; }
.diff-value { font-size: 0.62rem; font-weight: 600; color: #e05555; font-variant-numeric: tabular-nums; }

.rank-row .barchart-fill { transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s; }

/* Empty */
.lb-empty { padding: 48px 20px; text-align: center; color: #A09890; font-size: 0.82rem; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.lb-empty-icon { font-size: 2.5rem; opacity: 0.4; }
.lb-empty p { margin: 0; font-weight: 600; color: #8A827A; }
.lb-empty-hint { font-size: 0.72rem; opacity: 0.6; }

/* ====== Rank Result Overlay ====== */
.rank-result-overlay {
  position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);
}
.rank-result-card {
  background: #fff; border-radius: 24px; padding: 32px 28px; text-align: center;
  width: 90%; max-width: 320px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  animation: cardPop 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes cardPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.result-icon { font-size: 3rem; margin-bottom: 8px; animation: iconBounce 0.6s ease; }
@keyframes iconBounce { 0% { transform: scale(0); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
.result-title { font-size: 1.1rem; font-weight: 700; color: #2D2A26; margin-bottom: 12px; line-height: 1.5; }
.result-tier { color: #4ECDC4; font-size: 0.9rem; }
.result-tier-grey { color: #A09890; font-size: 0.9rem; }
.result-streak { font-size: 0.8rem; font-weight: 600; color: #FF6B6B; margin-bottom: 8px; }
.result-promo-banner {
  display: inline-block; padding: 6px 16px; background: linear-gradient(135deg, #FFE66D, #FFB8D0);
  border-radius: 20px; font-size: 0.8rem; font-weight: 700; color: #2D2A26; margin-bottom: 8px;
  animation: glow 2s ease-in-out infinite;
}
.result-tier-display { font-size: 1.2rem; font-weight: 700; margin-bottom: 8px; }
.result-progress { margin-bottom: 8px; }
.result-progress-label { display: flex; justify-content: space-between; font-size: 0.65rem; color: #A09890; font-weight: 500; margin-bottom: 4px; }
.result-progress-track { width: 100%; height: 8px; background: #f0ece4; border-radius: 4px; overflow: hidden; margin-bottom: 4px; }
.result-progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; }
.result-progress-values { display: flex; justify-content: space-between; font-size: 0.65rem; color: #A09890; }
.result-stats-row { display: flex; gap: 0; margin-bottom: 12px; }
.result-stat { flex: 1; text-align: center; }
.result-stat-val { font-size: 0.85rem; font-weight: 700; display: block; }
.result-stat-val.fire { color: #FF6B6B; }
.result-stat-lbl { font-size: 0.6rem; color: #A09890; }
.result-close-btn {
  width: 100%; padding: 12px; border: none; border-radius: 12px;
  background: linear-gradient(135deg, #E8784A, #D46838); color: #fff; font-size: 0.95rem;
  font-weight: 700; cursor: pointer; transition: all 0.2s; font-family: inherit; margin-top: 8px;
}
.result-close-btn:active { transform: scale(0.95); }

.rank-popup-enter-active { transition: opacity 0.3s; }
.rank-popup-leave-active { transition: opacity 0.2s; }
.rank-popup-enter-from, .rank-popup-leave-to { opacity: 0; }

/* Mobile */
.mobile-scroll-hint {
  display: none; position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
  padding: 8px 16px; background: rgba(40,38,34,0.75); color: #fff; font-size: 0.72rem;
  font-weight: 500; border-radius: 20px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
  z-index: 50; pointer-events: none; animation: hintFloat 3s ease-in-out infinite;
}
@keyframes hintFloat { 0%,100% { transform: translateX(-50%) translateY(0); opacity: 0.8; } 50% { transform: translateX(-50%) translateY(-6px); opacity: 1; } }

@media (max-width: 700px) {
  .bubble-game-page { padding: 8px; padding-bottom: calc(50px + env(safe-area-inset-bottom, 0px)); }
  .game-main { flex-direction: column; align-items: center; }
  .game-wrapper { width: 100%; max-width: 400px; }
  .leaderboard-panel { width: 100%; max-width: 400px; }
  .game-header h2 { font-size: 1.1rem; }
  .game-subtitle { font-size: 0.7rem; }
  .mobile-scroll-hint { display: flex; align-items: center; gap: 4px; }
}

/* Fullscreen */
.bubble-game-page:fullscreen { background: #1a1a2e; padding: 0; justify-content: center; }
.bubble-game-page:fullscreen .game-header { display: none; }
.bubble-game-page:fullscreen .leaderboard-panel { display: none; }
.bubble-game-page:fullscreen .game-main { max-width: none; align-items: center; justify-content: center; }
.bubble-game-page:fullscreen .game-wrapper { max-width: 100vw; }
.bubble-game-page:fullscreen .mobile-scroll-hint { display: none; }
.bubble-game-page:-webkit-full-screen { background: #1a1a2e; padding: 0; justify-content: center; }
.bubble-game-page:-webkit-full-screen .game-header { display: none; }
.bubble-game-page:-webkit-full-screen .leaderboard-panel { display: none; }
.bubble-game-page:-webkit-full-screen .game-main { max-width: none; align-items: center; justify-content: center; }
.bubble-game-page:-webkit-full-screen .game-wrapper { max-width: 100vw; }
.bubble-game-page:-webkit-full-screen .mobile-scroll-hint { display: none; }

/* ===== 手机端冠军卡片 ===== */
.lb-champion-card {
  background: linear-gradient(160deg, #1a1a2e 0%, #1e293b 40%, #1a1a2e 100%);
  border-radius: 20px;
  padding: 24px 20px 20px;
  text-align: center;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}
.lb-champion-card::before {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(ellipse at center, rgba(255,215,0,0.08) 0%, transparent 70%);
  pointer-events: none;
}
.champ-crown-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}
.champ-emoji {
  font-size: 32px;
  animation: champBounce 2s ease-in-out infinite;
}
@keyframes champBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-4px) scale(1.1); }
}
.champ-badge {
  padding: 2px 10px;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #1a1a2e;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
  border-radius: 12px;
}
.champ-avatar-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}
.champ-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
  color: #1a1a2e;
  box-shadow: 0 0 0 3px rgba(255,215,0,0.3), 0 4px 16px rgba(0,0,0,0.3);
}
.champ-name {
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}
.champ-score-row {
  display: flex;
  justify-content: center;
  margin-bottom: 4px;
}
.champ-score-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
.champ-score-val {
  font-size: 28px;
  font-weight: 800;
  color: #FFD700;
  text-shadow: 0 0 16px rgba(255,215,0,0.4);
}
.champ-score-unit {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
}
.champ-sub-row {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 2px;
}
.champ-sub-stat {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
}

/* 展开按钮 */
.lb-expand-btn {
  width: 100%;
  padding: 12px;
  border: 2px dashed #bfd6f0;
  border-radius: 14px;
  background: rgba(59,130,246,0.06);
  color: #3b82f6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  margin-bottom: 8px;
}
.lb-expand-btn:active {
  transform: scale(0.97);
  background: rgba(59,130,246,0.12);
}

/* ===== 手机端完整榜单弹窗 ===== */
.lb-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(4px);
}
.lb-modal {
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  background: #fff;
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: lbSlideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes lbSlideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.lb-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 14px;
  background: linear-gradient(135deg, #3b82f6, #1a56db);
  color: #fff;
  flex-shrink: 0;
}
.lb-modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}
.lb-modal-close {
  width: 32px; height: 32px;
  border: none; border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-family: inherit;
}
.lb-modal-tabs {
  display: flex;
  padding: 10px 16px 0;
  gap: 8px;
  flex-shrink: 0;
}
.lb-modal-tabs button {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 10px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.lb-modal-tabs button.active {
  background: #3b82f6;
  color: #fff;
}
.lb-modal-sub-tabs {
  display: flex;
  padding: 8px 16px 0;
  gap: 6px;
  flex-shrink: 0;
}
.lb-modal-sub-tabs button {
  padding: 4px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.lb-modal-sub-tabs button.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}
.lb-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;
}
.lb-modal-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  transition: background 0.15s;
}
.lb-modal-item.is-me {
  background: linear-gradient(90deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.02) 100%);
  border-left: 3px solid #3b82f6;
}
.lb-modal-item.is-top {
  background: linear-gradient(90deg, rgba(245,158,11,0.06) 0%, transparent 100%);
}
.lb-modal-rank {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.lb-modal-rank-num {
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
  background: #f1f5f9;
  width: 26px; height: 26px;
  line-height: 26px;
  text-align: center;
  border-radius: 8px;
}
.lb-modal-info {
  flex: 1;
  min-width: 0;
}
.lb-modal-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  display: block;
}
.lb-modal-meta {
  font-size: 11px;
  color: #94a3b8;
}
.lb-modal-score {
  font-size: 16px;
  font-weight: 700;
  color: #3b82f6;
  flex-shrink: 0;
}
.lb-modal-empty {
  text-align: center;
  padding: 40px 20px;
  color: #94a3b8;
}
.lb-modal-empty p {
  margin: 0;
  font-size: 14px;
}

/* 弹窗过渡动画 */
.lb-popup-enter-active { transition: opacity 0.3s; }
.lb-popup-leave-active { transition: opacity 0.25s; }
.lb-popup-enter-from, .lb-popup-leave-to { opacity: 0; }
</style>