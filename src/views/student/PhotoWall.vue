<template>
  <div class="photo-wall">
    <div class="page-header">
      <h2>照片收藏墙</h2>
      <el-button v-if="enabled" type="primary" @click="openUploadDialog">
        <el-icon><Plus /></el-icon> 上传照片
      </el-button>
    </div>

    <el-alert v-if="!enabled" title="照片墙功能已关闭" type="info" :closable="false" style="margin-bottom: 16px" />

    <div v-else-if="photos.length === 0" class="empty-state">
      <el-empty description="还没有照片，快来上传第一张吧！" />
    </div>

    <div v-else class="photo-grid">
      <div v-for="photo in photos" :key="photo.id" class="photo-card">
        <div class="photo-wrapper" @click="previewPhoto(photo)">
          <img :src="photoUrls[photo.id]" class="photo-img" loading="lazy" />
          <div v-if="!photo.is_public" class="photo-private-badge">
            <el-icon><Lock /></el-icon> 私密
          </div>
        </div>
        <div class="photo-info">
          <div class="photo-desc">{{ photo.description || '无描述' }}</div>
          <div class="photo-meta">
            <span class="photo-author">{{ photo.uploader_name }}</span>
            <span class="photo-time">{{ formatTime(photo.created_at) }}</span>
          </div>
          <div v-if="isOwner(photo)" class="photo-actions">
            <el-switch
              v-model="photo.is_public"
              active-text="公开"
              inactive-text="私密"
              size="small"
              @change="(val) => togglePrivacy(photo, val)"
            />
            <el-button type="danger" link size="small" @click="handleDelete(photo)">
              <el-icon><Delete /></el-icon> 删除
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="上传照片" width="450px" destroy-on-close>
      <el-form :model="uploadForm" label-width="80px">
        <el-form-item label="选择照片">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept="image/*"
            :on-change="handleFileChange"
            :on-remove="() => uploadFileList = []"
          >
            <el-button type="primary"><el-icon><Upload /></el-icon> 选择图片</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="uploadForm.description" type="textarea" :rows="2" placeholder="可选：写点什么..." />
        </el-form-item>
        <el-form-item label="可见性">
          <el-radio-group v-model="uploadForm.is_public">
            <el-radio :label="true">公开（所有人可见）</el-radio>
            <el-radio :label="false">私密（仅自己可见）</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">上传</el-button>
      </template>
    </el-dialog>

    <!-- 预览对话框 -->
    <el-dialog v-model="previewVisible" title="照片预览" width="70%" destroy-on-close @closed="previewUrl = ''">
      <img :src="previewUrl" style="width: 100%; max-height: 70vh; object-fit: contain;" />
      <div v-if="previewPhotoData" style="margin-top: 12px; text-align: center; color: #64748b;">
        {{ previewPhotoData.description || '' }} — {{ previewPhotoData.uploader_name }} · {{ formatTime(previewPhotoData.created_at) }}
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Upload, Delete, Lock } from '@element-plus/icons-vue'
import { useAuth } from '../../stores/auth'
import { getPhotos, uploadPhoto, deletePhoto, setPhotoPrivacy, downloadPhoto, getPhotoWallSetting } from '../../api/photo_wall'

const { studentId, username } = useAuth()
const enabled = ref(true)
const photos = ref([])
const photoUrls = ref({})
const loading = ref(false)
const uploadDialogVisible = ref(false)
const uploading = ref(false)
const uploadFileList = ref([])
const uploadForm = ref({ description: '', is_public: true })
const previewVisible = ref(false)
const previewUrl = ref('')
const previewPhotoData = ref(null)

const isOwner = (photo) => {
  const myId = studentId.value || username.value
  return photo.uploader_id === myId
}

const formatTime = (t) => {
  if (!t) return ''
  return t.replace('T', ' ').substring(0, 16)
}

const loadPhotos = async () => {
  loading.value = true
  try {
    const res = await getPhotos()
    enabled.value = res.data.enabled !== false
    photos.value = res.data.photos || []
    // 加载图片 URL
    for (const photo of photos.value) {
      downloadPhoto(photo.id).then(url => {
        photoUrls.value[photo.id] = url
      }).catch(() => {})
    }
  } catch (e) {
    ElMessage.error('获取照片失败')
  } finally {
    loading.value = false
  }
}

const openUploadDialog = () => {
  uploadForm.value = { description: '', is_public: true }
  uploadFileList.value = []
  uploadDialogVisible.value = true
}

const handleFileChange = (file) => {
  uploadFileList.value = [file]
}

const submitUpload = async () => {
  if (!uploadFileList.value.length || !uploadFileList.value[0].raw) {
    ElMessage.warning('请先选择照片')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', uploadFileList.value[0].raw)
    formData.append('description', uploadForm.value.description)
    formData.append('is_public', uploadForm.value.is_public)
    await uploadPhoto(formData)
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    loadPhotos()
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const previewPhoto = async (photo) => {
  previewPhotoData.value = photo
  previewUrl.value = photoUrls.value[photo.id] || ''
  previewVisible.value = true
}

const togglePrivacy = async (photo, val) => {
  try {
    await setPhotoPrivacy(photo.id, val)
    ElMessage.success(val ? '已设为公开' : '已设为私密')
  } catch (e) {
    photo.is_public = !val
    ElMessage.error('设置失败')
  }
}

const handleDelete = async (photo) => {
  try {
    await ElMessageBox.confirm('确定删除这张照片吗？', '提示', { type: 'warning' })
    await deletePhoto(photo.id)
    ElMessage.success('删除成功')
    loadPhotos()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

onMounted(loadPhotos)

onBeforeUnmount(() => {
  Object.values(photoUrls.value).forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
})
</script>

<style scoped>
.photo-wall { padding: 20px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.page-header h2 { margin: 0; }
.empty-state { padding: 60px 0; }
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.photo-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  transition: transform 0.2s, box-shadow 0.2s;
}
.photo-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}
.photo-wrapper {
  position: relative;
  width: 100%;
  height: 200px;
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
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.photo-info { padding: 12px; }
.photo-desc {
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 8px;
  word-break: break-all;
  min-height: 20px;
}
.photo-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 8px;
}
.photo-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #f1f5f9;
  padding-top: 8px;
}
</style>
