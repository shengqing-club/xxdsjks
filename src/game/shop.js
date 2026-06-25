/**
 * 泡泡工坊 V2 - 道具商店 & 背包管理
 * 支持 localStorage 本地存储 + 服务端数据库同步
 */

import { ITEM_SHOP } from './config.js'

const STORAGE_KEY_GOLD = 'bubble_workshop_gold'
const STORAGE_KEY_ITEMS = 'bubble_workshop_items'
const STORAGE_KEY_MILESTONE = 'bubble_workshop_milestone'
const STORAGE_KEY_SYNCED = 'bubble_workshop_synced'

class Shop {
  constructor() {
    this._listeners = []
    this._api = null  // 延迟绑定以避免循环依赖
  }

  /** 绑定 API 模块（由 Vue 组件调用） */
  bindApi(apiModule) {
    this._api = apiModule
  }

  /** 订阅变更通知 */
  onChange(fn) {
    this._listeners.push(fn)
    return () => {
      this._listeners = this._listeners.filter(f => f !== fn)
    }
  }

  _notify() {
    for (const fn of this._listeners) fn()
  }

  // ===== 金币 =====

  /** 获取金币余额 */
  getGold() {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEY_GOLD) || '0') || 0
    } catch { return 0 }
  }

  /** 设置金币余额 */
  _setGold(amount) {
    try {
      localStorage.setItem(STORAGE_KEY_GOLD, String(Math.max(0, amount)))
    } catch { /* ignore */ }
  }

  /** 增加金币 */
  addGold(amount) {
    const v = this.getGold() + amount
    this._setGold(v)
    this._notify()
    return v
  }

  /** 消耗金币（返回是否成功） */
  spendGold(amount) {
    const v = this.getGold()
    if (v < amount) return false
    this._setGold(v - amount)
    this._notify()
    return true
  }

  // ===== 道具背包 =====

  /** 获取背包 */
  getItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ITEMS)
      if (!raw) return this._defaultItems()
      return JSON.parse(raw)
    } catch { return this._defaultItems() }
  }

  _defaultItems() {
    const bag = {}
    for (const item of ITEM_SHOP) {
      bag[item.id] = 0
    }
    return bag
  }

  _saveItems(bag) {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(bag))
    } catch { /* ignore */ }
  }

  /** 获取某个道具数量 */
  getItemCount(itemId) {
    return this.getItems()[itemId] || 0
  }

  /** 增加道具 */
  addItem(itemId, count = 1) {
    const bag = this.getItems()
    bag[itemId] = (bag[itemId] || 0) + count
    this._saveItems(bag)
    this._notify()
  }

  /** 消耗道具（返回是否成功） */
  useItem(itemId) {
    const bag = this.getItems()
    if (!bag[itemId] || bag[itemId] <= 0) return false
    bag[itemId]--
    this._saveItems(bag)
    this._notify()
    return true
  }

  /** 购买道具 */
  buyItem(itemId) {
    const item = ITEM_SHOP.find(i => i.id === itemId)
    if (!item) return { success: false, error: '道具不存在' }
    if (!this.spendGold(item.price)) return { success: false, error: '金币不足' }
    this.addItem(itemId)
    return { success: true, item }
  }

  /** 获取道具信息 */
  getItemInfo(itemId) {
    return ITEM_SHOP.find(i => i.id === itemId) || null
  }

  /** 所有道具列表 */
  getShopList() {
    return ITEM_SHOP
  }

  // ===== 里程碑（已触达的分数段） =====

  getReachedMilestones() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_MILESTONE)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  markMilestone(score) {
    const reached = this.getReachedMilestones()
    if (!reached.includes(score)) {
      reached.push(score)
      try {
        localStorage.setItem(STORAGE_KEY_MILESTONE, JSON.stringify(reached))
      } catch { /* ignore */ }
    }
  }

  isMilestoneReached(score) {
    return this.getReachedMilestones().includes(score)
  }

  // ===== 服务端同步 =====

  /** 检查是否已同步过 */
  _hasSynced() {
    try {
      return localStorage.getItem(STORAGE_KEY_SYNCED) === '1'
    } catch { return false }
  }

  _markSynced() {
    try {
      localStorage.setItem(STORAGE_KEY_SYNCED, '1')
    } catch { /* ignore */ }
  }

  /** 从服务端加载数据并合并到本地 */
  async loadFromServer() {
    if (!this._api) return { gold: this.getGold(), items: this.getItems() }
    try {
      // 获取服务端数据
      const [goldRes, itemsRes] = await Promise.all([
        this._api.getUserGold().catch(() => ({ data: { gold: 0 } })),
        this._api.getUserItems().catch(() => ({ data: {} })),
      ])
      const serverGold = goldRes.data?.gold || 0
      const serverItems = itemsRes.data || {}

      // 合并策略：取最大值
      const localGold = this.getGold()
      const finalGold = Math.max(localGold, serverGold)
      this._setGold(finalGold)

      const localItems = this.getItems()
      for (const [itemId, count] of Object.entries(serverItems)) {
        localItems[itemId] = Math.max(localItems[itemId] || 0, count)
      }
      this._saveItems(localItems)

      // 同步本地新增数据到服务端
      if (!this._hasSynced()) {
        await this.syncToServer()
        this._markSynced()
      }

      this._notify()
      return { gold: finalGold, items: localItems }
    } catch {
      return { gold: this.getGold(), items: this.getItems() }
    }
  }

  /** 同步本地数据到服务端 */
  async syncToServer() {
    if (!this._api) return
    try {
      const localGold = this.getGold()
      const localItems = this.getItems()
      // 只同步非零数据
      const items = {}
      for (const [k, v] of Object.entries(localItems)) {
        if (v > 0) items[k] = v
      }
      await this._api.syncGameData({ gold: localGold, items })
    } catch { /* 静默失败 */ }
  }

  /** 在线购买道具 */
  async buyItemOnline(itemId) {
    const item = ITEM_SHOP.find(i => i.id === itemId)
    if (!item) return { success: false, error: '道具不存在' }

    // 先尝试服务端购买
    if (this._api) {
      try {
        const res = await this._api.purchaseItem({ itemId, price: item.price })
        if (res.data) {
          this._setGold(res.data.gold)
          this.addItem(itemId)
          return { success: true, item }
        }
      } catch (e) {
        // 服务端失败，降级到本地购买
        console.warn('服务端购买失败，使用本地:', e.message)
      }
    }

    // 本地购买（降级）
    return this.buyItem(itemId)
  }

  /** 在线使用道具 */
  async useItemOnline(itemId) {
    const result = this.useItem(itemId)
    if (!result) return false

    // 同步到服务端
    if (this._api) {
      try {
        await this._api.useGameItem({ itemId })
      } catch { /* 静默 */ }
    }
    return true
  }

  /** 在线添加金币 */
  async addGoldOnline(amount, reason) {
    this.addGold(amount)

    // 同步到服务端
    if (this._api) {
      try {
        await this._api.addGameGold({ amount, reason })
      } catch { /* 静默 */ }
    }
  }
}

export default new Shop()