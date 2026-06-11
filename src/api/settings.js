import api from './index'

export const getScrollingText = () => api.get('/settings/scrolling-text')

export const updateScrollingText = (data) => api.put('/settings/scrolling-text', data)

export const getFullscreenText = () => api.get('/settings/fullscreen-text')

export const updateFullscreenText = (data) => api.put('/settings/fullscreen-text', data)
