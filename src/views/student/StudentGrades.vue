<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import * as XLSX from 'xlsx'
import { useAuth } from '../../stores/auth'
import { getGradesByStudent } from '../../api/grade'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'

const { studentId } = useAuth()

const loading = ref(true)
const grades = ref([])
const selectedSemester = ref('')
const chartRef = ref(null)
let chartInstance = null

// Extract unique semesters
const semesters = computed(() => {
  const set = new Set(grades.value.map(g => g.semester))
  return Array.from(set).sort().reverse()
})

// Filtered grades
const filteredGrades = computed(() => {
  if (!selectedSemester.value) return grades.value
  return grades.value.filter(g => g.semester === selectedSemester.value)
})

// Grade level helper
const getGradeLevel = (score) => {
  if (score >= 90) return '优秀'
  if (score >= 80) return '良好'
  if (score >= 70) return '中等'
  if (score >= 60) return '及格'
  return '不及格'
}

const getTagType = (score) => {
  if (score >= 90) return 'success'
  if (score >= 80) return ''        // primary
  if (score >= 70) return 'warning'
  if (score >= 60) return 'info'
  return 'danger'
}

const getTagEffect = (score) => {
  if (score >= 90) return 'light'
  return 'light'
}

// Summary stats
const totalCourses = computed(() => filteredGrades.value.length)

const avgScore = computed(() => {
  if (!filteredGrades.value.length) return 0
  const sum = filteredGrades.value.reduce((acc, g) => acc + g.score, 0)
  return (sum / filteredGrades.value.length).toFixed(1)
})

const gpa = computed(() => {
  if (!filteredGrades.value.length) return 0
  const total = filteredGrades.value.reduce((acc, g) => {
    const point = Math.max(0, g.score / 10 - 5)
    return acc + point
  }, 0)
  return (total / filteredGrades.value.length).toFixed(2)
})

// Summary method for el-table
const summaryMethod = ({ columns }) => {
  const cells = columns.map((col, index) => {
    if (index === 0) return '合计 / 平均'
    if (col.property === 'score') return `均分 ${avgScore.value}`
    if (col.property === 'semester') return `共 ${totalCourses.value} 门`
    if (col.property === 'level') return `GPA ${gpa.value}`
    return ''
  })
  return cells
}

// Export to Excel
const handleExport = () => {
  if (!filteredGrades.value.length) {
    ElMessage.warning('没有可导出的成绩数据')
    return
  }
  const data = filteredGrades.value.map((g, idx) => ({
    '序号': idx + 1,
    '课程名称': g.courseName,
    '成绩': g.score,
    '等级': getGradeLevel(g.score),
    '学期': g.semester
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 6 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 16 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '我的成绩')
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const fileName = `我的成绩_${today}.xlsx`
  XLSX.writeFile(wb, fileName)
  ElMessage.success(`已导出 ${data.length} 条记录`)
}

// Radar chart for top 5
const initRadarChart = () => {
  if (!chartRef.value || !filteredGrades.value.length) return

  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }

  const top5 = [...filteredGrades.value]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  if (top5.length < 3) return // radar needs at least 3 axes

  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption({
    title: {
      text: '优势科目 TOP5',
      left: 'center',
      textStyle: { color: '#1e293b', fontSize: 14, fontWeight: 600 },
    },
    tooltip: {},
    radar: {
      indicator: top5.map(g => ({
        name: g.courseName,
        max: 100,
      })),
      shape: 'polygon',
      splitNumber: 5,
      axisName: { color: '#475569', fontSize: 12 },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
      splitArea: { areaStyle: { color: ['#fff', '#f8fafc'] } },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: top5.map(g => g.score),
            name: '成绩',
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#1a56db', width: 2 },
            itemStyle: { color: '#1a56db' },
            areaStyle: { color: 'rgba(26,86,219,0.18)' },
          },
        ],
      },
    ],
  })
}

const handleResize = () => chartInstance?.resize()

