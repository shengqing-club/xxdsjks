<template>
  <div class="all-students-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">学生信息查询</h2>
        <p class="page-desc">查看和管理所有学生信息，支持按专业筛选及密码管理</p>
      </div>
    </div>

    <!-- Search Bar -->
    <el-card shadow="never" class="search-card">
      <div class="search-bar">
        <el-input v-model="keyword" placeholder="姓名/学号/专业/班级" clearable class="search-input" @keyup.enter="handleSearch">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="majorFilter" placeholder="按专业筛选" clearable style="width: 160px" @change="handleSearch">
          <el-option v-for="m in majorList" :key="m" :label="m" :value="m" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 120px" @change="handleSearch">
          <el-option label="在读" value="在读" />
          <el-option label="休学" value="休学" />
          <el-option label="毕业" value="毕业" />
          <el-option label="退学" value="退学" />
        </el-select>
        <el-button type="primary" @click="handleSearch"><el-icon><Search /></el-icon>搜索</el-button>
        <el-button @click="handleReset"><el-icon><RefreshRight /></el-icon>重置</el-button>
        <el-button type="success" @click="importDialogVisible = true"><el-icon><Upload /></el-icon>批量导入</el-button>
        <span class="result-count">共 <strong>{{ filteredStudents.length }}</strong> 条</span>
      </div>
    </el-card>

    <!-- Batch Toolbar -->
    <el-card v-if="selectedRows.length > 0" shadow="never" class="batch-card">
      <div class="batch-bar">
        <span class="batch-info">已选择 <strong>{{ selectedRows.length }}</strong> 名学生</span>
        <el-select v-model="batchStatus" placeholder="批量修改状态" style="width: 160px">
          <el-option label="在读" value="在读" />
          <el-option label="休学" value="休学" />
          <el-option label="毕业" value="毕业" />
          <el-option label="退学" value="退学" />
        </el-select>
        <el-button type="primary" :loading="batchLoading" @click="handleBatchUpdate">批量更新状态</el-button>
        <el-button type="warning" plain :loading="batchPwdLoading" @click="handleBatchResetPwd">批量重置密码</el-button>
        <el-button @click="clearSelection">取消选择</el-button>
      </div>
    </el-card>

    <!-- Student Table -->
    <el-card shadow="never" class="table-card">
      <el-table ref="tableRef" :data="filteredStudents" stripe @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="student_id" label="学号" min-width="120" />
        <el-table-column prop="name" label="姓名" min-width="90" />
        <el-table-column prop="gender" label="性别" width="65" />
        <el-table-column prop="age" label="年龄" width="65" />
        <el-table-column prop="major" label="专业" min-width="130" />
        <el-table-column prop="class_name" label="班级" min-width="110" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status || '在读' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)"><el-icon><Edit /></el-icon></el-button>
            <el-button type="warning" size="small" @click="handlePassword(row)"><el-icon><Key /></el-icon></el-button>
            <el-button type="danger" size="small" @click="handleDelete(row)"><el-icon><Delete /></el-icon></el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Edit Dialog -->
    <el-dialog v-model="editDialogVisible" title="编辑学生信息" width="500px" destroy-on-close>
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="80px">
        <el-form-item label="学号"><el-input v-model="editForm.studentId" disabled /></el-form-item>
        <el-form-item label="姓名" prop="name"><el-input v-model="editForm.name" /></el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="editForm.gender"><el-radio value="男">男</el-radio><el-radio value="女">女</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="年龄" prop="age"><el-input-number v-model="editForm.age" :min="1" :max="100" /></el-form-item>
        <el-form-item label="专业" prop="major">
          <el-select v-model="editForm.major" filterable allow-create style="width:100%" @change="handleMajorChange">
            <el-option v-for="m in majorList" :key="m" :label="m" :value="m" />
          </el-select>
        </el-form-item>
        <el-form-item label="班级" prop="className">
          <el-select v-model="editForm.className" filterable allow-create style="width:100%" placeholder="请先选择专业再选班级">
            <el-option v-for="c in filteredClassOptions" :key="c.id" :label="c.name" :value="c.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态"><el-select v-model="editForm.status" style="width:100%">
          <el-option v-for="s in ['在读','休学','毕业','退学']" :key="s" :label="s" :value="s" />
        </el-select></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="submitEdit">确定</el-button>
      </template>
    </el-dialog>

    <!-- Password Dialog -->
    <el-dialog v-model="pwdDialogVisible" title="学生密码管理" width="450px" destroy-on-close>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="学号">{{ pwdForm.studentId }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ pwdForm.name }}</el-descriptions-item>
      </el-descriptions>
      <el-divider />
      <el-form label-width="90px">
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" placeholder="留空则自动生成">
            <template #append>
              <el-button @click="generateRandomPwd">随机生成</el-button>
            </template>
          </el-input>
        </el-form-item>
        <div style="font-size:12px;color:#94a3b8;margin-bottom:12px">
          设置后将强制更新学生密码，建议生成随机密码后通知学生自行修改
        </div>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="confirmResetPwd">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- Import Dialog -->
    <el-dialog v-model="importDialogVisible" title="批量导入学生" width="600px" destroy-on-close>
      <div style="margin-bottom: 16px;">
        <p style="font-size: 14px; color: #475569; margin: 0 0 12px;">
          请上传 Excel 文件，支持 .xlsx 格式。必填列：<strong>学号、姓名</strong>，可选列：性别、年龄、专业、班级、状态、密码。
        </p>
        <el-button type="primary" plain @click="downloadTemplate">
          <el-icon><Download /></el-icon>下载模板
        </el-button>
      </div>

      <el-upload
        ref="uploadRef"
        drag
        action="#"
        :auto-upload="false"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
        accept=".xlsx,.xls"
        :limit="1"
      >
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">
          拖拽文件到此处或 <em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            仅支持 .xlsx / .xls 格式，学号重复会自动更新已有记录
          </div>
        </template>
      </el-upload>

      <div v-if="importResult" style="margin-top: 16px;">
        <el-alert
          :title="importResult.message"
          :type="importResult.failed.length > 0 ? 'warning' : 'success'"
          :closable="false"
          show-icon
        />
        <div v-if="importResult.failed.length > 0" style="margin-top: 12px; max-height: 200px; overflow-y: auto;">
          <el-table :data="importResult.failed" size="small" border>
            <el-table-column prop="row" label="行号" width="80" />
            <el-table-column prop="reason" label="失败原因" />
          </el-table>
        </div>
      </div>

      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importLoading" :disabled="!importFile" @click="confirmImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, RefreshRight, Edit, Delete, Key, Upload, Download } from '@element-plus/icons-vue'
