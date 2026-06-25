"""
学生信息管理系统 - 一键部署脚本 (宝塔MySQL适配版)
将前端构建产物和后端代码部署到阿里云服务器
"""
import paramiko
import os
import tarfile
import time

# ====== 配置 ======
SERVER_HOST = '8.130.155.128'
SERVER_PORT = 22
SERVER_USER = 'root'
SERVER_PASS = 'admin123.'
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DEPLOY_DIR = '/www/wwwroot/student-system'
NGINX_CONF = '/www/server/panel/vhost/nginx/student-system.conf'

def run_ssh(ssh, cmd, timeout=120, show=True):
    """执行远程命令并返回结果"""
    if show:
        print(f'  > {cmd}')
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    if show and out:
        print(f'    {out[-500:]}')
    if show and err and 'warning' not in err.lower() and 'npm notice' not in err.lower() and 'deprecated' not in err.lower():
        print(f'    [stderr] {err[-300:]}')
    return out, err

def create_deploy_package():
    """创建部署包"""
    print('\n[1/6] 创建部署包...')
    tar_path = os.path.join(PROJECT_DIR, 'deploy.tar.gz')

    with tarfile.open(tar_path, 'w:gz') as tar:
        # 添加前端构建产物
        dist_dir = os.path.join(PROJECT_DIR, 'dist')
        if os.path.exists(dist_dir):
            tar.add(dist_dir, arcname='dist')
            print(f'  + dist/ (前端构建产物)')
        else:
            print('  !! dist/ 不存在，请先运行 npm run build')
            return None

        # 添加后端代码
        backend_dir = os.path.join(PROJECT_DIR, 'backend')
        for item in os.listdir(backend_dir):
            if item in ('node_modules', '.env'):
                continue
            full_path = os.path.join(backend_dir, item)
            arcname = f'backend/{item}'
            if os.path.isdir(full_path):
                tar.add(full_path, arcname=arcname)
            else:
                tar.add(full_path, arcname=arcname)
        print(f'  + backend/ (后端代码)')

        # 添加配置文件
        for f in ['ecosystem.config.js', 'nginx.conf']:
            fp = os.path.join(PROJECT_DIR, f)
            if os.path.exists(fp):
                tar.add(fp, arcname=f)
                print(f'  + {f}')

    size_mb = os.path.getsize(tar_path) / (1024 * 1024)
    print(f'  部署包大小: {size_mb:.1f} MB')
    return tar_path

def upload_package(ssh, tar_path):
    """上传部署包到服务器"""
    print('\n[2/6] 上传部署包到服务器...')
    sftp = ssh.open_sftp()

    remote_tar = f'/tmp/deploy.tar.gz'
    file_size = os.path.getsize(tar_path)

    # 带进度的上传
    transferred = [0]
    last_print = [0]
    def progress(sent, total):
        transferred[0] = sent
        now = time.time()
        if now - last_print[0] > 2:  # 每2秒打印一次
            pct = sent / total * 100
            print(f'    上传进度: {pct:.0f}% ({sent // 1024 // 1024}MB / {total // 1024 // 1024}MB)')
            last_print[0] = now

    sftp.put(tar_path, remote_tar, callback=progress)
    print(f'  上传完成!')
    sftp.close()
    return remote_tar

