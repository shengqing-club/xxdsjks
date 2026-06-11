import axios from 'axios'
import FormData from 'form-data'
import fs from 'fs'
import xlsx from 'xlsx'

// 先登录获取token
const loginRes = await axios.post('http://localhost:8081/api/auth/login', {
  username: 'admin',
  password: 'admin123'
})
const token = loginRes.data.token
console.log('登录成功')

// 创建测试Excel文件
const data = [
  ['学号', '姓名', '性别', '年龄', '专业', '班级', '状态', '密码'],
  ['2024999', '导入测试1', '男', '20', '计算机科学与技术', '计科2401', '在读', '123456'],
  ['2024998', '导入测试2', '女', '19', '软件工程', '软工2401', '在读', '123456'],
  ['', '导入测试3', '男', '20', '计算机科学与技术', '计科2401', '在读', '123456']
]
const ws = xlsx.utils.aoa_to_sheet(data)
const wb = xlsx.utils.book_new()
xlsx.utils.book_append_sheet(wb, ws, '学生')
xlsx.writeFile(wb, 'test_import.xlsx')

const form = new FormData()
form.append('file', fs.createReadStream('test_import.xlsx'), { filename: 'test_import.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

try {
  const res = await axios.post('http://localhost:8081/api/students/import', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`
    }
  })
  console.log('导入结果:', res.data)
} catch (e) {
  console.error('导入失败:', e.response?.status, e.response?.data || e.message)
}

fs.unlinkSync('test_import.xlsx')
