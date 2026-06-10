<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '../../stores/auth'
import { getStudents, getStudentByStudentId } from '../../api/student'

const { displayName, studentId } = useAuth()

const loading = ref(true)
const currentStudent = ref(null)
const allStudents = ref([])

// Classmates filtered by same className
const classmates = computed(() => {
  if (!currentStudent.value?.className) return []
  return allStudents.value.filter(
    s => s.className === currentStudent.value.className
  )
})

// Class info
const className = computed(() => currentStudent.value?.className || '--')
const major = computed(() => currentStudent.value?.major || '--')
const totalStudents = computed(() => classmates.value.length)

// Gender stats
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

// Average age
const avgAge = computed(() => {
  const withAge = classmates.value.filter(s => s.age != null && s.age !== '')
  if (!withAge.length) return '--'
  const sum = withAge.reduce((acc, s) => acc + Number(s.age), 0)
  return (sum / withAge.length).toFixed(1)
})

onMounted(async () => {
  try {
    const [studentRes, studentsRes] = await Promise.all([
      getStudentByStudentId(studentId.value),
      getStudents(),
    ])
    currentStudent.value = studentRes.data
    allStudents.value = studentsRes.data || []
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
    <el-card shadow="never" class="class-header-card">
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
    <div class="stats-row">
      <el-card shadow="never" class="stat-mini-card">
        <div class="stat-mini">
          <div class="stat-mini-icon" style="background: #eff6ff; color: #1a56db;">
            <el-icon :size="22"><Male /></el-icon>
          </div>
          <div class="stat-mini-body">
            <p class="stat-mini-label">男生</p>
            <p class="stat-mini-value">{{ maleCount }} <span class="stat-mini-pct">({{ malePercent }}%)</span></p>
          </div>
        </div>
      </el-card>
      <el-card shadow="never" class="stat-mini-card">
        <div class="stat-mini">
          <div class="stat-mini-icon" style="background: #fdf2f8; color: #ec4899;">
            <el-icon :size="22"><Female /></el-icon>
          </div>
          <div class="stat-mini-body">
            <p class="stat-mini-label">女生</p>
            <p class="stat-mini-value">{{ femaleCount }} <span class="stat-mini-pct">({{ femalePercent }}%)</span></p>
          </div>
        </div>
      </el-card>
      <el-card shadow="never" class="stat-mini-card">
        <div class="stat-mini">
          <div class="stat-mini-icon" style="background: #ecfdf5; color: #10b981;">
            <el-icon :size="22"><Histogram /></el-icon>
          </div>
          <div class="stat-mini-body">
            <p class="stat-mini-label">平均年龄</p>
            <p class="stat-mini-value">{{ avgAge }} <span class="stat-mini-pct">岁</span></p>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Classmates table -->
    <el-card shadow="never" class="table-card">
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
        row-key="studentId"
        empty-text="暂无同班同学数据"
      >
        <el-table-column prop="studentId" label="学号" width="180" />
        <el-table-column prop="name" label="姓名" min-width="120">
          <template #default="{ row }">
            <span class="student-name">{{ row.name }}</span>
            <el-tag
              v-if="String(row.studentId) === String(studentId)"
              type="primary"
              size="small"
              effect="plain"
              round
              class="me-tag"
            >
              我
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="gender" label="性别" width="90" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.gender === '男'" color="#1a56db" :size="16"><Male /></el-icon>
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
.page-desc {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* Class header card */
.class-header-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}
.class-header-card :deep(.el-card__body) {
  padding: 24px 28px;
}
.class-info-row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.class-badge {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: #1a56db;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(26, 86, 219, 0.3);
}
.class-details {
  flex: 1;
  min-width: 0;
}
.class-name {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
}
.class-meta {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}
.class-quick-stats {
  display: flex;
  gap: 24px;
  flex-shrink: 0;
}
.quick-stat {
  text-align: center;
}
.qs-value {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  line-height: 1.2;
}
.qs-sep {
  color: #94a3b8;
  font-weight: 400;
}
.qs-label {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}

/* Stats row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.stat-mini-card {
  border-radius: 8px;
  border: none;
}
.stat-mini-card :deep(.el-card__body) {
  padding: 16px 20px;
}
.stat-mini {
  display: flex;
  align-items: center;
  gap: 14px;
}
.stat-mini-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-mini-label {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 2px;
}
.stat-mini-value {
  font-size: 20px;
  font-weight: 700;
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
  border-radius: 8px;
  border: none;
}
.table-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid #f1f5f9;
}
.table-card :deep(.el-card__body) {
  padding: 0;
}
.table-card :deep(.el-table) {
  border-radius: 8px;
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

/* Student name */
.student-name {
  font-weight: 500;
  color: #1e293b;
}
.me-tag {
  margin-left: 6px;
}
</style>
