<template>
  <div class="game-settings-page">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">🎮 游戏参数设置</span>
          <el-button v-if="activeTab !== 'announce'" type="primary" @click="saveSettings" :loading="saving">保存设置</el-button>
          <el-button v-else type="primary" @click="showCreateAnnDialog = true">发布通告</el-button>
        </div>
      </template>

      <div class="settings-tabs">
        <el-tabs v-model="activeTab" type="border-card">
          <!-- 物理参数 -->
          <el-tab-pane label="物理参数" name="physics">
            <el-form :model="form" label-width="150px" label-position="left">
              <el-form-item label="重力加速度">
                <el-slider v-model="form.gravity" :min="0.5" :max="3" :step="0.1" show-input />
                <span class="form-hint">数值越大，泡泡下落越快</span>
              </el-form-item>
              <el-form-item label="弹性系数">
                <el-slider v-model="form.restitution" :min="0.1" :max="1" :step="0.05" show-input />
                <span class="form-hint">碰撞弹力，越高弹得越远</span>
              </el-form-item>
              <el-form-item label="表面摩擦">
                <el-slider v-model="form.friction" :min="0.01" :max="0.3" :step="0.01" show-input />
                <span class="form-hint">泡泡间摩擦，影响滚动速度</span>
              </el-form-item>
              <el-form-item label="空气阻力">
                <el-slider v-model="form.frictionAir" :min="0.005" :max="0.1" :step="0.005" show-input />
                <span class="form-hint">影响泡泡飞行距离</span>
              </el-form-item>
              <el-form-item label="发射速度">
                <el-slider v-model="form.launchSpeed" :min="6" :max="20" :step="1" show-input />
                <span class="form-hint">泡泡发射的初速度</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 游戏规则 -->
          <el-tab-pane label="游戏规则" name="rules">
            <el-form :model="form" label-width="150px" label-position="left">
              <el-form-item label="切换泡泡次数">
                <el-input-number v-model="form.swapCount" :min="0" :max="10" :step="1" />
                <span class="form-hint">每局可切换泡泡的次数，0=禁用</span>
              </el-form-item>
              <el-form-item label="警戒线Y坐标">
                <el-slider v-model="form.dangerLineY" :min="40" :max="200" :step="10" show-input />
                <span class="form-hint">泡泡超过此线进入危险状态</span>
              </el-form-item>
              <el-form-item label="越线超时(秒)">
                <el-slider v-model="form.dangerTimeout" :min="0.5" :max="5" :step="0.5" show-input />
                <span class="form-hint">泡泡超过警戒线多久后判负</span>
              </el-form-item>
              <el-form-item label="重力反转持续(秒)">
                <el-slider v-model="form.gravityFlipDuration" :min="2" :max="15" :step="1" show-input />
                <span class="form-hint">道具"重力反转"持续时间</span>
              </el-form-item>
              <el-form-item label="时间停止持续(秒)">
                <el-slider v-model="form.timeStopDuration" :min="2" :max="15" :step="1" show-input />
                <span class="form-hint">道具"时间停止"持续时间</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 副本模式 -->
          <el-tab-pane label="副本模式" name="dungeon">
            <el-form :model="form" label-width="150px" label-position="left">
              <el-form-item label="怪物移动速度倍率">
                <el-slider v-model="form.dungeonSpeedMult" :min="0.3" :max="3" :step="0.1" show-input />
                <span class="form-hint">副本怪物移动速度倍率，1=正常</span>
              </el-form-item>
              <el-form-item label="怪物基础血量倍率">
                <el-slider v-model="form.dungeonHpMult" :min="0.5" :max="5" :step="0.1" show-input />
                <span class="form-hint">副本怪物血量倍率，1=正常</span>
              </el-form-item>
              <el-form-item label="金币掉落倍率">
                <el-slider v-model="form.dungeonGoldMult" :min="0.5" :max="5" :step="0.1" show-input />
                <span class="form-hint">副本金币掉落倍率，1=正常</span>
              </el-form-item>
              <el-form-item label="通关奖励金币">
                <el-input-number v-model="form.dungeonClearGold" :min="100" :max="10000" :step="100" />
                <span class="form-hint">通关后奖励金币</span>
              </el-form-item>
              <el-form-item label="最大波次">
                <el-input-number v-model="form.dungeonMaxWave" :min="5" :max="30" :step="1" />
                <span class="form-hint">副本总波次数，通关后结束</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 双彩虹融合 -->
          <el-tab-pane label="🌈 双彩虹融合" name="fusion">
            <el-form :model="form" label-width="150px" label-position="left">
              <el-form-item label="融合清除半径">
                <el-slider v-model="form.fusionRadius" :min="100" :max="400" :step="10" show-input />
                <span class="form-hint">双彩虹融合时清除泡泡的范围</span>
              </el-form-item>
              <el-form-item label="融合基础分数">
                <el-input-number v-model="form.fusionBaseScore" :min="1000" :max="20000" :step="500" />
                <span class="form-hint">融合时的基础得分</span>
              </el-form-item>
              <el-form-item label="融合额外分数(每泡泡)">
                <el-input-number v-model="form.fusionBonusPerBubble" :min="50" :max="1000" :step="50" />
                <span class="form-hint">每个被清除的泡泡额外得分</span>
              </el-form-item>
              <el-form-item label="融合基础伤害">
                <el-input-number v-model="form.fusionBaseDamage" :min="2000" :max="50000" :step="1000" />
                <span class="form-hint">副本中融合对怪物造成的基础伤害</span>
              </el-form-item>
              <el-form-item label="慢动作时长(秒)">
                <el-slider v-model="form.fusionSlowMo" :min="0.2" :max="2" :step="0.1" show-input />
                <span class="form-hint">双彩虹融合时慢动作持续时间</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 得分倍率 -->
          <el-tab-pane label="得分倍率" name="score">
            <el-form :model="form" label-width="150px" label-position="left">
              <el-form-item label="全局得分倍率">
                <el-slider v-model="form.scoreMultiplier" :min="0.5" :max="5" :step="0.1" show-input />
                <span class="form-hint">所有得分乘以该系数，1.0=正常</span>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- 游戏公告 + 道具派发 -->
          <el-tab-pane label="📢 游戏公告" name="announce">
            <el-tabs v-model="annTab" type="card">
              <el-tab-pane label="通告列表" name="annList">
                <el-table :data="announcements" border stripe style="width:100%" v-loading="annLoading">
                  <el-table-column prop="id" label="ID" width="60" />
                  <el-table-column prop="title" label="标题" min-width="150" />
                  <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="ann_type" label="类型" width="90">
                    <template #default="{ row }">
                      <el-tag :type="annTypeTag(row.ann_type)" size="small">{{ annTypeLabel(row.ann_type) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="show_in_game" label="游戏内显示" width="100">
                    <template #default="{ row }">
                      <el-switch :model-value="row.show_in_game" @change="toggleAnnShow(row)" />
                    </template>
                  </el-table-column>
                  <el-table-column prop="is_active" label="启用" width="70">
                    <template #default="{ row }">
                      <el-switch :model-value="row.is_active" @change="toggleAnnActive(row)" />
                    </template>
                  </el-table-column>
                  <el-table-column prop="created_at" label="创建时间" width="160">
                    <template #default="{ row }">{{ fmtTime(row.created_at) }}</template>
                  </el-table-column>
                  <el-table-column label="操作" width="80" fixed="right">
                    <template #default="{ row }">
                      <el-button type="danger" size="small" @click="deleteAnn(row.id)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="道具/金币派发" name="annDist">
                <div class="distribute-section">
                  <el-alert title="向指定用户发放道具或金币" type="info" :closable="false" style="margin-bottom:16px" />
                  <el-form :model="distForm" label-width="100px" label-position="left">
                    <el-form-item label="目标用户">
                      <el-select
                        v-model="distForm.targetUser"
                        filterable
                        remote
                        reserve-keyword
                        placeholder="搜索用户（输入姓名或学号/账号）"
                        :remote-method="searchUsers"
                        :loading="userSearching"
                        style="width:100%"
                        value-key="id"
                      >
                        <el-option
                          v-for="u in userOptions"
                          :key="u.role + '_' + u.id"
                          :label="`${u.display_name || u.username} (${u.username}) [${u.role === 'admin' ? '管理员' : '学生'}]`"
                          :value="JSON.stringify(u)"
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="发放金币">
                      <el-input-number v-model="distForm.gold" :min="0" :max="100000" :step="100" />
                      <span class="form-hint">输入0表示不发放金币</span>
                    </el-form-item>
                    <el-form-item label="发放道具">
                      <el-select v-model="distForm.itemId" placeholder="选择道具（可不选）" clearable style="width:100%">
                        <el-option v-for="item in allItems" :key="item.id" :label="`${item.icon} ${item.name} - ${item.desc}`" :value="item.id" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="道具数量" v-if="distForm.itemId">
                      <el-input-number v-model="distForm.itemCount" :min="1" :max="999" :step="1" />
                    </el-form-item>
                    <el-form-item label="发放原因">
                      <el-input v-model="distForm.reason" placeholder="如：活动奖励、补偿发放等" />
                    </el-form-item>
                    <el-form-item>
                      <el-button type="primary" @click="doDistribute" :loading="distributing" :disabled="!distForm.targetUser">
                        确认发放
                      </el-button>
                    </el-form-item>
                  </el-form>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-tab-pane>

          <!-- 体验游戏 -->
          <el-tab-pane label="体验游戏" name="play">
            <div class="play-section">
              <p class="play-hint">以当前参数设置体验游戏，测试参数效果</p>
              <BubbleWorkshop :gameSettings="form" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>

    <!-- 创建通告对话框 -->
    <el-dialog v-model="showCreateAnnDialog" title="发布游戏通告" width="550px" :close-on-click-modal="false">
      <el-form :model="createAnnForm" label-width="90px" label-position="left">
        <el-form-item label="标题" required>
          <el-input v-model="createAnnForm.title" placeholder="通告标题" maxlength="100" />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input v-model="createAnnForm.content" type="textarea" :rows="4" placeholder="通告内容" maxlength="500" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="createAnnForm.ann_type">
            <el-radio value="notice">通知</el-radio>
            <el-radio value="event">活动</el-radio>
            <el-radio value="reward">奖励</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="游戏内显示">
          <el-switch v-model="createAnnForm.show_in_game" />
        </el-form-item>
        <el-form-item label="生效时间">
          <el-date-picker v-model="createAnnForm.start_time" type="datetime" placeholder="留空即立即生效" format="YYYY-MM-DD HH:mm" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
        <el-form-item label="失效时间">
          <el-date-picker v-model="createAnnForm.end_time" type="datetime" placeholder="留空即永久有效" format="YYYY-MM-DD HH:mm" value-format="YYYY-MM-DD HH:mm:ss" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateAnnDialog = false">取消</el-button>
        <el-button type="primary" @click="doCreateAnn" :loading="creatingAnn">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getGameSettings, saveGameSettings,
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getAdminUserList, adminDistribute,
} from '../../api/game.js'
import { ITEM_SHOP } from '../../game/config.js'
import BubbleWorkshop from '../../components/BubbleWorkshop.vue'

const activeTab = ref('physics')
const saving = ref(false)

const form = ref({
  gravity: 1.2,
  restitution: 0.4,
  friction: 0.05,
  frictionAir: 0.01,
  launchSpeed: 12,
  swapCount: 3,
  dangerLineY: 80,
  dangerTimeout: 1.5,
  gravityFlipDuration: 5,
  timeStopDuration: 8,
  scoreMultiplier: 1.0,
  // 副本
  dungeonSpeedMult: 1.0,
  dungeonHpMult: 1.0,
  dungeonGoldMult: 1.0,
  dungeonClearGold: 500,
  dungeonMaxWave: 15,
  // 双彩虹融合
  fusionRadius: 250,
  fusionBaseScore: 5000,
  fusionBonusPerBubble: 300,
  fusionBaseDamage: 8000,
  fusionSlowMo: 0.6,
})

// ========== 游戏参数 ==========
onMounted(() => {
  loadSettings()
  loadAnnouncements()
})

async function loadSettings() {
  try {
    const res = await getGameSettings()
    const data = res.data || {}
    for (const key of Object.keys(form.value)) {
      if (data[key] !== undefined) {
        form.value[key] = data[key]
      }
    }
  } catch (e) {
    console.warn('加载游戏参数失败:', e.message)
  }
}

async function saveSettings() {
  saving.value = true
  try {
    await saveGameSettings(form.value)
    ElMessage.success('游戏参数保存成功！下次游戏将使用新参数')
  } catch (e) {
    ElMessage.error('保存失败: ' + (e.response?.data?.message || e.message))
  } finally {
    saving.value = false
  }
}

// ========== 游戏公告 ==========
const annTab = ref('annList')
const annLoading = ref(false)
const announcements = ref([])
const showCreateAnnDialog = ref(false)
const creatingAnn = ref(false)
const createAnnForm = ref({
  title: '', content: '', ann_type: 'notice', show_in_game: true,
  start_time: null, end_time: null,
})

// 道具派发
const allItems = ref(ITEM_SHOP)
const distForm = ref({ targetUser: null, gold: 0, itemId: null, itemCount: 1, reason: '' })
const userOptions = ref([])
const userSearching = ref(false)
const distributing = ref(false)

function annTypeLabel(t) { return { notice: '通知', event: '活动', reward: '奖励' }[t] || t }
function annTypeTag(t) { return { notice: 'info', event: 'warning', reward: 'success' }[t] || 'info' }
function fmtTime(t) { return t ? new Date(t).toLocaleString('zh-CN') : '' }

async function loadAnnouncements() {
  annLoading.value = true
  try {
    const res = await getAnnouncements()
    announcements.value = res.data || []
  } catch (e) {
    ElMessage.error('加载通告失败')
  } finally { annLoading.value = false }
}

async function doCreateAnn() {
  if (!createAnnForm.value.title || !createAnnForm.value.content) {
    ElMessage.warning('标题和内容不能为空')
    return
  }
  creatingAnn.value = true
  try {
    await createAnnouncement(createAnnForm.value)
    ElMessage.success('通告发布成功')
    showCreateAnnDialog.value = false
    createAnnForm.value = { title: '', content: '', ann_type: 'notice', show_in_game: true, start_time: null, end_time: null }
    loadAnnouncements()
  } catch (e) {
    ElMessage.error('发布失败: ' + (e.response?.data?.message || e.message))
  } finally { creatingAnn.value = false }
}

async function toggleAnnActive(row) {
  try {
    await updateAnnouncement(row.id, { is_active: !row.is_active })
    row.is_active = !row.is_active
    ElMessage.success(row.is_active ? '已启用' : '已停用')
  } catch (e) { ElMessage.error('操作失败') }
}

async function toggleAnnShow(row) {
  try {
    await updateAnnouncement(row.id, { show_in_game: !row.show_in_game })
    row.show_in_game = !row.show_in_game
    ElMessage.success(row.show_in_game ? '将在游戏内显示' : '已取消游戏内显示')
  } catch (e) { ElMessage.error('操作失败') }
}

async function deleteAnn(id) {
  try {
    await ElMessageBox.confirm('确定删除此通告？', '确认', { type: 'warning' })
    await deleteAnnouncement(id)
    ElMessage.success('已删除')
    loadAnnouncements()
  } catch (e) { /* 取消 */ }
}

async function searchUsers(query) {
  if (!query || query.length < 1) { userOptions.value = []; return }
  userSearching.value = true
  try {
    const res = await getAdminUserList({ search: query })
    userOptions.value = res.data || []
    if (userOptions.value.length === 0) {
      ElMessage.info('未找到匹配用户')
    }
  } catch (e) {
    ElMessage.error('搜索用户失败: ' + (e.response?.data?.message || e.message))
  } finally { userSearching.value = false }
}

async function doDistribute() {
  if (!distForm.value.targetUser) { ElMessage.warning('请选择目标用户'); return }
  const goldVal = Number(distForm.value.gold) || 0
  const hasItem = distForm.value.itemId && Number(distForm.value.itemCount) > 0
  // 至少需要发放金币或道具之一
  if (goldVal <= 0 && !hasItem) {
    ElMessage.warning('请至少输入发放金币数量或选择发放道具')
    return
  }
  const user = JSON.parse(distForm.value.targetUser)
  distributing.value = true
  try {
    await adminDistribute({
      targetUserId: user.id,
      targetUserName: user.display_name || user.username,
      itemId: hasItem ? distForm.value.itemId : null,
      itemCount: hasItem ? Number(distForm.value.itemCount) : 0,
      goldAdd: goldVal,
      reason: distForm.value.reason || '管理员发放',
    })
    ElMessage.success('发放成功')
    distForm.value = { targetUser: null, gold: 0, itemId: null, itemCount: 1, reason: '' }
  } catch (e) {
    ElMessage.error('发放失败: ' + (e.response?.data?.message || e.message))
  } finally { distributing.value = false }
}
</script>

<style scoped>
.game-settings-page {
  padding: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.settings-card {
  border-radius: 12px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.settings-tabs {
  margin-top: 0;
}

.form-hint {
  display: block;
  font-size: 0.75rem;
  color: #999;
  margin-top: 4px;
  line-height: 1.4;
}

.play-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.play-hint {
  font-size: 0.82rem;
  color: #999;
  margin: 0 0 16px;
  text-align: center;
}

.distribute-section {
  padding: 8px 0;
}

:deep(.el-tabs__content) {
  padding: 20px;
}

:deep(.el-slider) {
  max-width: 300px;
}

:deep(.el-input-number) {
  width: 160px;
}
</style>