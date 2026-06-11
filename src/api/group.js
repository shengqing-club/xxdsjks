import api from './index'

// 获取分组列表
export function getGroups(params) {
  return api.get('/groups', { params })
}

// 创建分组
export function createGroup(data) {
  return api.post('/groups', data)
}

// 获取分组详情
export function getGroupDetail(id) {
  return api.get(`/groups/${id}`)
}

// 更新分组
export function updateGroup(id, data) {
  return api.put(`/groups/${id}`, data)
}

// 解散分组
export function disbandGroup(id) {
  return api.delete(`/groups/${id}`)
}

// 添加成员
export function addGroupMember(id, student_id) {
  return api.post(`/groups/${id}/members`, { student_id })
}

// 移除成员
export function removeGroupMember(id, student_id) {
  return api.delete(`/groups/${id}/members/${student_id}`)
}

// 任命组长
export function appointLeader(id, student_id) {
  return api.post(`/groups/${id}/leader/${student_id}`)
}

// 获取学生所在分组
export function getStudentGroups(student_id) {
  return api.get(`/groups/student/${student_id}`)
}

// 获取分组活跃度统计
export function getGroupStats() {
  return api.get('/groups/stats/overview')
}
