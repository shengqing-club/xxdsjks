<template>
  <div>
    <!-- Chat toggle button -->
    <div class="chat-fab" @click="openChat" v-if="!visible">
      <el-badge :value="unreadCount" :hidden="!unreadCount" :max="99">
        <el-button type="primary" circle :icon="ChatDotRound" size="large" class="fab-btn" />
      </el-badge>
    </div>

    <!-- Chat Drawer -->
    <el-drawer
      v-model="visible"
      title="在线聊天室"
      direction="rtl"
      size="420px"
      :with-header="true"
      :before-close="handleClose"
    >
      <template #header>
        <div class="drawer-header">
          <span>文字发送区域</span>
          <div class="drawer-header-right">
            <el-tag size="small" effect="plain" round type="success">
              在线 {{ onlineCount }} 人
            </el-tag>
            <el-button v-if="isAdmin" type="danger" size="small" text @click="handleClearChat" :loading="clearing">
              <el-icon><Delete /></el-icon>清空记录
            </el-button>
          </div>
        </div>
      </template>

      <!-- Messages Area -->
      <div class="chat-messages" ref="msgContainer">
        <div v-for="(msg, i) in messages" :key="i" class="msg-item">
          <div v-if="msg.system" class="system-msg">{{ msg.content }}</div>
          <div v-else :class="['msg-bubble', msg.sender_id === myId ? 'msg-mine' : 'msg-other']">
            <div class="msg-sender">{{ msg.sender_name }}</div>
            <div class="msg-content">{{ msg.content }}</div>
            <div class="msg-time">{{ formatTime(msg.time || msg.created_at) }}</div>
          </div>
        </div>
        <div ref="msgEnd"></div>
      </div>

      <!-- Input Area -->
      <div class="chat-input">
        <el-input
          v-model="inputText"
          placeholder="输入消息..."
          @keyup.enter="sendMessage"
        >
          <template #append>
            <el-button type="primary" @click="sendMessage" :disabled="!inputText.trim() || sending" :loading="sending">发送</el-button>
          </template>
        </el-input>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, nextTick, watch } from 'vue'
import { useAuth } from '../stores/auth'
import { getChatMessages, sendChatMessage, getOnlineCount } from '../api/chat'
import { ChatDotRound, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { clearChatMessages } from '../api/chat'

const { studentId, displayName, isAdmin } = useAuth()

const visible = ref(false)
const messages = ref([])
const inputText = ref('')
const msgContainer = ref(null)
const msgEnd = ref(null)
const onlineCount = ref(0)
const unreadCount = ref(0)
const sending = ref(false)
const myId = ref(studentId?.value || 'admin')

let pollTimer = null
let onlineTimer = null
let lastMessageTime = null

const formatTime = (t) => {
  if (!t) return ''
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const scrollToBottom = async () => {
  await nextTick()
  msgEnd.value?.scrollIntoView({ behavior: 'smooth' })
}

// HTTP 轮询获取新消息
const pollMessages = async () => {
  try {
    const params = {}
    if (lastMessageTime) {
      params.since = lastMessageTime
    }
    const res = await getChatMessages(params)
    const newMessages = (res.data || res || [])
    if (newMessages.length > 0) {
      const lastMsg = newMessages[newMessages.length - 1]
      lastMessageTime = lastMsg.created_at

      // 将旧消息中已存在的过滤掉
      const existingIds = new Set(messages.value.map(m => m.id))
      const freshMessages = newMessages.filter(m => !existingIds.has(m.id))

      if (freshMessages.length > 0) {
        messages.value.push(...freshMessages.map(m => ({ ...m, system: false })))
        scrollToBottom()
        if (!visible.value) unreadCount.value += freshMessages.length
      }
    }
  } catch (e) {
    // 静默处理轮询错误
  }
}

// 轮询在线人数
const pollOnlineCount = async () => {
  try {
    const res = await getOnlineCount()
    onlineCount.value = (res.data || res).count || 0
  } catch {}
}

const openChat = async () => {
  visible.value = true
  unreadCount.value = 0
  lastMessageTime = null
  try {
    const res = await getChatMessages()
    messages.value = (res.data || res || []).map(m => ({ ...m, system: false }))
    if (messages.value.length > 0) {
      lastMessageTime = messages.value[messages.value.length - 1].created_at
    }
    await scrollToBottom()
  } catch {}
  // 开启轮询
  startPolling()
}

const handleClose = () => {
  visible.value = false
  stopPolling()
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text) return
  sending.value = true
  try {
    await sendChatMessage({
      senderId: myId.value,
      senderName: displayName?.value || '匿名用户',
      role: isAdmin?.value ? 'admin' : 'student',
      content: text
    })
    inputText.value = ''
    // 立即拉取新消息
    await pollMessages()
  } catch (e) {
    ElMessage.error('发送失败，请稍后重试')
  } finally {
    sending.value = false
  }
}

const startPolling = () => {
  stopPolling()
  pollTimer = setInterval(pollMessages, 2000)
  onlineTimer = setInterval(pollOnlineCount, 10000)
  pollOnlineCount()
}

const stopPolling = () => {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  if (onlineTimer) { clearInterval(onlineTimer); onlineTimer = null }
}

// 监听窗口可见性（页面切后台时停止轮询节省资源）
watch(visible, (val) => {
  if (val) startPolling()
  else stopPolling()
})

// 管理端清空聊天记录
const clearing = ref(false)
const handleClearChat = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有聊天记录吗？此操作不可撤销！',
      '销毁聊天记录',
      { type: 'error', confirmButtonText: '确定清空', cancelButtonText: '取消' }
    )
    clearing.value = true
    await clearChatMessages()
    messages.value = []
    ElMessage.success('聊天记录已清空')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('清空失败')
  } finally {
    clearing.value = false
  }
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.chat-fab { position: fixed; right: 28px; bottom: 28px; z-index: 999; }
.fab-btn { width: 52px; height: 52px; box-shadow: 0 4px 16px rgba(26,86,219,0.35); }
.drawer-header { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.drawer-header-right { display: flex; align-items: center; gap: 8px; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; max-height: calc(100vh - 180px); }
.msg-item { margin-bottom: 14px; }
.system-msg { text-align: center; font-size: 12px; color: #94a3b8; padding: 4px 0; }
.msg-bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; }
.msg-mine { margin-left: auto; background: linear-gradient(135deg, #1a56db, #2563eb); color: #fff; }
.msg-other { margin-right: auto; background: #f1f5f9; color: #1e293b; }
.msg-sender { font-size: 11px; opacity: 0.7; margin-bottom: 2px; }
.msg-content { font-size: 14px; line-height: 1.4; word-break: break-word; }
.msg-time { font-size: 10px; opacity: 0.5; margin-top: 4px; text-align: right; }
.chat-input { padding: 12px 16px; border-top: 1px solid #e5e7eb; }
</style>
