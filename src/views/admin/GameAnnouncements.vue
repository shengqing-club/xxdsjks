<template>
  <div class="game-announcements-page">
    <el-card class="ann-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">游戏通告管理</span>
          <el-button type="primary" @click="showCreateDialog = true">发布通告</el-button>
        </div>
      </template>

      <el-tabs v-model="activeTab" type="border-card">
        <el-tab-pane label="通告列表" name="list">
          <el-table :data="announcements" border stripe style="width:100%" v-loading="loading">
            <el-table-column prop="id" label="ID" width="60" />
            <el-table-column prop="title" label="标题" min-width="150" />
            <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
            <el-table-column prop="ann_type" label="类型" width="90">
              <template #default="{ row }">
                <el-tag :type="typeTag(row.ann_type)" size="small">{{ typeLabel(row.ann_type) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="show_in_game" label="游戏内显示" width="100">
              <template #default="{ row }">
                <el-switch :model-value="row.show_in_game" @change="toggleShowInGame(row)" />
              </template>
            </el-table-column>
            <el-table-column prop="is_active" label="启用" width="70">
              <template #default="{ row }">
                <el-switch :model-value="row.is_active" @change="toggleActive(row)" />
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="160">
              <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="danger" size="small" @click="deleteAnn(row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="道具/金币派发" name="distribute">
          <div class="distribute-section">
            <el-alert title="向指定用户发放道具或金币" type="info" :closable="false" style="margin-bottom:16px" />
            <el-form :model="distForm" label-width="100px" label-position="left">
              <el-form-item label="目标用户">
                <el-select
                  v-model="distForm.targetUser"
                  filterable
                  remote
                  reserve-keyword
                  placeholder="搜索用户（输入姓名或学号）"
                  :remote-method="searchUsers"
                  :loading="userSearching"
                  style="width:100%"
                  value-key="id"
                >
                  <el-option
                    v-for="u in userOptions"
                    :key="u.id"
                    :label="`${u.display_name || u.username} (${u.username}) [${u.role}]`"
                    :value="JSON.stringify(u)"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="发放金币">
                <el-input-number v-model="distForm.gold" :min="0" :max="100000" :step="100" />
                <span class="form-hint">输入0表示不发放金币</span>
              </el-form-item>
              <el-form-item label="发放道具">
                <el-select v-model="distForm.itemId" placeholder="选择道具（可不选）" clearable style="width:100%">
                  <el-option v-for="item in allItems" :key="item.id" :label="`${item.icon} ${item.name} - ${item.desc}`" :value="item.id" />
                </el-select>
              </el-form-item>
              <el-form-item label="道具数量" v-if="distForm.itemId">
                <el-input-number v-model="distForm.itemCount" :min="1" :max="999" :step="1" />
              </el-form-item>
              <el-form-item label="发放原因">
                <el-input v-model="distForm.reason" placeholder="如：活动奖励、补偿发放等" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="doDistribute" :loading="distributing" :disabled="!distForm.targetUser">
                  确认发放
                </el-button>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 创建通告对话框 -->
    <el-dialog v-model="showCreateDialog" title="发布游戏通告" width="550px" :close-on-click-modal="false">
      <el-form :model="createForm" label-width="90px" label-position="left">
        <el-form-item label="标题" required>
          <el-input v-model="createForm.title" placeholder="通告标题" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="createForm.content" type="textarea" :rows="4" placeholder="通告内容" maxlength="500" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="createForm.ann_type">
            <el-radio value="notice">通知</el-radio>
            <el-radio value="event">活动</el-radio>
            <el-radio value="reward">奖励</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="游戏内显示">
          <el-switch v-model="createForm.show_in_game" />
        </el-form-item>
        <el-form-item label="生效时间">
          <el-date-picker v-model="createForm.start_time" type="datetime" placeholder="留空即立即生效" format="YYYY-MM-DD HH:mm" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="失效时间">
          <el-date-picker v-model="createForm.end_time" type="datetime" placeholder="留空即永久有效" format="YYYY-MM-DD HH:mm" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="doCreate" :loading="creating">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getAdminUserList, adminDistribute,
} from '../../api/game.js'
import { ITEM_SHOP } from '../../game/config.js'

const activeTab = ref('list')
const loading = ref(false)
const announcements = ref([])

// 创建通告
const showCreateDialog = ref(false)
const creating = ref(false)
const createForm = ref({
  title: '', content: '', ann_type: 'notice', show_in_game: true,
  start_time: null, end_time: null,
})

// 道具派发
const allItems = ref(ITEM_SHOP)
const distForm = ref({ targetUser: null, gold: 0, itemId: null, itemCount: 1, reason: '' })
const userOptions = ref([])
const userSearching = ref(false)
const distributing = ref(false)

function typeLabel(t) {
  return { notice: '通知', event: '活动', reward: '奖励' }[t] || t
}
function typeTag(t) {
  return { notice: 'info', event: 'warning', reward: 'success' }[t] || 'info'
}
function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN')
}

