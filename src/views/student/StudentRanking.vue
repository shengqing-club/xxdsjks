<script setup>
import { ref, onMounted, computed } from 'vue'
import { User, TrendCharts, Trophy, Reading, ArrowDown } from '@element-plus/icons-vue'
import { useAuth } from '../../stores/auth'
import { getPublicRanking } from '../../api/grade'

const { displayName, studentId } = useAuth()

const loading = ref(true)
const rankingData = ref([])
const showFullList = ref(false)

// 当前学生的排名信息
const myRanking = computed(() => {
  return rankingData.value.find(r => String(r.student_id) === String(studentId.value)) || null
})

// 第一名
const firstPlace = computed(() => {
  return rankingData.value.length > 0 ? rankingData.value[0] : null
})

// 奖牌颜色
const getMedalColor = (rank) => {
  if (rank === 1) return '#f59e0b'
  if (rank === 2) return '#94a3b8'
  if (rank === 3) return '#cd7f32'
  return ''
}

const getMedalLabel = (rank) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

// 高亮当前学生行
const tableRowClassName = ({ row }) => {
  if (String(row.student_id) === String(studentId.value)) {
    return 'current-student-row'
  }
  return ''
}

const isMobile = ref(window.innerWidth <= 768)

onMounted(() => {
  window.addEventListener('resize', () => {
    isMobile.value = window.innerWidth <= 768
  })
  loadData()
})

async function loadData() {
  try {
    const res = await getPublicRanking()
    rankingData.value = res.data || []
  } catch (e) {
    console.error('加载排名数据失败', e)
  } finally {
    loading.value = false
  }
}

function openFullList() {
  showFullList.value = true
  document.body.style.overflow = 'hidden'
}

function closeFullList() {
  showFullList.value = false
  document.body.style.overflow = ''
}
</script>

