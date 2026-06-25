import api from './index'
import { smartDownload } from './utils'
import { chunkedUpload } from './chunkedUpload'

export function getFiles(category) {
  const params = {}
  if (category && typeof category === 'string' && category.trim()) {
    params.category = category.trim()
  }
  return api.get('/files', { params })
}

// 分片上传（大文件自动分片，小文件直接上传）
export function uploadFile(formData, onProgress) {
  // Extract file and extra fields from FormData
  const file = formData.get('file')
  const extraFields = {}
  for (const [key, val] of formData.entries()) {
    if (key !== 'file') extraFields[key] = val
  }
  return chunkedUpload('/files', file, extraFields, onProgress)
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