async function loadAnnouncements() {
  loading.value = true
  try {
    const res = await getAnnouncements()
    announcements.value = res.data || []
  } catch (e) {
    ElMessage.error('加载失败')
  } finally { loading.value = false }
}

async function doCreate() {
  if (!createForm.value.title || !createForm.value.content) {
    ElMessage.warning('标题和内容不能为空')
    return
  }
  creating.value = true
  try {
    await createAnnouncement(createForm.value)
    ElMessage.success('通告发布成功')
    showCreateDialog.value = false
    createForm.value = { title: '', content: '', ann_type: 'notice', show_in_game: true, start_time: null, end_time: null }
    loadAnnouncements()
  } catch (e) {
    ElMessage.error('发布失败: ' + (e.response?.data?.message || e.message))
  } finally { creating.value = false }
}

async function toggleActive(row) {
  try {
    await updateAnnouncement(row.id, { is_active: !row.is_active })
    row.is_active = !row.is_active
    ElMessage.success(row.is_active ? '已启用' : '已停用')
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

async function toggleShowInGame(row) {
  try {
    await updateAnnouncement(row.id, { show_in_game: !row.show_in_game })
    row.show_in_game = !row.show_in_game
    ElMessage.success(row.show_in_game ? '将在游戏内显示' : '已取消游戏内显示')
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

async function deleteAnn(id) {
  try {
    await ElMessageBox.confirm('确定删除此通告？', '确认', { type: 'warning' })
    await deleteAnnouncement(id)
    ElMessage.success('已删除')
    loadAnnouncements()
  } catch (e) { /* 取消 */ }
}

async function searchUsers(query) {
  if (!query || query.length < 1) { userOptions.value = []; return }
  userSearching.value = true
  try {
    const res = await getAdminUserList({ search: query })
    userOptions.value = res.data || []
  } catch (e) {
    ElMessage.error('搜索用户失败')
  } finally { userSearching.value = false }
}

async function doDistribute() {
  if (!distForm.value.targetUser) { ElMessage.warning('请选择目标用户'); return }
  const user = JSON.parse(distForm.value.targetUser)
  distributing.value = true
  try {
    await adminDistribute({
      targetUserId: user.id,
      targetUserName: user.display_name || user.username,
      itemId: distForm.value.itemId || null,
      itemCount: distForm.value.itemId ? distForm.value.itemCount : 0,
      goldAdd: distForm.value.gold || 0,
      reason: distForm.value.reason || '管理员发放',
    })
    ElMessage.success('发放成功')
    distForm.value = { targetUser: null, gold: 0, itemId: null, itemCount: 1, reason: '' }
  } catch (e) {
    ElMessage.error('发放失败: ' + (e.response?.data?.message || e.message))
  } finally { distributing.value = false }
}

onMounted(() => {
  loadAnnouncements()
})
</script>

<style scoped>
.game-announcements-page { padding: 16px; max-width: 1000px; margin: 0 auto; }
.ann-card { border-radius: 12px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.card-title { font-size: 1.1rem; font-weight: 700; }
.form-hint { display: block; font-size: 0.75rem; color: #999; margin-top: 4px; }
.distribute-section { padding: 8px 0; }
:deep(.el-tabs__content) { padding: 20px; }
</style>