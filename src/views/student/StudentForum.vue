<template>
  <div class="forum-page">
    <!-- 顶部操作栏 -->
    <div class="forum-header">
      <div class="forum-tabs">
        <el-tag
          v-for="cat in categories" :key="cat"
          :effect="currentCategory === cat ? 'dark' : 'plain'"
          class="category-tag"
          @click="currentCategory = cat; loadPosts()"
        >{{ cat }}</el-tag>
      </div>
      <div class="forum-actions">
        <el-input v-model="keyword" placeholder="搜索帖子..." clearable style="width: 200px" @clear="loadPosts" @keyup.enter="loadPosts">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="showPostDialog = true">
          <el-icon><EditPen /></el-icon> 发帖
        </el-button>
      </div>
    </div>

    <!-- 帖子列表 -->
    <div v-loading="loading" class="post-list">
      <div v-if="posts.length === 0 && !loading" class="empty-state">
        <el-empty description="暂无帖子，快来发第一帖吧！" />
      </div>
      <div v-for="post in posts" :key="post.id" class="post-card" @click="openPost(post)">
        <div class="post-card-header">
          <span class="post-author">{{ post.author_name }}</span>
          <el-tag size="small" :type="getCategoryType(post.category)">{{ post.category }}</el-tag>
          <span class="post-time">{{ formatTime(post.created_at) }}</span>
        </div>
        <div class="post-title">{{ post.title }}</div>
        <div class="post-preview">{{ post.content?.substring(0, 100) }}{{ post.content?.length > 100 ? '...' : '' }}</div>
        <div class="post-stats">
          <span class="stat-item" @click.stop="toggleLike(post)">
            <el-icon :color="post.is_liked > 0 ? '#e74c3c' : ''"><component :is="post.is_liked > 0 ? 'FilledStar' : 'Star'" /></el-icon>
            {{ post.like_count || 0 }}
          </span>
          <span class="stat-item">
            <el-icon><ChatLineSquare /></el-icon>
            {{ post.comment_count || 0 }}
          </span>
          <el-button v-if="post.author_id === currentUserId" type="danger" size="small" text @click.stop="handleDeletePost(post.id)">
            删除
          </el-button>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination-wrapper">
      <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadPosts" />
    </div>

    <!-- 发帖对话框 -->
    <el-dialog v-model="showPostDialog" title="发表新帖" width="600px" destroy-on-close>
      <el-form :model="postForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="postForm.title" placeholder="请输入帖子标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="postForm.category" style="width: 100%">
            <el-option v-for="cat in categories.filter(c => c !== '全部')" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="postForm.content" type="textarea" :rows="8" placeholder="请输入帖子内容" maxlength="5000" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPostDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitPost">发表</el-button>
      </template>
    </el-dialog>

    <!-- 帖子详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="currentPost?.title" width="700px" destroy-on-close>
      <div class="post-detail">
        <div class="detail-meta">
          <span>{{ currentPost?.author_name }}</span>
          <el-tag size="small">{{ currentPost?.category }}</el-tag>
          <span>{{ formatTime(currentPost?.created_at) }}</span>
        </div>
        <div class="detail-content">{{ currentPost?.content }}</div>
        <div class="detail-actions">
          <el-button :type="currentPost?.is_liked > 0 ? 'danger' : 'default'" @click="toggleLike(currentPost)">
            <el-icon><Star /></el-icon> {{ currentPost?.like_count || 0 }} 赞
          </el-button>
        </div>
        <el-divider />
        <div class="comments-section">
          <h4>评论 ({{ comments.length }})</h4>
          <div class="comment-input">
            <el-input v-model="commentContent" placeholder="写下你的评论..." type="textarea" :rows="2" />
            <el-button type="primary" size="small" style="margin-top: 8px" @click="submitComment">发表评论</el-button>
          </div>
          <div v-if="comments.length === 0" style="color: #999; text-align: center; padding: 20px;">暂无评论</div>
          <div v-for="comment in comments" :key="comment.id" class="comment-item">
            <div class="comment-header">
              <span class="comment-author">{{ comment.author_name }}</span>
              <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
              <el-button v-if="comment.author_id === currentUserId" type="danger" size="small" text @click="handleDeleteComment(comment.id)">删除</el-button>
            </div>
            <div class="comment-content">{{ comment.content }}</div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, EditPen, Star, ChatLineSquare } from '@element-plus/icons-vue'
import { getPosts, getPost, createPost, deletePost, toggleLike as apiToggleLike, getComments, createComment, deleteComment } from '../../api/forum'

const categories = ['全部', '综合', '学习', '生活', '技术', '求助']
const currentCategory = ref('全部')
const keyword = ref('')
const posts = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const total = ref(0)

const showPostDialog = ref(false)
const showDetailDialog = ref(false)
const submitting = ref(false)
const postForm = ref({ title: '', content: '', category: '综合' })
const currentPost = ref(null)
const comments = ref([])
const commentContent = ref('')

