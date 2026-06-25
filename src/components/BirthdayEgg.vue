<template>
  <!-- Birthday notification overlay -->
  <Teleport to="body">
    <Transition name="birthday-fade">
      <div v-if="showNotification" class="birthday-overlay" @click="closeNotification">
        <div class="birthday-card" @click.stop>
          <div class="birthday-confetti">🎂🎉🎊🥳🎈</div>
          <div class="birthday-notify-item" v-for="(msg, i) in birthdayMessages" :key="i">
            <span class="notify-icon">📢</span>
            <span class="notify-text">{{ msg }}</span>
          </div>
          <button class="birthday-close-btn" @click="closeNotification">我知道了 ✨</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const showNotification = ref(false)
const birthdayMessages = [
  '系统通知：检测到今日为系统管理员生日，所有人实践考试满分！！',
  '系统通知：祝愿白雨轩生日快乐！！！🎂🎂🎂'
]

const isBirthday = () => {
  const now = new Date()
  return now.getMonth() === 5 && now.getDate() === 25 // June is month 5 (0-indexed)
}

const closeNotification = () => {
  showNotification.value = false
  localStorage.setItem('birthday_seen_2026', '1')
  // 触发 confetti 烟花效果
  triggerConfetti()
}

const triggerConfetti = () => {
  // 动态加载 canvas-confetti
  const script = document.createElement('script')
  script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
  script.onload = () => {
    if (typeof window.confetti === 'function') {
      // 多次发射烟花
      const duration = 3000
      const end = Date.now() + duration
      const colors = ['#ff6b9d', '#ffd700', '#ff8e53', '#60a5fa', '#a78bfa', '#34d399']
      
      const frame = () => {
        window.confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.7 },
          colors
        })
        window.confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.7 },
          colors
        })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
    }
  }
  document.head.appendChild(script)
}

onMounted(() => {
  if (isBirthday() && !localStorage.getItem('birthday_seen_2026')) {
    // Delay 1.5s after mount for smooth entrance
    setTimeout(() => {
      showNotification.value = true
    }, 1500)
  }
})

// Expose for parent to trigger manually if needed
defineExpose({ isBirthday })
</script>

<style scoped>
.birthday-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99998;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.4s ease;
}

.birthday-card {
  background: linear-gradient(135deg, #fff9e6 0%, #fff0f5 50%, #f0f8ff 100%);
  border-radius: 20px;
  padding: 40px 36px;
  max-width: 480px;
  width: 90%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 0 40px rgba(255, 182, 193, 0.3);
  animation: cardBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  text-align: center;
}

.birthday-confetti {
  font-size: 36px;
  margin-bottom: 24px;
  animation: confettiBounce 1s ease infinite;
  letter-spacing: 8px;
}

.birthday-notify-item {
  background: rgba(255, 255, 255, 0.7);
  border-left: 4px solid #ff6b9d;
  border-radius: 8px;
  padding: 14px 18px;
  margin-bottom: 14px;
  text-align: left;
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  backdrop-filter: blur(4px);
}

.notify-icon {
  margin-right: 8px;
}

.notify-text {
  font-weight: 500;
}

.birthday-close-btn {
  margin-top: 20px;
  padding: 12px 36px;
  background: linear-gradient(135deg, #ff6b9d, #ff8e53);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(255, 107, 157, 0.4);
}

.birthday-close-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(255, 107, 157, 0.5);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes cardBounce {
  from { transform: scale(0.3) translateY(100px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes confettiBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.birthday-fade-enter-active { animation: fadeIn 0.4s ease; }
.birthday-fade-leave-active { animation: fadeIn 0.3s ease reverse; }
</style>