def deploy_on_server(ssh, remote_tar):
    """在服务器上执行部署"""
    print('\n[3/6] 在服务器上部署...')

    # 创建目录
    run_ssh(ssh, f'mkdir -p {DEPLOY_DIR}')
    run_ssh(ssh, f'mkdir -p {DEPLOY_DIR}/uploads')
    run_ssh(ssh, f'mkdir -p {DEPLOY_DIR}/uploads/group_chat')
    run_ssh(ssh, f'mkdir -p {DEPLOY_DIR}/uploads/group_files')
    run_ssh(ssh, f'mkdir -p {DEPLOY_DIR}/uploads/study_materials')
    run_ssh(ssh, f'mkdir -p {DEPLOY_DIR}/uploads/photo_wall')

    # 备份旧版本
    run_ssh(ssh, f'cd {DEPLOY_DIR} && [ -d backend ] && cp -r backend backend.bak.$(date +%Y%m%d%H%M%S) || true')

    # 解压部署包
    run_ssh(ssh, f'tar -xzf {remote_tar} -C {DEPLOY_DIR}')
    run_ssh(ssh, f'rm -f {remote_tar}')

    # 创建日志目录
    run_ssh(ssh, 'mkdir -p /www/wwwlogs')

    # 创建后端 .env 文件 (MySQL配置)
    env_content = (
        'DATABASE_URL=mysql://student_admin:StuAdmin2024!@localhost:3306/student_management\n'
        'JWT_SECRET=xxdskj_g9k2m5n8p3q7r1s4t6u0v_w_y_z_2024_prod\n'
        'NODE_ENV=production\n'
        'PORT=8081'
    )
    run_ssh(ssh, f'cat > {DEPLOY_DIR}/backend/.env << \'EOF\'\n{env_content}\nEOF')
    print('  + 后端 .env 配置已写入 (MySQL)')

    # 安装后端依赖
    print('\n[4/6] 安装后端依赖...')
    run_ssh(ssh, f'cd {DEPLOY_DIR}/backend && npm install --production 2>&1', timeout=180)

    # 运行数据库迁移
    print('\n[5/6] 运行数据库迁移...')
    run_ssh(ssh, f'cd {DEPLOY_DIR}/backend && node migrate.js 2>&1', timeout=120)

    # 配置 Nginx
    print('\n[6/6] 配置 Nginx...')
    run_ssh(ssh, f'cp {DEPLOY_DIR}/nginx.conf {NGINX_CONF}')
    run_ssh(ssh, 'nginx -t 2>&1')
    run_ssh(ssh, 'systemctl reload nginx || nginx -s reload')
    print('  + Nginx 配置已更新并重载')

    # 用 PM2 启动/重启后端
    print('\n  启动后端服务...')
    run_ssh(ssh, f'cd {DEPLOY_DIR} && pm2 delete student-system-api 2>/dev/null; pm2 start ecosystem.config.js')
    run_ssh(ssh, 'pm2 save')

    print('\n' + '=' * 50)
    print('部署完成！')
    print(f'  前端: http://{SERVER_HOST}/')
    print(f'  后端: http://{SERVER_HOST}:8081/api/health')
    print(f'  管理员: admin / admin123')
    print(f'  学生: 2024001 / 123456')
    print('=' * 50)

def verify_deployment(ssh):
    """验证部署结果"""
    print('\n[验证] 检查部署结果...')

    # 检查后端健康状态
    out, _ = run_ssh(ssh, 'curl -s http://localhost:8081/api/health 2>&1')
    if '"status":"ok"' in out or '"ok"' in out:
        print('  [OK] 后端 API 正常')
    else:
        print(f'  [!!] 后端 API 可能未就绪: {out[:200]}')

    # 检查前端文件
    out, _ = run_ssh(ssh, f'ls {DEPLOY_DIR}/dist/index.html 2>&1')
    if 'index.html' in out:
        print('  [OK] 前端文件已部署')
    else:
        print('  [!!] 前端文件可能未正确部署')

    # 检查 PM2 状态
    out, _ = run_ssh(ssh, 'pm2 list 2>&1')
    if 'student-system-api' in out and ('online' in out or 'errored' in out):
        if 'errored' in out:
            print('  [!!] PM2 服务有错误，请检查日志')
        else:
            print('  [OK] PM2 后端服务运行中')
    else:
        print('  [!!] PM2 服务可能未正常运行')

    # 检查 Nginx
    out, _ = run_ssh(ssh, 'systemctl is-active nginx 2>&1 || service nginx status 2>&1 || echo "unknown"')
    if 'active' in out:
        print('  [OK] Nginx 运行中')
    else:
        print('  [!!] Nginx 可能未正常运行')

    # 检查 MySQL
    out, _ = run_ssh(ssh, 'systemctl is-active mysqld 2>&1 || systemctl is-active mysql 2>&1 || service mysql status 2>&1 || echo "unknown"')
    if 'active' in out:
        print('  [OK] MySQL 运行中')
    else:
        print('  [!!] MySQL 可能未正常运行')

    # 检查宝塔面板
    out, _ = run_ssh(ssh, 'bt default 2>&1 | head -5')
    if '面板地址' in out or '宝塔' in out:
        print('  [OK] 宝塔面板可访问')
    else:
        print('  [!!] 宝塔面板可能未正常运行')

def main():
    print('=' * 50)
    print('学生信息管理系统 - 一键部署 (宝塔MySQL版)')
    print(f'目标服务器: {SERVER_HOST}')
    print('=' * 50)

    # 1. 创建部署包
    tar_path = create_deploy_package()
    if not tar_path:
        return

    # 2. 连接服务器
    print('\n  连接服务器...')
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SERVER_HOST, port=SERVER_PORT, username=SERVER_USER, password=SERVER_PASS, timeout=15)
    print(f'  已连接到 {SERVER_HOST}')

    try:
        # 3. 上传
        remote_tar = upload_package(ssh, tar_path)

        # 4. 部署
        deploy_on_server(ssh, remote_tar)

        # 5. 验证
        time.sleep(3)  # 等待后端启动
        verify_deployment(ssh)
    finally:
        ssh.close()
        # 清理本地部署包
        if os.path.exists(tar_path):
            os.remove(tar_path)
            print(f'\n  已清理本地部署包')

if __name__ == '__main__':
    main()
