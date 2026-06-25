<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { getActiveAnnouncements } from '../api/announcement'
import { useBirthday } from '../composables/useBirthday'

const { isBirthday } = useBirthday()

const announcements = ref([])
const currentIndex = ref(0)
let timer = null

// 生日覆盖公告文字
const birthdayText = '🎂🎉 祝愿白雨轩生日快乐！！ 🎉🎂'
const displayText = computed(() => {
  if (isBirthday.value) return birthdayText
  const a = announcements.value[currentIndex.value]
  if (!a) return ''
  return `${a.title} — ${a.content}`
})

const fetchAnnouncements = async () => {
  try {
    const res = await getActiveAnnouncements()
    announcements.value = res.data || res || []
  } catch (e) {
    console.error('公告刷新失败', e)
  }
}

const startTimer = () => {
  if (timer) clearInterval(timer)
  if (announcements.value.length > 1) {
    timer = setInterval(() => {
      currentIndex.value = (currentIndex.value + 1) % announcements.value.length
    }, 5000)
  }
}

const refresh = async () => {
  currentIndex.value = 0
  await fetchAnnouncements()
  startTimer()
}

onMounted(async () => {
  await refresh()
  window.addEventListener('announcement-changed', refresh)
  // 保底：每30秒自动刷新一次
  timer = setInterval(() => { fetchAnnouncements(); startTimer() }, 30000)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('announcement-changed', refresh)
})
</script>

<template>
  <div v-if="announcements.length || isBirthday" class="announce-bar" :class="{ 'birthday-bar': isBirthday }">
    <div class="bar-inner">
      <span class="bar-icon">{{ isBirthday ? '🎂' : '📢' }}</span>
      <div class="marquee-wrapper">
        <span class="marquee-text" :key="currentIndex">
          {{ displayText }}
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
.birthday-bar {
  background: linear-gradient(90deg, #fff0f5 0%, #ffe4ec 50%, #fff9e6 100%);
  border-bottom-color: #ffc0cb;
}
.birthday-bar .marquee-text {
  color: #e75480;
  font-weight: 700;
  font-size: 14px;
}

@media (max-width: 768px) {
  .bar-inner { padding: 0 12px; gap: 6px; }
  .marquee-text { font-size: 12px; }
  .birthday-bar .marquee-text { font-size: 13px; }
}
</style>
