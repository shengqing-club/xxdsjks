<template>
  <div class="grade-page" v-loading="loading">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">成绩发布与管理</h2>
        <p class="page-desc">录入、编辑和管理学生成绩信息</p>
      </div>
    </div>

    <!-- Toolbar -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增成绩
        </el-button>
        <el-button type="success" @click="handleExport">
          <el-icon><Download /></el-icon>
          导出Excel
        </el-button>
        <el-input
          v-model="searchId"
          placeholder="按学号搜索"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" plain @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshRight /></el-icon>
          重置
        </el-button>
        <span class="result-count">
          共 <strong>{{ filteredGrades.length }}</strong> 条记录
        </span>
      </div>
    </el-card>

    <!-- Grade Table -->
    <el-card shadow="never" class="table-card">
      <el-table :data="filteredGrades" stripe style="width: 100%">
        <el-table-column prop="studentId" label="学号" min-width="130" />
        <el-table-column prop="courseName" label="课程名称" min-width="160" />
        <el-table-column label="成绩" width="120">
          <template #default="{ row }">
            <span :style="{ color: getScoreColor(row.score), fontWeight: 600 }">
              {{ row.score }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="semester" label="学期" min-width="140" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑成绩' : '新增成绩'"
      width="480px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="90px"
        label-position="right"
      >
        <el-form-item label="学号" prop="studentId">
          <el-input v-model="form.studentId" placeholder="请输入学号" />
        </el-form-item>
        <el-form-item label="课程名称" prop="courseName">
          <el-input v-model="form.courseName" placeholder="请输入课程名称" />
        </el-form-item>
        <el-form-item label="成绩" prop="score">
          <el-input-number
            v-model="form.score"
            :min="0"
            :max="100"
            :precision="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="学期" prop="semester">
          <el-input v-model="form.semester" placeholder="例如: 2024-2025-1" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, RefreshRight, Edit, Delete, Download } from '@element-plus/icons-vue'
import { getAllGrades, addGrade, updateGrade, deleteGrade } from '../../api/grade'
import { getStudents } from '../../api/student'
import * as XLSX from 'xlsx'

const loading = ref(false)
const grades = ref([])
const searchId = ref('')
const filteredGrades = ref([])

// Dialog state
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const form = ref({
  id: null,
  studentId: '',
  courseName: '',
  score: null,
  semester: '2024-2025-1'
})

const formRules = {
  studentId: [{ required: true, message: '请输入学号', trigger: 'blur' }],
  courseName: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  score: [{ required: true, message: '请输入成绩', trigger: 'blur' }],
  semester: [{ required: true, message: '请输入学期', trigger: 'blur' }]
}

// Student name map for Excel export
const studentNameMap = ref({})

const handleExport = () => {
  if (filteredGrades.value.length === 0) {
    ElMessage.warning('没有可导出的成绩数据')
    return
  }
  const data = filteredGrades.value.map((g, idx) => ({
    '序号': idx + 1,
    '学号': g.studentId,
    '姓名': studentNameMap.value[g.studentId] || '',
    '课程名称': g.courseName,
    '成绩': g.score,
    '学期': g.semester
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  ws['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 16 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '成绩表')
  const fileName = `成绩导出_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, fileName)
  ElMessage.success(`已导出 ${data.length} 条记录`)
}

const getScoreColor = (score) => {
  if (score >= 90) return '#16a34a'
  if (score >= 80) return '#2563eb'
  if (score >= 70) return '#d97706'
  if (score >= 60) return '#64748b'
  return '#dc2626'
}

const fetchData = async () => {
  loading.value = true
  try {
    const [gradeRes, studentRes] = await Promise.all([getAllGrades(), getStudents()])
    grades.value = gradeRes.data || gradeRes || []
    filteredGrades.value = [...grades.value]
    const students = studentRes.data || studentRes || []
    const map = {}
    students.forEach((s) => { map[s.studentId] = s.name })
    studentNameMap.value = map
  } catch (e) {
    ElMessage.error('获取成绩数据失败')
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  if (!searchId.value.trim()) {
    filteredGrades.value = [...grades.value]
    return
  }
  const kw = searchId.value.trim().toLowerCase()
  filteredGrades.value = grades.value.filter(
    (g) => g.studentId && g.studentId.toLowerCase().includes(kw)
  )
}

const handleReset = () => {
  searchId.value = ''
  fetchData()
}

const resetForm = () => {
  form.value = {
    id: null,
    studentId: '',
    courseName: '',
    score: null,
    semester: '2024-2025-1'
  }
}

const handleAdd = () => {
  resetForm()
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (row) => {
  form.value = {
    id: row.id,
    studentId: row.studentId,
    courseName: row.courseName,
    score: row.score,
    semester: row.semester
  }
  isEdit.value = true
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  submitLoading.value = true
  try {
    const data = {
      studentId: form.value.studentId,
      courseName: form.value.courseName,
      score: form.value.score,
      semester: form.value.semester
    }
    if (isEdit.value) {
      await updateGrade(form.value.id, data)
      ElMessage.success('修改成功')
    } else {
      await addGrade(data)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error(isEdit.value ? '修改失败' : '添加失败')
    console.error(e)
  } finally {
    submitLoading.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除学号「${row.studentId}」的「${row.courseName}」成绩记录吗？`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteGrade(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
      console.error(e)
    }
  }
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped>
.grade-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  color: #1e293b;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.page-desc {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

.toolbar-card {
  border-radius: 8px;
  margin-bottom: 20px;
}

.toolbar-card :deep(.el-card__body) {
  padding: 16px 20px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.result-count {
  font-size: 14px;
  color: #64748b;
  margin-left: auto;
}

.result-count strong {
  color: #1a56db;
  font-weight: 600;
}

.table-card {
  border-radius: 8px;
}

.table-card :deep(.el-card__body) {
  padding: 0;
}
</style>
