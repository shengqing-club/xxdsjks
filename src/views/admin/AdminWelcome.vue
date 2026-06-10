<template>
  <div class="welcome-page">
    <!-- Welcome Banner -->
    <div class="welcome-banner">
      <div class="banner-content">
        <div class="banner-text">
          <h1 class="school-name">西安信息职业大学</h1>
          <p class="banner-subtitle">学生信息管理系统管理后台</p>
          <div class="banner-meta">
            <span class="meta-item">
              <el-icon><Calendar /></el-icon>
              {{ currentDate }}
            </span>
            <span class="meta-item">
              <el-icon><Clock /></el-icon>
              {{ currentTime }}
            </span>
            <span class="meta-item">
              <el-icon><UserFilled /></el-icon>
              欢迎，{{ displayName }}
            </span>
          </div>
        </div>
      </div>
      <div class="banner-decoration"></div>
    </div>

    <!-- Stat Cards -->
    <div class="stat-cards">
      <el-card shadow="never" class="stat-card">
        <div class="stat-icon stat-icon--students">
          <el-icon :size="28"><UserFilled /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ totalStudents }}</span>
          <span class="stat-label">学生总数</span>
        </div>
      </el-card>

      <el-card shadow="never" class="stat-card">
        <div class="stat-icon stat-icon--majors">
          <el-icon :size="28"><School /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ totalMajors }}</span>
          <span class="stat-label">专业总数</span>
        </div>
      </el-card>

      <el-card shadow="never" class="stat-card">
        <div class="stat-icon stat-icon--classes">
          <el-icon :size="28"><Collection /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ totalClasses }}</span>
          <span class="stat-label">班级总数</span>
        </div>
      </el-card>

      <el-card shadow="never" class="stat-card">
        <div class="stat-icon stat-icon--grades">
          <el-icon :size="28"><EditPen /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ totalGrades }}</span>
          <span class="stat-label">成绩记录数</span>
        </div>
      </el-card>
    </div>

    <!-- Quick Actions -->
    <div class="section-header">
      <h3 class="section-title">快捷操作</h3>
    </div>
    <div class="quick-actions">
      <el-card shadow="never" class="action-card" @click="router.push('/add')">
        <div class="action-icon action-icon--add">
          <el-icon :size="32"><Plus /></el-icon>
        </div>
        <span class="action-label">新增学生</span>
        <span class="action-desc">添加新的学生信息</span>
      </el-card>

      <el-card shadow="never" class="action-card" @click="router.push('/grades')">
        <div class="action-icon action-icon--grade">
          <el-icon :size="32"><EditPen /></el-icon>
        </div>
        <span class="action-label">成绩发布</span>
        <span class="action-desc">录入与管理学生成绩</span>
      </el-card>

      <el-card shadow="never" class="action-card" @click="router.push('/announcements')">
        <div class="action-icon action-icon--announce">
          <el-icon :size="32"><Bell /></el-icon>
        </div>
        <span class="action-label">发布公告</span>
        <span class="action-desc">发布系统公告与通知</span>
      </el-card>

      <el-card shadow="never" class="action-card" @click="router.push('/ranking')">
        <div class="action-icon action-icon--ranking">
          <el-icon :size="32"><TrophyBase /></el-icon>
        </div>
        <span class="action-label">成绩排名</span>
        <span class="action-desc">查看学生成绩排名</span>
      </el-card>

      <el-card shadow="never" class="action-card" @click="router.push('/majors')">
        <div class="action-icon action-icon--major">
          <el-icon :size="32"><Collection /></el-icon>
        </div>
        <span class="action-label">专业管理</span>
        <span class="action-desc">管理学校专业设置</span>
      </el-card>
    </div>

    <!-- Recent Announcements -->
    <div class="section-header">
      <h3 class="section-title">最新公告</h3>
      <el-button text type="primary" @click="router.push('/announcements')">
        查看全部
        <el-icon class="el-icon--right"><ArrowRight /></el-icon>
      </el-button>
    </div>
    <el-card shadow="never" class="announcement-card">
      <el-timeline v-if="recentAnnouncements.length > 0">
        <el-timeline-item
          v-for="item in recentAnnouncements"
          :key="item.id"
          :timestamp="formatDate(item.created_at)"
          placement="top"
          :type="getTimelineType(item.type)"
        >
          <div class="announcement-item">
            <h4 class="announcement-title">{{ item.title }}</h4>
            <p class="announcement-content">{{ item.content }}</p>
            <el-tag size="small" :type="getTagType(item.type)">{{ item.type }}</el-tag>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无公告" :image-size="80" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../stores/auth'
