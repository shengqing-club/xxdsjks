import api from './index'
import { smartDownload } from './utils'

// 获取复习资料列表
export function getStudyMaterials(params) {
  return api.get('/study-materials', { params })
}

// 上传复习资料（普通上传，小文件）
export function uploadStudyMaterial(formData) {
  return api.post('/study-materials/upload', formData, { timeout: 300000 })
}

// 分片上传
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB
const UPLOAD_PARALLEL = 2 // 并行上传数

export async function uploadStudyMaterialChunked(file, options = {}, onProgress) {
  const { title, course_name, class_name } = options
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  // 1. 初始化
  const initRes = await api.post('/study-materials/upload/chunked/init', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    totalChunks,
    title: title || file.name,
    course_name: course_name || '',
    class_name: class_name || ''
  }, { timeout: 300000 })
  const { uploadId } = initRes.data

  // 2. 并行上传分片
  let completedChunks = 0
  const chunkPromises = []

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    if (chunkPromises.length >= UPLOAD_PARALLEL) {
      await Promise.race(chunkPromises)
    }

    const promise = (async (chunkIndex) => {
      const formData = new FormData()
      formData.append('chunk', chunk)
      try {
        await api.post(`/study-materials/upload/chunked/${uploadId}/${chunkIndex}`, formData, {
          timeout: 120000
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
  const completeRes = await api.post(`/study-materials/upload/chunked/${uploadId}/complete`, null, { timeout: 300000 })
  return completeRes.data
}

// 删除复习资料
export function deleteStudyMaterial(id) {
  return api.delete(`/study-materials/${id}`)
}

// 下载复习资料（智能分片下载）
export function downloadStudyMaterial(id, fileName, fileSize, fileType, onProgress) {
  return smartDownload(
    `/study-materials/download/${id}`,
    `/study-materials/download/${id}/chunk`,
    { fileSize, fileType },
    fileName,
    onProgress
  )
}

// 获取版本历史
export function getMaterialVersions(id) {
  return api.get(`/study-materials/${id}/versions`)
}

// 上传新版本（复用分片上传，传入 version_group）
export async function uploadStudyMaterialNewVersion(file, versionGroup, options = {}, onProgress) {
  const { title, course_name, class_name } = options
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  const initRes = await api.post('/study-materials/upload/chunked/init', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    totalChunks,
    title: title || file.name,
    course_name: course_name || '',
    class_name: class_name || '',
    version_group: versionGroup
  }, { timeout: 300000 })
  const { uploadId } = initRes.data

  let completedChunks = 0
  const chunkPromises = []

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    if (chunkPromises.length >= UPLOAD_PARALLEL) {
      await Promise.race(chunkPromises)
    }

    const promise = (async (chunkIndex) => {
      const formData = new FormData()
      formData.append('chunk', chunk)
      await api.post(`/study-materials/upload/chunked/${uploadId}/${chunkIndex}`, formData, { timeout: 120000 })
      completedChunks++
      if (onProgress) onProgress(Math.round((completedChunks / totalChunks) * 100))
    })(i)

    chunkPromises.push(promise)
  }

  await Promise.all(chunkPromises)

  const completeRes = await api.post(`/study-materials/upload/chunked/${uploadId}/complete`, null, { timeout: 300000 })
  return completeRes.data
}
