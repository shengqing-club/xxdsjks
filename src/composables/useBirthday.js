import { ref, onMounted, onUnmounted } from 'vue'

const isBirthday = ref(false)
let initialized = false

function checkBirthday() {
  const now = new Date()
  isBirthday.value = (now.getMonth() === 5 && now.getDate() === 25)
}

export function useBirthday() {
  onMounted(() => {
    if (!initialized) {
      checkBirthday()
      initialized = true
    }
  })

  return { isBirthday }
}
