<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '../../stores/auth'
import { getClassmates, getStudentByStudentId } from '../../api/student'

const { displayName, studentId } = useAuth()

const loading = ref(true)
const currentStudent = ref(null)
const classmates = ref([])

// 班级信息
const className = computed(() => currentStudent.value?.class_name || '--')
const major = computed(() => currentStudent.value?.major || '--')
const totalStudents = computed(() => classmates.value.length)

// 性别统计
const maleCount = computed(() => classmates.value.filter(s => s.gender === '男').length)
const femaleCount = computed(() => classmates.value.filter(s => s.gender === '女').length)
const malePercent = computed(() => {
  if (!totalStudents.value) return 0
  return ((maleCount.value / totalStudents.value) * 100).toFixed(0)
})
const femalePercent = computed(() => {
  if (!totalStudents.value) return 0
  return ((femaleCount.value / totalStudents.value) * 100).toFixed(0)
})

// 平均年龄
const avgAge = computed(() => {
  const withAge = classmates.value.filter(s => s.age != null && s.age !== '')
  if (!withAge.length) return '--'
  const sum = withAge.reduce((acc, s) => acc + Number(s.age), 0)
  return (sum / withAge.length).toFixed(1)
})

// 高亮当前学生行
const tableRowClassName = ({ row }) => {
  if (String(row.student_id) === String(studentId.value)) {
    return 'current-student-row'
  }
  return ''
}

// 头像颜色
const avatarColors = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #fccb90, #d57eeb)',
  'linear-gradient(135deg, #e0c3fc, #8ec5fc)',
]
const getAvatarStyle = (row) => {
  const idx = (row.name || '').charCodeAt(0) % avatarColors.length
  return { background: avatarColors[idx], color: '#fff', fontWeight: 700, fontSize: '14px' }
}

