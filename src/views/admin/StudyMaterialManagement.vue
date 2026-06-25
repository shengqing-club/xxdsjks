<template>
  <div class="study-material-page">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Reading /></el-icon>
        复习资料管理
      </h2>
      <div class="header-actions">
        <el-button type="primary" @click="handleUpload">
          <el-icon><Upload /></el-icon>
          上传资料
        </el-button>
        <el-button :type="editingMode ? 'warning' : 'default'" @click="toggleEditMode">
          <el-icon><Edit /></el-icon>
          {{ editingMode ? '取消编辑' : '编辑管理' }}
        </el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-select v-model="filterClass" placeholder="选择班级" clearable @change="loadMaterials" style="width: 180px">
        <el-option v-for="cls in classList" :key="cls" :label="cls" :value="cls" />
      </el-select>
      <el-select v-model="filterCourse" placeholder="选择课程" clearable @change="loadMaterials" style="width: 180px; margin-left: 12px">
        <el-option v-for="course in courseList" :key="course" :label="course" :value="course" />
      </el-select>
      <el-input v-model="searchKeyword" placeholder="搜索文件名" clearable @input="loadMaterials" style="width: 220px; margin-left: 12px">
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-button type="danger" v-if="editingMode" :disabled="selectedRows.length === 0" @click="handleBatchDelete" style="margin-left: 12px">
        <el-icon><Delete /></el-icon>
        批量删除 ({{ selectedRows.length }})
      </el-button>
    </div>

    <!-- 资料列表 -->
    <el-table :data="materialList" v-loading="loading" stripe border @selection-change="selectedRows = $event">
      <el-table-column v-if="editingMode" type="selection" width="50" />
      <el-table-column type="index" width="60" label="序号" />
      <el-table-column label="文件名" min-width="200">
        <template #default="{ row }">
          <div class="file-name-cell">
            <el-icon :size="18" :color="getFileIconColor(row.file_type)">
              <component :is="getFileIcon(row.file_type)" />
            </el-icon>
            <span class="file-name">{{ row.original_name || row.file_name || row.title || '-' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="class_name" label="班级" width="120" />
      <el-table-column prop="course_name" label="课程" width="150" />
      <el-table-column label="文件大小" width="120">
        <template #default="{ row }">
          {{ formatFileSize(row.file_size) }}
        </template>
      </el-table-column>
      <el-table-column prop="uploader_name" label="上传者" width="120" />
      <el-table-column label="上传时间" width="170">
        <template #default="{ row }">
          {{ formatDate(row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="版本" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.version_number > 1" size="small" type="warning">v{{ row.version_number }}</el-tag>
          <el-tag v-else size="small" type="info">v1</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleDownload(row)">
            <el-icon><Download /></el-icon>
            下载
          </el-button>
          <el-button type="success" size="small" @click="openVersionDialog(row)">
            <el-icon><Document /></el-icon>
            版本
          </el-button>
          <el-button v-if="editingMode" type="danger" size="small" @click="handleDelete(row)">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      v-if="total > 0"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      layout="total, sizes, prev, pager, next"
      @size-change="loadMaterials"
      @current-change="loadMaterials"
      class="pagination"
    />

    <!-- 上传弹窗 -->
    <el-dialog v-model="uploadDialogVisible" title="上传复习资料" width="500px">
      <el-form :model="uploadForm" label-width="100px">
        <el-form-item label="选择文件" required>
          <el-upload
            ref="uploadRef"
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
            :show-file-list="true"
          >
            <el-button type="primary">
              <el-icon><FolderOpened /></el-icon>
              选择文件
            </el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="班级" required>
          <el-select v-model="uploadForm.class_name" placeholder="选择班级" style="width: 100%">
            <el-option v-for="cls in classList" :key="cls" :label="cls" :value="cls" />
          </el-select>
        </el-form-item>
        <el-form-item label="课程" required>
          <el-select v-model="uploadForm.course_name" filterable allow-create default-first-option placeholder="选择或输入课程" style="width: 100%">
            <el-option v-for="course in courseList" :key="course" :label="course" :value="course" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadForm.description" type="textarea" :rows="3" placeholder="可选：填写资料描述" />
        </el-form-item>
      </el-form>
      <el-progress v-if="uploading && uploadProgress > 0" :percentage="uploadProgress" :stroke-width="18" style="margin-top: 12px" :format="(p) => p + '%'" />
      <UploadComfortText :visible="uploading && uploadProgress > 0" />
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmUpload" :loading="uploading">确认上传</el-button>
      </template>
    </el-dialog>

    <!-- 版本历史弹窗 -->
    <el-dialog v-model="versionDialogVisible" :title="`版本历史 - ${currentMaterial?.title}`" width="600px" destroy-on-close>
      <div v-if="versionLoading" class="version-loading">加载中...</div>
      <div v-else-if="versions.length === 0" class="version-empty">暂无版本历史</div>
      <el-timeline v-else>
        <el-timeline-item
          v-for="v in versions"
          :key="v.id"
          :type="v.is_latest ? 'primary' : ''"
          :timestamp="formatDate(v.created_at)"
        >
          <div class="version-item">
            <div class="version-header">
              <el-tag :type="v.is_latest ? 'success' : 'info'" size="small">v{{ v.version_number }}</el-tag>
              <span v-if="v.is_latest" class="version-latest">当前版本</span>
            </div>
            <div class="version-info">{{ v.file_name }} · {{ formatFileSize(v.file_size) }}</div>
            <div class="version-actions">
              <el-button type="primary" link size="small" @click="downloadStudyMaterial(v.id, v.file_name, v.file_size, v.file_type)">下载</el-button>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <template #footer>
        <el-button @click="versionDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="openUploadNewVersion">上传新版本</el-button>
      </template>
    </el-dialog>

    <!-- 上传新版本弹窗 -->
    <el-dialog v-model="newVersionDialogVisible" title="上传新版本" width="500px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="选择文件" required>
          <el-upload
            ref="versionUploadRef"
            action="#"
            :auto-upload="false"
            :on-change="handleVersionFileChange"
            :limit="1"
          >
            <el-button type="primary"><el-icon><FolderOpened /></el-icon> 选择文件</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <el-progress v-if="versionUploading && versionUploadProgress > 0" :percentage="versionUploadProgress" :stroke-width="18" style="margin-top: 12px" :format="(p) => p + '%'" />
      <UploadComfortText :visible="versionUploading && versionUploadProgress > 0" />
      <template #footer>
        <el-button @click="newVersionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmNewVersion" :loading="versionUploading">确认上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Reading, Upload, Download, Delete, Search, Edit,
  FolderOpened, Document, Picture, VideoPlay, Headset
} from '@element-plus/icons-vue'
import { getStudyMaterials, uploadStudyMaterial, deleteStudyMaterial, downloadStudyMaterial, getMaterialVersions } from '../../api/study_material'
import { getClasses } from '../../api/class'
import { getCourses } from '../../api/course'
import UploadComfortText from '../../components/UploadComfortText.vue'

const loading = ref(false)
const materialList = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const filterClass = ref('')
const filterCourse = ref('')
const searchKeyword = ref('')
const classList = ref([])
const courseList = ref([])

const uploadDialogVisible = ref(false)
const uploadForm = ref({ class_name: '', course_name: '', description: '' })
const uploadFile = ref(null)
const uploadRef = ref(null)
const uploading = ref(false)
const uploadProgress = ref(0)
const selectedRows = ref([])
const editingMode = ref(false)

// 版本管理
const versionDialogVisible = ref(false)
const versionLoading = ref(false)
const versions = ref([])
const currentMaterial = ref(null)
const newVersionDialogVisible = ref(false)
const versionUploadFile = ref(null)
const versionUploadRef = ref(null)
const versionUploading = ref(false)
const versionUploadProgress = ref(0)

const toggleEditMode = () => {
  editingMode.value = !editingMode.value
  if (!editingMode.value) selectedRows.value = []
}

// 文件图标映射
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
  while (s >= 1024 && i < units.length - 1) {
    s /= 1024
    i++
  }
  return `${s.toFixed(2)} ${units[i]}`
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleString('zh-CN')
}

const loadMaterials = async () => {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      class_name: filterClass.value || undefined,
      course_name: filterCourse.value || undefined,
      keyword: searchKeyword.value || undefined
    }
    const res = await getStudyMaterials(params)
    console.log('[DEBUG] study materials response:', res.data)
    // 兼容两种返回格式
    if (res.data && Array.isArray(res.data.list)) {
      materialList.value = res.data.list
      total.value = res.data.total || 0
    } else if (Array.isArray(res.data)) {
      materialList.value = res.data
      total.value = res.data.length
    } else {
      materialList.value = []
      total.value = 0
    }
  } catch (err) {
    console.error('获取复习资料失败:', err)
    ElMessage.error('获取复习资料失败: ' + (err.response?.data?.message || err.message))
    materialList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const loadClasses = async () => {
  try {
    const res = await getClasses()
    classList.value = (res.data || []).map(c => c.name).filter(Boolean)
  } catch (err) {
    console.error('获取班级列表失败', err)
  }
}

const loadCourses = async () => {
  try {
    const res = await getCourses()
    courseList.value = (res.data || []).map(c => c.name).filter(Boolean)
  } catch (err) {
    console.error('获取课程列表失败', err)
  }
}

const handleUpload = () => {
  uploadForm.value = { class_name: '', course_name: '', description: '' }
  uploadFile.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
  uploadDialogVisible.value = true
}

const handleFileChange = (file) => {
  uploadFile.value = file.raw
}

const confirmUpload = async () => {
  if (!uploadFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  if (!uploadForm.value.class_name) {
    ElMessage.warning('请选择班级')
    return
  }
  if (!uploadForm.value.course_name) {
    ElMessage.warning('请选择课程')
    return
  }

  uploading.value = true
  try {
    // 统一单次上传（服务器配置足够，不再分片）
    const formData = new FormData()
    formData.append('file', uploadFile.value)
    formData.append('title', uploadFile.value.name)
    formData.append('class_name', uploadForm.value.class_name)
    formData.append('course_name', uploadForm.value.course_name)
    formData.append('description', uploadForm.value.description || '')
    await uploadStudyMaterial(formData, (progress) => {
      uploadProgress.value = progress
    })
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    uploadProgress.value = 0
    loadMaterials()
  } catch (err) {
    console.error('上传失败:', err)
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message))
  } finally {
    uploading.value = false
  }
}

const handleDownload = async (row) => {
  try {
    await downloadStudyMaterial(row.id, row.original_name || row.file_name || row.title, row.file_size, row.file_type)
  } catch (err) {
    console.error('下载失败:', err)
    ElMessage.error('下载失败')
  }
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定删除资料 "${row.original_name || row.file_name || row.title || '此资料'}" 吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    await deleteStudyMaterial(row.id)
    ElMessage.success('删除成功')
    loadMaterials()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('删除失败:', err)
      ElMessage.error('删除失败')
    }
  }
}

