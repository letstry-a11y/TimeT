# TimeTracker Zeabur 部署指南

本指南将帮助你在 Zeabur 平台上部署 TimeTracker 应用。

## 准备工作

1. **GitHub 账号**：确保代码已推送到 GitHub 仓库
2. **Zeabur 账号**：访问 https://zeabur.com 注册账号

---

## 第一步：注册并登录 Zeabur

1. 访问 https://zeabur.com
2. 点击「Get Started」
3. 使用 GitHub 账号登录（推荐，方便后续连接仓库）

---

## 第二步：创建项目

1. 登录后，点击「Create Project」
2. 选择一个区域：
   - **香港** 或 **新加坡**（推荐，国内访问较快）
   - 其他区域也可以
3. 输入项目名称，如 `timetracker`

---

## 第三步：部署 PostgreSQL 数据库

1. 在项目页面，点击「Add Service」
2. 选择「Marketplace」
3. 搜索并选择「PostgreSQL」
4. 等待数据库启动完成
5. 点击数据库服务，记录连接信息：
   - 点击「Connect」标签
   - 复制 `DATABASE_URL`（格式：`postgresql://...`）

---

## 第四步：部署后端服务

### 4.1 添加后端服务

1. 点击「Add Service」
2. 选择「Git」
3. 选择你的 GitHub 仓库
4. 在「Root Directory」中填写：`backend`
5. 点击部署

### 4.2 配置后端环境变量

点击后端服务，进入「Variables」标签，添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `${POSTGRES.DATABASE_URL}` | 使用 Zeabur 变量引用 |
| `SECRET_KEY` | 随机字符串（至少32位） | JWT 加密密钥 |
| `DEBUG` | `False` | 生产环境关闭调试 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | Token 过期时间 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | 刷新 Token 过期时间 |
| `CORS_ORIGINS` | `["https://你的前端域名"]` | 跨域配置（先留空，后续填写） |

**生成随机 SECRET_KEY**（在终端运行）：
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
或使用在线工具生成。

### 4.3 配置启动命令

在「Settings」中，设置：
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

### 4.4 生成域名

1. 点击「Networking」标签
2. 点击「Generate Domain」
3. 会生成一个类似 `backend-xxx.zeabur.app` 的域名
4. 记录这个域名，后续前端需要使用

---

## 第五步：部署前端服务

### 5.1 添加前端服务

1. 点击「Add Service」
2. 选择「Git」
3. 选择同一个 GitHub 仓库
4. 在「Root Directory」中填写：`frontend`
5. 点击部署

### 5.2 配置前端环境变量

点击前端服务，进入「Variables」标签，添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_API_URL` | `https://你的后端域名/api/v1` | 后端 API 地址 |

例如：`https://backend-abc123.zeabur.app/api/v1`

### 5.3 生成前端域名

1. 点击「Networking」标签
2. 点击「Generate Domain」
3. 会生成一个类似 `frontend-xxx.zeabur.app` 的域名

---

## 第六步：更新 CORS 配置

返回后端服务，更新 `CORS_ORIGINS` 环境变量：

```
["https://你的前端域名.zeabur.app"]
```

例如：`["https://frontend-abc123.zeabur.app"]`

---

## 第七步：初始化数据库

后端首次启动会自动创建数据库表。如果需要手动迁移：

1. 在 Zeabur 控制台，点击后端服务
2. 点击「Shell」标签
3. 运行：
```bash
alembic upgrade head
```

---

## 第八步：验证部署

1. 访问前端域名，应该看到登录页面
2. 访问 `https://后端域名/api/v1/docs` 查看 API 文档
3. 访问 `https://后端域名/health` 检查健康状态

---

## 绑定自定义域名（可选）

如果你有自己的域名：

1. 在前端服务的「Networking」中点击「Add Domain」
2. 输入你的域名
3. 按照提示配置 DNS 记录：
   - 添加 CNAME 记录指向 Zeabur 提供的地址
4. 等待 DNS 生效（通常几分钟到几小时）
5. Zeabur 会自动配置 SSL 证书

---

## 环境变量完整参考

### 后端环境变量

```env
# 必填
DATABASE_URL=${POSTGRES.DATABASE_URL}
SECRET_KEY=你的随机密钥

# 可选（有默认值）
DEBUG=False
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=["https://你的前端域名"]
```

### 前端环境变量

```env
NEXT_PUBLIC_API_URL=https://你的后端域名/api/v1
```

---

## 常见问题

### Q: 部署失败，提示找不到模块？
A: 检查 Root Directory 是否正确设置为 `backend` 或 `frontend`

### Q: 前端无法连接后端 API？
A: 检查：
1. `NEXT_PUBLIC_API_URL` 是否正确
2. 后端 `CORS_ORIGINS` 是否包含前端域名
3. 后端服务是否正常运行

### Q: 数据库连接失败？
A: 使用 `${POSTGRES.DATABASE_URL}` 变量引用，Zeabur 会自动处理连接

### Q: 如何查看日志？
A: 点击服务 → 「Logs」标签

### Q: 费用问题？
A: Zeabur 每月提供 $5 免费额度，轻度使用通常足够

---

## 部署架构图

```
                    ┌─────────────────┐
                    │    用户访问      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  前端 (Next.js)  │
                    │  *.zeabur.app   │
                    └────────┬────────┘
                             │ API 请求
                    ┌────────▼────────┐
                    │  后端 (FastAPI)  │
                    │  *.zeabur.app   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   (Zeabur 托管)  │
                    └─────────────────┘
```

---

## 下一步

部署完成后，你可以：
1. 注册账号并开始使用
2. 配置自定义域名
3. 设置定期备份（Zeabur 提供数据库备份功能）
