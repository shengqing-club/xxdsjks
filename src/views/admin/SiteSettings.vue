<template>
  <div class="site-settings-page">
    <div class="page-header">
      <h2 class="page-title">
        <el-icon><Setting /></el-icon>
        站点设置
      </h2>
    </div>

    <!-- 滚动字幕设置 -->
    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#1a56db"><ChatLineRound /></el-icon>
          <span class="card-title">滚动字幕设置</span>
        </div>
      </template>

      <el-form label-width="100px" class="settings-form">
        <el-form-item label="字幕开关">
          <el-switch
            v-model="scrollingEnabled"
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>

        <el-form-item label="字幕内容">
          <el-input
            v-model="scrollingContent"
            type="textarea"
            :rows="3"
            placeholder="请输入滚动字幕内容"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="显示模式">
          <el-radio-group v-model="scrollingMode">
            <el-radio value="normal">普通模式</el-radio>
            <el-radio value="warning">警告模式</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <div v-if="scrollingEnabled && scrollingContent" class="preview-section">
        <div class="preview-label">效果预览：</div>
        <div class="scrolling-banner" :class="scrollingMode === 'warning' ? 'banner-warning' : 'banner-normal'">
          <div class="scrolling-text">{{ scrollingContent }}</div>
        </div>
      </div>
    </el-card>

    <!-- 全屏文字设置 -->
    <el-card shadow="never" class="settings-card" style="margin-top: 20px;">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#1a56db"><FullScreen /></el-icon>
          <span class="card-title">全屏文字设置</span>
        </div>
      </template>

      <el-form label-width="100px" class="settings-form">
        <el-form-item label="显示开关">
          <el-switch
            v-model="fullscreenEnabled"
            active-text="开启"
            inactive-text="关闭"
          />
        </el-form-item>

        <el-form-item label="显示内容">
          <el-input
            v-model="fullscreenContent"
            type="textarea"
            :rows="4"
            placeholder="请输入全屏显示内容"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="字体风格">
          <el-radio-group v-model="fullscreenFont">
            <el-radio label="serif">宋体（正式）</el-radio>
            <el-radio label="kai">楷体（传统）</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>

      <div v-if="fullscreenEnabled && fullscreenContent" class="preview-section">
        <div class="preview-label">效果预览：</div>
        <div class="fullscreen-preview">
          <div class="fullscreen-text" :class="fullscreenFont === 'kai' ? 'font-kai' : 'font-song'">{{ fullscreenContent }}</div>
        </div>
      </div>
    </el-card>

    <div style="margin-top: 20px;">
      <el-button type="primary" :loading="saving" @click="handleSave">
        <el-icon><Check /></el-icon>
        保存设置
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Setting, ChatLineRound, Check, FullScreen } from '@element-plus/icons-vue'
import { getScrollingText, updateScrollingText, getFullscreenText, updateFullscreenText } from '../../api/settings'

const scrollingEnabled = ref(false)
const scrollingContent = ref('')
const scrollingMode = ref('normal')
const fullscreenEnabled = ref(false)
const fullscreenContent = ref('')
const fullscreenFont = ref('serif')
const saving = ref(false)

const loadSettings = async () => {
  try {
    const [scrollRes, fullRes] = await Promise.all([
      getScrollingText(),
      getFullscreenText()
    ])
    scrollingEnabled.value = scrollRes.data.enabled
    scrollingContent.value = scrollRes.data.content
    scrollingMode.value = scrollRes.data.mode || 'normal'
    fullscreenEnabled.value = fullRes.data.enabled
    fullscreenContent.value = fullRes.data.content
    fullscreenFont.value = fullRes.data.font || 'serif'
  } catch (err) {
    console.error('加载设置失败:', err)
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    await Promise.all([
      updateScrollingText({
        enabled: scrollingEnabled.value,
        content: scrollingContent.value,
        mode: scrollingMode.value
      }),
      updateFullscreenText({
        enabled: fullscreenEnabled.value,
        content: fullscreenContent.value,
        font: fullscreenFont.value
      })
    ])
    ElMessage.success('保存成功')
  } catch (err) {
    console.error('保存失败:', err)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped>
.site-settings-page {
  padding: 0;
}
.page-header {
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
.settings-card {
  border-radius: 8px;
  border: none;
}
.settings-card :deep(.el-card__header) {
  padding: 14px 20px;
  border-bottom: 1px solid #f1f5f9;
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
.settings-form {
  max-width: 600px;
}
.preview-section {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #f1f5f9;
}
.preview-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 10px;
}

/* 滚动字幕样式 */
.scrolling-banner {
  width: 100%;
  height: 40px;
  color: #fff;
  display: flex;
  align-items: center;
  overflow: hidden;
  border-radius: 6px;
  position: relative;
}
.banner-normal {
  background: linear-gradient(90deg, #1a56db, #1e40af);
}
.banner-warning {
  background: linear-gradient(90deg, #dc2626, #b91c1c);
  animation: warningPulse 2s ease-in-out infinite;
}
@keyframes warningPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}
.scrolling-text {
  white-space: nowrap;
  padding-left: 100%;
  animation: scroll-left 15s linear infinite;
  font-size: 14px;
  font-family: 'KaiTi', 'STKaiti', '楷体', serif;
}
@keyframes scroll-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-100%); }
}

/* 全屏文字预览 */
.fullscreen-preview {
  width: 100%;
  height: 220px;
  background: linear-gradient(135deg, #1a56db 0%, #1e40af 50%, #312e81 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  padding: 32px;
}
.fullscreen-text {
  font-size: 22px;
  color: #fff;
  text-align: center;
  font-weight: 600;
  line-height: 1.8;
  white-space: pre-wrap;
  letter-spacing: 4px;
}
.font-song {
  font-family: 'SimSun', 'STSong', '宋体', 'Noto Serif CJK SC', serif;
}
.font-kai {
  font-family: 'KaiTi', 'STKaiti', '楷体', 'Noto Serif CJK SC', serif;
}

@media (max-width: 768px) {
  .site-settings-page { padding: 0 4px; }
  .settings-form { max-width: 100%; }
  .settings-form :deep(.el-form-item__label) { float: none; display: block; text-align: left; padding-bottom: 4px; }
  .settings-form :deep(.el-form-item__content) { margin-left: 0 !important; }
  .settings-form :deep(.el-radio-group) { display: flex; flex-wrap: wrap; gap: 8px; }
  .fullscreen-preview { height: 160px; padding: 16px; }
  .fullscreen-text { font-size: 16px; letter-spacing: 2px; }
}
</style>
