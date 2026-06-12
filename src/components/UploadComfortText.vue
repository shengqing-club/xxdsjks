<template>
  <div v-if="visible" class="comfort-text">
    <el-icon class="comfort-icon"><Loading /></el-icon>
    <span class="comfort-message">{{ currentMessage }}</span>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const messages = [
  '正在努力上传中...',
  '大模型思考中...',
  '文件正在穿越网络...',
  '稍等片刻，马上就好...',
  '正在处理中，请耐心等待...',
  '数据正在飞速传输...',
  '正在为您保存文件...',
  '即将完成，请稍候...'
]

const currentMessage = ref(messages[0])
let interval = null

watch(() => props.visible, (val) => {
  if (val) {
    let idx = 0
    currentMessage.value = messages[0]
    interval = setInterval(() => {
      idx = (idx + 1) % messages.length
      currentMessage.value = messages[idx]
    }, 2500)
  } else {
    if (interval) clearInterval(interval)
  }
})

onUnmounted(() => {
  if (interval) clearInterval(interval)
})
</script>

<style scoped>
.comfort-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 12px;
  background: #f0f9ff;
  border-radius: 6px;
  color: #1a56db;
  font-size: 13px;
}
.comfort-icon {
  animation: rotate 1s linear infinite;
}
@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
