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
    timeout: 300000, // 5 分钟
  })
}

// 分片上传
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB
const UPLOAD_PARALLEL = 2 // 并行上传数

export async function uploadFileChunked(file, options = {}, onProgress) {
  const { category, uploaderRole, uploaderId, uploaderName } = options
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  // 1. 初始化
  const initRes = await api.post('/files/upload/chunked/init', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    totalChunks,
    category: category || 'general',
    uploaderRole, uploaderId, uploaderName
  }, { timeout: 300000 })
  const { uploadId } = initRes.data

  // 2. 并行上传分片
  let completedChunks = 0
  const chunkPromises = []

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    // 控制并发
    if (chunkPromises.length >= UPLOAD_PARALLEL) {
      await Promise.race(chunkPromises)
    }

    const promise = (async (chunkIndex) => {
      const formData = new FormData()
      formData.append('chunk', chunk)
      try {
        await api.post(`/files/upload/chunked/${uploadId}/${chunkIndex}`, formData, {
          timeout: 120000 // 2 分钟
        })
        completedChunks++
        if (onProgress) onProgress(Math.round((completedChunks / totalChunks) * 100))
      } catch (e) {
        throw new Error(`分片 ${chunkIndex} 上传失败: ${e.message}`)
      }
    })(i)

    chunkPromises.push(promise)
  }

  await Promise.all(chunkPromises)

  // 3. 完成合并
  const completeRes = await api.post(`/files/upload/chunked/${uploadId}/complete`, null, { timeout: 300000 })
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
