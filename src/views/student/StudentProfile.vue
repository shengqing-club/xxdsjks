<script setup>
import { ref, onMounted, computed } from 'vue'
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
        <el-avatar :size="80" class="profile-avatar">
          <el-icon :size="40"><User /></el-icon>
        </el-avatar>
        <div class="profile-intro">
          <h3 class="profile-name">{{ student?.name || displayName }}</h3>
          <p class="profile-id">学号：{{ student?.studentId || studentId }}</p>
          <el-tag type="primary" size="small" effect="plain" round>在读</el-tag>
        </div>
      </div>
    </el-card>

    <!-- Basic info card -->
    <el-card shadow="never" class="info-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#1a56db"><UserFilled /></el-icon>
          <span class="card-title">基本资料</span>
        </div>
      </template>
      <el-descriptions :column="2" border label-style="{ width: '120px', fontWeight: 500 }">
        <el-descriptions-item label="学号">
          <span class="desc-val">{{ student?.studentId || '--' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="姓名">
          <span class="desc-val">{{ student?.name || displayName || '--' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="性别">
          <span class="desc-val">{{ student?.gender || '--' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="年龄">
          <span class="desc-val">{{ student?.age ?? '--' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="专业">
          <span class="desc-val">{{ student?.major || '--' }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="班级">
          <span class="desc-val">{{ student?.className || '--' }}</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Enrollment info card -->
    <el-card shadow="never" class="info-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#10b981"><School /></el-icon>
          <span class="card-title">学籍信息</span>
        </div>
      </template>
      <el-descriptions :column="2" border label-style="{ width: '120px', fontWeight: 500 }">
        <el-descriptions-item label="入学年份">
          <span class="desc-val">{{ enrollmentYear }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="入学学期">
          <span class="desc-val">{{ enrollmentSemester }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="学籍状态">
          <el-tag type="success" size="small" effect="light">在读</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="学制">
          <span class="desc-val">四年制本科</span>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<style scoped>
.profile-page {
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

/* Profile header card */
.profile-header-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}
.profile-header-card :deep(.el-card__body) {
  padding: 28px 32px;
}
.profile-top {
  display: flex;
  align-items: center;
  gap: 24px;
}
.profile-avatar {
  background: #1a56db;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(26, 86, 219, 0.3);
}
.profile-intro {
  flex: 1;
}
.profile-name {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 6px;
}
.profile-id {
  font-size: 14px;
  color: #64748b;
  margin: 0 0 10px;
}

/* Info cards */
.info-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 16px;
}
.info-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid #f1f5f9;
}
.info-card :deep(.el-card__body) {
  padding: 20px;
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
.desc-val {
  font-size: 14px;
  color: #334155;
}
</style>
