<template>
  <div class="group-management-page">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><User /></el-icon>
        分组管理
      </h2>
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建分组
      </el-button>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="filterClass" placeholder="选择班级" clearable @change="loadGroups" style="width: 180px">
        <el-option v-for="cls in classList" :key="cls" :label="cls" :value="cls" />
      </el-select>
      <el-radio-group v-model="showDisbanded" @change="loadGroups" style="margin-left: 12px">
        <el-radio-button :label="false">活跃分组</el-radio-button>
        <el-radio-button :label="true">已解散</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 分组列表 -->
    <el-table :data="groupList" v-loading="loading" stripe border empty-text="暂无分组">
      <el-table-column type="index" width="60" label="序号" />
      <el-table-column prop="name" label="分组名称" min-width="150" />
      <el-table-column prop="class_name" label="所属班级" width="120" />
      <el-table-column prop="description" label="描述" min-width="150" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.is_active ? 'success' : 'info'">
            {{ row.is_active ? '活跃' : '已解散' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleViewDetail(row)">
            <el-icon><View /></el-icon>
            详情
          </el-button>
          <el-button v-if="row.is_active" type="warning" size="small" @click="handleManageMembers(row)">
            <el-icon><UserFilled /></el-icon>
            成员
          </el-button>
          <el-button v-if="row.is_active" type="danger" size="small" @click="handleDisband(row)">
            <el-icon><CircleClose /></el-icon>
            解散
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 空状态 -->
    <div v-if="!loading && groupList.length === 0" class="empty-hint">
      <el-empty :description="showDisbanded ? '暂无已解散的分组' : '暂无活跃分组，点击上方按钮创建'">
        <el-button v-if="!showDisbanded" type="primary" @click="handleCreate">创建分组</el-button>
      </el-empty>
    </div>

    <!-- 创建分组弹窗 -->
    <el-dialog v-model="createDialogVisible" title="创建分组" width="450px">
      <el-form :model="createForm" label-width="100px" :rules="createRules" ref="createFormRef">
        <el-form-item label="分组名称" prop="name">
          <el-input v-model="createForm.name" placeholder="请输入分组名称" />
        </el-form-item>
        <el-form-item label="所属班级" prop="class_name">
          <el-select v-model="createForm.class_name" placeholder="选择班级" style="width: 100%">
            <el-option v-for="cls in classList" :key="cls" :label="cls" :value="cls" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmCreate" :loading="creating">创建</el-button>
      </template>
    </el-dialog>

    <!-- 分组详情弹窗 -->
    <el-dialog v-model="detailDialogVisible" title="分组详情" width="700px">
      <div v-if="currentGroup">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="分组名称">{{ currentGroup.name }}</el-descriptions-item>
          <el-descriptions-item label="所属班级">{{ currentGroup.class_name }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentGroup.is_active ? 'success' : 'info'">
              {{ currentGroup.is_active ? '活跃' : '已解散' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ formatDate(currentGroup.created_at) }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ currentGroup.description || '-' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 活跃度统计 -->
        <div class="stats-section" v-if="currentGroup.stats">
          <h4>活跃度统计</h4>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-statistic title="成员数" :value="currentGroup.members?.length || 0" />
            </el-col>
            <el-col :span="8">
              <el-statistic title="消息数" :value="parseInt(currentGroup.stats.message_count) || 0" />
            </el-col>
            <el-col :span="8">
              <el-statistic title="活跃人数" :value="parseInt(currentGroup.stats.active_members) || 0" />
            </el-col>
          </el-row>
        </div>

        <!-- 成员列表 -->
        <div class="members-section">
          <h4>成员列表</h4>
          <el-table :data="currentGroup.members" size="small" border empty-text="暂无成员">
            <el-table-column prop="student_name" label="姓名" width="120" />
            <el-table-column prop="student_id" label="学号" width="120" />
            <el-table-column label="角色" width="100">
              <template #default="{ row }">
                <el-tag v-if="row.role === 'leader'" type="warning">
                  <el-icon><StarFilled /></el-icon> 组长
                </el-tag>
                <el-tag v-else type="info">成员</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="加入时间" width="170">
              <template #default="{ row }">
                {{ formatDate(row.joined_at) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </el-dialog>

    <!-- 成员管理弹窗 -->
    <el-dialog v-model="memberDialogVisible" title="成员管理" width="900px">
      <div v-if="currentGroup">
        <el-row :gutter="20">
          <!-- 当前成员 -->
          <el-col :span="14">
            <h4>当前成员 ({{ currentGroup.members?.length || 0 }})</h4>
            <el-table :data="currentGroup.members" size="small" border height="400" empty-text="暂无成员">
              <el-table-column prop="student_name" label="姓名" width="100" />
              <el-table-column prop="student_id" label="学号" width="100" />
              <el-table-column label="角色" width="90">
                <template #default="{ row }">
                  <el-tag v-if="row.role === 'leader'" type="warning" size="small">
                    <el-icon><StarFilled /></el-icon> 组长
                  </el-tag>
                  <span v-else class="member-tag">成员</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button v-if="row.role !== 'leader'" type="warning" size="small" @click="handleAppointLeader(row)">
                    任命组长
                  </el-button>
                  <el-button type="danger" size="small" @click="handleRemoveMember(row)">
                    移除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-col>

          <!-- 可添加的学生 -->
          <el-col :span="10">
            <h4>可添加的学生 ({{ availableStudents.length }})</h4>
            <el-input v-model="studentSearch" placeholder="搜索姓名/学号" size="small" clearable style="margin-bottom: 8px">
              <template #prefix><el-icon><Search /></el-icon></template>
            </el-input>
            <el-table
              :data="availableStudents"
              size="small"
              border
              height="300"
              empty-text="没有可添加的学生"
              @selection-change="handleSelectionChange"
              ref="studentTableRef"
            >
              <el-table-column type="selection" width="40" />
              <el-table-column prop="name" label="姓名" width="80" />
              <el-table-column prop="student_id" label="学号" width="90" />
            </el-table>
            <div class="batch-add-bar">
              <el-button type="primary" size="small" @click="handleBatchAdd" :disabled="selectedStudents.length === 0" :loading="batchAdding">
                <el-icon><Plus /></el-icon>
                批量添加 ({{ selectedStudents.length }})
              </el-button>
            </div>
          </el-col>
        </el-row>
      </div>
    </el-dialog>

    <!-- 活跃度统计面板 -->
    <div class="stats-panel" v-if="!showDisbanded && groupStats.length > 0">
      <h3 class="stats-title">
        <el-icon><TrendCharts /></el-icon>
        分组活跃度统计
      </h3>
      <el-table :data="groupStats" size="small" stripe border empty-text="暂无统计数据">
        <el-table-column prop="name" label="分组名称" min-width="150" />
        <el-table-column prop="class_name" label="班级" width="120" />
        <el-table-column prop="member_count" label="成员数" width="90" />
        <el-table-column prop="message_count" label="消息数" width="90" />
        <el-table-column prop="active_members" label="活跃人数" width="100" />
        <el-table-column label="最后活跃" width="170">
          <template #default="{ row }">
            {{ row.last_activity ? formatDate(row.last_activity) : '无' }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  User, Plus, View, UserFilled, CircleClose, StarFilled, Search, TrendCharts
} from '@element-plus/icons-vue'
import {
  getGroups, createGroup, getGroupDetail, disbandGroup,
  addGroupMember, removeGroupMember, appointLeader, getGroupStats
} from '../../api/group'
import { getClasses } from '../../api/class'
import { getStudents } from '../../api/student'

const loading = ref(false)
const groupList = ref([])
const filterClass = ref('')
const showDisbanded = ref(false)
const classList = ref([])
const allStudents = ref([])
const groupStats = ref([])

const createDialogVisible = ref(false)
const createForm = ref({ name: '', class_name: '', description: '' })
const createFormRef = ref(null)
const creating = ref(false)
const createRules = {
  name: [{ required: true, message: '请输入分组名称', trigger: 'blur' }],
  class_name: [{ required: true, message: '请选择班级', trigger: 'change' }]
}

const detailDialogVisible = ref(false)
const memberDialogVisible = ref(false)
const currentGroup = ref(null)
const studentSearch = ref('')
const selectedStudents = ref([])
const studentTableRef = ref(null)
const batchAdding = ref(false)

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const loadGroups = async () => {
  loading.value = true
  try {
    const params = {}
    if (filterClass.value) params.class_name = filterClass.value
    if (showDisbanded.value) params.include_disbanded = 'true'
    const res = await getGroups(params)
    groupList.value = res.data || []
  } catch (err) {
    console.error('获取分组列表失败:', err)
    ElMessage.error('获取分组列表失败: ' + (err.response?.data?.message || err.message))
    groupList.value = []
  } finally {
    loading.value = false
  }
}

const loadClasses = async () => {
  try {
    const res = await getClasses()
    classList.value = (res.data || []).map(c => c.name).filter(Boolean)
  } catch (err) {
    console.error('获取班级列表失败', err)
  }
}

const loadStudents = async () => {
  try {
    const res = await getStudents()
    allStudents.value = res.data || []
  } catch (err) {
    console.error('获取学生列表失败', err)
  }
}

const loadStats = async () => {
  try {
    const res = await getGroupStats()
    groupStats.value = res.data || []
  } catch (err) {
    console.error('获取统计失败', err)
    groupStats.value = []
  }
}

const handleCreate = () => {
  createForm.value = { name: '', class_name: '', description: '' }
  createDialogVisible.value = true
}

const confirmCreate = async () => {
  if (!createFormRef.value) return
  await createFormRef.value.validate(async (valid) => {
    if (!valid) return
    creating.value = true
    try {
      await createGroup(createForm.value)
      ElMessage.success('创建成功')
      createDialogVisible.value = false
      loadGroups()
    } catch (err) {
      console.error('创建失败:', err)
      ElMessage.error('创建失败: ' + (err.response?.data?.message || err.message))
    } finally {
      creating.value = false
    }
  })
}

const handleViewDetail = async (row) => {
  try {
    const res = await getGroupDetail(row.id)
    currentGroup.value = res.data
    detailDialogVisible.value = true
  } catch (err) {
    console.error('获取详情失败:', err)
    ElMessage.error('获取详情失败')
  }
}

const handleManageMembers = async (row) => {
  try {
    const res = await getGroupDetail(row.id)
    currentGroup.value = res.data
    selectedStudents.value = []
    studentSearch.value = ''
    memberDialogVisible.value = true
  } catch (err) {
    console.error('获取详情失败:', err)
    ElMessage.error('获取详情失败')
  }
}

const handleDisband = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定解散分组 "${row.name}" 吗？解散后所有聊天消息和文件将被清空，此操作不可恢复。`,
      '确认解散',
      { confirmButtonText: '解散', cancelButtonText: '取消', type: 'warning' }
    )
    await disbandGroup(row.id)
    ElMessage.success('分组已解散')
    loadGroups()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('解散失败:', err)
      ElMessage.error('解散失败')
    }
  }
}

const availableStudents = computed(() => {
  if (!currentGroup.value) return []
  const memberIds = new Set(currentGroup.value.members?.map(m => m.student_id) || [])
  let students = allStudents.value.filter(s => !memberIds.has(s.student_id))
  if (currentGroup.value.class_name) {
    students = students.filter(s => s.class_name === currentGroup.value.class_name)
  }
  if (studentSearch.value) {
    const kw = studentSearch.value.toLowerCase()
    students = students.filter(s =>
      s.name?.toLowerCase().includes(kw) || s.student_id?.includes(kw)
    )
  }
  return students
})

const handleSelectionChange = (selection) => {
  selectedStudents.value = selection
}

const handleBatchAdd = async () => {
  if (selectedStudents.value.length === 0) return
  batchAdding.value = true
  let success = 0
  let fail = 0
  for (const student of selectedStudents.value) {
    try {
      await addGroupMember(currentGroup.value.id, student.student_id)
      success++
    } catch (err) {
      fail++
    }
  }
  batchAdding.value = false
  if (success > 0) {
    ElMessage.success(`成功添加 ${success} 人${fail > 0 ? `，${fail} 人失败` : ''}`)
  } else {
    ElMessage.error('添加失败')
  }
  // 刷新数据
  try {
    const res = await getGroupDetail(currentGroup.value.id)
    currentGroup.value = res.data
    selectedStudents.value = []
    if (studentTableRef.value) studentTableRef.value.clearSelection()
    loadGroups()
  } catch (err) {
    console.error('刷新失败', err)
  }
}

const handleAddMember = async (student) => {
  try {
    await addGroupMember(currentGroup.value.id, student.student_id)
    ElMessage.success('添加成功')
    const res = await getGroupDetail(currentGroup.value.id)
    currentGroup.value = res.data
    loadGroups()
  } catch (err) {
    console.error('添加失败:', err)
    ElMessage.error('添加失败')
  }
}

const handleRemoveMember = async (member) => {
  try {
    await ElMessageBox.confirm(
      `确定移除成员 "${member.student_name}" 吗？`,
      '确认移除',
      { confirmButtonText: '移除', cancelButtonText: '取消', type: 'warning' }
    )
    await removeGroupMember(currentGroup.value.id, member.student_id)
    ElMessage.success('移除成功')
    const res = await getGroupDetail(currentGroup.value.id)
    currentGroup.value = res.data
    loadGroups()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('移除失败:', err)
      ElMessage.error('移除失败')
    }
  }
}

const handleAppointLeader = async (member) => {
  try {
    await ElMessageBox.confirm(
      `确定任命 "${member.student_name}" 为组长吗？原组长将被取消。`,
      '确认任命',
      { confirmButtonText: '任命', cancelButtonText: '取消', type: 'warning' }
    )
    await appointLeader(currentGroup.value.id, member.student_id)
    ElMessage.success('任命成功')
    const res = await getGroupDetail(currentGroup.value.id)
    currentGroup.value = res.data
    loadGroups()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('任命失败:', err)
      ElMessage.error('任命失败')
    }
  }
}

onMounted(() => {
  loadGroups()
  loadClasses()
  loadStudents()
  loadStats()
})
</script>

<style scoped>
.group-management-page {
  padding: 0;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 20px;
  color: #1a56db;
}
.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.empty-hint {
  padding: 40px 0;
}
.stats-section {
  margin: 20px 0;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}
.stats-section h4 {
  margin: 0 0 12px 0;
  color: #303133;
}
.members-section {
  margin-top: 20px;
}
.members-section h4 {
  margin: 0 0 12px 0;
  color: #303133;
}
.member-tag {
  font-size: 12px;
  color: #909399;
}
.batch-add-bar {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}
.stats-panel {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}
.stats-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  font-size: 18px;
  color: #1a56db;
}

@media (max-width: 768px) {
  .group-management-page { padding: 0 4px; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-bar .el-select { width: 100% !important; }
  .filter-bar .el-radio-group { margin-left: 0; }
  .group-management-page > .el-table { min-width: 700px; }
  .group-management-page > .el-table .el-table__body-wrapper { overflow-x: auto; }
  .stats-panel .el-table { min-width: 600px; }
  .stats-panel .el-table .el-table__body-wrapper { overflow-x: auto; }
  .group-management-page :deep(.el-dialog) { width: calc(100vw - 32px) !important; max-width: 700px; }
  .group-management-page :deep(.el-dialog .el-row) { flex-direction: column; }
  .group-management-page :deep(.el-dialog .el-col) { width: 100% !important; max-width: 100% !important; }
}
</style>
