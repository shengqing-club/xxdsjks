# 项目记忆 - 学生管理系统

## 服务器信息
- IP: 8.130.155.128, SSH 端口: 22
- SSH 密钥: `C:\Users\31684\Downloads\workbuddy.pem`
- 项目路径: `/www/wwwroot/student-system/`
- 前端 dist: `/www/wwwroot/student-system/dist/`
- 后端: `/www/wwwroot/student-system/backend/`
- PM2 进程名: `student-system-api`
- MySQL: `student_admin:StuAdmin2024!@localhost:3306/student_management`
- MySQL root: `admin123`（2026-06-19重置，宝塔default.db已同步）
- student_admin 权限: ALL on student_management + PROCESS + SUPER + REPLICATION CLIENT + SELECT on mysql系统表
- Nginx: `client_max_body_size 50m`, `proxy_read_timeout 300s`
- 宝塔面板: 端口 18284 (HTTPS), 安全入口 `/a0c651b9`
- phpMyAdmin: 端口 888 (HTTP), Nginx root `/www/server/phpmyadmin/phpmyadmin_0cc518789e4f3bc0`, alias处理宝塔子目录URL, PHP sock `php-cgi-81.sock`
- **端口架构**: 80=Nginx(前端), 888=Nginx(phpMyAdmin), 18284=BT Panel Python直连(非Nginx), 8081=PM2(Node API)
- `ajax.py:1330` PMA URL 硬编码为 `"http://{}:888/"` 格式（避免port变量问题）
- 宝塔面板外部可能经阿里云WAF/CDN层（浏览器显示nginx/1.30.3但18284是Python直连）
- 阿里云安全组需放行: 22, 80, 888, 18284

## 架构决策
- **上传**: 单次整体上传（不再分片），multer memoryStorage → MySQL LONGBLOB，上限 50MB
- **下载**: 直接流式返回 `res.end(fileBuffer)`，无大小限制
- **数据库**: MySQL 5.7, `max_allowed_packet = 1GB`
- **Node timeout**: 300s（5分钟）

## SQL 注意事项
- `key` 是 MySQL 保留字，所有 SQL 中需用反引号 `` `key` ``
- `groups` 表名在 MySQL 8.0 是保留字，当前 5.7 不影响
- 日期字段用 `DATE_FORMAT(column, '%Y-%m-%d')` 返回字符串，避免 JS Date 时区偏移

## db.js 适配层
- `pool.query` 返回 `{ rows, insertId, affectedRows, changedRows }`
- `pool.connect()` 包装 `getConnection()` + `query()` + `release()`
- 批量 INSERT 支持: `VALUES ?` + 嵌套数组 `[[v1,v2],[v3,v4]]`

## Bug 修复记录
- el-switch 布尔转换 → `:model-value="!!row.pinned"` 单向绑定
- 通知已读 → `showNotifDetail` 调用 `markAsRead` API
- 下载 413 → 流式返回（4个路由: files/study_materials/photo_wall/group_files）
- phpMyAdmin REPLICATION CLIENT 错误 → Menu.php 执行 SHOW MASTER STATUS 需要该权限，GRANT SUPER + REPLICATION CLIENT 给 student_admin
- phpMyAdmin 公共访问 ERR_SSL_PROTOCOL_ERROR → `ajax.py:1330` 硬编码 `https://` 改为 `http://`（888端口无SSL）
