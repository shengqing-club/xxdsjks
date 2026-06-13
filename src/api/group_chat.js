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

// 上传图片/文件
export function uploadGroupFile(group_id, formData) {
  return api.post(`/group-chat/${group_id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
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
