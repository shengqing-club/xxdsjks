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

// 下载分组文件（兼容 serverless）
export async function downloadGroupFile(file_id, fileName) {
  const url = `/group-files/download/${file_id}`
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

// 删除分组文件
export function deleteGroupFile(file_id) {
  return api.delete(`/group-files/${file_id}`)
}