<template>
  <div v-loading="loading" class="ranking-page">
    <!-- Page header -->
    <div class="page-header">
      <h2>成绩排名</h2>
      <p class="page-desc">查看全年级学生成绩排名情况</p>
    </div>

    <!-- ===== 手机端：第一名虚荣展示 ===== -->
    <template v-if="isMobile && firstPlace">
      <!-- 冠军皇冠卡片 -->
      <div class="champion-card fade-up">
        <div class="champion-crown-area">
          <div class="crown-glow"></div>
          <span class="crown-emoji">👑</span>
          <div class="champion-badge">CHAMPION</div>
        </div>
        <div class="champion-avatar">
          <div class="champion-avatar-inner">
            <span class="champion-initial">{{ firstPlace.name?.charAt(0) || '?' }}</span>
          </div>
        </div>
        <div class="champion-info">
          <h3 class="champion-name">
            {{ firstPlace.name }}
            <el-tag v-if="String(firstPlace.student_id) === String(studentId)" type="warning" size="small" effect="dark" round class="me-tag-mobile">我</el-tag>
          </h3>
          <p class="champion-id">{{ firstPlace.student_id }}</p>
          <div class="champion-score-ring">
            <svg viewBox="0 0 120 120" class="score-ring-svg">
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="6"/>
              <circle cx="60" cy="60" r="52" fill="none" stroke="url(#ringGrad)" stroke-width="6"
                stroke-linecap="round" stroke-dasharray="327" stroke-dashoffset="0"
                transform="rotate(-90 60 60)" class="score-ring-fill"/>
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#FFD700"/>
                  <stop offset="100%" stop-color="#FFA500"/>
                </linearGradient>
              </defs>
            </svg>
            <div class="score-ring-content">
              <span class="score-ring-value">{{ Number(firstPlace.avg_score || 0).toFixed(1) }}</span>
              <span class="score-ring-label">平均分</span>
            </div>
          </div>
        </div>
        <div class="champion-stats">
          <div class="champion-stat">
            <span class="champion-stat-val">{{ firstPlace.max_score || 0 }}</span>
            <span class="champion-stat-lbl">最高分</span>
          </div>
          <div class="champion-stat-divider"></div>
          <div class="champion-stat">
            <span class="champion-stat-val">{{ firstPlace.course_count || 0 }}</span>
            <span class="champion-stat-lbl">课程数</span>
          </div>
          <div class="champion-stat-divider"></div>
          <div class="champion-stat">
            <span class="champion-stat-val gold">#1</span>
            <span class="champion-stat-lbl">全年级</span>
          </div>
        </div>
      </div>

      <!-- 我的排名卡片（如果不是第一名） -->
      <el-card v-if="myRanking && String(myRanking.student_id) !== String(firstPlace.student_id)" shadow="never" class="my-rank-card-mobile fade-up" style="--delay: 0.15s">
        <div class="my-rank-row">
          <div class="my-rank-badge-sm">
            <span class="my-rank-num">{{ myRanking.rank }}</span>
          </div>
          <div class="my-rank-info">
            <span class="my-rank-name">{{ myRanking.name }}</span>
            <span class="my-rank-detail">平均分 {{ Number(myRanking.avg_score || 0).toFixed(1) }} · 最高 {{ myRanking.max_score || 0 }}</span>
          </div>
          <div class="my-rank-diff">
            <span class="diff-label">距第一名</span>
            <span class="diff-value-red">{{ (Number(firstPlace.avg_score || 0) - Number(myRanking.avg_score || 0)).toFixed(1) }} 分</span>
          </div>
        </div>
      </el-card>

      <!-- 展开完整榜单按钮 -->
      <button class="expand-list-btn fade-up" style="--delay: 0.2s" @click="openFullList">
        <el-icon :size="16"><ArrowDown /></el-icon>
        <span>展开完整榜单（共 {{ rankingData.length }} 人）</span>
      </button>
    </template>

    <!-- ===== 桌面端：完整排名表 ===== -->
    <template v-if="!isMobile">
      <!-- My ranking card -->
      <el-card v-if="myRanking" shadow="never" class="my-rank-card fade-up" style="--delay: 0.1s">
        <div class="my-rank-inner">
          <div class="my-rank-left">
            <div class="my-rank-badge">
              <span class="rank-number">{{ myRanking.rank }}</span>
              <span class="rank-label">当前排名</span>
            </div>
          </div>
          <div class="my-rank-stats">
            <div class="my-stat-card">
              <div class="my-stat-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">
                <el-icon :size="20" color="#fff"><TrendCharts /></el-icon>
              </div>
              <div class="my-stat-body">
                <p class="my-stat-label">平均分</p>
                <p class="my-stat-value">{{ Number(myRanking.avg_score || 0).toFixed(1) }}</p>
              </div>
            </div>
            <div class="my-stat-card">
              <div class="my-stat-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                <el-icon :size="20" color="#fff"><Trophy /></el-icon>
              </div>
              <div class="my-stat-body">
                <p class="my-stat-label">最高分</p>
                <p class="my-stat-value">{{ myRanking.max_score }}</p>
              </div>
            </div>
            <div class="my-stat-card">
              <div class="my-stat-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                <el-icon :size="20" color="#fff"><Reading /></el-icon>
              </div>
              <div class="my-stat-body">
                <p class="my-stat-label">课程数</p>
                <p class="my-stat-value">{{ myRanking.course_count }}</p>
              </div>
            </div>
            <div class="my-stat-card">
              <div class="my-stat-icon" style="background: linear-gradient(135deg, #3b82f6, #1a56db);">
                <el-icon :size="20" color="#fff"><User /></el-icon>
              </div>
              <div class="my-stat-body">
                <p class="my-stat-label">总人数</p>
                <p class="my-stat-value">{{ rankingData.length }}</p>
              </div>
            </div>
          </div>
        </div>
      </el-card>

      <!-- Ranking table -->
      <el-card shadow="never" class="table-card fade-up" style="--delay: 0.2s">
        <el-table
          :data="rankingData"
          stripe
          row-key="student_id"
          :row-class-name="tableRowClassName"
          empty-text="暂无排名数据"
        >
          <el-table-column label="排名" width="100" align="center">
            <template #default="{ row }">
              <div v-if="row.rank <= 3" class="medal-wrapper">
                <span class="medal-icon" :class="'rank-' + row.rank">{{ getMedalLabel(row.rank) }}</span>
              </div>
              <span v-else class="rank-num">{{ row.rank }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="student_id" label="学号" width="160" />
          <el-table-column prop="name" label="姓名" min-width="120">
            <template #default="{ row }">
              <span class="student-name">{{ row.name }}</span>
              <el-tag v-if="String(row.student_id) === String(studentId)" type="primary" size="small" effect="dark" round class="me-tag">
                我
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="平均分" width="180" align="center">
            <template #default="{ row }">
              <div class="score-cell">
                <span class="score-val">{{ Number(row.avg_score || 0).toFixed(1) }}</span>
                <div class="score-bar-bg">
                  <div
                    class="score-bar-fill"
                    :style="{ width: Math.min(Number(row.avg_score || 0), 100) + '%' }"
                  ></div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="max_score" label="最高分" width="110" align="center" />
          <el-table-column prop="course_count" label="课程数" width="100" align="center" />
        </el-table>
      </el-card>
    </template>

    <!-- ===== 手机端完整榜单弹窗 ===== -->
    <Teleport to="body">
      <Transition name="list-popup">
        <div class="full-list-overlay" v-if="showFullList" @click.self="closeFullList">
          <div class="full-list-modal">
            <div class="full-list-header">
              <h3>📊 完整成绩排名</h3>
              <button class="full-list-close" @click="closeFullList">✕</button>
            </div>
            <div class="full-list-body">
              <div class="full-list-item" v-for="(item, idx) in rankingData" :key="item.student_id"
                :class="{ 'is-me': String(item.student_id) === String(studentId), 'is-top': idx < 3 }">
                <div class="fli-rank" :class="'top-' + (idx + 1)">
                  <span v-if="idx < 3" class="fli-medal">{{ getMedalLabel(idx + 1) }}</span>
                  <span v-else class="fli-num">{{ idx + 1 }}</span>
                </div>
                <div class="fli-info">
                  <span class="fli-name">{{ item.name }}</span>
                  <span class="fli-id">{{ item.student_id }}</span>
                </div>
                <div class="fli-scores">
                  <span class="fli-avg">{{ Number(item.avg_score || 0).toFixed(1) }}</span>
                  <span class="fli-sep">/</span>
                  <span class="fli-max">{{ item.max_score || 0 }}</span>
                </div>
                <el-tag v-if="String(item.student_id) === String(studentId)" type="primary" size="small" effect="dark" round>我</el-tag>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.ranking-page {
  min-height: 100%;
}

/* Fade-in animation */
.fade-up {
  animation: fadeUp 0.6s ease-out both;
  animation-delay: var(--delay, 0s);
}
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Page header */
.page-header {
  margin-bottom: 24px;
  animation: fadeUp 0.5s ease-out both;
}
.page-header h2 {
  font-size: 24px;
  font-weight: 800;
  color: #1e293b;
  margin: 0 0 6px;
  letter-spacing: -0.5px;
}
.page-desc {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* ===== 手机端：冠军虚荣卡片 ===== */
.champion-card {
  background: linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #1a1a2e 100%);
  border-radius: 24px;
  padding: 0;
  overflow: hidden;
  position: relative;
  margin-bottom: 16px;
  box-shadow: 0 12px 40px rgba(59, 130, 246, 0.3);
}
.champion-card::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(ellipse at center, rgba(255,215,0,0.06) 0%, transparent 70%);
  pointer-events: none;
}
.champion-crown-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 0;
  position: relative;
}
.crown-glow {
  position: absolute;
  top: 10px;
  width: 80px;
  height: 80px;
  background: radial-gradient(circle, rgba(255,215,0,0.25) 0%, transparent 70%);
  border-radius: 50%;
  animation: crownGlow 2s ease-in-out infinite;
}
@keyframes crownGlow {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 1; }
}
.crown-emoji {
  font-size: 48px;
  line-height: 1;
  position: relative;
  z-index: 1;
  animation: crownBounce 2s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(255,215,0,0.4));
}
@keyframes crownBounce {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-6px) scale(1.08); }
}
.champion-badge {
  margin-top: 6px;
  padding: 3px 14px;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #1a1a2e;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 3px;
  border-radius: 20px;
  position: relative;
  z-index: 1;
}
.champion-avatar {
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
}
.champion-avatar-inner {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 4px rgba(255,215,0,0.3), 0 8px 24px rgba(0,0,0,0.3);
}
.champion-initial {
  font-size: 32px;
  font-weight: 800;
  color: #1a1a2e;
  text-shadow: 0 1px 2px rgba(255,255,255,0.3);
}
.champion-info {
  text-align: center;
  padding: 0 20px;
}
.champion-name {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.me-tag-mobile {
  vertical-align: middle;
}
.champion-id {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin: 0 0 16px;
}

/* 分数环形图 */
.champion-score-ring {
  position: relative;
  width: 120px;
  height: 120px;
  margin: 0 auto 16px;
}
.score-ring-svg {
  width: 100%;
  height: 100%;
}
.score-ring-fill {
  animation: ringFill 1.5s ease-out forwards;
}
@keyframes ringFill {
  from { stroke-dashoffset: 327; }
  to { stroke-dashoffset: 0; }
}
.score-ring-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.score-ring-value {
  font-size: 32px;
  font-weight: 800;
  color: #FFD700;
  line-height: 1;
  text-shadow: 0 0 20px rgba(255,215,0,0.4);
}
.score-ring-label {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  margin-top: 2px;
}

.champion-stats {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: rgba(255,255,255,0.05);
  border-top: 1px solid rgba(255,255,255,0.08);
}
.champion-stat {
  flex: 1;
  text-align: center;
}
.champion-stat-val {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  line-height: 1;
}
.champion-stat-val.gold {
  color: #FFD700;
  font-size: 20px;
}
.champion-stat-lbl {
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  margin-top: 4px;
  display: block;
}
.champion-stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(255,255,255,0.12);
  flex-shrink: 0;
}

