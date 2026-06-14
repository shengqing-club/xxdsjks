<template>
  <div class="photo-wall-management">
    <div class="page-header">
      <h2>照片墙管理</h2>
      <div class="header-actions">
        <span class="toggle-label">照片墙功能：</span>
        <el-switch
          v-model="enabled"
          active-text="已开启"
          inactive-text="已关闭"
          @change="toggleEnabled"
        />
      </div>
    </div>

    <el-alert v-if="!enabled" title="照片墙功能已关闭，学生端将无法访问" type="warning" :closable="false" style="margin-bottom: 16px" />

    <el-card v-loading="loading">
      <div class="stats-bar">
        <div class="stat-item">
          <div class="stat-value">{{ photos.length }}</div>
          <div class="stat-label">总照片数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ publicCount }}</div>
          <div class="stat-label">公开照片</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">{{ privateCount }}</div>
          <div class="stat-label">私密照片</div>
        </div>
      </div>

      <el-divider />

      <div v-if="photos.length === 0" class="empty-state">
        <el-empty description="暂无照片" />
      </div>

      <div v-else class="photo-grid">
        <div v-for="photo in photos" :key="photo.id" class="photo-card">
          <div class="photo-wrapper" @click="previewPhoto(photo)">
            <img :src="photoUrls[photo.id]" class="photo-img" loading="lazy" />
            <div v-if="!photo.is_public" class="photo-private-badge">私密</div>
          </div>
          <div class="photo-info">
            <div class="photo-desc">{{ photo.description || '无描述' }}</div>
            <div class="photo-meta">
              <span>{{ photo.uploader_name }}</span>
              <span>{{ formatTime(photo.created_at) }}</span>
            </div>
            <div class="photo-actions">
              <el-tag size="small" :type="photo.is_public ? 'success' : 'info'">
                {{ photo.is_public ? '公开' : '私密' }}
              </el-tag>
              <el-button type="danger" link size="small" @click="handleDelete(photo)">
                <el-icon><Delete /></el-icon> 删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 预览 -->
    <el-dialog v-model="previewVisible" title="照片预览" width="70%" destroy-on-close>
      <img :src="previewUrl" style="width: 100%; max-height: 70vh; object-fit: contain;" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { getPhotos, deletePhoto, getPhotoWallSetting, setPhotoWallSetting, downloadPhoto } from '../../api/photo_wall'

const enabled = ref(true)
const photos = ref([])
const photoUrls = ref({})
const loading = ref(false)
const previewVisible = ref(false)
const previewUrl = ref('')

const publicCount = computed(() => photos.value.filter(p => p.is_public).length)
const privateCount = computed(() => photos.value.filter(p => !p.is_public).length)

const formatTime = (t) => {
  if (!t) return ''
  return t.replace('T', ' ').substring(0, 16)
}

const loadData = async () => {
  loading.value = true
  try {
    const settingRes = await getPhotoWallSetting()
    enabled.value = settingRes.data.enabled

    const photoRes = await getPhotos()
    photos.value = photoRes.data.photos || []

    for (const photo of photos.value) {
      downloadPhoto(photo.id, photo.file_size).then(url => {
        photoUrls.value[photo.id] = url
      }).catch(() => {})
    }
  } catch (e) {
    ElMessage.error('获取数据失败')
  } finally {
    loading.value = false
  }
}

const toggleEnabled = async (val) => {
  try {
    await setPhotoWallSetting(val)
    ElMessage.success(val ? '照片墙已开启' : '照片墙已关闭')
  } catch (e) {
    enabled.value = !val
    ElMessage.error('设置失败')
  }
}

const previewPhoto = (photo) => {
  previewUrl.value = photoUrls.value[photo.id] || ''
  previewVisible.value = true
}

const handleDelete = async (photo) => {
  try {
    await ElMessageBox.confirm(`确定删除 ${photo.uploader_name} 的这张照片吗？`, '提示', { type: 'warning' })
    await deletePhoto(photo.id)
    ElMessage.success('删除成功')
    loadData()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

onMounted(loadData)

onBeforeUnmount(() => {
  Object.values(photoUrls.value).forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
})
</script>

<style scoped>
.photo-wall-management { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.toggle-label { font-size: 14px; color: #475569; }
.stats-bar { display: flex; gap: 40px; margin-bottom: 16px; }
.stat-item { text-align: center; }
.stat-value { font-size: 28px; font-weight: 700; color: #1a56db; }
.stat-label { font-size: 13px; color: #94a3b8; margin-top: 4px; }
.empty-state { padding: 40px 0; }
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}
.photo-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.photo-wrapper {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  cursor: pointer;
}
.photo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}
.photo-wrapper:hover .photo-img {
  transform: scale(1.05);
}
.photo-private-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.photo-info { padding: 10px; }
.photo-desc {
  font-size: 13px;
  color: #1e293b;
  margin-bottom: 6px;
  word-break: break-all;
}
.photo-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 6px;
}
.photo-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
