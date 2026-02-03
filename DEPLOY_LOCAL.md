# TimeTracker 本地部署指南（Windows + Docker + frp）

本指南帮助你在 Windows 本地服务器上部署 TimeTracker，并通过 frp 内网穿透对外提供服务。

## 架构概览

```
                    ┌─────────────────┐
                    │    外网用户      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   frp 服务端     │
                    │  (你的VPS/云服务) │
                    └────────┬────────┘
                             │ frp 隧道
                    ┌────────▼────────┐
                    │   frp 客户端     │
                    │  (本地 Windows)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼───┐  ┌───────▼───┐  ┌───────▼───────┐
     │   Nginx    │  │  Backend  │  │   Frontend    │
     │   :80      │  │  :8000    │  │    :3000      │
     └────────────┘  └───────────┘  └───────────────┘
                             │
                    ┌────────▼────────┐
                    │     SQLite      │
                    │   (本地文件)     │
                    └─────────────────┘
```

---

## 前提条件

- Windows 10/11 专业版或企业版（支持 WSL2）
- Docker Desktop for Windows 已安装
- frp 客户端已配置并可连接到 frp 服务端
- 至少 4GB 可用内存

---

## 第一步：安装 Docker Desktop

如果尚未安装：

1. 下载 Docker Desktop：https://www.docker.com/products/docker-desktop/
2. 运行安装程序
3. 安装完成后重启电脑
4. 启动 Docker Desktop，等待 Docker 引擎启动完成

验证安装：
```powershell
docker --version
docker-compose --version
```

---

## 第二步：准备项目

### 2.1 进入项目目录

```powershell
cd "D:\ai demo\TimeTracker1.1.0"
```

### 2.2 创建环境变量文件

复制示例文件并修改：

```powershell
copy .env.example .env
```

编辑 `.env` 文件：

```env
# 应用配置
SECRET_KEY=你的随机密钥（至少32位）
DEBUG=False
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# 数据库（使用 SQLite，无需修改）
DATABASE_URL=sqlite+aiosqlite:///./data/timetracker.db

# CORS（填写你的 frp 域名）
CORS_ORIGINS=["http://localhost:3000","https://你的frp域名"]

# 前端 API 地址
NEXT_PUBLIC_API_URL=/api/v1

# HTTP 端口
HTTP_PORT=80
```

**生成随机 SECRET_KEY**：
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 第三步：构建并启动服务

### 3.1 构建镜像

```powershell
docker-compose build
```

首次构建可能需要 5-10 分钟，取决于网络速度。

### 3.2 启动服务

```powershell
docker-compose up -d
```

### 3.3 查看服务状态

```powershell
docker-compose ps
```

应该看到 3 个服务运行中：
- `nginx` - 端口 80
- `backend` - 端口 8000
- `frontend` - 端口 3000

### 3.4 查看日志

```powershell
# 查看所有日志
docker-compose logs -f

# 只看后端日志
docker-compose logs -f backend

# 只看前端日志
docker-compose logs -f frontend
```

---

## 第四步：验证本地部署

在浏览器中访问：

| 地址 | 说明 |
|------|------|
| http://localhost | 前端应用 |
| http://localhost/api/v1/docs | API 文档 |
| http://localhost/health | 健康检查 |

---

## 第五步：配置 frp 内网穿透

### 5.1 frp 客户端配置

编辑你的 frp 客户端配置文件 `frpc.ini`（或 `frpc.toml`）：

**frpc.ini 格式**：
```ini
[common]
server_addr = 你的frp服务端IP
server_port = 7000
token = 你的frp token

[timetracker-web]
type = http
local_ip = 127.0.0.1
local_port = 80
custom_domains = timetracker.你的域名.com

# 如果需要 HTTPS（frp 服务端支持）
[timetracker-https]
type = https
local_ip = 127.0.0.1
local_port = 80
custom_domains = timetracker.你的域名.com
```