// 版本管理方法
const openVersionDialog = async (row) => {
  currentMaterial.value = row
  versionDialogVisible.value = true
  versionLoading.value = true
  try {
    const res = await getMaterialVersions(row.id)
    versions.value = res.data.versions || []
  } catch (err) {
    ElMessage.error('获取版本历史失败')
  } finally {
    versionLoading.value = false
  }
}

const openUploadNewVersion = () => {
  versionUploadFile.value = null
  if (versionUploadRef.value) versionUploadRef.value.clearFiles()
  newVersionDialogVisible.value = true
}

const handleVersionFileChange = (file) => {
  versionUploadFile.value = file.raw
}

const confirmNewVersion = async () => {
  if (!versionUploadFile.value) {
    ElMessage.warning('请选择文件')
    return
  }
  versionUploading.value = true
  try {
    // 统一单次上传新版本（不再分片）
    const formData = new FormData()
    formData.append('file', versionUploadFile.value)
    formData.append('title', currentMaterial.value.title)
    formData.append('course_name', currentMaterial.value.course_name)
    formData.append('class_name', currentMaterial.value.class_name)
    formData.append('version_group', currentMaterial.value.version_group)
    await uploadStudyMaterial(formData, (progress) => { versionUploadProgress.value = progress })
    ElMessage.success('新版本上传成功')
    newVersionDialogVisible.value = false
    versionUploadProgress.value = 0
    // 刷新版本列表
    const res = await getMaterialVersions(currentMaterial.value.id)
    versions.value = res.data.versions || []
    loadMaterials()
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.response?.data?.message || err.message))
  } finally {
    versionUploading.value = false
  }
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${selectedRows.value.length} 份资料吗？此操作不可恢复。`,
      '确认批量删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
    )
    for (const row of selectedRows.value) {
      await deleteStudyMaterial(row.id)
    }
    ElMessage.success(`成功删除 ${selectedRows.value.length} 份资料`)
    selectedRows.value = []
    loadMaterials()
  } catch (err) {
    if (err !== 'cancel') {
      console.error('批量删除失败:', err)
      ElMessage.error('批量删除失败')
    }
  }
}

onMounted(() => {
  loadMaterials()
  loadClasses()
  loadCourses()
})
</script>

<style scoped>
.study-material-page {
  padding: 0;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 20px;
  color: #1a56db;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-bar {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.file-name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}
.file-name {
  font-size: 14px;
  color: #303133;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

@media (max-width: 768px) {
  .study-material-page { padding: 0 4px; }
  .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .header-actions { width: 100%; }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-bar .el-select,
  .filter-bar .el-input { width: 100% !important; margin-left: 0 !important; }
  .study-material-page > .el-table { min-width: 800px; }
  .study-material-page > .el-table .el-table__body-wrapper { overflow-x: auto; }
  .pagination { justify-content: center; }
  .study-material-page :deep(.el-dialog) { width: calc(100vw - 32px) !important; max-width: 500px; }
}
</style>