/* 我的排名卡片（手机端，非第一名） */
.my-rank-card-mobile {
  border-radius: 16px;
  border: none;
  margin-bottom: 16px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.my-rank-card-mobile :deep(.el-card__body) {
  padding: 16px;
}
.my-rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.my-rank-badge-sm {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #1a56db);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.my-rank-num {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
}
.my-rank-info {
  flex: 1;
  min-width: 0;
}
.my-rank-name {
  font-size: 15px;
  font-weight: 700;
  color: #1e293b;
  display: block;
}
.my-rank-detail {
  font-size: 12px;
  color: #94a3b8;
  display: block;
  margin-top: 2px;
}
.my-rank-diff {
  text-align: right;
  flex-shrink: 0;
}
.diff-label {
  font-size: 10px;
  color: #94a3b8;
  display: block;
}
.diff-value-red {
  font-size: 14px;
  font-weight: 700;
  color: #e05555;
}

/* 展开按钮 */
.expand-list-btn {
  width: 100%;
  padding: 14px;
  border: 2px dashed #bfd6f0;
  border-radius: 16px;
  background: rgba(59, 130, 246, 0.04);
  color: #3b82f6;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  font-family: inherit;
  margin-bottom: 16px;
}
.expand-list-btn:hover {
  background: rgba(59, 130, 246, 0.08);
  border-color: #3b82f6;
}
.expand-list-btn:active {
  transform: scale(0.97);
  background: rgba(59, 130, 246, 0.12);
}

/* ===== 完整榜单弹窗 ===== */
.full-list-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(4px);
}
.full-list-modal {
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  background: #fff;
  border-radius: 24px 24px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.full-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 20px 16px;
  background: linear-gradient(135deg, #3b82f6 0%, #1a56db 100%);
  color: #fff;
  flex-shrink: 0;
}
.full-list-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}
.full-list-close {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  font-family: inherit;
}
.full-list-close:hover {
  background: rgba(255,255,255,0.3);
}
.full-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
  -webkit-overflow-scrolling: touch;
}
.full-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  transition: background 0.15s;
}
.full-list-item:hover {
  background: #f8fafc;
}
.full-list-item.is-me {
  background: linear-gradient(90deg, rgba(59,130,246,0.08) 0%, rgba(26,86,219,0.04) 100%);
  border-left: 3px solid #3b82f6;
}
.full-list-item.is-top {
  background: linear-gradient(90deg, rgba(245,158,11,0.06) 0%, transparent 100%);
}
.fli-rank {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fli-medal {
  font-size: 22px;
}
.fli-num {
  font-size: 13px;
  font-weight: 700;
  color: #94a3b8;
  background: #f1f5f9;
  width: 26px;
  height: 26px;
  line-height: 26px;
  text-align: center;
  border-radius: 8px;
}
.fli-rank.top-1 .fli-num,
.fli-rank.top-2 .fli-num,
.fli-rank.top-3 .fli-num {
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #fff;
}
.fli-info {
  flex: 1;
  min-width: 0;
}
.fli-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  display: block;
}
.fli-id {
  font-size: 11px;
  color: #94a3b8;
  display: block;
  margin-top: 1px;
}
.fli-scores {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
}
.fli-avg {
  font-size: 16px;
  font-weight: 700;
  color: #3b82f6;
}
.fli-sep {
  font-size: 12px;
  color: #cbd5e1;
}
.fli-max {
  font-size: 13px;
  color: #94a3b8;
}

