<template>
  <div class="exam-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">考试日程管理</h2>
        <p class="page-desc">配置各班级考试安排，学生端首页可查看即将到来的考试</p>
      </div>
      <div class="header-actions">
        <el-button :type="editingMode ? 'warning' : 'default'" @click="editingMode = !editingMode">
          <el-icon><Edit /></el-icon> {{ editingMode ? '取消编辑' : '编辑管理' }}
        </el-button>
        <el-button v-if="editingMode && selectedRows.length > 0" type="danger" @click="handleBatchDelete">
          <el-icon><Delete /></el-icon> 批量删除 ({{ selectedRows.length }})
        </el-button>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>新增考试
        </el-button>
        <el-button @click="handleBatchAdd" plain>
          <el-icon><List /></el-icon>批量添加
        </el-button>
      </div>
    </div>

    <!-- 筛选条件 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <el-select v-model="filterClass" placeholder="按班级筛选" clearable style="width: 180px" @change="fetchData">
          <el-option v-for="c in classList" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="考试状态" clearable style="width: 140px" @change="fetchData">
          <el-option label="即将到来" value="upcoming" />
          <el-option label="已结束" value="past" />
        </el-select>
        <el-button type="primary" plain @click="fetchData">
          <el-icon><Search /></el-icon>查询
        </el-button>
        <span class="result-count">共 <strong>{{ exams.length }}</strong> 条考试安排</span>
      </div>
    </el-card>

    <!-- 考试列表 -->
    <el-card shadow="never" class="table-card">
      <el-table :data="exams" stripe row-key="id" :default-sort="{ prop: 'exam_date', order: 'ascending' }" @selection-change="selectedRows = $event">
        <el-table-column v-if="editingMode" type="selection" width="50" />
        <el-table-column prop="course_name" label="课程名称" min-width="160">
          <template #default="{ row }">
            <span class="course-name">{{ row.course_name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="日期" width="120" sortable prop="exam_date">
          <template #default="{ row }">
            <span :class="{ 'past-date': isPast(row.exam_date) }">{{ row.exam_date }}</span>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="140">
          <template #default="{ row }">{{ formatTimeRange(row) }}</template>
        </el-table-column>
        <el-table-column label="时长" width="90">
          <template #default="{ row }">{{ row.duration }}分钟</template>
        </el-table-column>
        <el-table-column prop="location" label="地点" min-width="140" />
        <el-table-column prop="class_name" label="班级" width="130">
          <template #default="{ row }">
            <el-tag size="small" type="primary" effect="light">{{ row.class_name }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getExamStatus(row).type" size="small" :effect="getExamStatus(row).tag === '考试中' ? 'dark' : 'light'">
              {{ getExamStatus(row).tag }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="100" show-overflow-tooltip prop="description" />
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
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑考试' : '新增考试'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="课程名称" prop="courseName">
          <el-input v-model="form.courseName" placeholder="例如：高等数学(下)" />
        </el-form-item>
        <el-form-item label="考试日期" prop="examDate">
          <el-date-picker v-model="form.examDate" type="date" placeholder="选择日期" style="width:100%"
            value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="考试时间" prop="examTime">
              <el-time-picker v-model="form.examTime" format="HH:mm" value-format="HH:mm" placeholder="选择时间"
                style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="考试时长" prop="duration">
              <el-input-number v-model="form.duration" :min="30" :max="300" :step="30" style="width:100%">
                <template #suffix>分钟</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="考试地点" prop="location">
          <el-input v-model="form.location" placeholder="例如：教学楼A301" />
        </el-form-item>
        <el-form-item label="适用班级" prop="classNames">
          <el-select v-model="form.classNames" multiple filterable placeholder="选择班级（可多选）" style="width:100%">
            <el-option v-for="c in classList" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注说明">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="考试注意事项等" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 批量添加对话框 -->
    <el-dialog v-model="batchVisible" title="批量添加考试" width="700px" destroy-on-close>
      <div class="batch-hint">
        <el-icon><InfoFilled /></el-icon>
        每行一条记录，格式：课程名称,日期(YYYY-MM-DD),时间(HH:MM),时长(分钟),地点,班级,备注
      </div>
      <el-input v-model="batchText" type="textarea" :rows="10" style="margin-top: 12px"
        placeholder="高等数学(下),2025-06-16,09:00,120,教学楼A301,计科2101,闭卷考试" />
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchLoading" @click="submitBatch">批量创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, List, Search, Edit, Delete, InfoFilled } from '@element-plus/icons-vue'
import { getExams, addExam, updateExam, deleteExam, getExamClasses, batchDeleteExams } from '../../api/exam'
import { formatTimeRange, getExamStatus, isPast } from '../../utils/exam'

const loading = ref(false)
const exams = ref([])
const selectedRows = ref([])
const editingMode = ref(false)
const classList = ref([])
const filterClass = ref('')
const filterStatus = ref('')

const dialogVisible = ref(false)
const isEdit = ref(false)
const submitLoading = ref(false)
const formRef = ref(null)
const form = ref({
  id: null, courseName: '', examDate: '', examTime: '09:00',
  duration: 120, location: '', classNames: [], description: ''
})
const formRules = {
  courseName: [{ required: true, message: '请输入课程名称', trigger: 'blur' }],
  examDate: [{ required: true, message: '请选择考试日期', trigger: 'change' }],
  examTime: [{ required: true, message: '请选择考试时间', trigger: 'change' }],
  duration: [{ required: true, message: '请输入考试时长', trigger: 'blur' }],
  classNames: [{ type: 'array', required: true, min: 1, message: '请选择至少一个班级', trigger: 'change' }],
}

const batchVisible = ref(false)
const batchText = ref('')
const batchLoading = ref(false)

// 使用共享工具函数，确保与管理端/学生端状态判断完全一致
// formatTimeRange、getExamStatus、isPast 均来自 @/utils/exam

const fetchData = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterClass.value) params.class_name = filterClass.value
    if (filterStatus.value) params.status = filterStatus.value
    const [examRes, classRes] = await Promise.all([
      getExams(params),
      getExamClasses()
    ])
    exams.value = examRes.data || examRes || []
    classList.value = classRes.data || classRes || []
  } catch (e) {
    ElMessage.error('获取数据失败')
  } finally { loading.value = false }
}

const resetForm = () => {
  form.value = {
    id: null, courseName: '', examDate: '', examTime: '09:00',
    duration: 120, location: '', classNames: [], description: ''
  }
}

const handleAdd = () => { resetForm(); isEdit.value = false; dialogVisible.value = true }

const handleEdit = (row) => {
  form.value = {
    id: row.id, courseName: row.course_name, examDate: row.exam_date,
    examTime: row.exam_time, duration: row.duration, location: row.location,
    classNames: [row.class_name], description: row.description || ''
  }
  isEdit.value = true; dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  submitLoading.value = true
  try {
    const data = {
      courseName: form.value.courseName,
      examDate: form.value.examDate,
      examTime: form.value.examTime,
      duration: form.value.duration,
      location: form.value.location,
      classNames: form.value.classNames.join(','),
      description: form.value.description
    }
    if (isEdit.value) {
      data.className = form.value.classNames[0]
      await updateExam(form.value.id, data)
      ElMessage.success('修改成功')
    } else {
      await addExam(data)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch (e) {
    ElMessage.error(isEdit.value ? '修改失败' : '新增失败')
  } finally { submitLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定删除「${row.course_name}」(${row.class_name}) 的考试安排吗？`,
      '确认删除', { type: 'warning' }
    )
    await deleteExam(row.id)
    ElMessage.success('删除成功')
    fetchData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleBatchAdd = () => {
  batchText.value = ''
  batchVisible.value = true
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 条考试安排吗？此操作不可恢复。`, '确认批量删除', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.id)
    await batchDeleteExams(ids)
    ElMessage.success(`成功删除 ${ids.length} 条考试安排`)
    selectedRows.value = []
    fetchData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('批量删除失败')
  }
}

const submitBatch = async () => {
  if (!batchText.value.trim()) {
    ElMessage.warning('请输入考试数据')
    return
  }
  batchLoading.value = true
  try {
    const lines = batchText.value.trim().split('\n').filter(Boolean)
    let success = 0, fail = 0
    for (const line of lines) {
      try {
        const parts = line.split(',').map(s => s.trim())
        if (parts.length < 6) { fail++; continue }
        const [courseName, examDate, examTime = '09:00', duration = '120', location = '', classNames, description = ''] = parts
        await addExam({ courseName, examDate, examTime, duration: parseInt(duration) || 120, location, classNames, description })
        success++
      } catch { fail++ }
    }
    ElMessage.success(`批量创建完成：成功 ${success} 条，失败 ${fail} 条`)
    batchVisible.value = false
    fetchData()
  } catch {
    ElMessage.error('批量创建失败')
  } finally { batchLoading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.exam-page { max-width: 1200px; margin: 0 auto; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.header-actions { display: flex; gap: 8px; flex-shrink: 0; }

.toolbar-card { border-radius: 8px; margin-bottom: 16px; }
.toolbar-card :deep(.el-card__body) { padding: 14px 20px; }
.toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.result-count { margin-left: auto; font-size: 14px; color: #64748b; }
.result-count strong { color: #1a56db; }

.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }
.course-name { font-weight: 600; color: #1e293b; }
.past-date { color: #94a3b8; text-decoration: line-through; }

.batch-hint { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #d97706; background: #fffbeb; padding: 10px 14px; border-radius: 6px; }
</style>