**frpc.toml 格式**（新版 frp）：
```toml
serverAddr = "你的frp服务端IP"
serverPort = 7000
auth.token = "你的frp token"

[[proxies]]
name = "timetracker-web"
type = "http"
localIP = "127.0.0.1"
localPort = 80
customDomains = ["timetracker.你的域名.com"]
```

### 5.2 启动 frp 客户端

```powershell
# 进入 frp 目录
cd C:\path\to\frp

# 启动客户端
.\frpc.exe -c frpc.ini
```

**推荐**：将 frp 设置为 Windows 服务，开机自启：
```powershell
# 使用 nssm 或 WinSW 将 frpc 注册为服务
```

### 5.3 配置域名 DNS

在你的域名 DNS 设置中，添加 A 记录或 CNAME 记录，指向 frp 服务端 IP。

---

## 第六步：更新 CORS 配置

frp 配置完成后，更新 `.env` 文件中的 CORS：

```env
CORS_ORIGINS=["http://localhost:3000","https://timetracker.你的域名.com"]
```

重启服务使配置生效：

```powershell
docker-compose restart backend
```

---

## 第七步：验证外网访问

1. 访问 `https://timetracker.你的域名.com`（或 http，取决于 frp 配置）
2. 应该能看到登录页面
3. 尝试注册账号并登录

---

## 常用命令

```powershell
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 重新构建并启动
docker-compose up -d --build

# 查看服务状态
docker-compose ps

# 进入后端容器
docker-compose exec backend bash

# 进入前端容器
docker-compose exec frontend sh
```

---

## 数据备份

SQLite 数据库文件存储在 Docker 卷中。备份方法：

### 方法一：复制数据库文件

```powershell
# 查看卷位置
docker volume inspect timetracker110_backend_data

# 或者直接从容器复制
docker cp timetracker110-backend-1:/app/data/timetracker.db ./backup/
```

### 方法二：定期自动备份

创建备份脚本 `backup.bat`：

```batch
@echo off
set BACKUP_DIR=D:\backup\timetracker
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%

if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

docker cp timetracker110-backend-1:/app/data/timetracker.db %BACKUP_DIR%\timetracker_%DATE%.db

echo Backup completed: %BACKUP_DIR%\timetracker_%DATE%.db
```

使用 Windows 任务计划程序设置定期执行。

---

## 常见问题

### Q: Docker 启动失败？
A: 确保：
1. Docker Desktop 已启动
2. WSL2 已正确安装
3. 端口 80 未被其他程序占用

### Q: frp 连接不上？
A: 检查：
1. frp 服务端是否运行
2. token 是否正确
3. 防火墙是否允许连接

### Q: 外网访问慢？
A: 可能原因：
1. frp 服务端带宽限制
2. 本地上行带宽不足
3. 考虑启用 frp 压缩：`use_compression = true`

### Q: 如何更新应用？
A:
```powershell
# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

### Q: 端口 80 被占用？
A: 修改 `.env` 文件中的 `HTTP_PORT`：
```env
HTTP_PORT=8080
```
同时更新 frp 配置中的 `local_port`。

---

## 服务自启动

### Docker Desktop 自启动

1. 打开 Docker Desktop
2. 设置 → General → 勾选 "Start Docker Desktop when you log in"

### 容器自启动

docker-compose.yml 中已配置 `restart: unless-stopped`，Docker 重启后容器会自动启动。

### frp 自启动

推荐使用 NSSM（Non-Sucking Service Manager）：

```powershell
# 下载 nssm: https://nssm.cc/download
nssm install frpc "C:\path\to\frpc.exe" "-c" "C:\path\to\frpc.ini"
nssm start frpc
```

---

## 性能优化建议

1. **分配足够内存**：Docker Desktop 设置中分配至少 4GB 内存
2. **使用 SSD**：将 Docker 数据存储在 SSD 上
3. **启用 frp 压缩**：减少传输数据量
4. **定期清理**：`docker system prune` 清理无用镜像和容器

---

## 下一步

1. 配置 HTTPS（在 frp 服务端配置 SSL 证书）
2. 设置定期备份
3. 配置监控告警（可选）
