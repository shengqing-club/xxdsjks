<template>
  <div class="forum-admin">
    <div class="forum-header">
      <h2 style="margin: 0;">论坛管理</h2>
      <div class="forum-actions">
        <el-select v-model="currentCategory" placeholder="分类筛选" clearable style="width: 120px" @change="loadPosts">
          <el-option v-for="cat in categories.filter(c => c !== '全部')" :key="cat" :label="cat" :value="cat" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索帖子..." clearable style="width: 200px" @clear="loadPosts" @keyup.enter="loadPosts" />
      </div>
    </div>

    <el-table :data="posts" v-loading="loading" stripe>
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column prop="author_name" label="作者" width="100" />
      <el-table-column prop="category" label="分类" width="80">
        <template #default="{ row }">
          <el-tag size="small">{{ row.category }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="点赞" width="70" align="center">
        <template #default="{ row }">{{ row.like_count || 0 }}</template>
      </el-table-column>
      <el-table-column label="评论" width="70" align="center">
        <template #default="{ row }">{{ row.comment_count || 0 }}</template>
      </el-table-column>
      <el-table-column label="置顶" width="70" align="center">
        <template #default="{ row }">
          <el-switch v-model="row.pinned" @change="handlePin(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="发布时间" width="160">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button size="small" @click="openPost(row)">查看</el-button>
          <el-button type="danger" size="small" @click="handleDeletePost(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display: flex; justify-content: center; margin-top: 20px;">
      <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadPosts" />
    </div>

    <!-- 帖子详情对话框 -->
    <el-dialog v-model="showDetailDialog" :title="currentPost?.title" width="700px" destroy-on-close>
      <div class="post-detail">
        <div class="detail-meta">
          <span>作者: {{ currentPost?.author_name }}</span>
          <el-tag size="small">{{ currentPost?.category }}</el-tag>
          <span>{{ formatTime(currentPost?.created_at) }}</span>
        </div>
        <div class="detail-content">{{ currentPost?.content }}</div>
        <el-divider />
        <h4>评论 ({{ comments.length }})</h4>
        <div v-if="comments.length === 0" style="color: #999; text-align: center; padding: 20px;">暂无评论</div>
        <div v-for="comment in comments" :key="comment.id" class="comment-item">
          <div class="comment-header">
            <span class="comment-author">{{ comment.author_name }}</span>
            <span class="comment-time">{{ formatTime(comment.created_at) }}</span>
            <el-button type="danger" size="small" text @click="handleDeleteComment(comment.id)">删除</el-button>
          </div>
          <div class="comment-content">{{ comment.content }}</div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPosts, getPost, deletePost, togglePinPost, getComments, deleteComment } from '../../api/forum'

const categories = ['全部', '综合', '学习', '生活', '技术', '求助']
const currentCategory = ref('')
const keyword = ref('')
const posts = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = 20
const total = ref(0)
const showDetailDialog = ref(false)
const currentPost = ref(null)
const comments = ref([])

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN')
}

async function loadPosts() {
  loading.value = true
  try {
    const params = { page: page.value, pageSize }
    if (currentCategory.value) params.category = currentCategory.value
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
    ElMessage.error('获取详情失败')
  }
}

async function handlePin(post) {
  try {
    await togglePinPost(post.id, post.pinned)
    ElMessage.success(post.pinned ? '已置顶' : '已取消置顶')
  } catch (e) {
    ElMessage.error('操作失败')
    post.pinned = !post.pinned
  }
}

async function handleDeletePost(id) {
  try {
    await ElMessageBox.confirm('确定删除此帖子？删除后不可恢复。', '提示', { type: 'warning' })
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
  } catch (e) { /* cancelled */ }
}

onMounted(() => { loadPosts() })
</script>

<style scoped>
.forum-admin { padding: 20px; }
.forum-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.forum-actions { display: flex; gap: 10px; }
.post-detail .detail-meta { display: flex; align-items: center; gap: 8px; color: #999; font-size: 13px; margin-bottom: 16px; }
.detail-content { font-size: 15px; line-height: 1.8; white-space: pre-wrap; }
.comment-item { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.comment-header { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #999; margin-bottom: 4px; }
.comment-author { font-weight: 500; color: #333; }
.comment-content { font-size: 14px; color: #555; line-height: 1.5; }
</style>
