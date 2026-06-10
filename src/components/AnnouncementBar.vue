<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { getActiveAnnouncements } from '../api/announcement'

const announcements = ref([])
const currentIndex = ref(0)
let timer = null

onMounted(async () => {
  try {
    const res = await getActiveAnnouncements()
    announcements.value = res.data || res || []
  } catch { /* 静默处理 */ }
  if (announcements.value.length > 1) {
    timer = setInterval(() => {
      currentIndex.value = (currentIndex.value + 1) % announcements.value.length
    }, 5000)
  }
})

onBeforeUnmount(() => {
  clearInterval(timer)
})
</script>

<template>
  <div v-if="announcements.length" class="announce-bar">
    <div class="bar-inner">
      <span class="bar-icon">📢</span>
      <div class="marquee-wrapper">
        <span class="marquee-text" :key="currentIndex">
          {{ announcements[currentIndex]?.title }} — {{ announcements[currentIndex]?.content }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.announce-bar {
  height: 40px;
  background: linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%);
  border-bottom: 1px solid #bfdbfe;
  display: flex;
  align-items: center;
  overflow: hidden;
  flex-shrink: 0;
}
.bar-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 24px;
  width: 100%;
}
.bar-icon {
  font-size: 16px;
  flex-shrink: 0;
}
.marquee-wrapper {
  flex: 1;
  overflow: hidden;
}
.marquee-text {
  display: inline-block;
  font-size: 13px;
  color: #1e40af;
  font-weight: 500;
  white-space: nowrap;
  animation: slideIn 0.3s ease;
}
@keyframes slideIn {
  from { transform: translateX(40px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
</style>
