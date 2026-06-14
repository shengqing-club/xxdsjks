<template>
  <div class="group-file-library">
    <div class="library-header">
      <el-upload
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleUpload"
      >
        <el-button type="primary" size="small" :loading="uploading">
          <el-icon><Upload /></el-icon>
          上传文件
        </el-button>
      </el-upload>
      <span class="file-count">共 {{ fileList.length }} 个文件</span>
    </div>

    <el-table :data="fileList" v-loading="loading" stripe border size="small">
      <el-table-column label="文件名" min-width="200">
        <template #default="{ row }">
          <div class="file-name-cell">
            <el-icon :size="18" :color="getFileIconColor(row.file_type)">
              <component :is="getFileIcon(row.file_type)" />
            </el-icon>
            <span>{{ row.original_name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="大小" width="100">
        <template #default="{ row }">
          {{ formatFileSize(row.file_size) }}
        </template>
      </el-table-column>
      <el-table-column prop="uploader_name" label="上传者" width="100" />
      <el-table-column label="上传时间" width="150">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="handleDownload(row)">
            <el-icon><Download /></el-icon>
            下载
          </el-button>
          <el-button type="danger" size="small" link @click="handleDelete(row)">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Upload, Download, Delete, Document, Picture, VideoPlay, Headset
} from '@element-plus/icons-vue'
import { getGroupFiles, uploadGroupSharedFile, downloadGroupFile, deleteGroupFile } from '../api/group_file'

const props = defineProps({
  group: { type: Object, required: true }
})

const loading = ref(false)
const uploading = ref(false)
const fileList = ref([])

const getFileIcon = (type) => {
  if (!type) return Document
  if (type.startsWith('image/')) return Picture
  if (type.startsWith('video/')) return VideoPlay
  if (type.startsWith('audio/')) return Headset
  return Document
}

const getFileIconColor = (type) => {
  if (!type) return '#606266'
  if (type.startsWith('image/')) return '#67c23a'
  if (type.startsWith('video/')) return '#e6a23c'
  if (type.startsWith('audio/')) return '#f56c6c'
  return '#409eff'
}

const formatFileSize = (size) => {
  if (!size) return '0 B'
  const numSize = Number(size) || 0
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let s = numSize
  while (s >= 1024 && i < units.length - 1) { s /= 1024; i++ }
  return `${s.toFixed(1)} ${units[i]}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

const loadFiles = async () => {
  loading.value = true
  try {
    const res = await getGroupFiles(props.group.id)
    fileList.value = res.data || []
  } catch (err) {
    ElMessage.error('获取文件列表失败')
  } finally {
    loading.value = false
  }
}

const handleUpload = async (file) => {
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file.raw)
    await uploadGroupSharedFile(props.group.id, formData)
    ElMessage.success('上传成功')
    loadFiles()
  } catch (err) {
    ElMessage.error('上传失败')
  } finally {
    uploading.value = false
  }
}

const handleDownload = async (row) => {
  try {
    await downloadGroupFile(row.id, row.original_name, row.file_size, row.file_type)
  } catch (err) {
    ElMessage.error('下载失败')
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定删除文件 "${row.original_name}" 吗？`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteGroupFile(row.id)
    ElMessage.success('删除成功')
    loadFiles()
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadFiles()
})
</script>

<style scoped>
.group-file-library {
  padding: 0;
}
.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.file-count {
  color: #909399;
  font-size: 14px;
}
.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
