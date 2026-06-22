module.exports = {
  apps: [{
    name: "student-system-api",
    script: "./index.js",
    cwd: "/www/wwwroot/student-system/backend",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: "8081"
    },
    max_restarts: 10,
    restart_delay: 3000,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "/www/wwwlogs/student-system-error.log",
    out_file: "/www/wwwlogs/student-system-out.log",
    merge_logs: true,
    max_memory_restart: "300M",
    watch: false
  }]
}