import { getStudents, updateStudent, deleteStudent, resetStudentPassword, batchResetPassword, getMajorsList, importStudents } from '../../api/student'
import { getClasses } from '../../api/class'

const loading = ref(false)
const students = ref([])
const keyword = ref('')
const majorFilter = ref('')
const statusFilter = ref('')
const filteredStudents = ref([])
const majorList = ref([])
const allClasses = ref([])

const tableRef = ref(null)
const selectedRows = ref([])
const batchStatus = ref('')
const batchLoading = ref(false)
const batchPwdLoading = ref(false)

const editDialogVisible = ref(false)
const editLoading = ref(false)
const editFormRef = ref(null)
const editForm = ref({ id: null, studentId: '', name: '', gender: '', age: null, major: '', className: '', status: '在读' })
const editRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  major: [{ required: true, message: '请选择专业', trigger: 'change' }],
  className: [{ required: true, message: '请选择班级', trigger: 'change' }]
}

// 根据当前选择的专业过滤班级列表
const filteredClassOptions = computed(() => {
  if (!editForm.value.major || allClasses.value.length === 0) return allClasses.value
  return allClasses.value.filter(c => c.major_name === editForm.value.major)
})

const pwdDialogVisible = ref(false)
const pwdLoading = ref(false)
const pwdForm = ref({ id: null, studentId: '', name: '', newPassword: '' })

