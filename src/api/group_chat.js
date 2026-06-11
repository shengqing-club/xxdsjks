import api from './index'

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

// 下载聊天中的文件（兼容 serverless）
export async function downloadGroupChatFile(message_id, fileName) {
  const url = `/group-chat/download/${message_id}`
  try {
    const res = await api.get(url)
    if (res.data && res.data.base64) {
      const binary = atob(res.data.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: res.data.fileType || 'application/octet-stream' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = fileName || res.data.fileName || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      return
    }
  } catch (e) { /* fallback */ }
  const res = await api.get(url, { responseType: 'blob' })
  const blob = new Blob([res.data])
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName || 'download'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
