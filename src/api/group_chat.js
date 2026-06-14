import api from './index'
import { smartDownload } from './utils'

// 获取分组聊天消息
export function getGroupMessages(group_id, params) {
  return api.get(`/group-chat/${group_id}`, { params })
}

// 发送文字消息
export function sendGroupMessage(group_id, content) {
  return api.post(`/group-chat/${group_id}/send`, { content })
}

// 上传图片/文件（不手动设置 Content-Type，让 axios 自动添加 boundary）
export function uploadGroupChatFile(group_id, formData) {
  return api.post(`/group-chat/${group_id}/upload`, formData, {
    timeout: 60000
  })
}

export function downloadGroupChatFile(message_id, fileName, fileSize, fileType, onProgress) {
  return smartDownload(
    `/group-chat/download/${message_id}`,
    `/group-chat/download/${message_id}/chunk`,
    { fileSize, fileType },
    fileName,
    onProgress
  )
}