// 批量导入
const importDialogVisible = ref(false)
const importLoading = ref(false)
const importFile = ref(null)
const importResult = ref(null)
const uploadRef = ref(null)

const getStatusType = (s) => ({ '在读': 'success', '休学': 'warning', '毕业': 'info', '退学': 'danger' })[s] || 'success'

const fetchData = async () => {
  loading.value = true
  try {
    const [sRes, mRes, cRes] = await Promise.all([getStudents(), getMajorsList(), getClasses({})])
    students.value = sRes.data || []
    majorList.value = (mRes.data || []).map(m => m.name).filter(Boolean)
    allClasses.value = cRes.data || cRes || []
    filteredStudents.value = [...students.value]
    console.log('[AllStudents] 加载学生数:', students.value.length, '班级数:', allClasses.value.length)
  } catch (e) { ElMessage.error('获取数据失败'); console.error(e) } finally { loading.value = false }
}

// 单独刷新专业/班级下拉选项（新增专业/班级后打开编辑框时调用）
const refreshOptions = async () => {
  try {
    const [mRes, cRes] = await Promise.all([getMajorsList(), getClasses({})])
    majorList.value = (mRes.data || []).map(m => m.name).filter(Boolean)
    allClasses.value = cRes.data || cRes || []
  } catch (e) { console.error('刷新选项失败', e) }
}

const handleSearch = () => {
  let result = [...students.value]
  if (keyword.value.trim()) {
    const kw = keyword.value.trim().toLowerCase()
    result = result.filter(s =>
      (s.name && s.name.toLowerCase().includes(kw)) ||
      (s.student_id && s.student_id.toLowerCase().includes(kw)) ||
      (s.major && s.major.toLowerCase().includes(kw)) ||
      (s.class_name && s.class_name.toLowerCase().includes(kw))
    )
  }
  if (majorFilter.value) result = result.filter(s => s.major === majorFilter.value)
  if (statusFilter.value) result = result.filter(s => (s.status || '在读') === statusFilter.value)
  filteredStudents.value = result
}

const handleReset = () => { keyword.value = ''; majorFilter.value = ''; statusFilter.value = ''; fetchData() }
const handleSelectionChange = (rows) => { selectedRows.value = rows }
const clearSelection = () => { tableRef.value?.clearSelection(); selectedRows.value = [] }

const handleBatchUpdate = async () => {
  if (!batchStatus.value) { ElMessage.warning('请选择目标状态'); return }
  try {
    await ElMessageBox.confirm(`确定将 ${selectedRows.value.length} 名学生状态改为「${batchStatus.value}」？`, '确认', { type: 'warning' })
    batchLoading.value = true
    await Promise.all(selectedRows.value.map(r => updateStudent(r.id, { ...r, status: batchStatus.value })))
    ElMessage.success('批量更新成功'); batchStatus.value = ''; clearSelection(); fetchData()
  } catch (e) { if (e !== 'cancel') ElMessage.error('批量更新失败') } finally { batchLoading.value = false }
}

const handleBatchResetPwd = async () => {
  try {
    await ElMessageBox.confirm(`确定重置 ${selectedRows.value.length} 名学生的密码吗？`, '确认', { type: 'warning' })
    batchPwdLoading.value = true
    const res = await batchResetPassword(selectedRows.value.map(r => r.id))
    ElMessage.success(res.data?.message || '批量重置成功')
    // Show passwords
    if (res.data?.results?.length) {
      const info = res.data.results.map(r => `${r.name}(${r.student_id}): ${r.newPassword}`).join('\n')
      ElMessageBox.alert(info, '新密码列表', { confirmButtonText: '已复制', type: 'info' })
      try { navigator.clipboard.writeText(info) } catch {}
    }
    clearSelection()
  } catch (e) { if (e !== 'cancel') ElMessage.error('批量重置失败') } finally { batchPwdLoading.value = false }
}

