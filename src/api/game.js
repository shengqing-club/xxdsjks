// 游戏 API
import api from './index'

/** 提交游戏分数（经典/限时/禅意模式） */
export function submitScore(data) {
  return api.post('/game/submit', data)
}

// ========== 道具/金币 API ==========

/** 获取用户金币 */
export function getUserGold() {
  return api.get('/game/coins')
}

/** 获取用户道具库存 */
export function getUserItems() {
  return api.get('/game/my-items')
}

/** 同步本地数据到服务端 */
export function syncGameData(data) {
  return api.post('/game/sync', data)
}

/** 购买道具 */
export function purchaseItem(data) {
  return api.post('/game/purchase', data)
}

/** 使用道具 */
export function useGameItem(data) {
  return api.post('/game/use-item', data)
}

/** 添加金币（副本奖励） */
export function addGameGold(data) {
  return api.post('/game/add-gold', data)
}

/** 获取排行榜 */
export function getLeaderboard(params) {
  return api.get('/game/leaderboard', { params })
}

/** 提交游戏结果（一站式：分数+排位，已废弃，改用 submitScore） */
export function submitGameResult(data) {
  return api.post('/game/submit', data)
}

// ========== 排位赛 API ==========

/** 获取排位赛对手 */
export function getRankedOpponent() {
  return api.get('/game/ranked/opponent')
}

/** 提交排位赛结果 */
export function submitRankedMatch(data) {
  return api.post('/game/ranked/submit', data)
}

// ========== 排位系统 API ==========

/** 获取我的排位信息 */
export function getMyRank() {
  return api.get('/rank/my')
}

/** 获取排位排行榜 */
export function getRankLeaderboard(params) {
  return api.get('/rank/leaderboard', { params })
}

/** 获取王者榜单 */
export function getTopKings() {
  return api.get('/rank/top-kings')
}

/** 获取排位历史 */
export function getRankHistory(params) {
  return api.get('/rank/history', { params })
}

/** 更新排位积分 */
export function updateRank(data) {
  return api.post('/rank/update', data)
}

// ========== 管理端 API ==========

/** 获取游戏设置 */
export function getGameSettings() {
  return api.get('/game/settings')
}

/** 保存游戏设置 */
export function saveGameSettings(data) {
  return api.put('/game/settings', data)
}

/** 获取赛季信息 */
export function getSeasonInfo() {
  return api.get('/rank/season')
}

/** 更新赛季设置 */
export function updateSeason(data) {
  return api.put('/rank/season', data)
}

/** 重置赛季 */
export function resetSeason() {
  return api.post('/rank/season/reset')
}

// ========== 游戏通告 API ==========

/** 获取活跃通告（游戏内展示） */
export function getActiveAnnouncements() {
  return api.get('/game/announcements/active')
}

/** 获取所有通告（管理端） */
export function getAnnouncements() {
  return api.get('/game/announcements')
}

/** 创建通告 */
export function createAnnouncement(data) {
  return api.post('/game/announcements', data)
}

/** 更新通告 */
export function updateAnnouncement(id, data) {
  return api.put(`/game/announcements/${id}`, data)
}

/** 删除通告 */
export function deleteAnnouncement(id) {
  return api.delete(`/game/announcements/${id}`)
}

// ========== 管理端派发 API ==========

/** 获取用户列表（用于派发道具/金币） */
export function getAdminUserList(params) {
  return api.get('/game/admin/users', { params })
}

/** 管理员派发道具/金币 */
export function adminDistribute(data) {
  return api.post('/game/admin/distribute', data)
}