/* Popup transition */
.list-popup-enter-active { transition: opacity 0.3s; }
.list-popup-leave-active { transition: opacity 0.25s; }
.list-popup-enter-from, .list-popup-leave-to { opacity: 0; }

/* ===== 桌面端：完整样式 ===== */
/* My ranking card */
.my-rank-card {
  border-radius: 16px;
  border: none;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #3b82f6 0%, #1a56db 100%);
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.35);
  overflow: hidden;
  position: relative;
}
.my-rank-card::before {
  content: '';
  position: absolute;
  top: -40%;
  right: -15%;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.my-rank-card :deep(.el-card__body) {
  padding: 28px 32px;
  position: relative;
  z-index: 1;
}
.my-rank-inner {
  display: flex;
  align-items: center;
  gap: 32px;
}
.my-rank-left {
  flex-shrink: 0;
}
.my-rank-badge {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 3px solid rgba(255, 255, 255, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 8px rgba(255, 255, 255, 0.08), 0 8px 24px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(8px);
}
.rank-number {
  font-size: 36px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
.rank-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 4px;
}
.my-rank-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  flex: 1;
}
.my-stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  transition: all 0.3s ease;
}
.my-stat-card:hover {
  background: rgba(255, 255, 255, 0.18);
  transform: translateY(-2px);
}
.my-stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.my-stat-body {
  flex: 1;
}
.my-stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 0 2px;
}
.my-stat-value {
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  margin: 0;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

/* Table card */
.table-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease;
}
.table-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}
.table-card :deep(.el-card__body) {
  padding: 0;
}
.table-card :deep(.el-table) {
  border-radius: 16px;
  overflow: hidden;
}
.table-card :deep(.el-table th.el-table__cell) {
  background: #f8fafc;
  font-weight: 700;
  color: #475569;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Medal */
.medal-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}
.medal-icon {
  font-size: 24px;
  display: inline-block;
}
.rank-num {
  font-size: 15px;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  width: 28px;
  height: 28px;
  line-height: 28px;
  border-radius: 8px;
  display: inline-block;
}

