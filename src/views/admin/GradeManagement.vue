<template>
  <div class="grade-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">成绩发布与管理</h2>
        <p class="page-desc">按班级查看成绩，支持筛选、编辑与Excel导入导出</p>
      </div>
      <div class="view-toggle">
        <el-radio-group v-model="viewMode" size="small">
          <el-radio-button label="class">班级视图</el-radio-button>
          <el-radio-button label="all">全局视图</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 全局统计面板 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="4" v-for="stat in statsCards" :key="stat.label">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 班级视图 -->
    <template v-if="viewMode === 'class'">
      <!-- 班级概览卡片 -->
      <div class="class-overview-grid">
        <div
          v-for="cls in classStats"
          :key="cls.class_name"
          class="class-overview-card"
          :class="{ active: activeClass === cls.class_name }"
          @click="activeClass = cls.class_name"
        >
          <div class="cls-name">{{ cls.class_name }}</div>
          <div class="cls-meta">
            <span>{{ cls.student_count }}人</span>
            <span class="sep">|</span>
            <span :style="{ color: getScoreColor(cls.avg_score) }">均分{{ cls.avg_score }}</span>
            <span class="sep">|</span>
            <span>GPA {{ cls.avg_gpa }}</span>
          </div>
          <div class="cls-pass-bar">
            <div class="pass-track">
              <div class="pass-fill pass-excellent" :style="{ width: cls.excellent / cls.grade_count * 100 + '%' }"></div>
              <div class="pass-fill pass-good" :style="{ width: cls.good / cls.grade_count * 100 + '%', left: cls.excellent / cls.grade_count * 100 + '%' }"></div>
              <div class="pass-fill pass-medium" :style="{ width: cls.medium / cls.grade_count * 100 + '%', left: (cls.excellent + cls.good) / cls.grade_count * 100 + '%' }"></div>
              <div class="pass-fill pass-pass" :style="{ width: cls.pass_count / cls.grade_count * 100 + '%', left: (cls.excellent + cls.good + cls.medium) / cls.grade_count * 100 + '%' }"></div>
              <div class="pass-fill pass-fail" :style="{ width: cls.fail / cls.grade_count * 100 + '%', left: (cls.excellent + cls.good + cls.medium + cls.pass_count) / cls.grade_count * 100 + '%' }"></div>
            </div>
          </div>
          <div class="cls-legend">
            <span class="dot dot-excellent"></span>优{{ cls.excellent }}
            <span class="dot dot-good"></span>良{{ cls.good }}
            <span class="dot dot-medium"></span>中{{ cls.medium }}
            <span class="dot dot-pass"></span>及{{ cls.pass_count }}
            <span class="dot dot-fail"></span>不{{ cls.fail }}
          </div>
        </div>
      </div>

      <!-- 当前班级成绩详情 -->
      <el-card v-if="activeClass" shadow="never" class="table-card class-detail-card">
        <template #header>
          <div class="class-detail-header">
            <span class="class-detail-title">
              <el-icon><School /></el-icon> {{ activeClass }} — 成绩明细
            </span>
            <span class="class-detail-count">共 {{ classGrades.length }} 条</span>
          </div>
        </template>
        <div class="toolbar mini-toolbar">
          <el-input v-model="classSearch" placeholder="搜索学号/姓名/课程" clearable style="width: 220px" @clear="filterClassGrades" @keyup.enter="filterClassGrades">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" plain size="small" @click="filterClassGrades">搜索</el-button>
          <el-button size="small" @click="classSearch = ''; filterClassGrades()">重置</el-button>
          <el-button size="small" type="success" plain @click="exportClassGrades">
            <el-icon><Download /></el-icon>导出本班
          </el-button>
          <span class="mini-result-count">显示 <strong>{{ filteredClassGrades.length }}</strong> 条</span>
        </div>
        <el-table :data="filteredClassGrades" stripe row-key="id" max-height="460">
          <el-table-column prop="student_id" label="学号" width="120" />
          <el-table-column prop="student_name" label="姓名" width="90" />
          <el-table-column prop="course_name" label="课程" min-width="150" />
          <el-table-column label="成绩" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getScoreTag(row.score)" effect="light" round size="default">{{ row.score }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="等级" width="80" align="center">
            <template #default="{ row }">
              <span :style="{ color: getScoreColor(row.score), fontWeight: 600 }">{{ getLevel(row.score) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="semester" label="学期" width="140" />
          <el-table-column prop="course_type" label="类型" width="80" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" text @click="handleEdit(row)"><el-icon><Edit /></el-icon></el-button>
              <el-button type="danger" size="small" text @click="handleDelete(row)"><el-icon><Delete /></el-icon></el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
      <el-empty v-else description="点击班级卡片查看成绩明细" :image-size="80" />
    </template>

    <!-- 全局视图 -->
    <template v-if="viewMode === 'all'">
      <el-card shadow="never" class="toolbar-card">
        <div class="toolbar">
          <el-button type="primary" @click="handleAdd"><el-icon><Plus /></el-icon>新增成绩</el-button>
          <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx,.xls" :on-change="handleExcelImport">
            <el-button type="success" plain><el-icon><Upload /></el-icon>导入Excel</el-button>
          </el-upload>
          <el-button type="success" @click="handleExport" plain><el-icon><Download /></el-icon>导出</el-button>
          <el-input v-model="searchKeyword" placeholder="学号/姓名/课程/班级" clearable style="width: 200px" @clear="handleSearch" @keyup.enter="handleSearch">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filterMajor" placeholder="专业筛选" clearable style="width: 160px" @change="handleSearch">
            <el-option v-for="m in majorList" :key="m" :label="m" :value="m" />
          </el-select>
          <el-button type="primary" plain @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset"><el-icon><RefreshRight /></el-icon>重置</el-button>
          <span class="result-count">共 <strong>{{ filteredGrades.length }}</strong> 条</span>
        </div>
      </el-card>
      <el-card shadow="never" class="table-card">
        <el-table :data="filteredGrades" stripe row-key="id" :default-sort="{ prop: 'class_name', order: 'ascending' }">
          <el-table-column prop="student_id" label="学号" width="120" />
          <el-table-column prop="student_name" label="姓名" width="90" />
          <el-table-column prop="class_name" label="班级" width="120" sortable />
          <el-table-column prop="course_name" label="课程名称" min-width="140" />
          <el-table-column label="成绩" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getScoreTag(row.score)" effect="light" round size="default">{{ row.score }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="等级" width="80" align="center">
            <template #default="{ row }">
              <span :style="{ color: getScoreColor(row.score), fontWeight: 600 }">{{ getLevel(row.score) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="semester" label="学期" width="140" />
          <el-table-column prop="course_type" label="类型" width="80" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button type="primary" size="small" text @click="handleEdit(row)"><el-icon><Edit /></el-icon></el-button>
              <el-button type="danger" size="small" text @click="handleDelete(row)"><el-icon><Delete /></el-icon></el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑成绩' : '新增成绩'" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="学号" prop="studentId">
          <el-select v-model="form.studentId" filterable placeholder="搜索学号或姓名" style="width:100%" :disabled="isEdit">
            <el-option v-for="s in studentOptions" :key="s.student_id" :label="`${s.student_id} - ${s.name}`" :value="s.student_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程名称" prop="courseName">
          <el-input v-model="form.courseName" placeholder="请输入课程名称" />
        </el-form-item>
        <el-form-item label="成绩" prop="score">
          <el-input-number v-model="form.score" :min="0" :max="100" :precision="0" style="width:100%" />
        </el-form-item>
        <el-form-item label="课程类型">
          <el-select v-model="form.courseType" style="width:100%">
            <el-option label="必修" value="必修" />
            <el-option label="选修" value="选修" />
            <el-option label="实践" value="实践" />
          </el-select>
        </el-form-item>
        <el-form-item label="学期" prop="semester">
          <el-input v-model="form.semester" placeholder="例如: 2024-2025-2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 导入预览 -->
    <el-dialog v-model="importDialogVisible" title="Excel 导入预览" width="700px">
      <div class="import-info">已解析 <strong>{{ importData.length }}</strong> 条，请确认</div>
      <el-table :data="importData.slice(0, 10)" stripe max-height="300" style="margin:12px 0">
        <el-table-column prop="studentId" label="学号" />
        <el-table-column prop="courseName" label="课程" />
        <el-table-column prop="score" label="成绩" />
        <el-table-column prop="courseType" label="类型" />
        <el-table-column prop="semester" label="学期" />
      </el-table>
      <div v-if="importData.length > 10" class="import-more">... 还有 {{ importData.length - 10 }} 条</div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importLoading" @click="confirmImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, RefreshRight, Edit, Delete, Download, Upload, School } from '@element-plus/icons-vue'
import { getAllGrades, addGrade, updateGrade, deleteGrade, batchImportGrades, getGradeDistribution, getGradeByClass } from '../../api/grade'
import { getStudents, getMajorsList } from '../../api/student'
import * as XLSX from 'xlsx'

const loading = ref(false)
const viewMode = ref('class') // 'class' | 'all'
const activeClass = ref('')
const classSearch = ref('')
const grades = ref([])
const searchKeyword = ref('')
const filterMajor = ref('')
const filteredGrades = ref([])
const majorList = ref([])
const studentOptions = ref([])
const distStats = ref({ excellent: 0, good: 0, medium: 0, pass: 0, fail: 0 })
const classStats = ref([])

// Dialogs
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const form = ref({ id: null, studentId: '', courseName: '', score: null, courseType: '必修', semester: '2024-2025-2' })
const formRules = {
  studentId: [{ required: true, message: '请选择学生', trigger: 'change' }],
  courseName: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  score: [{ required: true, message: '请输入成绩', trigger: 'blur' }],
  semester: [{ required: true, message: '请输入学期', trigger: 'blur' }]
}

const importDialogVisible = ref(false)
const importData = ref([])
const importLoading = ref(false)

const statsCards = computed(() => [
  { label: '优秀(≥90)', value: distStats.value.excellent || 0, color: '#10b981' },
  { label: '良好(80-89)', value: distStats.value.good || 0, color: '#2563eb' },
  { label: '中等(70-79)', value: distStats.value.medium || 0, color: '#d97706' },
  { label: '及格(60-69)', value: distStats.value.pass || 0, color: '#64748b' },
  { label: '不及格(<60)', value: distStats.value.fail || 0, color: '#dc2626' },
])

// 当前班级的成绩
const classGrades = computed(() => {
  if (!activeClass.value) return []
  return grades.value.filter(g => g.class_name === activeClass.value)
})

const filteredClassGrades = computed(() => {
  if (!classSearch.value.trim()) return classGrades.value
  const kw = classSearch.value.trim().toLowerCase()
  return classGrades.value.filter(g =>
    (g.student_id && g.student_id.toLowerCase().includes(kw)) ||
    (g.student_name && g.student_name.toLowerCase().includes(kw)) ||
    (g.course_name && g.course_name.toLowerCase().includes(kw))
  )
})

const getScoreColor = (s) => s >= 90 ? '#10b981' : s >= 80 ? '#2563eb' : s >= 70 ? '#d97706' : s >= 60 ? '#64748b' : '#dc2626'
const getScoreTag = (s) => s >= 90 ? 'success' : s >= 80 ? 'primary' : s >= 70 ? 'warning' : s >= 60 ? 'info' : 'danger'
const getLevel = (s) => s >= 90 ? '优秀' : s >= 80 ? '良好' : s >= 70 ? '中等' : s >= 60 ? '及格' : '不及格'

const fetchData = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterMajor.value) params.major = filterMajor.value
    const [gradeRes, studentRes, majorRes, classStatRes] = await Promise.all([
      getAllGrades(params),
      getStudents(),
      getMajorsList(),
      getGradeByClass()
    ])
    grades.value = gradeRes.data || gradeRes || []
    studentOptions.value = studentRes.data || studentRes || []
    majorList.value = (majorRes.data || majorRes || []).map(m => m.name).filter(Boolean)
    classStats.value = (classStatRes.data || classStatRes || []).map(c => ({
      ...c,
      excellent: parseInt(c.excellent) || 0,
      good: parseInt(c.good) || 0,
      medium: parseInt(c.medium) || 0,
      pass_count: parseInt(c.pass_count) || 0,
      fail: parseInt(c.fail) || 0,
      student_count: parseInt(c.student_count) || 0,
      grade_count: parseInt(c.grade_count) || 0,
    }))
    filteredGrades.value = [...grades.value]
    // 默认选中第一个班级
    if (viewMode.value === 'class' && classStats.value.length && !activeClass.value) {
      activeClass.value = classStats.value[0].class_name
    }
  } catch (e) {
    ElMessage.error('获取数据失败')
  } finally { loading.value = false }
}

