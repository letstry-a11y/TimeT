# TimeTracker 本地服务器部署指南

> 适用于 Windows Server + 企业 VPN 环境

## 部署架构

```
┌─────────────────────────────────────────────────────┐
│                    内网服务器                         │
│  ┌─────────────┐     ┌─────────────┐               │
│  │  Frontend   │     │  Backend    │               │
│  │  (Next.js)  │────▶│  (FastAPI)  │──▶ SQLite    │
│  │  :3000      │     │  :8000      │               │
│  └─────────────┘     └─────────────┘               │
└─────────────────────────────────────────────────────┘
          ▲
          │ VPN 连接
          │
    ┌─────┴─────┐
    │  外网用户  │
    └───────────┘
```

## 环境要求

| 项目 | 要求 |
|-----|------|
| 操作系统 | Windows Server 2016/2019/2022 |
| Python | 3.10+ |
| Node.js | 18+ |
| 网络 | 企业 VPN 已配置 |

---

## 部署步骤

### 步骤 1: 安装必要软件

1. **安装 Python**
   - 下载: https://python.org/downloads/
   - 安装时**务必勾选** "Add Python to PATH"

2. **安装 Node.js**
   - 下载: https://nodejs.org/
   - 选择 LTS（长期支持）版本

3. **验证安装**
   ```powershell
   python --version   # 应显示 3.10+
   node --version     # 应显示 18+
   npm --version
   ```

---

### 步骤 2: 部署后端

```powershell
# 进入后端目录
cd "D:\ai demo\TimeFeatureAdd\backend"

# 创建 Python 虚拟环境
python -m venv venv

# 激活虚拟环境
.\venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt
```

**创建启动脚本** `D:\ai demo\TimeFeatureAdd\start_backend.bat`:
```batch
@echo off
cd /d "D:\ai demo\TimeFeatureAdd\backend"
call venv\Scripts\activate
python run.py
pause
```

---

### 步骤 3: 部署前端

```powershell
# 进入前端目录
cd "D:\ai demo\TimeFeatureAdd\frontend"

# 安装依赖
npm install

# 构建生产版本
npm run build
```

**配置 API 地址（重要）**

创建文件 `D:\ai demo\TimeFeatureAdd\frontend\.env.production`:
```
NEXT_PUBLIC_API_URL=http://192.168.x.x:8000
```
> 将 `192.168.x.x` 替换为服务器实际内网 IP

**创建启动脚本** `D:\ai demo\TimeFeatureAdd\start_frontend.bat`:
```batch
@echo off
cd /d "D:\ai demo\TimeFeatureAdd\frontend"
npm run start
pause
```

---

### 步骤 4: 配置服务监听地址

**修改后端** `backend\run.py`:
```python
if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",  # 监听所有网卡
        port=8000,
        reload=False     # 生产环境关闭热重载
    )
```

**修改前端** `frontend\package.json` 中的 start 脚本:
```json
{
  "scripts": {
    "start": "next start -H 0.0.0.0 -p 3000"
  }
}
```

---

### 步骤 5: 配置 Windows 防火墙

以**管理员身份**运行 PowerShell:
```powershell
# 允许 3000 端口（前端）
netsh advfirewall firewall add rule name="TimeTracker Frontend" dir=in action=allow protocol=TCP localport=3000

# 允许 8000 端口（后端）
netsh advfirewall firewall add rule name="TimeTracker Backend" dir=in action=allow protocol=TCP localport=8000
```

---

### 步骤 6: 设置 Windows 服务（开机自启）

#### 方法 A: 使用 NSSM（推荐）

1. **下载 NSSM**: https://nssm.cc/download
2. 解压到 `C:\nssm`
3. 以**管理员身份**运行 CMD:

```cmd
C:\nssm\win64\nssm.exe install TimeTrackerBackend "D:\ai demo\TimeFeatureAdd\start_backend.bat"
C:\nssm\win64\nssm.exe install TimeTrackerFrontend "D:\ai demo\TimeFeatureAdd\start_frontend.bat"

C:\nssm\win64\nssm.exe start TimeTrackerBackend
C:\nssm\win64\nssm.exe start TimeTrackerFrontend
```

**服务管理命令:**
```cmd
nssm status TimeTrackerBackend    # 查看状态
nssm stop TimeTrackerBackend      # 停止服务
nssm start TimeTrackerBackend     # 启动服务
nssm restart TimeTrackerBackend   # 重启服务
nssm remove TimeTrackerBackend    # 删除服务
```

#### 方法 B: 使用任务计划程序

1. 打开"任务计划程序"（taskschd.msc）
2. 创建基本任务
3. 触发器选择"计算机启动时"
4. 操作选择"启动程序"，指向 bat 文件

---

## VPN 访问

用户访问步骤：

1. **连接企业 VPN** 到公司内网
2. **打开浏览器**访问: `http://服务器内网IP:3000`
3. **登录系统**使用

> 确保 VPN 配置允许访问服务器所在网段

---

## 验证部署

### 1. 服务器本地测试
```
http://localhost:3000        → 前端页面
http://localhost:8000/docs   → API 文档（Swagger）
```

### 2. 内网其他电脑测试
```
http://服务器IP:3000
http://服务器IP:8000/docs
```

### 3. VPN 远程测试
1. 从外网连接企业 VPN
2. 访问 `http://服务器内网IP:3000`
3. 登录系统验证功能正常

---

## 数据备份

SQLite 数据库位置: `backend\timetracker.db`

**自动备份脚本** `D:\ai demo\TimeFeatureAdd\backup.bat`:
```batch
@echo off
set backup_dir=D:\backup\timetracker
set date_str=%date:~0,4%%date:~5,2%%date:~8,2%
if not exist %backup_dir% mkdir %backup_dir%
copy "D:\ai demo\TimeFeatureAdd\backend\timetracker.db" "%backup_dir%\timetracker_%date_str%.db"
echo Backup completed: %backup_dir%\timetracker_%date_str%.db
```

**设置每日自动备份:**
1. 打开任务计划程序
2. 创建基本任务，触发器选"每天"
3. 操作指向 `backup.bat`

---

## 常见问题

| 问题 | 解决方案 |
|-----|---------|
| 前端无法连接后端 | 检查 `.env.production` 中的 `NEXT_PUBLIC_API_URL` 是否正确 |
| 内网其他电脑无法访问 | 检查防火墙是否开放 3000/8000 端口 |
| VPN 连接后无法访问 | 确认 VPN 路由配置允许访问服务器网段 |
| 服务意外停止 | 检查 NSSM 服务状态: `nssm status TimeTrackerBackend` |
| 端口被占用 | 使用 `netstat -ano | findstr :3000` 查找占用进程 |

---

## 快速命令参考

```powershell
# 查看端口占用
netstat -ano | findstr :3000
netstat -ano | findstr :8000

# 查看服务器 IP
ipconfig

# 手动启动服务
cd "D:\ai demo\TimeFeatureAdd"
start start_backend.bat
start start_frontend.bat

# 查看 NSSM 服务状态
nssm status TimeTrackerBackend
nssm status TimeTrackerFrontend
```

---

## 更新部署

当代码更新后:

```powershell
# 1. 停止服务
nssm stop TimeTrackerBackend
nssm stop TimeTrackerFrontend

# 2. 更新代码（git pull 或手动复制）

# 3. 更新后端依赖（如有变化）
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt

# 4. 重新构建前端
cd ..\frontend
npm install
npm run build

# 5. 启动服务
nssm start TimeTrackerBackend
nssm start TimeTrackerFrontend
```
