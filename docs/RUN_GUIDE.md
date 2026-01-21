# TimeTracker 运行指南

## 环境要求

### 后端 (Backend)
- Python 3.10+
- pip (Python 包管理器)

### 前端 (Frontend)
- Node.js 18+
- npm 或 yarn

---

## 快速启动

### 第一步：启动后端服务

1. 打开终端，进入后端目录：
   ```bash
   cd D:\ai demo\TimeT\backend
   ```

2. 安装 Python 依赖（首次运行需要）：
   ```bash
   pip install -r requirements.txt
   ```

3. 启动后端服务：
   ```bash
   python run.py
   ```

4. 看到以下输出表示启动成功：
   ```
   INFO:     Uvicorn running on http://0.0.0.0:8000
   INFO:     Application startup complete.
   ```

### 第二步：启动前端服务

1. **新开一个终端窗口**，进入前端目录：
   ```bash
   cd D:\ai demo\TimeT\frontend
   ```

2. 安装 Node.js 依赖（首次运行需要）：
   ```bash
   npm install
   ```

3. 启动前端开发服务：
   ```bash
   npm run dev
   ```

4. 看到以下输出表示启动成功：
   ```
   ▲ Next.js 14.1.0
   - Local:        http://localhost:3000
   ✓ Ready in Xs
   ```

### 第三步：访问应用

在浏览器中打开：**http://localhost:3000**

---

## 服务端口说明

| 服务 | 端口 | 地址 |
|------|------|------|
| 后端 API | 8000 | http://localhost:8000/api/v1 |
| 前端 Web | 3000 | http://localhost:3000 |
| Swagger 文档 | 8000 | http://localhost:8000/api/v1/docs |
| ReDoc 文档 | 8000 | http://localhost:8000/api/v1/redoc |
| 健康检查 | 8000 | http://localhost:8000/health |

---

## 常见问题

### 1. 端口被占用

如果提示端口被占用，可以：

**Windows:**
```bash
# 查找占用端口的进程
netstat -ano | findstr :8000
# 结束进程 (替换 PID 为实际进程ID)
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
# 查找并结束占用端口的进程
lsof -i :8000
kill -9 <PID>
```

### 2. Python 依赖安装失败

尝试使用清华镜像源：
```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### 3. Node.js 依赖安装失败

尝试使用淘宝镜像源：
```bash
npm install --registry=https://registry.npmmirror.com
```

### 4. 数据库迁移

如果遇到数据库相关错误，可以手动执行迁移：
```bash
cd D:\ai demo\TimeT\backend
alembic upgrade head
```

---

## 停止服务

在各自的终端窗口中按 `Ctrl + C` 即可停止服务。

---

## 新增功能：时间追踪器增强

### 功能列表

1. **按天记录** - 时间记录按天分组显示
2. **天/周视图** - 可切换按天或按周查看记录
3. **计划功能** - 支持提前计划某个时间段的工作
4. **完成状态** - 计划任务可标记完成/未完成

### 使用方法

1. 进入"时间追踪"页面
2. 点击"创建计划"按钮创建计划任务
3. 使用日期导航浏览不同日期的记录
4. 对待完成的计划，点击 ✓ 或 ✗ 标记状态

---

## 项目结构

```
TimeT/
├── backend/                 # 后端服务
│   ├── app/                # 应用代码
│   │   ├── api/           # API 端点
│   │   ├── crud/          # 数据库操作
│   │   ├── models/        # 数据模型
│   │   └── schemas/       # 数据验证
│   ├── alembic/           # 数据库迁移
│   ├── requirements.txt   # Python 依赖
│   └── run.py             # 启动脚本
│
├── frontend/               # 前端服务
│   ├── src/
│   │   ├── app/          # 页面组件
│   │   ├── components/   # UI 组件
│   │   ├── hooks/        # React Hooks
│   │   ├── lib/          # 工具函数
│   │   └── i18n/         # 国际化
│   └── package.json      # Node 依赖
│
└── docs/                   # 文档
    ├── requirements-and-plans.md
    └── RUN_GUIDE.md       # 本文件
```

---

## 技术栈

- **后端**: Python, FastAPI, SQLAlchemy, SQLite
- **前端**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **状态管理**: Zustand
- **HTTP 客户端**: Axios
