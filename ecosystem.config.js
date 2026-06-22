// PM2 进程配置文件
module.exports = {
  apps: [{
    name: 'student-system-api',
    script: './index.js',
    cwd: './backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 8081
    },
    // 自动重启配置
    max_restarts: 10,
    restart_delay: 3000,
    // 日志配置
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/www/wwwlogs/student-system-error.log',
    out_file: '/www/wwwlogs/student-system-out.log',
    merge_logs: true,
    // 内存限制自动重启（服务器内存 1.6G，给后端约 300MB）
    max_memory_restart: '300M',
    // 监听文件变化自动重启（生产环境关闭）
    watch: false
  }]
}
