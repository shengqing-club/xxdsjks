<script setup>
import { onMounted } from 'vue'

onMounted(() => {
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
/* ===== CSS 变量体系：亮色/暗色主题 ===== */
:root {
  --bg-primary: #f0f5ff;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f1f5f9;
  --bg-hover: #eff6ff;
  --bg-card: #ffffff;
  --bg-input: #ffffff;
  --text-primary: #1e293b;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --text-on-primary: #ffffff;
  --border-color: #e8ecf4;
  --border-light: #f1f5f9;
  --shadow-color: rgba(30, 64, 175, 0.08);
  --shadow-heavy: rgba(30, 64, 175, 0.15);
  --accent: #1a56db;
  --accent-light: #3b82f6;
  --accent-bg: #eff6ff;
  --danger: #dc2626;
  --success: #16a34a;
  --warning: #d97706;
  --info: #2563eb;
  --header-bg: linear-gradient(90deg, #1a56db 0%, #1e40af 100%);
  --header-text: #ffffff;
  --sidebar-bg: #ffffff;
  --sidebar-active-bg: #eff6ff;
  --sidebar-hover-bg: #f1f5f9;
  --dialog-bg: #ffffff;
  --overlay-bg: rgba(0, 0, 0, 0.5);
  --code-bg: #f1f5f9;
  --scrollbar-thumb: #cbd5e1;
  --scrollbar-track: transparent;
}

html.dark {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-tertiary: #334155;
  --bg-hover: #334155;
  --bg-card: #1e293b;
  --bg-input: #334155;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --text-on-primary: #ffffff;
  --border-color: #334155;
  --border-light: #1e293b;
  --shadow-color: rgba(0, 0, 0, 0.3);
  --shadow-heavy: rgba(0, 0, 0, 0.5);
  --accent: #60a5fa;
  --accent-light: #93c5fd;
  --accent-bg: #1e3a5f;
  --danger: #f87171;
  --success: #4ade80;
  --warning: #fbbf24;
  --info: #60a5fa;
  --header-bg: linear-gradient(90deg, #1e3a5f 0%, #1e293b 100%);
  --header-text: #e2e8f0;
  --sidebar-bg: #1e293b;
  --sidebar-active-bg: #1e3a5f;
  --sidebar-hover-bg: #334155;
  --dialog-bg: #1e293b;
  --overlay-bg: rgba(0, 0, 0, 0.7);
  --code-bg: #334155;
  --scrollbar-thumb: #475569;
  --scrollbar-track: transparent;
}

/* 全局基础样式 */
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  overscroll-behavior: none;
}

html {
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

body {
  min-height: 100%;
  overflow-x: hidden;
}

#app {
  min-height: 100%;
}

/* 暗色模式全局覆盖 */
html.dark body {
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Element Plus 暗色模式覆盖 */
html.dark .el-card {
  --el-card-bg-color: var(--bg-card);
  border-color: var(--border-color);
}
html.dark .el-table {
  --el-table-bg-color: var(--bg-card);
  --el-table-tr-bg-color: var(--bg-card);
  --el-table-header-bg-color: var(--bg-tertiary);
  --el-table-row-hover-bg-color: var(--bg-hover);
  --el-table-border-color: var(--border-color);
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-secondary);
  color: var(--text-primary);
}
html.dark .el-table__inner-wrapper::before {
  background-color: var(--border-color);
}
html.dark .el-form-item__label {
  color: var(--text-secondary);
}
html.dark .el-input__wrapper,
html.dark .el-textarea__inner,
html.dark .el-select .el-input__wrapper {
  background-color: var(--bg-input);
  box-shadow: 0 0 0 1px var(--border-color) inset;
}
html.dark .el-input__inner,
html.dark .el-textarea__inner {
  color: var(--text-primary);
}
html.dark .el-dialog {
  --el-dialog-bg-color: var(--dialog-bg);
}
html.dark .el-dialog__header {
  color: var(--text-primary);
}
html.dark .el-dialog__title {
  color: var(--text-primary);
}
html.dark .el-dropdown-menu {
  background-color: var(--bg-card);
  border-color: var(--border-color);
}
html.dark .el-dropdown-menu__item {
  color: var(--text-primary);
}
html.dark .el-dropdown-menu__item:hover {
  background-color: var(--bg-hover);
}
html.dark .el-menu {
  background-color: var(--sidebar-bg);
  border-right-color: var(--border-color);
}
html.dark .el-menu-item {
  color: var(--text-secondary);
}
html.dark .el-menu-item.is-active {
  color: var(--accent);
}
html.dark .el-menu-item:hover {
  background-color: var(--sidebar-hover-bg);
}
html.dark .el-tag {
  --el-tag-bg-color: var(--bg-tertiary);
  --el-tag-border-color: var(--border-color);
  --el-tag-text-color: var(--text-secondary);
}
html.dark .el-button--default {
  --el-button-bg-color: var(--bg-tertiary);
  --el-button-border-color: var(--border-color);
  --el-button-text-color: var(--text-primary);
  --el-button-hover-bg-color: var(--bg-hover);
  --el-button-hover-border-color: var(--accent);
  --el-button-hover-text-color: var(--accent);
}
html.dark .el-pagination {
  --el-pagination-bg-color: var(--bg-tertiary);
  --el-pagination-text-color: var(--text-secondary);
  --el-pagination-button-bg-color: var(--bg-card);
  --el-pagination-button-color: var(--text-primary);
  --el-pagination-hover-color: var(--accent);
}
html.dark .el-descriptions {
  --el-descriptions-table-border: var(--border-color);
}
html.dark .el-descriptions__label {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
}
html.dark .el-descriptions__content {
  color: var(--text-primary);
}
html.dark .el-message-box {
  --el-messagebox-bg-color: var(--dialog-bg);
}
html.dark .el-message-box__title {
  color: var(--text-primary);
}
html.dark .el-popover {
  background-color: var(--bg-card);
  border-color: var(--border-color);
}
html.dark .el-loading-mask {
  background-color: var(--overlay-bg);
}
html.dark .el-empty__description p {
  color: var(--text-muted);
}
html.dark .el-tabs__item {
  color: var(--text-secondary);
}
html.dark .el-tabs__item.is-active {
  color: var(--accent);
}
html.dark .el-tabs__active-bar {
  background-color: var(--accent);
}
html.dark .el-tabs__nav-wrap::after {
  background-color: var(--border-color);
}
html.dark .el-date-editor .el-input__wrapper {
  background-color: var(--bg-input);
}
html.dark .el-overlay {
  background-color: var(--overlay-bg);
}

/* 滚动条暗色 */
html.dark ::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
}
html.dark ::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}
</style>
