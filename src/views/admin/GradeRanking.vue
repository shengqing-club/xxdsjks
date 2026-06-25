<template>
  <div class="ranking-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">成绩排名榜</h2>
        <p class="page-desc">按均分降序排列，支持按学期和专业筛选</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <el-card shadow="never" class="filter-card">
      <div class="filter-row">
        <el-select v-model="filterSemester" placeholder="全部学期" clearable style="width: 180px" @change="fetchData">
          <el-option v-for="s in semesters" :key="s" :label="s" :value="s" />
        </el-select>
        <el-select v-model="filterMajor" placeholder="全部专业" clearable style="width: 180px" @change="fetchData">
          <el-option v-for="m in majorList" :key="m" :label="m" :value="m" />
        </el-select>
        <el-button type="primary" :icon="'Download'" @click="handleExport" plain>导出排名表</el-button>
        <span class="result-count">共 <strong>{{ rankedData.length }}</strong> 人参与排名</span>
      </div>
    </el-card>

    <!-- Top 3 Cards -->
    <el-row :gutter="16" class="top3-row" v-if="rankedData.length >= 3">
      <el-col :span="8">
        <el-card shadow="never" class="top-card top-silver">
          <div class="medal">🥈</div>
          <div class="top-name">{{ rankedData[1]?.name }}</div>
          <div class="top-major">{{ rankedData[1]?.major }}</div>
          <div class="top-score">均分 {{ rankedData[1]?.avg_score }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="top-card top-gold">
          <div class="medal">🥇</div>
          <div class="top-name">{{ rankedData[0]?.name }}</div>
          <div class="top-major">{{ rankedData[0]?.major }}</div>
          <div class="top-score">均分 {{ rankedData[0]?.avg_score }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="top-card top-bronze">
          <div class="medal">🥉</div>
          <div class="top-name">{{ rankedData[2]?.name }}</div>
          <div class="top-major">{{ rankedData[2]?.major }}</div>
          <div class="top-score">均分 {{ rankedData[2]?.avg_score }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Ranking Table -->
    <el-card shadow="never" class="table-card">
      <el-table :data="rankedData" stripe highlight-current-row row-key="student_id">
        <el-table-column label="排名" width="80" align="center">
          <template #default="{ row }">
            <span :class="['rank-badge', `rank-${row.rank <= 3 ? row.rank : 'other'}`]">{{ row.rank }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="student_id" label="学号" min-width="120" />
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="major" label="专业" min-width="140" />
        <el-table-column prop="class_name" label="班级" min-width="120" />
        <el-table-column prop="course_count" label="课程数" width="90" align="center" />
        <el-table-column label="均分" width="100" align="center">
          <template #default="{ row }">
            <span :style="{ color: getScoreColor(row.avg_score), fontWeight: 700, fontSize: '15px' }">{{ row.avg_score }}</span>
          </template>
        </el-table-column>
        <el-table-column label="GPA" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getGpaType(row.gpa)" size="small" round>{{ row.gpa }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最高分" width="90" align="center">
          <template #default="{ row }"><span style="color:#10b981;font-weight:600">{{ row.max_score }}</span></template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getGradeRanking } from '../../api/grade'
import { getMajors } from '../../api/major'
import * as XLSX from 'xlsx'

const loading = ref(false)
const rankedData = ref([])
const filterSemester = ref('')
const filterMajor = ref('')
const semesters = ref([])
const majorList = ref([])

const getScoreColor = (s) => s >= 90 ? '#16a34a' : s >= 80 ? '#2563eb' : s >= 70 ? '#d97706' : s >= 60 ? '#64748b' : '#dc2626'
const getGpaType = (g) => g >= 4.0 ? 'success' : g >= 3.0 ? 'primary' : g >= 2.0 ? 'warning' : 'danger'

const fetchData = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterSemester.value) params.semester = filterSemester.value
    if (filterMajor.value) params.major = filterMajor.value
    const res = await getGradeRanking(params)
    rankedData.value = res.data || []
    console.log('[GradeRanking] 加载排名数:', rankedData.value.length)
    // Extract semesters
    if (!filterSemester.value) {
      const set = new Set()
      rankedData.value.forEach(r => r.semester && set.add(r.semester))
      semesters.value = Array.from(set).sort().reverse()
    }
  } catch (e) { ElMessage.error('获取排名失败'); console.error(e) } finally { loading.value = false }
}

const fetchMajors = async () => {
  try {
    const res = await getMajors()
    majorList.value = (res.data || res || []).map(m => m.name).filter(Boolean)
  } catch {}
}

const handleExport = () => {
  if (!rankedData.value.length) { ElMessage.warning('没有数据'); return }
  const data = rankedData.value.map((r, i) => ({
    '排名': i + 1, '学号': r.student_id, '姓名': r.name, '专业': r.major,
    '班级': r.class_name, '课程数': r.course_count, '均分': r.avg_score, 'GPA': r.gpa
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '成绩排名')
  XLSX.writeFile(wb, `成绩排名_${new Date().toLocaleDateString('zh-CN')}.xlsx`)
  ElMessage.success('导出成功')
}

onMounted(() => { fetchData(); fetchMajors() })
</script>

<style scoped>
.ranking-page { max-width: 1100px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.filter-card { border-radius: 8px; margin-bottom: 20px; }
.filter-card :deep(.el-card__body) { padding: 14px 20px; }
.filter-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.result-count { margin-left: auto; font-size: 14px; color: #64748b; }
.result-count strong { color: #1a56db; }
.top3-row { margin-bottom: 20px; }
.top-card { border-radius: 12px; text-align: center; }
.top-card :deep(.el-card__body) { padding: 20px; }
.top-gold { background: linear-gradient(135deg, #fef3c7, #fffbeb); border: 2px solid #f59e0b; }
.top-silver { background: linear-gradient(135deg, #f1f5f9, #f8fafc); border: 2px solid #94a3b8; }
.top-bronze { background: linear-gradient(135deg, #fef2f2, #fff7ed); border: 2px solid #d97706; }
.medal { font-size: 36px; }
.top-name { font-size: 18px; font-weight: 700; color: #1e293b; margin: 6px 0; }
.top-major { font-size: 13px; color: #64748b; }
.top-score { font-size: 15px; font-weight: 600; color: #1a56db; margin-top: 4px; }
.rank-badge { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; font-weight: 700; font-size: 13px; }
.rank-1 { background: #fef3c7; color: #f59e0b; }
.rank-2 { background: #f1f5f9; color: #64748b; }
.rank-3 { background: #fef2f2; color: #d97706; }
.rank-other { color: #94a3b8; }
.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }

@media (max-width: 768px) {
  .ranking-page { max-width: 100%; }
  .filter-row { flex-direction: column; align-items: stretch; }
  .filter-row .el-select { width: 100% !important; }
  .result-count { margin-left: 0; text-align: center; }
  .top3-row :deep(.el-col) { max-width: 100% !important; flex: 0 0 100% !important; margin-bottom: 12px; }
  .table-card :deep(.el-card__body) { overflow-x: auto; }
  .table-card :deep(.el-table) { min-width: 700px; }
}
</style>

