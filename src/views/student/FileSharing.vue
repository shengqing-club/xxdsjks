<template>
  <div class="file-page" v-loading="loading">
    <!-- Header -->
    <div class="page-header">
      <h2>文件共享</h2>
      <p class="page-desc">查看和共享学习资源</p>
    </div>

    <!-- Toolbar -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar">
        <el-upload
          v-if="uploadEnabled"
          :show-file-list="false"
          :auto-upload="false"
          :on-change="handleToolbarFileChange"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,.png,.jpg,.jpeg,.mp4,.mp3"
        >
          <el-button type="primary">
            <el-icon><UploadFilled /></el-icon>
            上传文件
          </el-button>
        </el-upload>
        <el-alert
          v-else
          type="info"
          :closable="false"
          show-icon
          class="upload-disabled-alert"
        >
          <template #title>管理员尚未开启上传权限，如需上传请联系管理员</template>
        </el-alert>

        <el-select v-model="filterCategory" placeholder="全部分类" clearable style="width: 150px" @change="fetchData">
          <el-option label="课件资料" value="courseware" />
          <el-option label="通知公告" value="notice" />
          <el-option label="作业模板" value="homework" />
          <el-option label="其他" value="general" />
        </el-select>

        <span class="result-count">
          共 <strong>{{ files.length }}</strong> 个文件
        </span>
      </div>
    </el-card>

    <!-- Upload dialog -->
    <el-dialog v-model="uploadDialogVisible" title="上传文件" width="480px" destroy-on-close>
      <el-form :model="uploadForm" label-width="80px">
        <el-form-item label="选择文件">
          <el-upload
            :auto-upload="false"
            :file-list="uploadFileList"
            :limit="1"
            :on-change="handleDialogFileChange"
            :on-exceed="() => ElMessage.warning('每次只能上传一个文件')"
            drag
          >
            <el-icon :size="40" color="#c0c4cc"><UploadFilled /></el-icon>
            <div class="upload-text">将文件拖到此处，或<em>点击选择</em></div>
          </el-upload>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="uploadForm.category" style="width: 100%">
            <el-option label="课件资料" value="courseware" />
            <el-option label="作业模板" value="homework" />
            <el-option label="其他" value="general" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="uploadForm.description" type="textarea" :rows="2" placeholder="文件描述（选填）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">确定上传</el-button>
      </template>
    </el-dialog>

    <!-- File list -->
    <el-card shadow="never" class="table-card">
      <el-table :data="files" stripe style="width: 100%">
        <el-table-column label="文件名" min-width="220">
          <template #default="{ row }">
            <div class="file-name">
              <el-icon :size="18" :color="getFileIconColor(row.file_type)">
                <component :is="getFileIcon(row.file_type)" />
              </el-icon>
              <span class="name-text">{{ row.original_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="100">
          <template #default="{ row }">
            {{ formatSize(row.file_size) }}
          </template>
        </el-table-column>
        <el-table-column label="分类" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="getCategoryTagType(row.category)">
              {{ getCategoryLabel(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上传者" width="120">
          <template #default="{ row }">
            <el-tag :type="row.uploader_role === 'admin' ? '' : 'success'" size="small" effect="plain">
              {{ row.uploader_name || (row.uploader_role === 'admin' ? '管理员' : '同学') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleDownload(row)">
              <el-icon><Download /></el-icon>
              下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled, Download, Document, Picture, VideoPlay, Headset } from '@element-plus/icons-vue'
import { useAuth } from '../../stores/auth'
import { getFiles, uploadFile, downloadFile, getStudentUploadSetting } from '../../api/file'

const { displayName, studentId } = useAuth()

const loading = ref(false)
const files = ref([])
const filterCategory = ref('')
const uploadEnabled = ref(false)

// Upload dialog
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const uploadFileList = ref([])
const uploadForm = ref({ category: 'general', description: '' })

const fetchData = async () => {
  loading.value = true
  try {
    const res = await getFiles(filterCategory.value || undefined)
    files.value = res.data || res || []
  } catch (e) {
    ElMessage.error('获取文件列表失败')
  } finally {
    loading.value = false
  }
}

const fetchSetting = async () => {
  try {
    const res = await getStudentUploadSetting()
    uploadEnabled.value = (res.data || res).enabled
  } catch (e) { /* ignore */ }
}

const handleToolbarFileChange = (file) => {
  if (!file || !file.raw) return
  uploadFileList.value = [{ raw: file.raw, name: file.name }]
  uploadForm.value = { category: 'general', description: '' }
  uploadDialogVisible.value = true
}

const handleDialogFileChange = (file) => {
  uploadFileList.value = [file]
}

const submitUpload = async () => {
  if (!uploadFileList.value.length || !uploadFileList.value[0].raw) {
    ElMessage.warning('请先选择文件')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', uploadFileList.value[0].raw)
    formData.append('originalFilename', uploadFileList.value[0].name) // 前端正确UTF-8文件名
    formData.append('uploaderRole', 'student')
    formData.append('uploaderId', studentId.value || '')
    formData.append('uploaderName', displayName.value || '学生')
    formData.append('category', uploadForm.value.category)
    formData.append('description', uploadForm.value.description)
    await uploadFile(formData)
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    fetchData()
  } catch (e) {
    const msg = e.response?.data?.error || '上传失败'
    ElMessage.error(msg)
  } finally {
    uploading.value = false
  }
}

const handleDownload = async (row) => {
  try {
    const res = await downloadFile(row.id)
    const blob = res.data || res
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.original_name
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('开始下载')
  } catch (e) {
    ElMessage.error('下载失败')
  }
}

// Helpers
const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i]
}

const formatTime = (t) => t ? t.replace('T', ' ').substring(0, 16) : ''

const getFileIcon = (type) => {
  if (!type) return 'Document'
  if (type.startsWith('image/')) return 'Picture'
  if (type.startsWith('video/')) return 'VideoPlay'
  if (type.startsWith('audio/')) return 'Headset'
  return 'Document'
}

const getFileIconColor = (type) => {
  if (!type) return '#94a3b8'
  if (type.startsWith('image/')) return '#10b981'
  if (type.startsWith('video/')) return '#8b5cf6'
  if (type.startsWith('audio/')) return '#f59e0b'
  if (type.includes('pdf')) return '#ef4444'
  if (type.includes('word') || type.includes('document')) return '#2563eb'
  if (type.includes('sheet') || type.includes('excel')) return '#16a34a'
  if (type.includes('presentation') || type.includes('powerpoint')) return '#ea580c'
  return '#94a3b8'
}

const getCategoryLabel = (cat) => {
  const map = { courseware: '课件资料', notice: '通知公告', homework: '作业模板', general: '其他' }
  return map[cat] || cat || '其他'
}

const getCategoryTagType = (cat) => {
  const map = { courseware: '', notice: 'warning', homework: 'success', general: 'info' }
  return map[cat] || 'info'
}

onMounted(() => {
  fetchData()
  fetchSetting()
})
</script>

<style scoped>
.file-page { max-width: 1100px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
.page-header h2 { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.toolbar-card { border-radius: 8px; margin-bottom: 20px; }
.toolbar-card :deep(.el-card__body) { padding: 16px 20px; }
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.upload-disabled-alert { flex: 1; }
.upload-disabled-alert :deep(.el-alert__title) { font-size: 13px; }
.result-count { font-size: 14px; color: #64748b; margin-left: auto; }
.result-count strong { color: #1a56db; font-weight: 600; }
.table-card { border-radius: 8px; }
.table-card :deep(.el-card__body) { padding: 0; }
.file-name { display: flex; align-items: center; gap: 8px; }
.name-text { font-weight: 500; color: #1e293b; word-break: break-all; }
.upload-text { margin-top: 8px; font-size: 14px; color: #94a3b8; }
.upload-text em { color: #1a56db; font-style: normal; }
</style>
