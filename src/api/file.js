import api from './index'

export function getFiles(category) {
  const params = {}
  if (category && typeof category === 'string' && category.trim()) {
    params.category = category.trim()
  }
  return api.get('/files', { params })
}

export function uploadFile(formData) {
  return api.post('/files/upload', formData, {
    timeout: 120000,
  })
}

// 分片上传（绕过 Netlify 6MB 限制）
const CHUNK_SIZE = 4 * 1024 * 1024

export async function uploadFileChunked(file, options = {}, onProgress) {
  const { category, uploaderRole, uploaderId, uploaderName } = options
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  const initRes = await api.post('/files/upload/chunked/init', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    totalChunks,
    category: category || 'general',
    uploaderRole, uploaderId, uploaderName
  })
  const { uploadId } = initRes.data

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    const formData = new FormData()
    formData.append('chunk', chunk)
    await api.post(`/files/upload/chunked/${uploadId}/${i}`, formData, { timeout: 60000 })
    if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100))
  }

  const completeRes = await api.post(`/files/upload/chunked/${uploadId}/complete`)
  return completeRes.data
}

export function deleteFile(id) {
  return api.delete(`/files/${id}`)
}

export function getStudentUploadSetting() {
  return api.get('/files/setting/student-upload')
}

export function setStudentUploadSetting(enabled) {
  return api.post('/files/setting/student-upload', { enabled })
}

export function getDangerousFileBlockSetting() {
  return api.get('/files/setting/dangerous-file-block')
}

export function setDangerousFileBlockSetting(enabled) {
  return api.post('/files/setting/dangerous-file-block', { enabled })
}

/**
 * 通用文件下载函数（兼容 serverless 环境）
 */
export async function downloadFile(id, fileName) {
  const url = `/files/${id}/download`
  // 先尝试 JSON（serverless 返回 base64）
  try {
    const res = await api.get(url, { timeout: 120000 })
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
  } catch (e) { /* fallback to blob */ }
  // 传统 blob 下载
  const res = await api.get(url, { responseType: 'blob', timeout: 120000 })
  const blob = new Blob([res.data])
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName || 'download'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
