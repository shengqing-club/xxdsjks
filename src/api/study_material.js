import api from './index'

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

// 删除复习资料
export function deleteStudyMaterial(id) {
  return api.delete(`/study-materials/${id}`)
}

// 下载复习资料（兼容 serverless）
export function downloadStudyMaterial(id, fileName) {
  return downloadFileFromApi(`/study-materials/download/${id}`, fileName)
}
