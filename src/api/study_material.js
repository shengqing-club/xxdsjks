import api from './index'
import { smartDownload } from './utils'

/**
 * 通用文件下载函数
 * 兼容 serverless 环境（Netlify）返回 base64 JSON 和传统服务器返回 blob
 */
export async function downloadFileFromApi(url, fileName) {
  // 先尝试普通 JSON 请求（serverless 环境返回 base64）
  try {
    const res = await api.get(url)
    const data = res.data
    if (data && data.base64) {
      // serverless 环境：base64 JSON 格式
      const binary = atob(data.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: data.fileType || 'application/octet-stream' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = fileName || data.fileName || 'download'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)
      return
    }
  } catch (e) {
    // 不是 JSON 响应，继续尝试 blob 下载
  }

  // 传统环境：直接 blob 下载
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

// 获取复习资料列表
export function getStudyMaterials(params) {
  return api.get('/study-materials', { params })
}

// 上传复习资料
export function uploadStudyMaterial(formData) {
  return api.post('/study-materials/upload', formData)
}

// 分片上传（绕过 Netlify 6MB 限制）
const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB per chunk

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
  })
  const { uploadId } = initRes.data

  // 2. 逐片上传
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    const formData = new FormData()
    formData.append('chunk', chunk)

    await api.post(`/study-materials/upload/chunked/${uploadId}/${i}`, formData, {
      timeout: 60000
    })

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100))
    }
  }

  // 3. 完成合并
  const completeRes = await api.post(`/study-materials/upload/chunked/${uploadId}/complete`)
  return completeRes.data
}

// 删除复习资料
export function deleteStudyMaterial(id) {
  return api.delete(`/study-materials/${id}`)
}

// 下载复习资料（智能分片下载，绕过 Netlify 6MB 限制）
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
  })
  const { uploadId } = initRes.data

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    const formData = new FormData()
    formData.append('chunk', chunk)
    await api.post(`/study-materials/upload/chunked/${uploadId}/${i}`, formData, { timeout: 60000 })
    if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100))
  }

  const completeRes = await api.post(`/study-materials/upload/chunked/${uploadId}/complete`)
  return completeRes.data
}
