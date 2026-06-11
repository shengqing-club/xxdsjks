<template>
  <div class="grade-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">成绩发布与管理</h2>
        <p class="page-desc">管理学生成绩，支持搜索、编辑与Excel导出</p>
      </div>
      <div class="header-actions">
          <el-button type="primary" @click="handleAdd">
            <el-icon><Plus /></el-icon>新增成绩
          </el-button>
          <el-button type="success" plain @click="handleExport">
            <el-icon><Download /></el-icon>导出Excel
          </el-button>
        </div>
      </div>

    <!-- 搜索工具栏 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索学号/姓名/课程"
          clearable
          style="width: 220px"
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="filterCourse" placeholder="按课程筛选" clearable style="width: 180px" @change="handleSearch">
          <el-option v-for="c in courseOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="filterMajor" placeholder="按专业筛选" clearable style="width: 160px" @change="handleSearch">
          <el-option v-for="m in majorList" :key="m" :label="m" :value="m" />
        </el-select>
        <el-button type="primary" plain @click="handleSearch">
          <el-icon><Search /></el-icon>查询
        </el-button>
        <el-button @click="handleReset">重置</el-button>
        <span class="result-count">共 <strong>{{ filteredGrades.length }}</strong> 条</span>
      </div>
    </el-card>

    <!-- 成绩表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="pagedGrades" stripe style="width: 100%" row-key="id">
        <el-table-column prop="student_id" label="学号" width="130" />
        <el-table-column prop="student_name" label="姓名" width="100" />
        <el-table-column prop="class_name" label="班级" width="130" />
        <el-table-column prop="course_name" label="课程" min-width="160" />
        <el-table-column label="成绩" width="90" align="center">
          <template #default="{ row }">
            <span :style="{ color: getScoreColor(row.score), fontWeight: 600 }">{{ row.score }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="course_type" label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.course_type === '必修' ? 'primary' : 'success'" size="small">
              {{ row.course_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="semester" label="学期" width="130" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" text @click="handleEdit(row)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button type="danger" size="small" text @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredGrades.length"
          layout="total, prev, pager, next, jumper"
          background
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑成绩' : '新增成绩'" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="学号" prop="studentId">
          <el-select v-model="form.studentId" placeholder="选择学生" filterable style="width:100%">
            <el-option v-for="s in studentOptions" :key="s.student_id" :label="`${s.student_id} - ${s.name}`" :value="s.student_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程" prop="courseName">
          <el-select v-model="form.courseName" placeholder="选择课程" filterable allow-create style="width:100%">
            <el-option v-for="c in courseOptions" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="成绩" prop="score">
          <el-input-number v-model="form.score" :min="0" :max="100" :precision="1" style="width:100%" />
        </el-form-item>
        <el-form-item label="类型" prop="courseType">
          <el-radio-group v-model="form.courseType">
            <el-radio label="必修" />
            <el-radio label="选修" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="学期" prop="semester">
          <el-input v-model="form.semester" placeholder="如：2024-2025-2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Edit, Delete, Download } from '@element-plus/icons-vue'
import { getAllGrades, addGrade, updateGrade, deleteGrade } from '../../api/grade'
import { getStudents } from '../../api/student'
import { getMajors } from '../../api/major'
import { getCourses } from '../../api/course'

const loading = ref(false)
const grades = ref([])
const filteredGrades = ref([])
const studentOptions = ref([])
const courseOptions = ref([])
const majorList = ref([])

const searchKeyword = ref('')
const filterCourse = ref('')
const filterMajor = ref('')
const currentPage = ref(1)
const pageSize = 15

const pagedGrades = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredGrades.value.slice(start, start + pageSize)
})

const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const form = ref({ id: null, studentId: '', courseName: '', score: 75, courseType: '必修', semester: '' })

const formRules = {
  studentId: [{ required: true, message: '请选择学生', trigger: 'change' }],
  courseName: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  score: [{ required: true, message: '请输入成绩', trigger: 'blur' }],
}

const getScoreColor = (score) => {
  if (score >= 90) return '#16a34a'
  if (score >= 80) return '#2563eb'
  if (score >= 70) return '#d97706'
  if (score >= 60) return '#ea580c'
  return '#dc2626'
}

// ========== 数据获取 ==========
const fetchData = async () => {
  loading.value = true
  try {
    const [gradeRes, studentRes, majorRes, courseRes] = await Promise.all([
      getAllGrades(),
      getStudents(),
      getMajors(),
      getCourses(),
    ])
    grades.value = gradeRes.data || gradeRes || []
    filteredGrades.value = [...grades.value]
    studentOptions.value = studentRes.data || studentRes || []
    majorList.value = (majorRes.data || majorRes || []).map(m => m.name).filter(Boolean)
    const courseData = courseRes.data || courseRes || []
    courseOptions.value = [...new Set([
      ...courseData.map(c => c.name).filter(Boolean),
      ...grades.value.map(g => g.course_name).filter(Boolean),
    ])]
  } catch (e) {
    ElMessage.error('获取数据失败')
    console.error(e)
  } finally { loading.value = false }
}

// ========== 搜索/重置 ==========
const handleSearch = () => {
  let result = [...grades.value]
  const kw = searchKeyword.value.trim().toLowerCase()
  if (kw) {
    result = result.filter(g =>
      (g.student_id && g.student_id.toLowerCase().includes(kw)) ||
      (g.student_name && g.student_name.toLowerCase().includes(kw)) ||
      (g.course_name && g.course_name.toLowerCase().includes(kw))
    )
  }
  if (filterCourse.value) {
    result = result.filter(g => g.course_name === filterCourse.value)
  }
  if (filterMajor.value) {
    result = result.filter(g => {
      const student = studentOptions.value.find(s => s.student_id === g.student_id)
      return student && student.major === filterMajor.value
    })
  }
  filteredGrades.value = result
  currentPage.value = 1
}

const handleReset = () => {
  searchKeyword.value = ''
  filterCourse.value = ''
  filterMajor.value = ''
  filteredGrades.value = [...grades.value]
  currentPage.value = 1
}

// ========== 新增/编辑/删除 ==========
const resetForm = () => {
  form.value = { id: null, studentId: '', courseName: '', score: 75, courseType: '必修', semester: '' }
}

const handleAdd = () => { resetForm(); isEdit.value = false; dialogVisible.value = true }

const handleEdit = (row) => {
  form.value = {
    id: row.id,
    studentId: row.student_id,
    courseName: row.course_name,
    score: row.score,
    courseType: row.course_type || '必修',
    semester: row.semester || '',
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
      courseType: form.value.courseType,
      semester: form.value.semester,
    }
    if (isEdit.value) {
      await updateGrade(form.value.id, data)
      ElMessage.success('修改成功')
    } else {
      await addGrade(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error(isEdit.value ? '修改失败' : '新增失败')
    console.error(e)
  } finally { submitLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.student_name}」的「${row.course_name}」成绩吗？`,
      '确认删除',
      { type: 'warning' }
    )
    await deleteGrade(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

// ========== 导出Excel ==========
const handleExport = () => {
  try {
    const XLSX = require('xlsx')
    const exportData = filteredGrades.value.map(g => ({
      '学号': g.student_id,
      '姓名': g.student_name,
      '班级': g.class_name,
      '课程': g.course_name,
      '成绩': g.score,
      '类型': g.course_type,
      '学期': g.semester,
    }))
    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '成绩')
    XLSX.writeFile(wb, `成绩导出_${new Date().toLocaleDateString('zh-CN')}.xlsx`)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败，请确保已安装 xlsx 依赖')
  }
}

onMounted(fetchData)
</script>

<style scoped>
.grade-page { max-width: 1200px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.header-actions { display: flex; gap: 8px; flex-shrink: 0; }
.toolbar-card { border-radius: 8px; margin-bottom: 16px; }
.toolbar-card :deep(.el-card__body) { padding: 14px 20px; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.result-count { margin-left: auto; font-size: 14px; color: #64748b; }
.result-count strong { color: #1a56db; font-weight: 600; }
.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }
.pagination-wrapper { padding: 14px 20px; display: flex; justify-content: flex-end; }
</style>
