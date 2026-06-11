<template>
  <div class="reward-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">奖惩管理</h2>
        <p class="page-desc">管理学生奖励与惩罚记录</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>新增记录
        </el-button>
        <el-button :type="editingMode ? 'warning' : 'default'" @click="toggleEditMode">
          <el-icon><Edit /></el-icon>
          {{ editingMode ? '取消编辑' : '编辑管理' }}
        </el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-item stat-reward">
        <span class="stat-num">{{ rewardCount }}</span>
        <span class="stat-label">奖励次数</span>
      </div>
      <div class="stat-item stat-punish">
        <span class="stat-num">{{ punishCount }}</span>
        <span class="stat-label">惩罚次数</span>
      </div>
    </div>

    <!-- 表格 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="records" stripe style="width: 100%" @selection-change="selectedRows = $event">
        <el-table-column v-if="editingMode" type="selection" width="50" />
        <el-table-column prop="student_name" label="学生" width="100" />
        <el-table-column prop="student_id" label="学号" width="120" />
        <el-table-column prop="class_name" label="班级" width="120" />
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === '奖励' ? 'success' : 'danger'" size="small" effect="dark">
              {{ row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="类别" width="120" />
        <el-table-column prop="reason" label="原因" min-width="200" show-overflow-tooltip />
        <el-table-column label="分值" width="80" align="center">
          <template #default="{ row }">
            <span :style="{ color: row.type === '奖励' ? '#16a34a' : '#dc2626', fontWeight: 600 }">
              {{ row.type === '奖励' ? '+' : '' }}{{ row.points }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="awarded_by" label="操作人" width="100" />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">
            {{ row.created_at ? row.created_at.replace('T', ' ').substring(0, 16) : '' }}
          </template>
        </el-table-column>
        <el-table-column v-if="editingMode" label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" size="small" text @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="editingMode" style="padding: 12px 20px; display: flex; justify-content: flex-end;">
        <el-button type="danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete">
          <el-icon><Delete /></el-icon>
          批量删除 ({{ selectedRows.length }})
        </el-button>
      </div>
    </el-card>

    <!-- 新增对话框 -->
    <el-dialog v-model="dialogVisible" title="新增奖惩记录" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="学生" prop="studentId">
          <el-select v-model="form.studentId" placeholder="选择学生" filterable style="width:100%" @change="onStudentChange">
            <el-option v-for="s in studentOptions" :key="s.student_id" :label="`${s.student_id} - ${s.name}`" :value="s.student_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio label="奖励">奖励</el-radio>
            <el-radio label="惩罚">惩罚</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="类别" prop="category">
          <el-select v-model="form.category" placeholder="选择类别" style="width:100%" allow-create filterable>
            <el-option v-if="form.type === '奖励'" label="三好学生" value="三好学生" />
            <el-option v-if="form.type === '奖励'" label="优秀干部" value="优秀干部" />
            <el-option v-if="form.type === '奖励'" label="竞赛获奖" value="竞赛获奖" />
            <el-option v-if="form.type === '奖励'" label="奖学金" value="奖学金" />
            <el-option v-if="form.type === '奖励'" label="其他奖励" value="其他奖励" />
            <el-option v-if="form.type === '惩罚'" label="迟到" value="迟到" />
            <el-option v-if="form.type === '惩罚'" label="旷课" value="旷课" />
            <el-option v-if="form.type === '惩罚'" label="违纪" value="违纪" />
            <el-option v-if="form.type === '惩罚'" label="考试作弊" value="考试作弊" />
            <el-option v-if="form.type === '惩罚'" label="其他惩罚" value="其他惩罚" />
          </el-select>
        </el-form-item>
        <el-form-item label="分值" prop="points">
          <el-input-number v-model="form.points" :min="1" :max="100" style="width:100%" />
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入详细原因" />
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
import { getRewards, addReward, deleteReward } from '../../api/reward'
import { getStudents } from '../../api/student'

const loading = ref(false)
const records = ref([])
const studentOptions = ref([])
const editingMode = ref(false)
const selectedRows = ref([])
const dialogVisible = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const form = ref({ studentId: '', studentName: '', className: '', type: '奖励', category: '', points: 5, reason: '' })

const formRules = {
  studentId: [{ required: true, message: '请选择学生', trigger: 'change' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  category: [{ required: true, message: '请选择类别', trigger: 'change' }],
  reason: [{ required: true, message: '请输入原因', trigger: 'blur' }],
}

const rewardCount = computed(() => records.value.filter(r => r.type === '奖励').length)
const punishCount = computed(() => records.value.filter(r => r.type === '惩罚').length)

const toggleEditMode = () => {
  editingMode.value = !editingMode.value
  if (!editingMode.value) selectedRows.value = []
}

const onStudentChange = (val) => {
  const s = studentOptions.value.find(x => x.student_id === val)
  if (s) {
    form.value.studentName = s.name
    form.value.className = s.class_name || ''
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const [res, stuRes] = await Promise.all([getRewards(), getStudents()])
    records.value = res.data || []
    studentOptions.value = stuRes.data || []
  } catch (e) {
    ElMessage.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

const handleAdd = () => {
  form.value = { studentId: '', studentName: '', className: '', type: '奖励', category: '', points: 5, reason: '' }
  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  submitLoading.value = true
  try {
    await addReward(form.value)
    ElMessage.success('添加成功')
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error('添加失败')
  } finally {
    submitLoading.value = false
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除此记录吗？', '确认删除', { type: 'warning' })
    await deleteReward(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 条记录吗？`, '确认批量删除', { type: 'warning' })
    for (const row of selectedRows.value) {
      await deleteReward(row.id)
    }
    ElMessage.success(`成功删除 ${selectedRows.value.length} 条记录`)
    selectedRows.value = []
    fetchData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('批量删除失败')
  }
}

onMounted(fetchData)
</script>

<style scoped>
.reward-page { max-width: 1200px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.header-actions { display: flex; gap: 8px; flex-shrink: 0; }
.stat-row { display: flex; gap: 16px; margin-bottom: 16px; }
.stat-item { padding: 16px 24px; border-radius: 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.06); text-align: center; min-width: 140px; }
.stat-reward { border-left: 4px solid #16a34a; }
.stat-punish { border-left: 4px solid #dc2626; }
.stat-num { display: block; font-size: 28px; font-weight: 700; color: #1e293b; }
.stat-label { font-size: 13px; color: #94a3b8; }
.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }
</style>
