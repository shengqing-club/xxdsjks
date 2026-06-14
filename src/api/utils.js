import api from './index'
import { ElMessage } from 'element-plus'

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB per chunk

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
  // 随机起始索引，打乱轮播顺序
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
  // 安抚话语轮播，每2.5秒切换一条
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
 * 分片下载文件
 */
export async function downloadFileChunked(chunkBaseUrl, fileMeta, onProgress) {
  const totalSize = fileMeta.fileSize
  if (!totalSize || totalSize <= 0) throw new Error('文件大小未知，无法分片下载')
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
  const chunks = []

  for (let i = 0; i < totalChunks; i++) {
    const res = await api.get(`${chunkBaseUrl}?chunk=${i}&chunkSize=${CHUNK_SIZE}`, { timeout: 60000 })
    const data = res.data
    if (!data || !data.base64) throw new Error(`分片 ${i} 下载失败`)
    const binary = atob(data.base64)
    const bytes = new Uint8Array(binary.length)
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
    chunks.push(bytes)
    if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100))
  }

  return new Blob(chunks, { type: fileMeta.fileType || 'application/octet-stream' })
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

export async function smartDownload(downloadUrl, chunkBaseUrl, fileMeta, fileName, onProgress) {
  const overlay = createDownloadUI()
  const progressCallback = (percent) => {
    updateDownloadUI(overlay, percent)
    if (onProgress) onProgress(percent)
  }
  try {
    if (!fileMeta.fileSize || fileMeta.fileSize < 4 * 1024 * 1024) {
      updateDownloadUI(overlay, 50)
      try {
        const res = await api.get(downloadUrl, { timeout: 30000 })
        if (res.data && res.data.base64) {
          updateDownloadUI(overlay, 100)
          const binary = atob(res.data.base64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
          const blob = new Blob([bytes], { type: res.data.fileType || 'application/octet-stream' })
          triggerDownload(blob, fileName || res.data.fileName)
          setTimeout(() => { removeDownloadUI(); ElMessage.success('下载成功') }, 500)
          return
        }
      } catch (e) { /* fallback to chunked */ }
    }

    const blob = await downloadFileChunked(chunkBaseUrl, fileMeta, progressCallback)
    triggerDownload(blob, fileName)
    setTimeout(() => { removeDownloadUI(); ElMessage.success('下载成功') }, 500)
  } catch (e) {
    removeDownloadUI()
    ElMessage.error('下载失败: ' + (e.message || '未知错误'))
  }
}

export async function smartLoadImage(downloadUrl, chunkBaseUrl, fileMeta) {
  try {
    if (!fileMeta.fileSize || fileMeta.fileSize < 4 * 1024 * 1024) {
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
  } catch (e) {
    console.error('图片加载失败:', e)
    return ''
  }
}
