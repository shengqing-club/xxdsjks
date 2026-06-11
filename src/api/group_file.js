import api from './index'

// 获取分组文件列表
export function getGroupFiles(group_id) {
  return api.get(`/group-files/${group_id}`)
}

// 上传文件到分组
export function uploadGroupFile(group_id, formData) {
  return api.post(`/group-files/${group_id}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 下载分组文件
export function downloadGroupFile(file_id) {
  return api.get(`/group-files/download/${file_id}`, { responseType: 'blob' })
}

// 删除分组文件
export function deleteGroupFile(file_id) {
  return api.delete(`/group-files/${file_id}`)
}