onMounted(async () => {
  try {
    // 先获取当前学生信息（确定班级）
    const studentRes = await getStudentByStudentId(studentId.value)
    currentStudent.value = studentRes.data
    // 再获取同班同学
    const matesRes = await getClassmates()
    classmates.value = matesRes.data || []
  } catch (e) {
    console.error('加载班级信息失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="class-page">
    <!-- Page header -->
    <div class="page-header">
      <h2>班级一览</h2>
      <p class="page-desc">查看同班同学信息</p>
    </div>

    <!-- Class info header -->
    <el-card shadow="never" class="class-header-card fade-up" style="--delay: 0.1s">
      <div class="class-info-row">
        <div class="class-badge">
          <el-icon :size="32" color="#fff"><OfficeBuilding /></el-icon>
        </div>
        <div class="class-details">
          <h3 class="class-name">{{ className }}</h3>
          <p class="class-meta">{{ major }}</p>
        </div>
        <div class="class-quick-stats">
          <div class="quick-stat">
            <p class="qs-value">{{ totalStudents }}</p>
            <p class="qs-label">总人数</p>
          </div>
          <div class="quick-stat">
            <p class="qs-value">{{ avgAge }}</p>
            <p class="qs-label">平均年龄</p>
          </div>
          <div class="quick-stat">
            <p class="qs-value">{{ maleCount }}<span class="qs-sep">/</span>{{ femaleCount }}</p>
            <p class="qs-label">男/女</p>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Gender ratio and stats -->
    <div class="stats-row fade-up" style="--delay: 0.2s">
      <el-card shadow="never" class="stat-mini-card">
        <div class="stat-mini">
          <div class="stat-mini-icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8);">
            <el-icon :size="22" color="#fff"><Male /></el-icon>
          </div>
          <div class="stat-mini-body">
            <p class="stat-mini-label">男生</p>
            <p class="stat-mini-value">{{ maleCount }} <span class="stat-mini-pct">({{ malePercent }}%)</span></p>
          </div>
        </div>
      </el-card>
      <el-card shadow="never" class="stat-mini-card">
        <div class="stat-mini">
          <div class="stat-mini-icon" style="background: linear-gradient(135deg, #ec4899, #f43f5e);">
            <el-icon :size="22" color="#fff"><Female /></el-icon>
          </div>
          <div class="stat-mini-body">
            <p class="stat-mini-label">女生</p>
            <p class="stat-mini-value">{{ femaleCount }} <span class="stat-mini-pct">({{ femalePercent }}%)</span></p>
          </div>
        </div>
      </el-card>
      <el-card shadow="never" class="stat-mini-card">
        <div class="stat-mini">
          <div class="stat-mini-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
            <el-icon :size="22" color="#fff"><Histogram /></el-icon>
          </div>
          <div class="stat-mini-body">
            <p class="stat-mini-label">平均年龄</p>
            <p class="stat-mini-value">{{ avgAge }} <span class="stat-mini-pct">岁</span></p>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Classmates table -->
    <el-card shadow="never" class="table-card fade-up" style="--delay: 0.3s">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#1a56db"><User /></el-icon>
          <span class="card-title">同学列表</span>
          <el-tag type="info" size="small" effect="plain" round style="margin-left: 8px;">
            {{ totalStudents }} 人
          </el-tag>
        </div>
      </template>
      <el-table
        :data="classmates"
        stripe
        row-key="student_id"
        :row-class-name="tableRowClassName"
        empty-text="暂无同班同学数据"
      >
        <el-table-column label="头像" width="70" align="center">
          <template #default="{ row }">
            <el-avatar
              :size="36"
              :style="getAvatarStyle(row)"
              class="classmate-avatar"
            >
              {{ (row.name || '?').charAt(0) }}
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="student_id" label="学号" width="180" />
        <el-table-column prop="name" label="姓名" min-width="120">
          <template #default="{ row }">
            <span class="student-name">{{ row.name }}</span>
            <el-tag
              v-if="String(row.student_id) === String(studentId)"
              type="primary"
              size="small"
              effect="dark"
              round
              class="me-tag"
            >
              我
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="gender" label="性别" width="90" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.gender === '男'" color="#3b82f6" :size="16"><Male /></el-icon>
            <el-icon v-else-if="row.gender === '女'" color="#ec4899" :size="16"><Female /></el-icon>
            <span style="margin-left: 4px;">{{ row.gender || '--' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="age" label="年龄" width="90" align="center">
          <template #default="{ row }">
            {{ row.age ?? '--' }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.class-page {
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

/* Class header card */
.class-header-card {
  border-radius: 16px;
  border: none;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.35);
  overflow: hidden;
  position: relative;
}
.class-header-card::before {
  content: '';
  position: absolute;
  top: -40%;
  right: -10%;
  width: 320px;
  height: 320px;
  background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.class-header-card::after {
  content: '';
  position: absolute;
  bottom: -50%;
  left: 20%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
.class-header-card :deep(.el-card__body) {
  padding: 28px 32px;
  position: relative;
  z-index: 1;
}
.class-info-row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.class-badge {
  width: 68px;
  height: 68px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  backdrop-filter: blur(8px);
}
.class-details {
  flex: 1;
  min-width: 0;
}
.class-name {
  font-size: 26px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 6px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  letter-spacing: -0.5px;
}
.class-meta {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  margin: 0;
}
.class-quick-stats {
  display: flex;
  gap: 28px;
  flex-shrink: 0;
}
.quick-stat {
  text-align: center;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);
}
.qs-value {
  font-size: 24px;
  font-weight: 800;
  color: #fff;
  margin: 0;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
.qs-sep {
  color: rgba(255, 255, 255, 0.6);
  font-weight: 400;
}
.qs-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
}

/* Stats row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.stat-mini-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}
.stat-mini-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}
.stat-mini-card :deep(.el-card__body) {
  padding: 18px 22px;
}
.stat-mini {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-mini-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.stat-mini-label {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 2px;
  font-weight: 500;
}
.stat-mini-value {
  font-size: 22px;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
  line-height: 1.2;
}
.stat-mini-pct {
  font-size: 13px;
  font-weight: 400;
  color: #94a3b8;
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
.table-card :deep(.el-card__header) {
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
  border-radius: 16px 16px 0 0;
}
.table-card :deep(.el-card__body) {
  padding: 0;
}
.table-card :deep(.el-table) {
  border-radius: 0 0 16px 16px;
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

/* Classmate avatar */
.classmate-avatar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  transition: transform 0.3s ease;
}
.classmate-avatar:hover {
  transform: scale(1.1);
}

/* Student name */
.student-name {
  font-weight: 600;
  color: #1e293b;
}
.me-tag {
  margin-left: 6px;
}

/* Current student row highlight */
.table-card :deep(.current-student-row td) {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%) !important;
  border-left: 3px solid #667eea !important;
}
.table-card :deep(.current-student-row:hover > td) {
  background: linear-gradient(90deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.08) 100%) !important;
}

/* Responsive */
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
  .class-quick-stats {
    display: none;
  }
  .class-name {
    font-size: 20px;
  }
}
</style>
