import api from './index'
import { ElMessage } from 'element-plus'

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
 * 流式下载文件（阿里云服务器环境，直接二进制流下载）
 */
export async function downloadFileStreaming(downloadUrl, fileName, fileType, onProgress) {
  const token = (localStorage.getItem('token') || '').replace(/^["']|["']$/g, '')
  const url = `/api${downloadUrl}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 300000) // 5分钟超时（大文件）

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

  // 获取文件总大小
  const totalSize = parseInt(res.headers.get('Content-Length')) || 0

  // 使用 ReadableStream 读取并跟踪进度
  const reader = res.body.getReader()
  const chunks = []
  let receivedSize = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    receivedSize += value.length
    if (onProgress && totalSize > 0) {
      onProgress(Math.round((receivedSize / totalSize) * 100))
    }
  }

  // 合并 chunks
  const allChunks = new Uint8Array(receivedSize)
  let position = 0
  for (const chunk of chunks) {
    allChunks.set(chunk, position)
    position += chunk.length
  }

  const blob = new Blob([allChunks], { type: fileType || res.headers.get('Content-Type') || 'application/octet-stream' })
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
 * 智能下载：大文件(>10MB)用浏览器原生下载，小文件用流式下载
 */
export async function smartDownload(downloadUrl, _chunkBaseUrl, fileMeta, fileName, onProgress) {
  const fileSize = fileMeta.fileSize || 0
  const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024 // 10MB

  // 大文件：使用浏览器原生下载（不经过 JS 内存）
  if (fileSize > LARGE_FILE_THRESHOLD) {
    const token = (localStorage.getItem('token') || '').replace(/^["']|["']$/g, '')
    // 构造带 token 的下载 URL
    const url = `/api${downloadUrl}${downloadUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    window.open(url, '_blank')
    if (onProgress) onProgress(100)
    return
  }

  // 小文件：使用流式下载 + 进度 UI
  const overlay = createDownloadUI()
  const progressCallback = (percent) => {
    updateDownloadUI(overlay, percent)
    if (onProgress) onProgress(percent)
  }
  try {
    updateDownloadUI(overlay, 10)
    const blob = await downloadFileStreaming(downloadUrl, fileName, fileMeta.fileType, progressCallback)
    triggerDownload(blob, fileName)
    updateDownloadUI(overlay, 100)
    setTimeout(() => { removeDownloadUI(); ElMessage.success('下载成功') }, 500)
  } catch (e) {
    removeDownloadUI()
    ElMessage.error('下载失败: ' + (e.message || '未知错误'))
    throw e
  }
}

/**
 * 智能加载图片（阿里云服务器环境，直接流式下载）
 */
export async function smartLoadImage(downloadUrl, _chunkBaseUrl, fileMeta) {
  try {
    const blob = await downloadFileStreaming(downloadUrl, null, fileMeta.fileType || 'image/png')
    return URL.createObjectURL(blob)
  } catch (e) {
    console.error('图片加载失败:', e)
    return ''
  }
}