const fetchDist = async () => {
  try {
    const res = await getGradeDistribution()
    distStats.value = res.data || res || { excellent: 0, good: 0, medium: 0, pass: 0, fail: 0 }
  } catch {}
}

const handleSearch = () => {
  let result = [...grades.value]
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    result = result.filter(g =>
      (g.student_id && g.student_id.toLowerCase().includes(kw)) ||
      (g.student_name && g.student_name.toLowerCase().includes(kw)) ||
      (g.course_name && g.course_name.toLowerCase().includes(kw)) ||
      (g.class_name && g.class_name.toLowerCase().includes(kw))
    )
  }
  filteredGrades.value = result
}

const handleReset = () => { searchKeyword.value = ''; filterMajor.value = ''; fetchData(); fetchDist() }
const resetForm = () => { form.value = { id: null, studentId: '', courseName: '', score: null, courseType: '必修', semester: '2024-2025-2' } }
const handleAdd = () => { resetForm(); isEdit.value = false; dialogVisible.value = true }

const handleEdit = (row) => {
  form.value = { id: row.id, studentId: row.student_id, courseName: row.course_name, score: row.score, courseType: row.course_type || '必修', semester: row.semester }
  isEdit.value = true; dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  submitLoading.value = true
  try {
    const data = { studentId: form.value.studentId, courseName: form.value.courseName, score: form.value.score, courseType: form.value.courseType, semester: form.value.semester }
    isEdit.value ? await updateGrade(form.value.id, data) : await addGrade(data)
    ElMessage.success(isEdit.value ? '修改成功' : '添加成功')
    dialogVisible.value = false
    fetchData(); fetchDist()
  } catch (e) { ElMessage.error(isEdit.value ? '修改失败' : '添加失败') }
  finally { submitLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除「${row.student_name || row.student_id}」的「${row.course_name}」成绩吗？`, '确认', { type: 'warning' })
    await deleteGrade(row.id)
    ElMessage.success('删除成功')
    fetchData(); fetchDist()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

// Filter for class search
const filterClassGrades = () => {} // computed handles it

const handleExcelImport = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws)
      if (!json.length) { ElMessage.warning('Excel为空'); return }
      importData.value = json.map(row => ({
        studentId: String(row['学号'] || row['studentId'] || ''),
        courseName: row['课程名称'] || row['courseName'] || row['课程'] || '',
        score: parseInt(row['成绩'] || row['score'] || 0),
        courseType: row['课程类型'] || row['courseType'] || row['类型'] || '必修',
        semester: row['学期'] || row['semester'] || '2024-2025-2'
      }))
      importDialogVisible.value = true
    } catch { ElMessage.error('Excel 解析失败') }
  }
  reader.readAsBinaryString(file.raw)
}

const confirmImport = async () => {
  importLoading.value = true
  try {
    const res = await batchImportGrades(importData.value)
    ElMessage.success(res.data?.message || '导入完成')
    importDialogVisible.value = false
    fetchData(); fetchDist()
  } catch { ElMessage.error('导入失败') }
  finally { importLoading.value = false }
}

const handleExport = () => {
  if (!filteredGrades.value.length) { ElMessage.warning('没有数据'); return }
  const data = filteredGrades.value.map((g, i) => ({
    '序号': i + 1, '学号': g.student_id, '姓名': g.student_name || '',
    '班级': g.class_name || '', '课程名称': g.course_name,
    '成绩': g.score, '等级': getLevel(g.score),
    '类型': g.course_type || '必修', '学期': g.semester
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '成绩表')
  XLSX.writeFile(wb, `成绩导出_${new Date().toISOString().slice(0,10)}.xlsx`)
  ElMessage.success(`导出 ${data.length} 条`)
}

const exportClassGrades = () => {
  if (!filteredClassGrades.value.length) { ElMessage.warning('没有数据'); return }
  const data = filteredClassGrades.value.map((g, i) => ({
    '序号': i + 1, '学号': g.student_id, '姓名': g.student_name || '',
    '课程名称': g.course_name, '成绩': g.score, '等级': getLevel(g.score),
    '类型': g.course_type || '必修', '学期': g.semester
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, activeClass.value + '成绩')
  XLSX.writeFile(wb, `${activeClass.value}_成绩_${new Date().toISOString().slice(0,10)}.xlsx`)
  ElMessage.success(`导出 ${data.length} 条`)
}

onMounted(() => { fetchData(); fetchDist() })
</script>

<style scoped>
.grade-page { max-width: 1300px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }

.stats-row { margin-bottom: 16px; }
.stat-card { border-radius: 8px; text-align: center; }
.stat-card :deep(.el-card__body) { padding: 14px 10px; }
.stat-value { font-size: 24px; font-weight: 700; }
.stat-label { font-size: 12px; color: #64748b; margin-top: 2px; }

/* Class Overview Cards */
.class-overview-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 20px; }
.class-overview-card {
  background: #fff; border-radius: 10px; padding: 16px 18px;
  border: 2px solid #e2e8f0; cursor: pointer;
  transition: all 0.2s;
}
.class-overview-card:hover { border-color: #1a56db; box-shadow: 0 4px 16px rgba(26,86,219,0.08); }
.class-overview-card.active { border-color: #1a56db; box-shadow: 0 2px 12px rgba(26,86,219,0.15); background: #f8faff; }
.cls-name { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
.cls-meta { font-size: 13px; color: #64748b; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.cls-meta .sep { color: #cbd5e1; }
.cls-pass-bar { margin-bottom: 8px; }
.pass-track { position: relative; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.pass-fill { position: absolute; top: 0; height: 100%; }
.pass-excellent { background: linear-gradient(90deg, #10b981, #34d399); z-index: 5; }
.pass-good { background: linear-gradient(90deg, #2563eb, #60a5fa); z-index: 4; }
.pass-medium { background: linear-gradient(90deg, #d97706, #fbbf24); z-index: 3; }
.pass-pass { background: linear-gradient(90deg, #64748b, #94a3b8); z-index: 2; }
.pass-fail { background: linear-gradient(90deg, #dc2626, #f87171); z-index: 1; }
.cls-legend { font-size: 11px; color: #94a3b8; display: flex; gap: 8px; align-items: center; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 2px; }
.dot-excellent { background: #10b981; }
.dot-good { background: #2563eb; }
.dot-medium { background: #d97706; }
.dot-pass { background: #64748b; }
.dot-fail { background: #dc2626; }

/* Class Detail */
.class-detail-card { border-radius: 10px; }
.class-detail-card :deep(.el-card__header) { padding: 12px 20px; border-bottom: 1px solid #f1f5f9; }
.class-detail-header { display: flex; align-items: center; justify-content: space-between; }
.class-detail-title { font-size: 15px; font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 6px; }
.class-detail-count { font-size: 13px; color: #94a3b8; }
.mini-toolbar { padding: 12px 20px; border-bottom: 1px solid #f1f5f9; }
.mini-result-count { margin-left: auto; font-size: 13px; color: #64748b; }
.mini-result-count strong { color: #1a56db; }

/* Toolbar */
.toolbar-card { border-radius: 8px; margin-bottom: 16px; }
.toolbar-card :deep(.el-card__body) { padding: 14px 20px; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.result-count { margin-left: auto; font-size: 14px; color: #64748b; }
.result-count strong { color: #1a56db; }

.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }

.import-info { font-size: 14px; color: #64748b; padding: 8px 0; }
.import-more { text-align: center; font-size: 13px; color: #94a3b8; padding: 8px; }
</style>
