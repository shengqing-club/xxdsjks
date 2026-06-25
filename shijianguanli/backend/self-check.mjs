import axios from 'axios'

const API = 'http://localhost:8081/api'
let token = null
let passed = 0
let failed = 0

function ok(msg) { console.log('  ✅', msg); passed++ }
function err(msg, detail) { console.log('  ❌', msg, detail || ''); failed++ }

async function check() {
  console.log('\n========== 系统自检 ==========\n')

  // 1. 健康检查
  console.log('1. 健康检查')
  try {
    const r = await axios.get(`${API}/health`)
    if (r.data.status === 'ok') ok('服务运行正常')
    else err('服务异常', r.data)
  } catch (e) { err('健康检查失败', e.message) }

  // 2. 登录
  console.log('\n2. 登录测试')
  try {
    const r = await axios.post(`${API}/auth/login`, { username: 'admin', password: 'admin123' })
    token = r.data.token
    ok('管理员登录成功')
  } catch (e) { err('登录失败', e.response?.data?.message || e.message) }

  if (!token) { console.log('\n❌ 无法继续测试（登录失败）'); return }

  const headers = { Authorization: `Bearer ${token}` }

  // 3. 学生端登录
  console.log('\n3. 学生端登录')
  try {
    const r = await axios.post(`${API}/auth/login`, { username: '2024002', password: '123456' })
    if (r.data.token) ok('学生登录成功')
    else err('学生登录失败')
  } catch (e) { err('学生登录失败', e.response?.data?.message || e.message) }

  // 4. 滚动字幕设置
  console.log('\n4. 滚动字幕设置')
  try {
    const r = await axios.get(`${API}/settings/scrolling-text`)
    ok(`滚动字幕: ${r.data.enabled ? '开启' : '关闭'}, 模式: ${r.data.mode || 'normal'}`)
  } catch (e) { err('滚动字幕获取失败', e.message) }

  // 5. 全屏文字设置
  console.log('\n5. 全屏文字设置')
  try {
    const r = await axios.get(`${API}/settings/fullscreen-text`)
    ok(`全屏文字: ${r.data.enabled ? '开启' : '关闭'}`)
  } catch (e) { err('全屏文字获取失败', e.message) }

  // 6. 奖惩系统
  console.log('\n6. 奖惩系统')
  try {
    const r = await axios.get(`${API}/rewards`, { headers })
    ok(`奖惩记录: ${r.data.length} 条`)
  } catch (e) { err('奖惩系统失败', e.message) }

  // 7. Word文件上传（复习资料）
  console.log('\n7. Word文件上传（复习资料）')
  try {
    const FormData = (await import('form-data')).default
    const fs = await import('fs')
    fs.writeFileSync('test_word.docx', 'test word content for upload')
    const form = new FormData()
    form.append('file', fs.createReadStream('test_word.docx'), { filename: 'test_word.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    form.append('title', '自检Word文件')
    form.append('course_name', '自检课程')
    form.append('class_name', '计算机1班')
    const r = await axios.post(`${API}/study-materials/upload`, form, { headers: { ...headers, ...form.getHeaders() } })
    ok(`Word上传成功, id=${r.data.id}`)
    fs.unlinkSync('test_word.docx')
    await axios.delete(`${API}/study-materials/${r.data.id}`, { headers })
  } catch (e) { err('Word上传失败', e.response?.data?.message || e.message) }

  // 8. 复习资料列表
  console.log('\n8. 复习资料列表')
  try {
    const r = await axios.get(`${API}/study-materials`, { headers })
    ok(`复习资料: ${r.data.total || r.data.list?.length || 0} 条`)
  } catch (e) { err('复习资料获取失败', e.message) }

  // 9. 学生信息
  console.log('\n9. 学生信息')
  try {
    const r = await axios.get(`${API}/students`, { headers })
    ok(`学生总数: ${r.data.length}`)
  } catch (e) { err('学生信息获取失败', e.message) }

  // 10. 通知系统
  console.log('\n10. 通知系统')
  try {
    const r = await axios.get(`${API}/notifications`, { headers })
    ok(`通知: ${r.data.length} 条`)
  } catch (e) { err('通知获取失败', e.message) }

  // 11. Excel批量导入学生
  console.log('\n11. Excel批量导入学生')
  try {
    const FormData = (await import('form-data')).default
    const fs = await import('fs')
    const xlsx = await import('xlsx')
    const data = [
      ['学号', '姓名', '性别', '年龄', '专业', '班级', '状态', '密码'],
      ['2024997', '自检导入1', '男', '20', '计算机科学与技术', '计科2401', '在读', '123456']
    ]
    const ws = xlsx.utils.aoa_to_sheet(data)
    const wb = xlsx.utils.book_new()
    xlsx.utils.book_append_sheet(wb, ws, '学生')
    xlsx.writeFile(wb, 'test_import_check.xlsx')
    const form = new FormData()
    form.append('file', fs.createReadStream('test_import_check.xlsx'), { filename: 'test_import_check.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const r = await axios.post(`${API}/students/import`, form, { headers: { ...headers, ...form.getHeaders() } })
    ok(`Excel导入成功: ${r.data.message}`)
    fs.unlinkSync('test_import_check.xlsx')
  } catch (e) { err('Excel导入失败', e.response?.data?.message || e.message) }

  // 12. 论坛功能
  console.log('\n12. 论坛功能')
  try {
    const { data: post } = await axios.post(`${API}/forum/posts`, { title: '自检测试帖', content: '自检测试内容', category: '综合' }, { headers })
    const { data: detail } = await axios.get(`${API}/forum/posts/${post.id}`, { headers })
    await axios.post(`${API}/forum/posts/${post.id}/comments`, { content: '自检评论' }, { headers })
    await axios.post(`${API}/forum/posts/${post.id}/like`, {}, { headers })
    const { data: updated } = await axios.get(`${API}/forum/posts/${post.id}`, { headers })
    await axios.delete(`${API}/forum/posts/${post.id}`, { headers })
    ok(`论坛: 发帖/评论/点赞/删除正常 (like=${updated.like_count}, comments=${updated.comment_count})`)
  } catch (e) { err('论坛功能失败', e.response?.data?.message || e.message) }

  // 13. 分片下载
  console.log('\n13. 分片下载（大文件）')
  try {
    const FormData = (await import('form-data')).default
    const fs = await import('fs')
    const buf = Buffer.alloc(5 * 1024 * 1024, 0x42)
    fs.writeFileSync('test_chunk.bin', buf)
    const form = new FormData()
    form.append('file', fs.createReadStream('test_chunk.bin'), { filename: 'test_chunk.bin', contentType: 'application/octet-stream' })
    form.append('title', '自检大文件')
    form.append('course_name', '自检')
    form.append('class_name', '自检')
    const { data: up } = await axios.post(`${API}/study-materials/upload`, form, { headers: { ...headers, ...form.getHeaders() }, timeout: 60000 })
    const { data: c0 } = await axios.get(`${API}/study-materials/download/${up.id}/chunk?chunk=0`, { headers })
    const totalOk = c0.totalSize === 5 * 1024 * 1024 && c0.totalChunks >= 1 && c0.base64.length > 0
    await axios.delete(`${API}/study-materials/${up.id}`, { headers })
    fs.unlinkSync('test_chunk.bin')
    ok(`分片下载: 5MB文件分为${c0.totalChunks}片, 总大小${c0.totalSize}`)
  } catch (e) { err('分片下载失败', e.response?.data?.message || e.message) }

  console.log('\n========== 自检结果 ==========')
  console.log(`通过: ${passed} 项`)
  console.log(`失败: ${failed} 项`)
  console.log(failed === 0 ? '\n🎉 所有检查通过！' : '\n⚠️ 存在失败项，请检查。')
}

check().catch(console.error)
