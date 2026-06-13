import api from './index'

// 获取帖子列表
export function getPosts(params) {
  return api.get('/forum/posts', { params })
}

// 获取帖子详情
export function getPost(id) {
  return api.get(`/forum/posts/${id}`)
}

// 发帖
export function createPost(data) {
  return api.post('/forum/posts', data)
}

// 删除帖子
export function deletePost(id) {
  return api.delete(`/forum/posts/${id}`)
}

// 置顶/取消置顶
export function togglePinPost(id, pinned) {
  return api.put(`/forum/posts/${id}/pin`, { pinned })
}

// 获取评论列表
export function getComments(postId) {
  return api.get(`/forum/posts/${postId}/comments`)
}

// 发表评论
export function createComment(postId, content) {
  return api.post(`/forum/posts/${postId}/comments`, { content })
}

// 删除评论
export function deleteComment(id) {
  return api.delete(`/forum/comments/${id}`)
}

// 点赞/取消点赞
export function toggleLike(postId) {
  return api.post(`/forum/posts/${postId}/like`)
}

// 获取点赞列表
export function getLikes(postId) {
  return api.get(`/forum/posts/${postId}/likes`)
}
