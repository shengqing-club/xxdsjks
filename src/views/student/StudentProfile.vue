<script setup>
import { ref, onMounted, computed } from 'vue'
import { User, UserFilled, School, Postcard, Calendar, Reading, Trophy, Clock, Male, Female, Document } from '@element-plus/icons-vue'
import { useAuth } from '../../stores/auth'
import { getStudentByStudentId } from '../../api/student'

const { displayName, studentId } = useAuth()

const loading = ref(true)
const student = ref(null)

// Derive enrollment year from studentId (first 4 digits often encode year)
const enrollmentYear = computed(() => {
  if (!student.value?.studentId) return '--'
  const id = String(student.value.studentId)
  if (id.length >= 4) {
    const year = parseInt(id.substring(0, 4), 10)
    if (year >= 2000 && year <= 2099) return `${year}年`
  }
  return '--'
})

const enrollmentSemester = computed(() => {
  if (enrollmentYear.value === '--') return '--'
  return `${enrollmentYear.value}秋季学期入学`
})

onMounted(async () => {
  try {
    const res = await getStudentByStudentId(studentId.value)
    student.value = res.data
  } catch (e) {
    console.error('加载学生信息失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="profile-page">
    <!-- Page header -->
    <div class="page-header">
      <h2>个人信息</h2>
      <p class="page-desc">查看您的基本资料和学籍信息</p>
    </div>

    <!-- Profile header card -->
    <el-card shadow="never" class="profile-header-card">
      <div class="profile-top">
        <div class="avatar-wrapper">
          <el-avatar :size="88" class="profile-avatar">
            <el-icon :size="44"><User /></el-icon>
          </el-avatar>
          <div class="avatar-ring"></div>
        </div>
        <div class="profile-intro">
          <h3 class="profile-name">{{ student?.name || displayName }}</h3>
          <p class="profile-id">学号：{{ student?.studentId || studentId }}</p>
          <el-tag type="primary" size="small" effect="dark" round class="status-tag">在读</el-tag>
        </div>
      </div>
    </el-card>

    <!-- Basic info card -->
    <el-card shadow="never" class="info-card fade-up" style="--delay: 0.1s">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#1a56db"><UserFilled /></el-icon>
          <span class="card-title">基本资料</span>
        </div>
      </template>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #6366f1, #8b5cf6);">
            <el-icon :size="18" color="#fff"><Postcard /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">学号</span>
            <span class="info-item-value">{{ student?.studentId || '--' }}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">
            <el-icon :size="18" color="#fff"><User /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">姓名</span>
            <span class="info-item-value">{{ student?.name || displayName || '--' }}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #ec4899, #f43f5e);">
            <el-icon :size="18" color="#fff"><Female /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">性别</span>
            <span class="info-item-value">{{ student?.gender || '--' }}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #f59e0b, #f97316);">
            <el-icon :size="18" color="#fff"><Calendar /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">年龄</span>
            <span class="info-item-value">{{ student?.age ?? '--' }}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
            <el-icon :size="18" color="#fff"><Reading /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">专业</span>
            <span class="info-item-value">{{ student?.major || '--' }}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
            <el-icon :size="18" color="#fff"><Document /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">班级</span>
            <span class="info-item-value">{{ student?.className || '--' }}</span>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Enrollment info card -->
    <el-card shadow="never" class="info-card fade-up" style="--delay: 0.2s">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#10b981"><School /></el-icon>
          <span class="card-title">学籍信息</span>
        </div>
      </template>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #06b6d4, #0891b2);">
            <el-icon :size="18" color="#fff"><Calendar /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">入学年份</span>
            <span class="info-item-value">{{ enrollmentYear }}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #0ea5e9, #0284c7);">
            <el-icon :size="18" color="#fff"><Reading /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">入学学期</span>
            <span class="info-item-value">{{ enrollmentSemester }}</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
            <el-icon :size="18" color="#fff"><Trophy /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">学籍状态</span>
            <span class="info-item-value">
              <el-tag :type="student?.status === '在读' ? 'success' : 'warning'" size="small" effect="light">{{ student?.status || '在读' }}</el-tag>
            </span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
            <el-icon :size="18" color="#fff"><School /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">学制</span>
            <span class="info-item-value">四年制本科</span>
          </div>
        </div>
        <div class="info-item">
          <div class="info-item-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
            <el-icon :size="18" color="#fff"><Clock /></el-icon>
          </div>
          <div class="info-item-content">
            <span class="info-item-label">注册时间</span>
            <span class="info-item-value">{{ student?.created_at ? student.created_at.slice(0, 10) : '--' }}</span>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.profile-page {
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

/* Profile header card */
.profile-header-card {
  border-radius: 16px;
  border: none;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.35);
  animation: fadeUp 0.5s ease-out both;
  overflow: hidden;
  position: relative;
}
.profile-header-card::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.profile-header-card::after {
  content: '';
  position: absolute;
  bottom: -40%;
  left: -10%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.profile-header-card :deep(.el-card__body) {
  padding: 32px 36px;
  position: relative;
  z-index: 1;
}
.profile-top {
  display: flex;
  align-items: center;
  gap: 28px;
}
.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}
.profile-avatar {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 3px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.15);
}
.avatar-ring {
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.25);
  animation: ringPulse 3s ease-in-out infinite;
}
@keyframes ringPulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.06); opacity: 1; }
}
.profile-intro {
  flex: 1;
}
.profile-name {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 8px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  letter-spacing: -0.5px;
}
.profile-id {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  margin: 0 0 12px;
}
.status-tag {
  background: rgba(255, 255, 255, 0.2) !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  color: #fff !important;
  backdrop-filter: blur(4px);
}

/* Info cards */
.info-card {
  border-radius: 16px;
  border: none;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: box-shadow 0.3s ease;
}
.info-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}
.info-card :deep(.el-card__header) {
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
  border-radius: 16px 16px 0 0;
}
.info-card :deep(.el-card__body) {
  padding: 24px;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}

/* Info grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.info-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  transition: all 0.3s ease;
}
.info-item:hover {
  background: #f1f5f9;
  border-color: #e2e8f0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}
.info-item-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.info-item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.info-item-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}
.info-item-value {
  font-size: 15px;
  color: #1e293b;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Responsive */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .profile-name {
    font-size: 22px;
  }
}
@media (max-width: 480px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
