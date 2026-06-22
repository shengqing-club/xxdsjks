import axios from 'axios'

async function test() {
  // 登录import axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login',import axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password:import axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  constimport axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
import axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
  try {
    const r = await axios.put('http://localhost:8081/api/settingsimport axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
  try {
    const r = await axios.put('http://localhost:8081/api/settings/scrolling-text',
      { enabled: true, content: '测试字幕' }, { headersimport axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
  try {
    const r = await axios.put('http://localhost:8081/api/settings/scrolling-text',
      { enabled: true, content: '测试字幕' }, { headers })
    console.log('字幕保存成功:', r.data)
  } catch (e) {
    console.error('字幕保存失败import axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
  try {
    const r = await axios.put('http://localhost:8081/api/settings/scrolling-text',
      { enabled: true, content: '测试字幕' }, { headers })
    console.log('字幕保存成功:', r.data)
  } catch (e) {
    console.error('字幕保存失败:', e.response?.status, e.response?.dataimport axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
  try {
    const r = await axios.put('http://localhost:8081/api/settings/scrolling-text',
      { enabled: true, content: '测试字幕' }, { headers })
    console.log('字幕保存成功:', r.data)
  } catch (e) {
    console.error('字幕保存失败:', e.response?.status, e.response?.data)
  }

  // 测试import axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
  try {
    const r = await axios.put('http://localhost:8081/api/settings/scrolling-text',
      { enabled: true, content: '测试字幕' }, { headers })
    console.log('字幕保存成功:', r.data)
  } catch (e) {
    console.error('字幕保存失败:', e.response?.status, e.response?.data)
  }

  // 测试保存全屏文字
  try {
    const r = await axios.put('http://localhostimport axios from 'axios'

async function test() {
  // 登录
  const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
    username: 'admin', password: 'admin123'
  })
  const token = loginRes.data.token
  const headers = { Authorization: `Bearer ${token}` }

  // 测试保存字幕
  try {
    const r = await axios.put('http://localhost:8081/api/settings/scrolling-text',
      { enabled: true, content: '测试字幕' }, { headers })
    console.log('字幕保存成功:', r.data)
  } catch (e) {
    console.error('字幕保存失败:', e.response?.status, e.response?.data)
  }

  // 测试保存全屏文字
  try {
    const r = await axios.put('http://localhost:8081/api/settings/fullscreen-text',
      { enabled: false, content: '测试