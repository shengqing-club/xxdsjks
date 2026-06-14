import api from './index'
import { ElMessage } from 'element-plus'

const CHUNK_SIZE = 1024 * 1024 // 1MB（base64 后约 1.33MB）
const PARALLEL_CHUNKS = 4 // 并行下载数

const comfortTexts = [
  '大模型思考中... 其实是在帮你搬文件...',
  'AI正在深度学习如何更快地下载...',
  '神经网络正在全速运转，文件传输中...',
  '大模型推理中... 结论是：文件马上就好...',
  'GPU正在满载运行，为你加速下载...',
  '郝宇波正在努力搬砖Ing...',
  '白雨轩正在殴打系统，很快就好了...',
  '赵峰正在计算文件大小...',
  'oi，赵锦欣在努力帮你找答案了...',
]

function createDownloadUI() {
  const isDark = document.documentElement.classList.contains('dark')
  const overlay = document.createElement('div')
  overlay.id = 'download-progress-overlay'
  const startIndex = Math.floor(Math.random() * comfortTexts.length)
  overlay.innerHTML = `
    <style>
      #download-progress-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: ${isDark ? 'rgba(18, 22, 36, 0.95)' : 'rgba(255,255,255,0.92)'};
        z-index: 99999;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      }
      .dl-icon {
        width: 48px; height: 48px; margin-bottom: 24px;
        border: 3px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#e0e0e0'};
        border-top-color: ${isDark ? '#60a5fa' : '#1a56db'};
        border-radius: 50%;
        animation: dlSpin 0.8s linear infinite;
      }
      @keyframes dlSpin { to { transform: rotate(360deg); } }
      .progress-bar-wrap { width: 320px; height: 10px; background: ${isDark ? 'rgba(255,255,255,0.1)' : '#e8e8e8'}; border-radius: 5px; overflow: hidden; margin-bottom: 20px; box-shadow: inset 0 1px 3px rgba(0,0,0,0.08); }
      .progress-bar-fill { height: 100%; background: ${isDark ? '#60a5fa' : '#1a56db'}; border-radius: 5px; transition: width 0.35s ease; width: 0%; }
      .progress-text { font-size: 15px; color: ${isDark ? 'rgba(255,255,255,0.85)' : '#555'}; margin-bottom: 16px; font-weight: 500; }
      .comfort-text { font-size: 14px; color: ${isDark ? 'rgba(255,255,255,0.5)' : '#999'}; max-width: 320px; text-align: center; line-height: 1.7; min-height: 24px; transition: opacity 0.4s ease; }
    </style>
    <div class="dl-icon"></div>
    <div class="progress-bar-wrap"><div class="progress-bar-fill" id="dl-progress-fill"></div></div>
    <div class="progress-text" id="dl-progress-text">准备中...</div>
    <div class="comfort-text" id="dl-comfort-text">${comfortTexts[startIndex]}</div>
  `
  document.body.appendChild(overlay)
  let idx = startIndex
  overlay._comfortTimer = setInterval(() => {
    const el = overlay.querySelector('#dl-comfort-text')
    if (!el) return
    el.style.opacity = '0'
    setTimeout(() => {
      idx = (idx + 1) % comfortTexts.length
      el.textContent = comfortTexts[idx]
      el.style.opacity = '1'
    }, 400)
  }, 2500)
  return overlay
}

function updateDownloadUI(overlay, percent) {
  const fill = overlay.querySelector('#dl-progress-fill')
  const text = overlay.querySelector('#dl-progress-text')
  if (fill) fill.style.width = percent + '%'
  if (text) text.textContent = percent >= 100 ? '下载完成！' : `正在下载... ${percent}%`
}

function removeDownloadUI() {
  const overlay = document.getElementById('download-progress-overlay')
  if (overlay) {
    if (overlay._comfortTimer) clearInterval(overlay._comfortTimer)
    overlay.remove()
  }
}

/**
 * 快速 base64 → Uint8Array（使用 TextDecoder 代替逐字节 atob）
 */
function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  // 按 1024 块批量写入，减少属性赋值次数
  const blockSize = 1024
  for (let i = 0; i < binary.length; i += blockSize) {
    const end = Math.min(i + blockSize, binary.length)
    for (let j = i; j < end; j++) {
      bytes[j] = binary.charCodeAt(j)
    }
  }
  return bytes
}

/**
 * 下载单个分片，带重试机制和 401 处理
 */
