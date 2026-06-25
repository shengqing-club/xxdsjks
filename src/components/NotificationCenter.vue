<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Bell } from '@element-plus/icons-vue'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../api/notification'
import { useAuth } from '../stores/auth'

useAuth()

const visible = ref(false)
const notifications = ref([])
const unreadCount = ref(0)

const fetchNotifications = async () => {
  try {
    const [notiRes, countRes] = await Promise.all([
      getNotifications(),
      getUnreadCount()
    ])
    notifications.value = notiRes.data || notiRes || []
    unreadCount.value = countRes.data?.count || 0
  } catch {}
}

const handleRead = async (noti) => {
  if (noti.is_read) return
  try {
    await markAsRead(noti.id)
    noti.is_read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch {}
}

const handleReadAll = async () => {
  if (!unreadCount.value) return
  try {
    await markAllAsRead()
    notifications.value.forEach(n => n.is_read = true)
    unreadCount.value = 0
    ElMessage.success('全部标记已读')
  } catch {
    ElMessage.error('标记失败')
  }
}

const toggleVisible = () => {
  visible.value = !visible.value
  if (visible.value) fetchNotifications()
}

const formatTime = (t) => {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(() => {
  fetchNotifications()
  setInterval(fetchNotifications, 30000)
})
</script>

<template>
  <div class="noti-wrapper">
    <el-badge :value="unreadCount" :hidden="!unreadCount" :max="99">
      <el-button circle :icon="Bell" @click="toggleVisible" class="noti-btn" />
    </el-badge>

    <el-popover
      v-model:visible="visible"
      placement="bottom-end"
      :width="360"
      trigger="click"
    >
      <template #reference>
        <span></span>
      </template>
      <div class="noti-pop">
        <div class="noti-header">
          <strong>消息通知</strong>
          <div class="noti-header-right">
            <el-button v-if="unreadCount" link type="primary" size="small" @click.stop="handleReadAll">
              一键已读
            </el-button>
            <span class="noti-count">{{ unreadCount }} 条未读</span>
          </div>
        </div>
        <div class="noti-list">
          <div v-if="!notifications.length" class="noti-empty">暂无通知</div>
          <div
            v-for="item in notifications"
            :key="item.id"
            :class="['noti-item', { unread: !item.is_read }]"
            @click="handleRead(item)"
          >
            <div class="noti-title">{{ item.title }}</div>
            <div class="noti-content">{{ item.content }}</div>
            <div class="noti-time">{{ formatTime(item.created_at) }}</div>
            <span v-if="!item.is_read" class="noti-dot"></span>
          </div>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<style scoped>
.noti-wrapper { position: relative; }
.noti-btn { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.2); color: #fff; }
.noti-btn:hover { background: rgba(255,255,255,0.25); }
.noti-pop { max-height: 400px; }
.noti-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 0 12px; border-bottom: 1px solid #e5e7eb; margin-bottom: 8px; }
.noti-header-right { display: flex; align-items: center; gap: 8px; }
.noti-count { font-size: 12px; color: #1a56db; }
.noti-list { max-height: 320px; overflow-y: auto; }
.noti-empty { text-align: center; color: #94a3b8; font-size: 13px; padding: 24px 0; }
.noti-item { position: relative; padding: 10px 12px; border-radius: 6px; cursor: pointer; margin-bottom: 4px; transition: background 0.2s; }
.noti-item:hover { background: #f8fafc; }
.noti-item.unread { background: #eff6ff; }
.noti-item.unread:hover { background: #dbeafe; }
.noti-title { font-size: 13px; font-weight: 600; color: #1e293b; }
.noti-content { font-size: 12px; color: #64748b; margin: 2px 0; line-height: 1.4; }
.noti-time { font-size: 11px; color: #94a3b8; }
.noti-dot { position: absolute; top: 14px; right: 12px; width: 8px; height: 8px; border-radius: 50%; background: #1a56db; }

@media (max-width: 768px) {
  .noti-wrapper :deep(.el-popover) { width: calc(100vw - 32px) !important; max-width: 360px; }
}
</style>