/* Top 3 row backgrounds */
.table-card :deep(.el-table .el-table__row:nth-child(1) td) {
  background: linear-gradient(90deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%) !important;
}
.table-card :deep(.el-table .el-table__row:nth-child(2) td) {
  background: linear-gradient(90deg, rgba(148, 163, 184, 0.08) 0%, rgba(148, 163, 184, 0.03) 100%) !important;
}
.table-card :deep(.el-table .el-table__row:nth-child(3) td) {
  background: linear-gradient(90deg, rgba(205, 127, 50, 0.08) 0%, rgba(205, 127, 50, 0.03) 100%) !important;
}

/* Student name */
.student-name {
  font-weight: 600;
  color: #1e293b;
}
.me-tag {
  margin-left: 6px;
}

/* Score display with progress bar */
.score-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.score-val {
  font-weight: 700;
  color: #1e293b;
  font-size: 15px;
}
.score-bar-bg {
  width: 100%;
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}
.score-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1a56db);
  border-radius: 3px;
  transition: width 0.8s ease-out;
  min-width: 4px;
}

/* Current student row highlight */
.table-card :deep(.current-student-row td) {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.1) 0%, rgba(26, 86, 219, 0.05) 100%) !important;
  border-left: 3px solid #3b82f6 !important;
}
.table-card :deep(.current-student-row:hover > td) {
  background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(26, 86, 219, 0.08) 100%) !important;
}

/* Responsive */
@media (max-width: 768px) {
  .my-rank-stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 480px) {
  .my-rank-stats {
    grid-template-columns: 1fr;
  }
}
</style>