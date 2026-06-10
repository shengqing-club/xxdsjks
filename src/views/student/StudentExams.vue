<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { OfficeBuilding, Calendar, Location, Clock } from '@element-plus/icons-vue'
import { useAuth } from '../../stores/auth'
import { getStudentByStudentId } from '../../api/student'
import { getClassExams } from '../../api/exam'
import { normalizeDate, formatDateCN, formatTimeRange, getExamStatus } from '../../utils/exam'

const { studentId } = useAuth()
const loading = ref(true)
const currentStudent = ref(null)
const exams = ref([])

const todayStr = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
})()

// === 统计 ===
const allCount = computed(() => exams.value.length)
const upcomingCount = computed(() =>
  exams.value.filter(e => normalizeDate(e.exam_date) >= todayStr).length
)
const finishedCount = computed(() => allCount.value - upcomingCount.value)
const ongoingExams = computed(() =>
  exams.value.filter(e => getExamStatus(e).tag === '考试中')
)

// === 按日期分组（所有考试，含已结束） ===
const groupedExams = computed(() => {
  const map = {}
  exams.value.forEach(e => {
    const d = normalizeDate(e.exam_date) || e.exam_date
    if (!map[d]) map[d] = []
    map[d].push(e)
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({
      date,
      displayDate: formatDateCN(date),
      list: list.sort((a, b) => (a.exam_time || '').localeCompare(b.exam_time || ''))
    }))
})

onMounted(async () => {
  try {
    const stuRes = await getStudentByStudentId(studentId.value)
    currentStudent.value = stuRes.data
    const className = currentStudent.value?.class_name
    if (!className) {
      ElMessage.warning('未找到您的班级信息')
      loading.value = false
      return
    }
    const examsRes = await getClassExams(className)
    exams.value = examsRes.data || examsRes || []
  } catch (e) {
    console.error('加载考试安排失败', e)
    ElMessage.error('加载考试安排失败')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="exam-page">
    <!-- 考试中横幅 -->
    <el-alert
      v-if="ongoingExams.length"
      type="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px; border-radius: 8px;"
    >
      <template #title>
        <span style="font-weight: 700; font-size: 15px;">正在考试中</span>
      </template>
      <template #default>
        <div class="ongoing-list">
          <div v-for="exam in ongoingExams" :key="exam.id" class="ongoing-item">
            <strong>{{ exam.course_name }}</strong>
            <span>{{ exam.location }}</span>
            <span>{{ formatTimeRange(exam) }}</span>
            <el-tag type="danger" size="small" effect="dark">考试中</el-tag>
          </div>
        </div>
      </template>
    </el-alert>

    <!-- Page header -->
    <div class="page-header">
      <h2 class="page-title">考试安排</h2>
      <p class="page-desc">查看您的班级考试日程</p>
    </div>

    <!-- 统计卡片 -->
    <el-row v-if="exams.length" :gutter="16" class="stats-row">
      <el-col :span="8">
        <el-card shadow="never" class="stat-card total">
          <div class="stat-value">{{ allCount }}</div>
          <div class="stat-label">总考试数</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="stat-card upcoming">
          <div class="stat-value">{{ upcomingCount }}</div>
          <div class="stat-label">待考科目</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="stat-card finished">
          <div class="stat-value">{{ finishedCount }}</div>
          <div class="stat-label">已结束</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 考试列表（按日期分组） -->
    <div v-if="groupedExams.length" class="exam-timeline">
      <div v-for="group in groupedExams" :key="group.date" class="exam-day-group">
        <div class="day-header" :class="{ 'day-today': group.date === todayStr }">
          <el-icon :size="18"><Calendar /></el-icon>
          <span class="day-text">{{ group.displayDate }}</span>
          <el-tag size="small" effect="plain" round>{{ group.date }}</el-tag>
        </div>
        <div class="exam-cards">
          <el-card
            v-for="exam in group.list"
            :key="exam.id"
            shadow="hover"
            class="exam-card"
            :class="'status-' + getExamStatus(exam).type"
          >
            <div class="exam-card-body">
              <div class="exam-main">
                <div class="exam-title-row">
                  <el-tag :type="getExamStatus(exam).type" size="small" :effect="getExamStatus(exam).tag === '考试中' ? 'dark' : 'light'" round>
                    {{ getExamStatus(exam).tag }}
                  </el-tag>
                  <h3 class="exam-course">{{ exam.course_name }}</h3>
                </div>
                <div class="exam-meta">
                  <span class="meta-item">
                    <el-icon :size="14"><Clock /></el-icon>
                    <strong>{{ formatTimeRange(exam) }}</strong>
                  </span>
                  <span class="meta-item">
                    <el-icon :size="14"><Location /></el-icon>
                    {{ exam.location || '待定' }}
                  </span>
                  <span v-if="exam.class_name" class="meta-item">
                    <el-icon :size="14"><OfficeBuilding /></el-icon>
                    {{ exam.class_name }}
                  </span>
                </div>
                <p v-if="exam.description" class="exam-desc">{{ exam.description }}</p>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <el-empty v-if="!loading && !exams.length" description="暂无考试安排" :image-size="120">
      <template #description>
        <p>当前班级暂无考试安排</p>
        <p class="empty-hint">请联系管理员添加考试日程</p>
      </template>
    </el-empty>
  </div>
</template>

<style scoped>
.exam-page { max-width: 900px; margin: 0 auto; }

/* 考试中横幅 */
.ongoing-list { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.ongoing-item { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #7f1d1d; }
.ongoing-item strong { font-size: 15px; }

.page-header { margin-bottom: 20px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }

/* Stats */
.stats-row { margin-bottom: 20px; }
.stat-card { border-radius: 8px; text-align: center; border: none; }
.stat-card :deep(.el-card__body) { padding: 18px; }
.stat-card.total { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
.stat-card.upcoming { background: linear-gradient(135deg, #fefce8, #fef3c7); }
.stat-card.finished { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
.stat-value { font-size: 28px; font-weight: 700; }
.stat-card.total .stat-value { color: #1a56db; }
.stat-card.upcoming .stat-value { color: #d97706; }
.stat-card.finished .stat-value { color: #16a34a; }
.stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }

/* Timeline */
.exam-timeline { display: flex; flex-direction: column; gap: 20px; }
.exam-day-group { }
.day-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 12px; color: #475569; font-weight: 600; font-size: 15px;
}
.day-header.day-today { color: #dc2626; }
.day-text { color: #1e293b; }
.day-header.day-today .day-text { color: #dc2626; }
.day-header .el-tag { margin-left: auto; }

/* Exam cards */
.exam-cards { display: flex; flex-direction: column; gap: 12px; }
.exam-card {
  border-radius: 10px; border: 1px solid #e8ecf4;
  transition: all 0.2s;
}
.exam-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
.exam-card.status-danger { border-left: 4px solid #ef4444; background: #fff5f5; }
.exam-card.status-warning { border-left: 4px solid #f59e0b; }
.exam-card.status-success { border-left: 4px solid #10b981; }
.exam-card.status-info { border-left: 4px solid #94a3b8; }
.exam-card.status-primary { border-left: 4px solid #1a56db; }
.exam-card :deep(.el-card__body) { padding: 18px 20px; }
.exam-card-body { display: flex; gap: 16px; align-items: flex-start; }
.exam-main { flex: 1; min-width: 0; }
.exam-title-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.exam-course { font-size: 17px; font-weight: 700; color: #1e293b; margin: 0; }
.exam-meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; color: #64748b; }
.meta-item { display: flex; align-items: center; gap: 4px; }
.exam-desc { font-size: 13px; color: #94a3b8; margin: 8px 0 0; }

/* Empty */
.empty-hint { font-size: 13px; color: #94a3b8; margin-top: 4px; }
</style>
