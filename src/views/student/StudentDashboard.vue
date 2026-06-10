<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import * as echarts from 'echarts'
import { useAuth } from '../../stores/auth'
import { getStudentByStudentId } from '../../api/student'
import { getGradesByStudent } from '../../api/grade'
import { getAnnouncements } from '../../api/announcement'

const { displayName, studentId } = useAuth()

const loading = ref(true)
const student = ref(null)
const grades = ref([])
const announcements = ref([])
const chartRef = ref(null)
let chartInstance = null

// Computed stats
const courseCount = computed(() => grades.value.length)

const avgScore = computed(() => {
  if (!grades.value.length) return 0
  const sum = grades.value.reduce((acc, g) => acc + g.score, 0)
  return (sum / grades.value.length).toFixed(1)
})

const maxScore = computed(() => {
  if (!grades.value.length) return 0
  return Math.max(...grades.value.map(g => g.score))
})

const minScore = computed(() => {
  if (!grades.value.length) return 0
  return Math.min(...grades.value.map(g => g.score))
})

// Latest 3 announcements
const latestAnnouncements = computed(() => {
  return announcements.value.slice(0, 3)
})

// Announcement type tag mapping
const getAnnouncementTagType = (type) => {
  const map = {
    '通知': 'primary',
    '公告': 'success',
    '紧急': 'danger',
    '活动': 'warning',
  }
  return map[type] || 'info'
}

const today = new Date()
const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const weekday = weekDays[today.getDay()]

// Init chart
const initChart = () => {
  if (!chartRef.value || !grades.value.length) return
  chartInstance = echarts.init(chartRef.value)
  const courseNames = grades.value.map(g => g.courseName)
  const scores = grades.value.map(g => g.score)
  chartInstance.setOption({
    title: {
      text: '各科成绩一览',
      left: 'center',
      textStyle: { color: '#1e293b', fontSize: 15, fontWeight: 600 },
    },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 24, top: 50, bottom: 60 },
    xAxis: {
      type: 'category',
      data: courseNames,
      axisLabel: {
        interval: 0,
        rotate: courseNames.length > 6 ? 30 : 0,
        fontSize: 12,
        color: '#64748b',
      },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: scores,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { color: '#1a56db', width: 2.5 },
        itemStyle: { color: '#1a56db' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(26,86,219,0.28)' },
            { offset: 1, color: 'rgba(26,86,219,0.03)' },
          ]),
        },
      },
    ],
  })
}

// Handle resize
const handleResize = () => chartInstance?.resize()

onMounted(async () => {
  try {
    const [studentRes, gradesRes, announcementsRes] = await Promise.all([
      getStudentByStudentId(studentId.value),
      getGradesByStudent(studentId.value),
      getAnnouncements(),
    ])
    student.value = studentRes.data
    grades.value = gradesRes.data || []
    announcements.value = announcementsRes.data || []
  } catch (e) {
    console.error('加载数据失败', e)
  } finally {
    loading.value = false
  }
  await nextTick()
  initChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <!-- Greeting -->
    <div class="page-header">
      <h2>欢迎回来，{{ displayName }}</h2>
      <p class="date-info">{{ dateStr }} 星期{{ weekday }}</p>
    </div>

    <!-- Stat cards -->
    <div class="stat-grid">
      <div class="stat-card stat-courses">
        <div class="stat-icon">
          <el-icon :size="28"><Collection /></el-icon>
        </div>
        <div class="stat-body">
          <p class="stat-label">已修课程数</p>
          <p class="stat-value">{{ courseCount }}</p>
        </div>
      </div>
      <div class="stat-card stat-avg">
        <div class="stat-icon">
          <el-icon :size="28"><TrendCharts /></el-icon>
        </div>
        <div class="stat-body">
          <p class="stat-label">平均分</p>
          <p class="stat-value">{{ avgScore }}</p>
        </div>
      </div>
      <div class="stat-card stat-max">
        <div class="stat-icon">
          <el-icon :size="28"><Top /></el-icon>
        </div>
        <div class="stat-body">
          <p class="stat-label">最高分</p>
          <p class="stat-value">{{ maxScore }}</p>
        </div>
      </div>
      <div class="stat-card stat-min">
        <div class="stat-icon">
          <el-icon :size="28"><Bottom /></el-icon>
        </div>
        <div class="stat-body">
          <p class="stat-label">最低分</p>
          <p class="stat-value">{{ minScore }}</p>
        </div>
      </div>
    </div>

    <!-- Announcements -->
    <el-card shadow="never" class="announcement-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#f59e0b"><Bell /></el-icon>
          <span class="card-title">最新通知</span>
        </div>
      </template>
      <div v-if="latestAnnouncements.length" class="announcement-list">
        <div
          v-for="ann in latestAnnouncements"
          :key="ann.id"
          class="announcement-item"
        >
          <div class="ann-left">
            <el-tag
              v-if="ann.type"
              :type="getAnnouncementTagType(ann.type)"
              size="small"
              effect="light"
              round
              class="ann-type-tag"
            >
              {{ ann.type }}
            </el-tag>
            <span class="ann-title">{{ ann.title }}</span>
          </div>
          <span class="ann-date">{{ ann.createTime || ann.date || '' }}</span>
        </div>
      </div>
      <el-empty v-else description="暂无通知" :image-size="60" />
    </el-card>

    <!-- Chart -->
    <el-card shadow="never" class="chart-card">
      <div ref="chartRef" class="chart-container"></div>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100%;
}

/* Page header */
.page-header {
  margin-bottom: 20px;
}
.page-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
}
.date-info {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* Stat grid */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border-left: 4px solid transparent;
  transition: box-shadow 0.2s;
}
.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.stat-courses {
  border-left-color: #1a56db;
}
.stat-avg {
  border-left-color: #10b981;
}
.stat-max {
  border-left-color: #f59e0b;
}
.stat-min {
  border-left-color: #ef4444;
}
.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-courses .stat-icon {
  background: #eff6ff;
  color: #1a56db;
}
.stat-avg .stat-icon {
  background: #ecfdf5;
  color: #10b981;
}
.stat-max .stat-icon {
  background: #fffbeb;
  color: #f59e0b;
}
.stat-min .stat-icon {
  background: #fef2f2;
  color: #ef4444;
}
.stat-label {
  font-size: 13px;
  color: #94a3b8;
  margin: 0 0 4px;
}
.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  line-height: 1.1;
}

/* Announcements */
.announcement-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 20px;
}
.announcement-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid #f1f5f9;
}
.announcement-card :deep(.el-card__body) {
  padding: 0;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.announcement-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.announcement-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.15s;
}
.announcement-item:last-child {
  border-bottom: none;
}
.announcement-item:hover {
  background: #f8fafc;
}
.ann-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.ann-type-tag {
  flex-shrink: 0;
}
.ann-title {
  font-size: 14px;
  color: #334155;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ann-date {
  font-size: 12px;
  color: #94a3b8;
  flex-shrink: 0;
  margin-left: 12px;
}

/* Chart */
.chart-card {
  border-radius: 8px;
  border: none;
}
.chart-card :deep(.el-card__body) {
  padding: 20px;
}
.chart-container {
  width: 100%;
  height: 360px;
}
</style>
