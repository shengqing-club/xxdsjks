import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

// 先登录获取token
const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
  username: 'admin',
  password: 'admin123'
})
const token = loginRes.data.token
console.log('登录成功，token:', token?.substring(0, 20) + '...')

// 创建一个测试文件
fs.writeFileSync('test.docx', 'test word file content')

const form = new FormData()
form.append('file', fs.createReadStream('test.docx'), { filename: 'test.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
form.append('title', '测试Word文件')
form.append('course_name', '测试课程')
form.append('class_name', '计算机1班')

try {
  const res = await axios.post('http://localhost:8081/api/study-materials/upload', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`
    }
  })
  console.log('上传成功:', res.data)
} catch (e) {
  console.error('上传失败:', e.response?.status, e.response?.data || e.message)
}

fs.unlinkSync('test.docx')