import {
  UserFilled,
  School,
  Collection,
  EditPen,
  Plus,
  Bell,
  DataAnalysis,
  Calendar,
  Clock,
  ArrowRight
} from '@element-plus/icons-vue'
import { getStudents } from '../../api/student'
import { getAllGrades } from '../../api/grade'
import { getAnnouncements } from '../../api/announcement'

const router = useRouter()
const { displayName } = useAuth()

const totalStudents = ref(0)
const totalMajors = ref(0)
const totalClasses = ref(0)
const totalGrades = ref(0)
const recentAnnouncements = ref([])

const currentDate = ref('')
const currentTime = ref('')
let timer = null

const updateDateTime = () => {
  const now = new Date()
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  currentDate.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekDays[now.getDay()]}`
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  // 直接从字符串提取日期部分，兼容 "YYYY-MM-DD HH:MM:SS" 和 ISO 格式
  const datePart = String(dateStr).split('T')[0].split(' ')[0]
  const parts = datePart.split('-')
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  }
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getTagType = (type) => {
  const map = { '通知': 'primary', '公告': 'success', '考试': 'warning', '活动': 'danger' }
  return map[type] || 'info'
}

const getTimelineType = (type) => {
  const map = { '通知': 'primary', '公告': 'success', '考试': 'warning', '活动': 'danger' }
  return map[type] || 'info'
}

onMounted(async () => {
  updateDateTime()
  timer = setInterval(updateDateTime, 1000)

  try {
    const res = await getStudents()
    const students = res.data || res || []
    totalStudents.value = students.length

    const majorSet = new Set()
    const classSet = new Set()
    students.forEach((s) => {
      if (s.major) majorSet.add(s.major)
      if (s.class_name || s.className) classSet.add(s.class_name || s.className)
    })
    totalMajors.value = majorSet.size
    totalClasses.value = classSet.size
  } catch (e) {
    console.error('获取学生统计数据失败', e)
  }

  try {
    const res = await getAllGrades()
    const grades = res.data || res || []
    totalGrades.value = grades.length
  } catch (e) {
    console.error('获取成绩数据失败', e)
  }

  try {
    const res = await getAnnouncements()
    const announcements = res.data || res || []
    recentAnnouncements.value = announcements.slice(0, 3)
  } catch (e) {
    console.error('获取公告数据失败', e)
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.welcome-page {
  max-width: 1100px;
  margin: 0 auto;
}

/* Banner */
.welcome-banner {
  position: relative;
  border-radius: 12px;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
  padding: 40px 48px;
  margin-bottom: 24px;
  overflow: hidden;
  color: #fff;
}

.banner-content {
  position: relative;
  z-index: 1;
}

.banner-text .school-name {
  font-family: KaiTi, '楷体', STKaiti, serif;
  font-size: 2.4rem;
  font-weight: 700;
  margin: 0 0 8px 0;
  letter-spacing: 4px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.banner-subtitle {
  font-size: 1rem;
  margin: 0 0 20px 0;
  color: rgba(255, 255, 255, 0.85);
  letter-spacing: 1px;
}

.banner-meta {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
}

.banner-decoration {
  position: absolute;
  top: -40%;
  right: -10%;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
}

.banner-decoration::after {
  content: '';
  position: absolute;
  top: 30px;
  left: 30px;
  right: 30px;
  bottom: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.04);
}

/* Stat Cards */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 28px;
}

.stat-card {
  border-radius: 8px;
  transition: transform 0.25s, box-shadow 0.25s;
  cursor: default;
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
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

.stat-icon--students {
  background: #eff6ff;
  color: #1a56db;
}

.stat-icon--majors {
  background: #f0fdf4;
  color: #16a34a;
}

.stat-icon--classes {
  background: #fef3c7;
  color: #d97706;
}

.stat-icon--grades {
  background: #fce7f3;
  color: #db2777;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: #94a3b8;
  margin-top: 4px;
}

/* Section Header */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

/* Quick Actions */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 28px;
}

.action-card {
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.25s, box-shadow 0.25s;
  text-align: center;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.action-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 16px;
}

.action-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-icon--add {
  background: #eff6ff;
  color: #1a56db;
}

.action-icon--grade {
  background: #f0fdf4;
  color: #16a34a;
}

.action-icon--announce {
  background: #fef3c7;
  color: #d97706;
}

.action-icon--chart {
  background: #ede9fe;
  color: #7c3aed;
}

.action-icon--ranking {
  background: #fff7ed;
  color: #ea580c;
}

.action-icon--major {
  background: #ecfdf5;
  color: #059669;
}

.action-label {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.action-desc {
  font-size: 13px;
  color: #94a3b8;
}

/* Announcements */
.announcement-card {
  border-radius: 8px;
}

.announcement-card :deep(.el-card__body) {
  padding: 24px;
}

.announcement-item {
  padding-bottom: 4px;
}

.announcement-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 6px 0;
}

.announcement-content {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 8px 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
