<template>
  <div class="study-material-page">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Reading /></el-icon>
        复习资料
      </h2>
    </div>

    <!-- 最新上传区域 -->
    <el-card v-if="latestMaterials.length > 0" shadow="never" class="latest-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#f59e0b"><Timer /></el-icon>
          <span class="card-title">最新上传</span>
          <el-tag size="small" type="warning" effect="plain">最近5条</el-tag>
        </div>
      </template>
      <div class="latest-list">
        <div v-for="mat in latestMaterials" :key="mat.id" class="latest-item">
          <div class="latest-left">
            <el-icon :size="20" :color="getFileIconColor(mat.file_type)">
              <component :is="getFileIcon(mat.file_type)" />
            </el-icon>
            <span class="latest-title">{{ mat.original_name || mat.file_name || mat.title || '-' }}</span>
            <el-tag v-if="mat.course_name" size="small" type="info" effect="plain">{{ mat.course_name }}</el-tag>
            <el-tag v-if="mat.class_name" size="small" type="success" effect="plain">{{ mat.class_name }}</el-tag>
          </div>
          <div class="latest-right">
            <span class="latest-uploader">{{ mat.uploader_name }}</span>
            <span class="latest-date">{{ formatDateShort(mat.created_at) }}</span>
            <el-button type="primary" link size="small" @click="handleDownload(mat)">
              <el-icon><Download /></el-icon>下载
            </el-button>
          </div>
        </div>
      </div>
    </el-card>

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
    </div>

    <!-- 资料列表 -->
    <el-table :data="materialList" v-loading="loading" stripe border>
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
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="handleDownload(row)">
            <el-icon><Download /></el-icon>
            下载
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Reading, Download, Search, Document, Picture, VideoPlay, Headset, Timer
} from '@element-plus/icons-vue'
import { getStudyMaterials, downloadStudyMaterial } from '../../api/study_material'
import { getClasses } from '../../api/class'
import { getCourses } from '../../api/course'

const loading = ref(false)
const materialList = ref([])
const latestMaterials = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const filterClass = ref('')
const filterCourse = ref('')
const searchKeyword = ref('')
const classList = ref([])
const courseList = ref([])

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
  return new Date(dateStr).toLocaleString('zh-CN')
}

const formatDateShort = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN')
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

const loadLatest = async () => {
  try {
    const res = await getStudyMaterials({ page: 1, pageSize: 5 })
    if (res.data && Array.isArray(res.data.list)) {
      latestMaterials.value = res.data.list
    } else if (Array.isArray(res.data)) {
      latestMaterials.value = res.data.slice(0, 5)
    }
  } catch (err) {
    console.error('获取最新资料失败:', err)
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

const handleDownload = async (row) => {
  try {
    await downloadStudyMaterial(row.id, row.original_name || row.file_name || row.title, row.file_size, row.file_type)
  } catch (err) {
    console.error('下载失败:', err)
    ElMessage.error('下载失败')
  }
}

onMounted(() => {
  loadMaterials()
  loadLatest()
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

/* 最新上传卡片 */
.latest-card {
  border-radius: 8px;
  border: none;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #fffbeb 0%, #fff 100%);
}
.latest-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid #fef3c7;
}
.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}
.latest-list {
  padding: 0;
}
.latest-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.15s;
}
.latest-item:last-child {
  border-bottom: none;
}
.latest-item:hover {
  background: #fffbeb;
}
.latest-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.latest-title {
  font-size: 14px;
  color: #334155;
  font-weight: 500;
}
.latest-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  font-size: 12px;
  color: #94a3b8;
}
.latest-uploader {
  color: #64748b;
}
.latest-date {
  color: #f59e0b;
  font-weight: 500;
}

/* 筛选和表格 */
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

/* 响应式布局 */
@media (max-width: 768px) {
  .filter-bar { flex-direction: column; align-items: flex-start; }
  .filter-bar .el-select { width: 100% !important; margin-left: 0 !important; }
  .filter-bar .el-input { width: 100% !important; margin-left: 0 !important; }
  .latest-item { flex-direction: column; align-items: flex-start; gap: 8px; }
  .latest-right { margin-left: 0; }
  .page-title { font-size: 18px; }
}
@media (max-width: 480px) {
  .page-title { font-size: 16px; }
  .pagination { justify-content: center; }
}
</style>
