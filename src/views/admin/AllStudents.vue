<template>
  <div class="all-students-page" v-loading="loading">
    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h2 class="page-title">学生信息查询</h2>
        <p class="page-desc">查看和管理所有学生信息</p>
      </div>
    </div>

    <!-- Search Bar -->
    <el-card shadow="never" class="search-card">
      <div class="search-bar">
        <el-input
          v-model="keyword"
          placeholder="请输入姓名、学号、专业等关键词搜索"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="statusFilter"
          placeholder="状态筛选"
          clearable
          style="width: 140px"
          @change="handleSearch"
        >
          <el-option label="在读" value="在读" />
          <el-option label="休学" value="休学" />
          <el-option label="毕业" value="毕业" />
          <el-option label="退学" value="退学" />
        </el-select>
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshRight /></el-icon>
          重置
        </el-button>
        <span class="result-count">
          共 <strong>{{ filteredStudents.length }}</strong> 条记录
        </span>
      </div>
    </el-card>

    <!-- Batch Toolbar -->
    <el-card v-if="selectedRows.length > 0" shadow="never" class="batch-card">
      <div class="batch-bar">
        <span class="batch-info">
          已选择 <strong>{{ selectedRows.length }}</strong> 名学生
        </span>
        <el-select
          v-model="batchStatus"
          placeholder="批量修改状态"
          style="width: 180px"
        >
          <el-option label="在读" value="在读" />
          <el-option label="休学" value="休学" />
          <el-option label="毕业" value="毕业" />
          <el-option label="退学" value="退学" />
        </el-select>
        <el-button type="primary" :loading="batchLoading" @click="handleBatchUpdate">
          批量更新状态
        </el-button>
        <el-button @click="clearSelection">取消选择</el-button>
      </div>
    </el-card>

    <!-- Student Table -->
    <el-card shadow="never" class="table-card">
      <el-table
        ref="tableRef"
        :data="filteredStudents"
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="studentId" label="学号" min-width="120" />
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="gender" label="性别" width="80" />
        <el-table-column prop="age" label="年龄" width="80" />
        <el-table-column prop="major" label="专业" min-width="140" />
        <el-table-column prop="className" label="班级" min-width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ row.status || '在读' }}
            </el-tag>
          </template>
        </el-table-column>
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

    <!-- Edit Dialog -->
    <el-dialog v-model="editDialogVisible" title="编辑学生信息" width="500px" destroy-on-close>
      <el-form
        ref="editFormRef"
        :model="editForm"
        :rules="editRules"
        label-width="80px"
        label-position="right"
      >
        <el-form-item label="学号">
          <el-input v-model="editForm.studentId" disabled />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="editForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="editForm.gender">
            <el-radio value="男">男</el-radio>
            <el-radio value="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="editForm.age" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="专业" prop="major">
          <el-input v-model="editForm.major" placeholder="请输入专业" />
        </el-form-item>
        <el-form-item label="班级" prop="className">
          <el-input v-model="editForm.className" placeholder="请输入班级" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="editForm.status" placeholder="请选择状态" style="width: 100%">
            <el-option label="在读" value="在读" />
            <el-option label="休学" value="休学" />
            <el-option label="毕业" value="毕业" />
            <el-option label="退学" value="退学" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="submitEdit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshRight, Edit, Delete } from '@element-plus/icons-vue'
import { getStudents, updateStudent, deleteStudent } from '../../api/student'

const loading = ref(false)
const students = ref([])
const keyword = ref('')
const statusFilter = ref('')
const filteredStudents = ref([])

// Table selection
const tableRef = ref(null)
const selectedRows = ref([])
const batchStatus = ref('')
const batchLoading = ref(false)

// Edit dialog state
const editDialogVisible = ref(false)
const editLoading = ref(false)
const editFormRef = ref(null)
const editForm = ref({
  id: null,
  studentId: '',
  name: '',
  gender: '',
  age: null,
  major: '',
  className: '',
  status: '在读'
})

const editRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  major: [{ required: true, message: '请输入专业', trigger: 'blur' }],
  className: [{ required: true, message: '请输入班级', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
}

const getStatusType = (status) => {
  const map = {
    '在读': 'success',
    '休学': 'warning',
    '毕业': 'info',
    '退学': 'danger'
  }
  return map[status] || 'success'
}

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getStudents()
    students.value = res.data || res || []
    filteredStudents.value = [...students.value]
  } catch (e) {
    ElMessage.error('获取学生数据失败')
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  let result = [...students.value]

  // Filter by keyword
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(kw)) ||
        (s.studentId && s.studentId.toLowerCase().includes(kw)) ||
        (s.major && s.major.toLowerCase().includes(kw)) ||
        (s.className && s.className.toLowerCase().includes(kw)) ||
        (s.gender && s.gender.toLowerCase().includes(kw))
    )
  }

  // Filter by status
  if (statusFilter.value) {
    result = result.filter((s) => (s.status || '在读') === statusFilter.value)
  }

  filteredStudents.value = result
}

const handleReset = () => {
  keyword.value = ''
  statusFilter.value = ''
  fetchData()
}

const handleSelectionChange = (rows) => {
  selectedRows.value = rows
}

const clearSelection = () => {
  if (tableRef.value) {
    tableRef.value.clearSelection()
  }
  selectedRows.value = []
}

const handleBatchUpdate = async () => {
  if (!batchStatus.value) {
    ElMessage.warning('请选择目标状态')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定将 ${selectedRows.value.length} 名学生的状态修改为「${batchStatus.value}」吗？`,
      '批量更新确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    batchLoading.value = true
    const promises = selectedRows.value.map((row) =>
      updateStudent(row.id, { ...row, status: batchStatus.value })
    )
    await Promise.all(promises)
    ElMessage.success('批量更新成功')
    batchStatus.value = ''
    clearSelection()
    fetchData()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('批量更新失败')
      console.error(e)
    }
  } finally {
    batchLoading.value = false
  }
}

const handleEdit = (row) => {
  editForm.value = {
    id: row.id,
    studentId: row.studentId,
    name: row.name,
    gender: row.gender,
    age: row.age,
    major: row.major,
    className: row.className,
    status: row.status || '在读'
  }
  editDialogVisible.value = true
}

const submitEdit = async () => {
  if (!editFormRef.value) return
  await editFormRef.value.validate()
  editLoading.value = true
  try {
    await updateStudent(editForm.value.id, {
      name: editForm.value.name,
      gender: editForm.value.gender,
      age: editForm.value.age,
      major: editForm.value.major,
      className: editForm.value.className,
      status: editForm.value.status
    })
    ElMessage.success('修改成功')
    editDialogVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error('修改失败')
    console.error(e)
  } finally {
    editLoading.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除学生「${row.name}」的信息吗？此操作不可撤销。`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteStudent(row.id)
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
.all-students-page {
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

.search-card {
  border-radius: 8px;
  margin-bottom: 20px;
}

.search-card :deep(.el-card__body) {
  padding: 16px 20px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 240px;
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

.batch-card {
  border-radius: 8px;
  margin-bottom: 20px;
}

.batch-card :deep(.el-card__body) {
  padding: 14px 20px;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.batch-info {
  font-size: 14px;
  color: #64748b;
}

.batch-info strong {
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