const currentUser = computed(() => {
  try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} }
})
const currentUserId = computed(() => currentUser.value.studentId || currentUser.value.username || '')

function getCategoryType(cat) {
  const map = { '综合': '', '学习': 'success', '生活': 'warning', '技术': 'primary', '求助': 'danger' }
  return map[cat] || 'info'
}

function formatTime(t) {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'
  return d.toLocaleDateString('zh-CN')
}

async function loadPosts() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize }
    if (currentCategory.value !== '全部') params.category = currentCategory.value
    if (keyword.value) params.keyword = keyword.value
    const res = await getPosts(params)
    posts.value = res.data.list || []
    total.value = res.data.total || 0
  } catch (e) {
    ElMessage.error('获取帖子失败')
  } finally {
    loading.value = false
  }
}

async function openPost(post) {
  try {
    const res = await getPost(post.id)
    currentPost.value = res.data
    comments.value = await getComments(post.id).then(r => r.data || [])
    showDetailDialog.value = true
  } catch (e) {
    ElMessage.error('获取帖子详情失败')
  }
}

async function submitPost() {
  if (!postForm.value.title.trim()) return ElMessage.warning('请输入标题')
  if (!postForm.value.content.trim()) return ElMessage.warning('请输入内容')
  submitting.value = true
  try {
    await createPost(postForm.value)
    ElMessage.success('发帖成功')
    showPostDialog.value = false
    postForm.value = { title: '', content: '', category: '综合' }
    loadPosts()
  } catch (e) {
    ElMessage.error('发帖失败')
  } finally {
    submitting.value = false
  }
}

async function toggleLike(post) {
  try {
    const res = await apiToggleLike(post.id)
    if (res.data.liked) {
      post.like_count = (post.like_count || 0) + 1
      post.is_liked = 1
    } else {
      post.like_count = Math.max(0, (post.like_count || 1) - 1)
      post.is_liked = 0
    }
  } catch (e) {
    ElMessage.error('操作失败')
  }
}

async function submitComment() {
  if (!commentContent.value.trim()) return ElMessage.warning('请输入评论内容')
  try {
    await createComment(currentPost.value.id, commentContent.value)
    ElMessage.success('评论成功')
    commentContent.value = ''
    comments.value = await getComments(currentPost.value.id).then(r => r.data || [])
    currentPost.value.comment_count = comments.value.length
  } catch (e) {
    ElMessage.error('评论失败')
  }
}

async function handleDeletePost(id) {
  try {
    await ElMessageBox.confirm('确定删除此帖子？', '提示', { type: 'warning' })
    await deletePost(id)
    ElMessage.success('删除成功')
    loadPosts()
  } catch (e) { /* cancelled */ }
}

async function handleDeleteComment(id) {
  try {
    await ElMessageBox.confirm('确定删除此评论？', '提示', { type: 'warning' })
    await deleteComment(id)
    ElMessage.success('删除成功')
    comments.value = await getComments(currentPost.value.id).then(r => r.data || [])
    currentPost.value.comment_count = comments.value.length
  } catch (e) { /* cancelled */ }
}

onMounted(() => { loadPosts() })
</script>

<style scoped>
.forum-page { padding: 20px; max-width: 900px; margin: 0 auto; }
.forum-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
.forum-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
.category-tag { cursor: pointer; }
.forum-actions { display: flex; gap: 10px; align-items: center; }
.post-list { min-height: 200px; }
.post-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: box-shadow 0.2s; }
.post-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
.post-card-header { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #999; margin-bottom: 8px; }
.post-author { font-weight: 500; color: #333; }
.post-title { font-size: 16px; font-weight: 600; color: #333; margin-bottom: 6px; }
.post-preview { font-size: 14px; color: #666; line-height: 1.5; }
.post-stats { display: flex; align-items: center; gap: 16px; margin-top: 10px; font-size: 13px; color: #999; }
.stat-item { display: flex; align-items: center; gap: 4px; cursor: pointer; }
.stat-item:hover { color: #333; }
.pagination-wrapper { display: flex; justify-content: center; margin-top: 20px; }
.empty-state { padding: 60px 0; }
.post-detail .detail-meta { display: flex; align-items: center; gap: 8px; color: #999; font-size: 13px; margin-bottom: 16px; }
.detail-content { font-size: 15px; line-height: 1.8; color: #333; white-space: pre-wrap; }
.detail-actions { margin-top: 12px; }
.comments-section h4 { margin-bottom: 12px; }
.comment-input { margin-bottom: 16px; }
.comment-item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.comment-header { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #999; margin-bottom: 4px; }
.comment-author { font-weight: 500; color: #333; }
.comment-content { font-size: 14px; color: #555; line-height: 1.5; }
</style>
