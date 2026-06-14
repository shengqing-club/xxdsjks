<template>
  <div class="group-chat-panel">
    <!-- 消息列表 -->
    <div class="message-list" ref="messageListRef">
      <div v-for="msg in messages" :key="msg.id" class="message-item" :class="{ self: isSelf(msg) }">
        <div class="message-avatar">
          <el-avatar :size="36" :icon="UserFilled" />
        </div>
        <div class="message-content">
          <div class="message-header">
            <span class="sender-name">
              {{ msg.sender_name }}
              <el-tag v-if="msg.sender_role === 'leader' || isLeader(msg.sender_id)" type="warning" size="small" class="leader-tag">
                <el-icon><StarFilled /></el-icon> 组长
              </el-tag>
              <el-tag v-if="msg.sender_role === 'admin'" type="danger" size="small">管理员</el-tag>
            </span>
            <span class="message-time">{{ formatTime(msg.created_at) }}</span>
          </div>
          <div class="message-body">
            <!-- 文字消息 -->
            <div v-if="msg.message_type === 'text'" class="text-message">{{ msg.content }}</div>
            <!-- 图片消息 -->
            <div v-else-if="msg.message_type === 'image'" class="image-message">
              <img
                v-if="imageUrls[msg.id]"
                :src="imageUrls[msg.id]"
                @click="previewImage(msg.id)"
                style="max-width: 200px; max-height: 200px; border-radius: 8px; cursor: pointer"
              />
              <el-button v-else type="primary" link @click="loadImage(msg)">
                <el-icon><Picture /></el-icon>
                [图片] {{ msg.file_name }} (点击加载)
              </el-button>
            </div>
            <!-- 文件消息 -->
            <div v-else-if="msg.message_type === 'file'" class="file-message">
              <el-button type="primary" link @click="downloadFile(msg)">
                <el-icon><Document /></el-icon>
                {{ msg.file_name || '未命名文件' }}
              </el-button>
              <span class="file-size">{{ formatFileSize(msg.file_size) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区 -->
    <div class="chat-input-area">
      <div class="input-toolbar">
        <el-upload
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleImageUpload"
          accept="image/*"
        >
          <el-button type="info" link>
            <el-icon><Picture /></el-icon>
            图片
          </el-button>
        </el-upload>
        <el-upload
          action="#"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileUpload"
        >
          <el-button type="info" link>
            <el-icon><FolderOpened /></el-icon>
            文件
          </el-button>
        </el-upload>
      </div>
      <el-input
        v-model="inputMessage"
        type="textarea"
        :rows="3"
        placeholder="输入消息..."
        @keydown.enter.prevent="sendMessage"
        resize="none"
      />
      <div class="input-actions">
        <el-button type="primary" @click="sendMessage" :loading="sending">
          <el-icon><Promotion /></el-icon>
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  UserFilled, StarFilled, Document, Picture, FolderOpened, Promotion
} from '@element-plus/icons-vue'
import { getGroupMessages, sendGroupMessage, uploadGroupChatFile, downloadGroupChatFile } from '../api/group_chat'
import api from '../api/index'
import { useAuth } from '../stores/auth'

const props = defineProps({
  group: { type: Object, required: true }
})

const { user } = useAuth()
const messages = ref([])
const inputMessage = ref('')
const sending = ref(false)
const messageListRef = ref(null)
const pollTimer = ref(null)
const lastMessageTime = ref(0)
const imageUrls = ref({}) // 缓存已加载的图片 blob URL

const isSelf = (msg) => {
  const myId = user.value.studentId || user.value.username
  return msg.sender_id === myId
}

const isLeader = (senderId) => {
  return props.group.leader_id === senderId
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatFileSize = (size) => {
  if (!size) return '0 B'
  const numSize = Number(size) || 0
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let s = numSize
  while (s >= 1024 && i < units.length - 1) { s /= 1024; i++ }
  return `${s.toFixed(1)} ${units[i]}`
}

const scrollToBottom = () => {
  nextTick(() => {
    const el = messageListRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

const loadMessages = async () => {
  try {
    const params = {}
    if (lastMessageTime.value > 0) {
      params.since = lastMessageTime.value
    }
    const res = await getGroupMessages(props.group.id, params)
    const newMessages = res.data || []
    if (newMessages.length > 0) {
      const existingIds = new Set(messages.value.map(m => m.id))
      const uniqueNew = newMessages.filter(m => !existingIds.has(m.id))
      if (uniqueNew.length > 0) {
        messages.value.push(...uniqueNew)
        lastMessageTime.value = new Date(uniqueNew[uniqueNew.length - 1].created_at).getTime()
        scrollToBottom()
      }
    }
  } catch (err) {
    console.error('获取消息失败', err)
  }
}

const sendMessage = async () => {
  const content = inputMessage.value.trim()
  if (!content) return
  sending.value = true
  try {
    await sendGroupMessage(props.group.id, content)
    inputMessage.value = ''
    await loadMessages()
  } catch (err) {
    ElMessage.error('发送失败')
  } finally {
    sending.value = false
  }
}

const handleImageUpload = async (file) => {
  await uploadChatFile(file.raw, 'image')
}

const handleFileUpload = async (file) => {
  await uploadChatFile(file.raw, 'file')
}

const uploadChatFile = async (file, type) => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    await uploadGroupFile(props.group.id, formData)
    ElMessage.success('上传成功')
    await loadMessages()
  } catch (err) {
    console.error('上传失败:', err)
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message))
  }
}

// 加载图片：先尝试 JSON（serverless base64），再 fallback blob
const loadImage = async (msg) => {
  try {
    const res = await api.get(`/group-chat/download/${msg.id}`)
    if (res.data && res.data.base64) {
      const binaryStr = atob(res.data.base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: res.data.fileType || msg.file_type || 'image/png' })
      const url = URL.createObjectURL(blob)
      imageUrls.value[msg.id] = url
      return
    }
  } catch (e) {
    // 不是 JSON，继续 blob
  }
  // 传统环境：直接 blob
  try {
    const res = await api.get(`/group-chat/download/${msg.id}`, { responseType: 'blob' })
    const blob = new Blob([res.data], { type: msg.file_type || 'image/png' })
    const url = URL.createObjectURL(blob)
    imageUrls.value[msg.id] = url
  } catch (err) {
    console.error('加载图片失败:', err)
  }
}

