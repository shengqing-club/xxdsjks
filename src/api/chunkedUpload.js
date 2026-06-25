import api from './index'

const CHUNK_SIZE = 2 * 1024 * 1024 // 2MB per chunk
const MAX_CONCURRENT = 3 // max 3 parallel uploads

/**
 * Compute SHA-256 hash of a file using Web Crypto API
 * Processes in chunks to avoid loading entire file into memory
 */
async function computeFileHash(file) {
  const chunkSize = 5 * 1024 * 1024 // 5MB chunks for hashing
  const totalChunks = Math.ceil(file.size / chunkSize)
  const buffers = []

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, file.size)
    const chunk = file.slice(start, end)
    buffers.push(await chunk.arrayBuffer())
  }

  const combined = new Uint8Array(file.size)
  let offset = 0
  for (const buf of buffers) {
    combined.set(new Uint8Array(buf), offset)
    offset += buf.byteLength
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Upload a single chunk with retry
 */
async function uploadChunk(uploadUrl, formData, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await api.post(uploadUrl, formData, {
        timeout: 60000, // 60s per chunk
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      return res.data
    } catch (e) {
      if (attempt === retries) throw e
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1))) // exponential backoff
    }
  }
}

/**
 * Run tasks with concurrency limit
 */
async function runWithConcurrency(tasks, limit) {
  const results = []
  const executing = new Set()

  for (const task of tasks) {
    const p = task().then(result => {
      executing.delete(p)
      return result
    })
    executing.add(p)
    results.push(p)

    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}

/**
 * Chunked upload with parallel concurrency, resume, and progress tracking
 *
 * @param {string} uploadBasePath - e.g., '/files' (without '/api' prefix)
 * @param {File} file - The file to upload
 * @param {Object} extraFields - Additional form fields (category, title, etc.)
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<Object>} - Server response from merge endpoint
 */
export async function chunkedUpload(uploadBasePath, file, extraFields = {}, onProgress) {
  // Files under 5MB: use simple single upload (no chunking overhead)
  if (file.size < 5 * 1024 * 1024) {
    const formData = new FormData()
    formData.append('file', file)
    for (const [key, val] of Object.entries(extraFields)) {
      formData.append(key, val)
    }
    const res = await api.post(`${uploadBasePath}/upload`, formData, {
      timeout: 300000,
      onUploadProgress: onProgress ? (e) => {
        if (e.total > 0) onProgress(Math.round((e.loaded / e.total) * 100))
      } : undefined
    })
    return res.data
  }

  // Large files: chunked upload
  onProgress?.(1) // "computing hash"

  // Step 1: Compute file hash
  const hash = await computeFileHash(file)
  onProgress?.(3)

  // Step 1.5: Check if file already exists (instant upload / 秒传)
  try {
    const checkRes = await api.post(`${uploadBasePath}/check-hash`, {
      hash,
      fileName: file.name,
      fileSize: file.size
    })
    if (checkRes.data.exists && checkRes.data.file) {
      onProgress?.(100)
      return checkRes.data.file
    }
  } catch (e) {
    // 秒传检查失败，继续正常上传流程
  }

  // Step 2: Check existing progress (resume support)
  let uploadedChunks = []
  try {
    const progressRes = await api.get(`${uploadBasePath}/upload/progress/${hash}`)
    uploadedChunks = progressRes.data.uploadedChunks || []
  } catch (e) {
    // No existing progress, start fresh
  }

  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  let completedChunks = uploadedChunks.length

  // Report initial progress
  const reportProgress = () => {
    const percent = Math.round(3 + (completedChunks / totalChunks) * 90) // 3-93% range
    onProgress?.(Math.min(percent, 93))
  }
  reportProgress()

  // Step 3: Create upload tasks for missing chunks
  const tasks = []
  for (let i = 0; i < totalChunks; i++) {
    if (uploadedChunks.includes(i)) continue // skip already uploaded

    tasks.push(() => {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      const formData = new FormData()
      formData.append('file', chunk, `chunk_${i}`)
      formData.append('hash', hash)
      formData.append('chunkIndex', String(i))
      formData.append('totalChunks', String(totalChunks))
      formData.append('fileName', file.name)
      formData.append('fileSize', String(file.size))
      formData.append('fileType', file.type || 'application/octet-stream')

      return uploadChunk(`${uploadBasePath}/upload/chunk`, formData).then(() => {
        completedChunks++
        reportProgress()
      })
    })
  }

  // Step 4: Upload chunks with concurrency
  if (tasks.length > 0) {
    await runWithConcurrency(tasks, MAX_CONCURRENT)
  }

  onProgress?.(95) // "merging"

  // Step 5: Merge chunks on server
  const mergeData = {
    hash,
    totalChunks,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || 'application/octet-stream',
    ...extraFields
  }

  const mergeRes = await api.post(`${uploadBasePath}/upload/merge`, mergeData)
  onProgress?.(100)

  return mergeRes.data
}
