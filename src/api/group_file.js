import api from './index'
import { smartDownload } from './utils'

// 获取分组文件列表
export function getGroupFiles(group_id) {
  return api.get(`/group-files/${group_id}`)
}

// 上传文件到分组（不手动设置 Content-Type，让 axios 自动添加 boundary）
export function uploadGroupSharedFile(group_id, formData) {
  return api.post(`/group-files/${group_id}/upload`, formData, {
    timeout: 60000
  })
}

export function downloadGroupFile(file_id, fileName, fileSize, fileType, onProgress) {
  return smartDownload(
    `/group-files/download/${file_id}`,
    `/group-files/download/${file_id}/chunk`,
    { fileSize, fileType },
    fileName,
    onProgress
  )
}

// 删除分组文件
export function deleteGroupFile(file_id) {
  return api.delete(`/group-files/${file_id}`)
}
