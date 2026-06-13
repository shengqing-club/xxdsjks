import api from './index'

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB per chunk

/**
 * 分片下载文件（绕过 Netlify 6MB 响应体限制）
 * @param {string} chunkBaseUrl - 分片下载基础URL，如 /study-materials/download/123/chunk
 * @param {object} fileMeta - 文件元信息 { fileSize, fileType }
 * @param {function} onProgress - 进度回调 (percent: number) => void
 * @returns {Promise<Blob>}
 */
export async function downloadFileChunked(chunkBaseUrl, fileMeta, onProgress) {
  const totalSize = fileMeta.fileSize
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
  const chunks = []

  for (let i = 0; i < totalChunks; i++) {
    const res = await api.get(`${chunkBaseUrl}?chunk=${i}&chunkSize=${CHUNK_SIZE}`, {
      timeout: 60000
    })
    const data = res.data
    if (!data || !data.base64) {
      throw new Error(`分片 ${i} 下载失败`)
    }
    const binary = atob(data.base64)
    const bytes = new Uint8Array(binary.length)
    for (let j = 0; j < binary.length; j++) {
      bytes[j] = binary.charCodeAt(j)
    }
    chunks.push(bytes)
    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100))
    }
  }

  return new Blob(chunks, { type: fileMeta.fileType || 'application/octet-stream' })
}

/**
 * 触发浏览器下载
 */
export function triggerDownload(blob, fileName) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fileName || 'download'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

/**
 * 智能下载：小文件直接下载，大文件分片下载
 * @param {string} downloadUrl - 原有下载URL（小文件用）
 * @param {string} chunkBaseUrl - 分片下载基础URL（大文件用）
 * @param {object} fileMeta - { fileSize, fileType }
 * @param {string} fileName - 下载文件名
 * @param {function} onProgress - 进度回调
 */
export async function smartDownload(downloadUrl, chunkBaseUrl, fileMeta, fileName, onProgress) {
  // 小于 4MB 直接用原有方式
  if (fileMeta.fileSize && fileMeta.fileSize < 4 * 1024 * 1024) {
    try {
      const res = await api.get(downloadUrl, { timeout: 30000 })
      if (res.data && res.data.base64) {
        const binary = atob(res.data.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const blob = new Blob([bytes], { type: res.data.fileType || 'application/octet-stream' })
        triggerDownload(blob, fileName || res.data.fileName)
        return
      }
    } catch (e) { /* fallback to chunked */ }
  }

  // 大文件分片下载
  const blob = await downloadFileChunked(chunkBaseUrl, fileMeta, onProgress)
  triggerDownload(blob, fileName)
}

/**
 * 智能加载图片（照片墙等场景）：小图直接加载，大图分片加载
 * @returns {Promise<string>} Object URL
 */
export async function smartLoadImage(downloadUrl, chunkBaseUrl, fileMeta) {
  if (fileMeta.fileSize && fileMeta.fileSize < 4 * 1024 * 1024) {
    try {
      const res = await api.get(downloadUrl, { timeout: 30000 })
      if (res.data && res.data.base64) {
        const binary = atob(res.data.base64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        return URL.createObjectURL(new Blob([bytes], { type: res.data.fileType || 'image/png' }))
      }
    } catch (e) { /* fallback */ }
  }

  const blob = await downloadFileChunked(chunkBaseUrl, fileMeta)
  return URL.createObjectURL(blob)
}