async function fetchChunk(chunkBaseUrl, chunkIndex, chunkSize, maxRetries = 3) {
  const token = (localStorage.getItem('token') || '').replace(/^["']|["']$/g, '')
  const url = `/api${chunkBaseUrl}?chunk=${chunkIndex}&chunkSize=${chunkSize}`

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒超时（2MB 分片需更长时间）

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      // 处理 401
      if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
        throw new Error('登录已过期')
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${errText}`)
      }

      const data = await res.json()
      if (!data || !data.base64) {
        throw new Error('响应中缺少 base64 数据')
      }

      const newToken = res.headers.get('x-refresh-token')
      if (newToken) {
        localStorage.setItem('token', newToken)
      }

      return data
    } catch (e) {
      if (attempt === maxRetries - 1) throw e
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  throw new Error('分片下载重试耗尽')
}

/**
 * 并行分片下载文件（并发 PARALLEL_CHUNKS 个请求）
 */
export async function downloadFileChunked(chunkBaseUrl, fileMeta, onProgress) {
  const totalSize = parseInt(fileMeta.fileSize, 10) || 0
  if (totalSize <= 0) throw new Error('文件大小未知，无法分片下载')
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
  const chunks = new Array(totalChunks)
  let completedChunks = 0

  // 并行下载调度器
  let nextChunkIndex = 0
  const workers = new Array(PARALLEL_CHUNKS).fill(null).map(async () => {
    while (true) {
      // 原子地获取下一个待下载的分片索引
      const myIndex = nextChunkIndex++
      if (myIndex >= totalChunks) break

      try {
        const data = await fetchChunk(chunkBaseUrl, myIndex, CHUNK_SIZE)
        chunks[myIndex] = base64ToUint8Array(data.base64)
      } catch (e) {
        // 如果该分片失败，用 slot 标记为 error
        chunks[myIndex] = null
        throw e
      }

      completedChunks++
      if (onProgress) {
        onProgress(Math.round((completedChunks / totalChunks) * 100))
      }
    }
  })

  // 等待所有 worker 完成
  await Promise.all(workers)

  // 检查是否有失败的分片
  for (let i = 0; i < totalChunks; i++) {
    if (chunks[i] === null || chunks[i] === undefined) {
      throw new Error(`分片 ${i} 下载失败`)
    }
  }

  return new Blob(chunks, { type: fileMeta.fileType || 'application/octet-stream' })
}

/**
 * 流式下载文件（非 Serverless 环境，直接以二进制下载，无 base64 开销）
 * 速度最快，适用于本地开发或传统服务器部署
 */
export async function downloadFileStreaming(streamUrl, fileName, fileSize, fileType, onProgress) {
  const token = (localStorage.getItem('token') || '').replace(/^["']|["']$/g, '')
  const url = `/api${streamUrl}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: controller.signal
  })
  clearTimeout(timeoutId)

  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new Error('登录已过期')
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }

  // 对于小文件（< 50MB），直接一次性读取
  const buffer = await res.arrayBuffer()
  const blob = new Blob([buffer], { type: fileType || res.headers.get('Content-Type') || 'application/octet-stream' })
  if (onProgress) onProgress(100)
  return blob
}

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
 * 智能下载：自动选择最优策略
 * - 非 Netlify：优先流式下载（无 base64 开销）
 * - Netlify / 流式失败：并行分片下载
 */
export async function smartDownload(downloadUrl, chunkBaseUrl, fileMeta, fileName, onProgress) {
  const overlay = createDownloadUI()
  const progressCallback = (percent) => {
    updateDownloadUI(overlay, percent)
    if (onProgress) onProgress(percent)
  }
  try {
    const size = parseInt(fileMeta.fileSize, 10) || 0

    // 策略 1：小文件（< 2MB）直接一次性下载（base64）
    if (size > 0 && size < 2 * 1024 * 1024) {
      updateDownloadUI(overlay, 50)
      try {
        const res = await api.get(downloadUrl, { timeout: 30000 })
        if (res.data && res.data.base64) {
          updateDownloadUI(overlay, 100)
          const bytes = base64ToUint8Array(res.data.base64)
          const blob = new Blob([bytes], { type: res.data.fileType || 'application/octet-stream' })
          triggerDownload(blob, fileName || res.data.fileName)
          setTimeout(() => { removeDownloadUI(); ElMessage.success('下载成功') }, 500)
          return
        }
      } catch (e) {
        console.warn('直接下载失败，回退:', e.message)
      }
    }

    // 策略 2：流式下载（仅非 Netlify 且文件 < 10MB 时尝试，避免大文件超时卡住）
    const isNetlify = !!window.location.hostname.match(/\.netlify\.app$/)
    if (!isNetlify && size >= 2 * 1024 * 1024 && size < 10 * 1024 * 1024) {
      try {
        const streamUrl = downloadUrl.replace(/\/download$/, '/download/stream')
        updateDownloadUI(overlay, 10)
        const blob = await downloadFileStreaming(streamUrl, fileName, size, fileMeta.fileType, (p) => {
          updateDownloadUI(overlay, Math.max(10, p))
        })
        triggerDownload(blob, fileName)
        setTimeout(() => { removeDownloadUI(); ElMessage.success('下载成功') }, 500)
        return
      } catch (e) {
        console.warn('流式下载失败，回退到分片下载:', e.message)
        // 回退到分片下载
      }
    }

    // 策略 3：并行分片下载（兼容所有环境，包括 Netlify）
    const blob = await downloadFileChunked(chunkBaseUrl, { ...fileMeta, fileSize: size }, progressCallback)
    triggerDownload(blob, fileName)
    setTimeout(() => { removeDownloadUI(); ElMessage.success('下载成功') }, 500)
  } catch (e) {
    removeDownloadUI()
    ElMessage.error('下载失败: ' + (e.message || '未知错误'))
    throw e
  }
}

export async function smartLoadImage(downloadUrl, chunkBaseUrl, fileMeta) {
  try {
    if (!fileMeta.fileSize || fileMeta.fileSize < 4 * 1024 * 1024) {
      try {
        const res = await api.get(downloadUrl, { timeout: 30000 })
        if (res.data && res.data.base64) {
          const bytes = base64ToUint8Array(res.data.base64)
          return URL.createObjectURL(new Blob([bytes], { type: res.data.fileType || 'image/png' }))
        }
      } catch (e) { /* fallback */ }
    }
    const blob = await downloadFileChunked(chunkBaseUrl, fileMeta)
    return URL.createObjectURL(blob)
  } catch (e) {
    console.error('图片加载失败:', e)
    return ''
  }
}
