import api from './index'

export const getRewards = () => api.get('/rewards')

export const addReward = (data) => api.post('/rewards', data)

export const deleteReward = (id) => api.delete(`/rewards/${id}`)