const handleEdit = (row) => {
  refreshOptions() // 打开编辑框时刷新专业/班级列表，确保看到新增项
  editForm.value = {
    id: row.id, studentId: row.student_id, name: row.name, gender: row.gender,
    age: row.age, major: row.major, className: row.class_name, status: row.status || '在读'
  }
  editDialogVisible.value = true
}

// 专业改变时清空班级选择
const handleMajorChange = () => {
  editForm.value.className = ''
}

const submitEdit = async () => {
  if (!editFormRef.value) return
  await editFormRef.value.validate()
  editLoading.value = true
  try {
    await updateStudent(editForm.value.id, {
      name: editForm.value.name, gender: editForm.value.gender, age: editForm.value.age,
      major: editForm.value.major, className: editForm.value.className, status: editForm.value.status
    })
    ElMessage.success('修改成功')
    editDialogVisible.value = false; fetchData()
  } catch { ElMessage.error('修改失败') } finally { editLoading.value = false }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」？此操作不可撤销`, '确认删除', { type: 'warning' })
    await deleteStudent(row.id)
    ElMessage.success('删除成功'); fetchData()
  } catch (e) { if (e !== 'cancel') ElMessage.error('删除失败') }
}

const handlePassword = (row) => {
  pwdForm.value = { id: row.id, studentId: row.student_id, name: row.name, newPassword: '' }
  pwdDialogVisible.value = true
}

const generateRandomPwd = () => {
  pwdForm.value.newPassword = Math.random().toString(36).slice(-8)
}

const confirmResetPwd = async () => {
  pwdLoading.value = true
  try {
    const res = await resetStudentPassword(pwdForm.value.id, pwdForm.value.newPassword || undefined)
    const newPwd = res.data?.newPassword || pwdForm.value.newPassword
    ElMessageBox.alert(
      `学生: ${res.data?.student?.name}\n学号: ${res.data?.student?.student_id}\n新密码: ${newPwd}`,
      '密码重置成功', { confirmButtonText: '复制并确认', type: 'success' }
    ).then(() => {
      try { navigator.clipboard.writeText(newPwd) } catch {}
    })
    pwdDialogVisible.value = false
  } catch { ElMessage.error('重置失败') } finally { pwdLoading.value = false }
}

// 批量导入相关方法
const handleFileChange = (file) => {
  importFile.value = file.raw
  importResult.value = null
}

const handleFileRemove = () => {
  importFile.value = null
  importResult.value = null
}

const downloadTemplate = () => {
  const template = [
    ['学号', '姓名', '性别', '年龄', '专业', '班级', '状态', '密码'],
    ['2024001', '张三', '男', '20', '计算机科学与技术', '计科2401', '在读', '123456'],
    ['2024002', '李四', '女', '19', '软件工程', '软工2401', '在读', '123456']
  ]
  import('xlsx').then(xlsx => {
    const ws = xlsx.utils.aoa_to_sheet(template)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, '学生模板')
    xlsx.writeFile(wb, '学生导入模板.xlsx')
  })
}

const confirmImport = async () => {
  if (!importFile.value) { ElMessage.warning('请选择文件'); return }
  importLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', importFile.value)
    const res = await importStudents(formData)
    importResult.value = res.data
    ElMessage.success(res.data.message)
    if (res.data.success.length > 0) fetchData()
  } catch (e) {
    console.error('导入失败:', e)
    ElMessage.error(e.response?.data?.message || '导入失败')
  } finally {
    importLoading.value = false
  }
}

onMounted(fetchData)
</script>

<style scoped>
.all-students-page { max-width: 1100px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.search-card { border-radius: 8px; margin-bottom: 16px; }
.search-card :deep(.el-card__body) { padding: 14px 20px; }
.search-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 200px; }
.result-count { font-size: 14px; color: #64748b; margin-left: auto; }
.result-count strong { color: #1a56db; }
.batch-card { border-radius: 8px; margin-bottom: 16px; }
.batch-card :deep(.el-card__body) { padding: 12px 20px; }
.batch-bar { display: flex; align-items: center; gap: 10px; }
.batch-info { font-size: 14px; color: #64748b; }
.batch-info strong { color: #1a56db; }
.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }
</style>
