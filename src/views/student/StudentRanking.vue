<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '../../stores/auth'
import { getStudents } from '../../api/student'
import { getAllGrades } from '../../api/grade'

const { displayName, studentId } = useAuth()

const loading = ref(true)
const allStudents = ref([])
const allGrades = ref([])

// Group grades by studentId and compute stats
const studentStats = computed(() => {
  const map = {}
  for (const g of allGrades.value) {
    const sid = g.studentId
    if (!map[sid]) {
      map[sid] = { studentId: sid, scores: [], sum: 0, max: 0 }
    }
    map[sid].scores.push(g.score)
    map[sid].sum += g.score
    if (g.score > map[sid].max) map[sid].max = g.score
  }
  const list = Object.values(map).map(s => ({
    studentId: s.studentId,
    avg: s.scores.length ? s.sum / s.scores.length : 0,
    max: s.max,
    courseCount: s.scores.length,
  }))
  // Sort descending by avg
  list.sort((a, b) => b.avg - a.avg)
  // Assign rank
  list.forEach((s, i) => { s.rank = i + 1 })
  return list
})

// Build name lookup from allStudents
const studentNameMap = computed(() => {
  const m = {}
  for (const s of allStudents.value) {
    m[s.studentId] = s.name
  }
  return m
})

// Ranking table data with name
const rankingData = computed(() => {
  return studentStats.value.map(s => ({
    ...s,
    name: studentNameMap.value[s.studentId] || s.studentId,
    avgDisplay: s.avg.toFixed(1),
  }))
})

// Current student's ranking info
const myRanking = computed(() => {
  return rankingData.value.find(r => String(r.studentId) === String(studentId.value)) || null
})

// Medal icon for top 3
const getMedalColor = (rank) => {
  if (rank === 1) return '#f59e0b'   // gold
  if (rank === 2) return '#94a3b8'   // silver
  if (rank === 3) return '#cd7f32'   // bronze
  return ''
}

const getMedalLabel = (rank) => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

// Row class for highlighting current student
const tableRowClassName = ({ row }) => {
  if (String(row.studentId) === String(studentId.value)) {
    return 'current-student-row'
  }
  return ''
}

onMounted(async () => {
  try {
    const [studentsRes, gradesRes] = await Promise.all([
      getStudents(),
      getAllGrades(),
    ])
    allStudents.value = studentsRes.data || []
    allGrades.value = gradesRes.data || []
  } catch (e) {
    console.error('加载排名数据失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="ranking-page">
    <!-- Page header -->
    <div class="page-header">
      <h2>成绩排名</h2>
      <p class="page-desc">查看全年级学生成绩排名情况</p>
    </div>

    <!-- My ranking card -->
    <el-card v-if="myRanking" shadow="never" class="my-rank-card">
      <div class="my-rank-inner">
        <div class="my-rank-left">
          <div class="my-rank-badge">
            <span class="rank-number">{{ myRanking.rank }}</span>
            <span class="rank-label">当前排名</span>
          </div>
        </div>
        <div class="my-rank-stats">
          <div class="my-stat">
            <p class="my-stat-label">平均分</p>
            <p class="my-stat-value">{{ myRanking.avgDisplay }}</p>
          </div>
          <div class="my-stat">
            <p class="my-stat-label">最高分</p>
            <p class="my-stat-value">{{ myRanking.max }}</p>
          </div>
          <div class="my-stat">
            <p class="my-stat-label">课程数</p>
            <p class="my-stat-value">{{ myRanking.courseCount }}</p>
          </div>
          <div class="my-stat">
            <p class="my-stat-label">总人数</p>
            <p class="my-stat-value">{{ rankingData.length }}</p>
          </div>
        </div>
      </div>
    </el-card>

    <!-- Ranking table -->
    <el-card shadow="never" class="table-card">
      <el-table
        :data="rankingData"
        stripe
        row-key="studentId"
        :row-class-name="tableRowClassName"
        empty-text="暂无排名数据"
      >
        <el-table-column label="排名" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.rank <= 3" class="medal-icon" :style="{ color: getMedalColor(row.rank) }">
              {{ getMedalLabel(row.rank) }}
            </span>
            <span v-else class="rank-num">{{ row.rank }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="studentId" label="学号" width="160" />
        <el-table-column prop="name" label="姓名" min-width="120">
          <template #default="{ row }">
            <span class="student-name">{{ row.name }}</span>
            <el-tag v-if="String(row.studentId) === String(studentId)" type="primary" size="small" effect="plain" round class="me-tag">
              我
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="平均分" width="120" align="center">
          <template #default="{ row }">
            <span class="score-val">{{ row.avgDisplay }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="max" label="最高分" width="110" align="center" />
        <el-table-column prop="courseCount" label="课程数" width="100" align="center" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.ranking-page {
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

/* My ranking card */
.my-rank-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
}
.my-rank-card :deep(.el-card__body) {
  padding: 24px 28px;
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
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #1a56db;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(26, 86, 219, 0.3);
}
.rank-number {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}
.rank-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
}
.my-rank-stats {
  display: flex;
  gap: 28px;
  flex: 1;
}
.my-stat {
  text-align: center;
}
.my-stat-label {
  font-size: 12px;
  color: #64748b;
  margin: 0 0 4px;
}
.my-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  line-height: 1.2;
}

/* Table card */
.table-card {
  border-radius: 8px;
  border: none;
}
.table-card :deep(.el-card__body) {
  padding: 0;
}
.table-card :deep(.el-table) {
  border-radius: 8px;
}

/* Medal icon */
.medal-icon {
  font-size: 22px;
}
.rank-num {
  font-size: 14px;
  font-weight: 600;
  color: #475569;
}

/* Student name */
.student-name {
  font-weight: 500;
  color: #1e293b;
}
.me-tag {
  margin-left: 6px;
}

/* Score display */
.score-val {
  font-weight: 700;
  color: #1e293b;
  font-size: 14px;
}

/* Current student row highlight - using deep since el-table row classes are not scoped */
.table-card :deep(.current-student-row) {
  background-color: #eff6ff !important;
}
.table-card :deep(.current-student-row:hover > td) {
  background-color: #dbeafe !important;
}
</style>
