<template>
  <div class="course-management">
    <div class="page-header">
      <h2>课程管理</h2>
      <div class="header-actions">
        <el-button :type="editingMode ? 'warning' : 'default'" @click="editingMode = !editingMode">
          <el-icon><Edit /></el-icon> {{ editingMode ? '取消编辑' : '编辑管理' }}
        </el-button>
        <el-button v-if="editingMode && selectedRows.length > 0" type="danger" @click="handleBatchDelete">
          <el-icon><Delete /></el-icon> 批量删除 ({{ selectedRows.length }})
        </el-button>
        <el-button type="primary" @click="openDialog()">
          <el-icon><Plus /></el-icon> 新增课程
        </el-button>
      </div>
    </div>

    <el-table :data="courseList" v-loading="loading" stripe border @selection-change="selectedRows = $event">
      <el-table-column v-if="editingMode" type="selection" width="50" />
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="name" label="课程名称" min-width="150" />
      <el-table-column prop="code" label="课程代码" width="120" />
      <el-table-column prop="credit" label="学分" width="80" />
      <el-table-column prop="major" label="所属专业" width="150" />
      <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openDialog(row)">编辑</el-button>
          <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑课程' : '新增课程'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="80px">
        <el-form-item label="课程名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入课程名称" />
        </el-form-item>
        <el-form-item label="课程代码">
          <el-input v-model="form.code" placeholder="可选" />
        </el-form-item>
        <el-form-item label="学分">
          <el-input-number v-model="form.credit" :min="0.5" :max="10" :step="0.5" />
        </el-form-item>
        <el-form-item label="所属专业">
          <el-input v-model="form.major" placeholder="可选" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm" :loading="submitting">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit } from '@element-plus/icons-vue'
import { getCourses, addCourse, updateCourse, deleteCourse, batchDeleteCourses } from '../../api/course'

const loading = ref(false)
const courseList = ref([])
const selectedRows = ref([])
const editingMode = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref(null)
const form = ref({ name: '', code: '', credit: 3, major: '', description: '' })

const rules = {
  name: [{ required: true, message: '请输入课程名称', trigger: 'blur' }]
}

const loadCourses = async () => {
  loading.value = true
  try {
    const res = await getCourses()
    courseList.value = res.data
  } catch (e) {
    ElMessage.error('获取课程列表失败')
  } finally {
    loading.value = false
  }
}

const openDialog = (row = null) => {
  isEdit.value = !!row
  if (row) {
    form.value = { ...row }
  } else {
    form.value = { name: '', code: '', credit: 3, major: '', description: '' }
  }
  dialogVisible.value = true
}

const submitForm = async () => {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    if (isEdit.value) {
      await updateCourse(form.value.id, form.value)
      ElMessage.success('更新成功')
    } else {
      await addCourse(form.value)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    loadCourses()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除课程「${row.name}」吗？`, '提示', { type: 'warning' })
    await deleteCourse(row.id)
    ElMessage.success('删除成功')
    loadCourses()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.response?.data?.message || '删除失败')
  }
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 门课程吗？此操作不可恢复。`, '确认批量删除', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.id)
    await batchDeleteCourses(ids)
    ElMessage.success(`成功删除 ${ids.length} 门课程`)
    selectedRows.value = []
    loadCourses()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('批量删除失败')
  }
}

onMounted(loadCourses)
</script>

<style scoped>
.course-management {
  padding: 20px;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-header h2 {
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .course-management { padding: 12px; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .header-actions { width: 100%; flex-wrap: wrap; }
  .course-management :deep(.el-table) { min-width: 600px; }
  .course-management :deep(.el-table__body-wrapper) { overflow-x: auto; }
  .course-management :deep(.el-dialog) { width: calc(100vw - 32px) !important; max-width: 500px; }
}
</style>
