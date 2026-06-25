<template>
  <div class="major-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">专业管理</h2>
        <p class="page-desc">管理学校的专业设置，查看各专业学生分布</p>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value">{{ majors.length }}</div>
          <div class="stat-label">专业总数</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value">{{ totalStudents }}</div>
          <div class="stat-label">覆盖学生</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never" class="stat-card">
          <div class="stat-value">{{ avgPerMajor }}</div>
          <div class="stat-label">平均人数/专业</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Toolbar -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>新增专业
        </el-button>
      </div>
    </el-card>

    <!-- Major Table -->
    <el-card shadow="never" class="table-card">
      <el-table :data="majors" stripe>
        <el-table-column prop="code" label="专业代码" width="130" />
        <el-table-column prop="name" label="专业名称" min-width="160" />
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
        <el-table-column prop="student_count" label="学生人数" width="110" align="center">
          <template #default="{ row }">
            <el-tag type="primary" effect="plain" round size="small">{{ row.student_count || 0 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Add/Edit Dialog -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑专业' : '新增专业'" width="480px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="专业代码" prop="code">
          <el-input v-model="form.code" placeholder="如: CS, SE, AI" />
        </el-form-item>
        <el-form-item label="专业名称" prop="name">
          <el-input v-model="form.name" placeholder="如: 计算机科学与技术" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="专业简介" />
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
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import { getMajors, addMajor, updateMajor, deleteMajor } from '../../api/major'

const loading = ref(false)
const majors = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const form = ref({ id: null, name: '', code: '', description: '' })
const rules = {
  name: [{ required: true, message: '请输入专业名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入专业代码', trigger: 'blur' }]
}

const totalStudents = computed(() => majors.value.reduce((s, m) => s + (m.student_count || 0), 0))
const avgPerMajor = computed(() => majors.value.length ? Math.round(totalStudents.value / majors.value.length) : 0)

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getMajors()
    majors.value = res.data || res || []
  } catch { ElMessage.error('获取专业数据失败') } finally { loading.value = false }
}

const resetForm = () => { form.value = { id: null, name: '', code: '', description: '' } }
const handleAdd = () => { resetForm(); isEdit.value = false; dialogVisible.value = true }
const handleEdit = (row) => { form.value = { ...row }; isEdit.value = true; dialogVisible.value = true }

const submitForm = async () => {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
  submitLoading.value = true
  try {
    const data = { name: form.value.name, code: form.value.code, description: form.value.description }
    isEdit.value ? await updateMajor(form.value.id, data) : await addMajor(data)
    ElMessage.success(isEdit.value ? '修改成功' : '添加成功')
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error(isEdit.value ? '修改失败' : '添加失败')
  } finally { submitLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除专业「${row.name}」吗？`, '确认删除', { type: 'warning' })
    await deleteMajor(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

onMounted(fetchData)
</script>

<style scoped>
.major-page { max-width: 1100px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.stats-row { margin-bottom: 16px; }
.stat-card { border-radius: 8px; text-align: center; }
.stat-card :deep(.el-card__body) { padding: 20px; }
.stat-value { font-size: 28px; font-weight: 700; color: #1a56db; }
.stat-label { font-size: 13px; color: #64748b; margin-top: 4px; }
.toolbar-card { border-radius: 8px; margin-bottom: 16px; }
.toolbar-card :deep(.el-card__body) { padding: 14px 20px; }
.toolbar { display: flex; align-items: center; gap: 12px; }
.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }

@media (max-width: 768px) {
  .major-page { max-width: 100%; }
  .stats-row :deep(.el-col) { max-width: 100% !important; flex: 0 0 100% !important; margin-bottom: 12px; }
  .table-card :deep(.el-card__body) { overflow-x: auto; }
  .table-card :deep(.el-table) { min-width: 600px; }
  .major-page :deep(.el-dialog) { width: calc(100vw - 32px) !important; max-width: 480px; }
}
</style>
