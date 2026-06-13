import api from './index'
import { smartDownload } from './utils'

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

export function downloadFile(id, fileName, fileSize, fileType, onProgress) {
  return smartDownload(
    `/files/${id}/download`,
    `/files/${id}/download/chunk`,
    { fileSize, fileType },
    fileName,
    onProgress
  )
}
