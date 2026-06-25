<template>
  <div class="class-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">班级管理</h2>
        <p class="page-desc">管理班级信息，支持按专业筛选与维护</p>
      </div>
      <el-button type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增班级
      </el-button>
    </div>

    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <el-select v-model="filterMajor" placeholder="全部专业" clearable style="width: 200px" @change="fetchData">
          <el-option v-for="m in majorOptions" :key="m.id" :label="m.name" :value="m.id" />
        </el-select>
        <el-input v-model="searchKeyword" placeholder="搜索班级名称" clearable style="width: 220px" @clear="fetchData" @keyup.enter="fetchData">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" plain @click="fetchData">搜索</el-button>
        <el-button @click="handleReset"><el-icon><RefreshRight /></el-icon>重置</el-button>
        <span class="result-count">共 <strong>{{ filteredClasses.length }}</strong> 个班级</span>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table :data="filteredClasses" stripe style="width: 100%">
        <el-table-column prop="name" label="班级名称" min-width="160" />
        <el-table-column prop="major_name" label="所属专业" min-width="160">
          <template #default="{ row }">
            <el-tag v-if="row.major_name" size="small" effect="plain">{{ row.major_name }}</el-tag>
            <span v-else style="color: #94a3b8;">--</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" text @click="handleEdit(row)"><el-icon><Edit /></el-icon></el-button>
            <el-button type="danger" size="small" text @click="handleDelete(row)"><el-icon><Delete /></el-icon></el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑班级' : '新增班级'" width="500px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="班级名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：计科2401" />
        </el-form-item>
        <el-form-item label="所属专业">
          <el-select v-model="form.major_id" placeholder="请选择专业" clearable style="width: 100%">
            <el-option v-for="m in majorOptions" :key="m.id" :label="m.name" :value="m.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="班级描述（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, RefreshRight, Edit, Delete } from '@element-plus/icons-vue'
import { getClasses, addClass, updateClass, deleteClass } from '../../api/class'
import { getMajors } from '../../api/major'

const loading = ref(false)
const classes = ref([])
const majorOptions = ref([])
const filterMajor = ref('')
const searchKeyword = ref('')

const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref(null)
const form = ref({ id: null, name: '', major_id: '', description: '' })
const rules = {
  name: [{ required: true, message: '请输入班级名称', trigger: 'blur' }]
}

const filteredClasses = computed(() => {
  let result = [...classes.value]
  const kw = searchKeyword.value.trim()
  if (kw) {
    result = result.filter(c => c.name && c.name.includes(kw))
  }
  return result
})

const fetchData = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterMajor.value) params.major_id = filterMajor.value
    const res = await getClasses(params)
    classes.value = res.data || res || []
  } catch (e) {
    ElMessage.error('获取班级列表失败')
  } finally {
    loading.value = false
  }
}

const fetchMajors = async () => {
  try {
    const res = await getMajors()
    majorOptions.value = (res.data || res || []).filter(m => m && m.name)
  } catch (e) {
    console.warn('获取专业列表失败:', e)
  }
}

const handleReset = () => {
  filterMajor.value = ''
  searchKeyword.value = ''
  fetchData()
}

const handleAdd = () => {
  form.value = { id: null, name: '', major_id: '', description: '' }
  isEdit.value = false
  dialogVisible.value = true
}

const handleEdit = (row) => {
  form.value = { id: row.id, name: row.name, major_id: row.major_id || '', description: row.description || '' }
  isEdit.value = true
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const data = {
      name: form.value.name,
      major_id: form.value.major_id || null,
      description: form.value.description
    }
    isEdit.value ? await updateClass(form.value.id, data) : await addClass(data)
    ElMessage.success(isEdit.value ? '修改成功' : '添加成功')
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error(isEdit.value ? '修改失败' : '添加失败')
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除班级「${row.name}」吗？`, '确认', { type: 'warning' })
    await deleteClass(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const formatTime = (t) => t ? t.replace('T', ' ').substring(0, 16) : ''

onMounted(() => {
  fetchData()
  fetchMajors()
})
</script>

<style scoped>
.class-page { max-width: 1100px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.toolbar-card { border-radius: 8px; margin-bottom: 16px; }
.toolbar-card :deep(.el-card__body) { padding: 14px 20px; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.result-count { margin-left: auto; font-size: 14px; color: #64748b; }
.result-count strong { color: #1a56db; font-weight: 600; }
.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }

@media (max-width: 768px) {
  .class-page { max-width: 100%; }
  .page-header { flex-direction: column; }
  .toolbar { flex-direction: column; align-items: stretch; }
  .toolbar .el-select,
  .toolbar .el-input { width: 100% !important; }
  .result-count { margin-left: 0; text-align: center; }
  .table-card :deep(.el-card__body) { overflow-x: auto; }
  .table-card :deep(.el-table) { min-width: 600px; }
  .class-page :deep(.el-dialog) { width: calc(100vw - 32px) !important; max-width: 500px; }
}
</style>
