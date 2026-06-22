import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'

// 先以学生身份登录
const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
  username: '2024002',
  password: '123456'
})
const token = loginRes.data.token
console.log('学生登录成功')

// 创建测试Word文件
fs.writeFileSync('test_word2.docx', 'test word file content for file sharing')

const form = new FormData()
form.append('file', fs.createReadStream('test_word2.docx'), { filename: 'test_word2.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
form.append('originalFilename', 'test_word2.docx')
form.append('uploaderRole', 'student')
form.append('uploaderId', '2024002')
form.append('uploaderName', '李婉清')
form.append('category', 'general')
form.append('description', '测试Word上传')

try {
  const res = await axios.post('http://localhost:8081/api/files/upload', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`
    }
  })
  console.log('上传成功:', res.data)
} catch (e) {
  console.error('上传失败:', e.response?.status, e.response?.data || e.message)
}

fs.unlinkSync('test_word2.docx')
