<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // 从 localStorage 读取主题设置
  const darkMode = localStorage.getItem('darkMode') === 'true'
  if (darkMode) {
    document.documentElement.classList.add('dark')
  }
})
</script>
<template>
  <router-view />
</template>

<style>
/* 暗色模式全局样式 */
html.dark {
  filter: invert(1) hue-rotate(180deg);
}
html.dark img,
html.dark video,
html.dark canvas,
html.dark .el-avatar,
html.dark .photo-img,
html.dark .el-image-viewer__canvas img {
  filter: invert(1) hue-rotate(180deg);
}
html.dark .el-dialog,
html.dark .el-message-box,
html.dark .el-dropdown-menu,
html.dark .el-popover,
html.dark .el-tooltip__popper {
  filter: invert(1) hue-rotate(180deg);
}
</style>