// Re-render chart when filter changes
watch(selectedSemester, async () => {
  await nextTick()
  initRadarChart()
})

onMounted(async () => {
  try {
    const res = await getGradesByStudent(studentId.value)
    const raw = res.data || []
    grades.value = raw.map(g => ({
      ...g,
      courseName: g.course_name || g.courseName || '',
      studentId: g.student_id || g.studentId || '',
      courseType: g.course_type || g.courseType || '必修',
    }))
  } catch (e) {
    console.error('加载成绩失败', e)
  } finally {
    loading.value = false
  }
  await nextTick()
  initRadarChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<template>
  <div v-loading="loading" class="grades-page">
    <!-- Page header -->
    <div class="page-header">
      <h2>成绩查询</h2>
      <p class="page-desc">查看您的各科成绩和学分绩点</p>
    </div>

    <!-- Filter bar -->
    <el-card shadow="never" class="filter-card">
      <div class="filter-row">
        <span class="filter-label">学期筛选：</span>
        <el-select
          v-model="selectedSemester"
          placeholder="全部学期"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="s in semesters"
            :key="s"
            :label="s"
            :value="s"
          />
        </el-select>
        <div class="filter-stats">
          <el-tag type="primary" effect="plain" round size="small">
            共 {{ totalCourses }} 门课程
          </el-tag>
          <el-tag type="success" effect="plain" round size="small">
            均分 {{ avgScore }}
          </el-tag>
          <el-tag type="warning" effect="plain" round size="small">
            GPA {{ gpa }}
          </el-tag>
          <el-button type="success" size="small" plain @click="handleExport">
            <el-icon><Download /></el-icon>
            导出Excel
          </el-button>
        </div>
      </div>
    </el-card>

    <!-- Grades table -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="filteredGrades"
        stripe
        show-summary
        :summary-method="summaryMethod"
        row-key="id"
        empty-text="暂无成绩数据"
      >
        <el-table-column prop="courseName" label="课程名称" min-width="140">
          <template #default="{ row }">
            <span class="course-name">{{ row.courseName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="score" label="成绩" width="110" align="center">
          <template #default="{ row }">
            <el-tag
              :type="getTagType(row.score)"
              :effect="getTagEffect(row.score)"
              round
              size="default"
              class="score-tag"
            >
              {{ row.score }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="semester" label="学期" width="160" />
        <el-table-column prop="level" label="等级" width="100" align="center">
          <template #default="{ row }">
            <span :class="['level-text', `level-${getGradeLevel(row.score)}`]">
              {{ getGradeLevel(row.score) }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Radar chart -->
    <el-card shadow="never" class="chart-card">
      <div ref="chartRef" class="chart-container"></div>
    </el-card>
  </div>
</template>

<style scoped>
.grades-page {
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

/* Filter card */
.filter-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 16px;
}
.filter-card :deep(.el-card__body) {
  padding: 16px 20px;
}
.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #475569;
}
.filter-stats {
  margin-left: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* Table card */
.table-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 16px;
}
.table-card :deep(.el-card__body) {
  padding: 0;
}
.table-card :deep(.el-table) {
  border-radius: 8px;
}
.course-name {
  font-weight: 500;
  color: #1e293b;
}
.score-tag {
  font-weight: 700;
  font-size: 13px;
  min-width: 44px;
  text-align: center;
}

/* Level text colors */
.level-text {
  font-size: 13px;
  font-weight: 500;
}
.level-优秀 { color: #10b981; }
.level-良好 { color: #1a56db; }
.level-中等 { color: #f59e0b; }
.level-及格 { color: #94a3b8; }
.level-不及格 { color: #ef4444; }

/* Summary row styling */
.table-card :deep(.el-table__footer-wrapper) {
  background: #f8fafc;
}
.table-card :deep(.el-table__footer .cell) {
  font-weight: 600;
  color: #475569;
  font-size: 13px;
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
  height: 300px;
}
</style>