// 预览图片
const previewImage = (msgId) => {
  const url = imageUrls.value[msgId]
  if (url) {
    window.open(url, '_blank')
  }
}

const downloadFile = async (msg) => {
  try {
    await downloadGroupChatFile(msg.id, msg.file_name, msg.file_size, msg.file_type)
  } catch (err) {
    console.error('下载失败:', err)
    ElMessage.error('下载失败')
  }
}

const startPolling = () => {
  loadMessages()
  pollTimer.value = setInterval(loadMessages, 2000)
}

const stopPolling = () => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value)
    pollTimer.value = null
  }
  // 清理图片blob URL
  Object.values(imageUrls.value).forEach(url => URL.revokeObjectURL(url))
  imageUrls.value = {}
}

onMounted(() => {
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<style scoped>
.group-chat-panel {
  display: flex;
  flex-direction: column;
  height: 500px;
}
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 12px;
}
.message-item {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.message-item.self {
  flex-direction: row-reverse;
}
.message-item.self .message-content {
  align-items: flex-end;
}
.message-item.self .text-message {
  background: linear-gradient(135deg, #1a56db 0%, #1e40af 100%);
  color: #fff;
}
.message-content {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}
.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
}
.sender-name {
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 4px;
}
.leader-tag {
  font-size: 10px;
}
.message-time {
  color: #909399;
}
.text-message {
  background: #fff;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  color: #303133;
  word-break: break-word;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.image-message {
  border-radius: 8px;
  overflow: hidden;
}
.file-message {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 8px 12px;
  border-radius: 8px;
}
.file-size {
  font-size: 12px;
  color: #909399;
}
.chat-input-area {
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
}
.input-toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}
.input-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
