软件需求与架构设计文档：目标导向时间追踪系统 (Goal-Oriented Time Tracker)

1\. 项目概述

本系统旨在打破“盲目忙碌”，通过愿景 (Vision) -> 目标 (Goals) -> 任务/记录 (Tasks/TimeLogs) 的层级体系，让用户的每一分钟时间消耗都能追溯到长期的价值愿景。



核心逻辑层级

愿景层 (Vision)：3-5 年长期愿景。



目标层 (Goals)：



年度目标 (Yearly)：关联愿景。



季度目标 (Quarterly)：关联年度目标。



执行层 (TimeLogs/Tasks)：



具体的时间消耗记录。



硬性约束：每一条 TimeLog 必须关联一个“季度目标”。



2\. 技术栈 (Technical Stack)

后端: Python 3.10+ / FastAPI (异步架构)



数据库: PostgreSQL 14+



ORM: SQLAlchemy 2.0 (Async) + Alembic (迁移)



校验/DTO: Pydantic v2



任务队列: Celery + Redis (处理进度聚合、报表生成)



前端: Next.js (TypeScript) + Tailwind CSS



认证: JWT (Access \& Refresh Token)



3\. 数据库模型设计 (Data Schema)

3.1 核心实体关系

User 1:N Vision



Vision 1:N Goal (Yearly)



Goal (Yearly) 1:N Goal (Quarterly)



Goal (Quarterly) 1:N TimeLog



Task (Optional) 1:N TimeLog



3.2 关键表结构 (PostgreSQL)

visions (愿景表)

id: UUID, PK



user\_id: UUID, FK (users.id)



title: VARCHAR(255)



description: TEXT



start\_date: DATE



target\_date: DATE (3-5年后)



status: Enum (active, completed, archived)



goals (目标表)

id: UUID, PK



parent\_goal\_id: UUID, FK (goals.id, 自关联，年度指向季度)



vision\_id: UUID, FK (visions.id)



period\_type: Enum (year, quarter)



status: Enum (not\_started, in\_progress, completed)



progress: Numeric (0.00 - 100.00, 自动计算或手动更新)



time\_logs (时间记录表)

id: UUID, PK



goal\_id: UUID, FK (goals.id, 必须是季度目标)



task\_id: UUID, FK (tasks.id, 可选)



planned\_start: TIMESTAMPTZ



planned\_end: TIMESTAMPTZ



actual\_start: TIMESTAMPTZ



actual\_end: TIMESTAMPTZ



duration\_minutes: INTEGER (计算字段：actual\_end - actual\_start)



tags: JSONB (存储标签数组)



4\. 核心功能需求

4.1 目标管理

支持创建愿景，并将其分解为年度目标，再进一步分解为季度目标。



层级验证：系统需确保季度目标的父级是年度目标，年度目标的父级是愿景。



4.2 时间追踪 (Time Tracking)

实时打卡模式：点击 "Start" 开始记录（记录 actual\_start），点击 "Stop" 结束（记录 actual\_end 并计算 duration\_minutes）。



手动补录模式：用户可选择日期和时间段手动创建记录。



强制关联：创建 TimeLog 时，前端必须提供季度目标选择器。



4.3 自动化与计算逻辑

时长计算：duration\_minutes 由服务端在写入前自动根据 actual\_end - actual\_start 计算。



进度反馈：当一条 TimeLog 被创建或修改后，异步触发更新所属 Goal 的累计已投入时长。



4.4 报表系统

愿景对齐度：展示在特定时间段内，各个“愿景”下所有目标消耗时间的占比。



目标进度条：对比计划投入时长与实际投入时长。



5\. API 接口设计 (FastAPI)

Vision 模块

GET /api/v1/visions - 获取当前用户所有愿景



POST /api/v1/visions - 创建新愿景



Goal 模块

GET /api/v1/goals?type=quarter - 按类型筛选目标



GET /api/v1/goals/{id}/tree - 获取目标及其子目标的层级树



TimeLog 模块

POST /api/v1/timelogs/start - 开启打卡（只传 goal\_id）



PATCH /api/v1/timelogs/{id}/stop - 结束打卡



POST /api/v1/timelogs - 手动补录



GET /api/v1/timelogs/stats?range=week - 获取本周统计数据



6\. 架构设计图示与说明

6.1 系统架构

负载均衡 (Nginx): 负责 SSL 终止和静态资源分发。



API 服务 (FastAPI): 处理所有业务逻辑，采用异步 I/O 提高并发处理能力。



异步 Worker (Celery): 处理耗时的报表聚合计算、邮件通知。



数据层 (PostgreSQL): 存储结构化数据，利用 JSONB 处理标签，利用约束保证数据完整性。



6.2 目录结构建议 (Python 后端)

Plaintext

backend/

├── app/

│   ├── api/            # 路由定义 (v1/endpoints)

│   ├── core/           # 配置、安全、JWT 逻辑

│   ├── crud/           # 数据库增删改查逻辑

│   ├── models/         # SQLAlchemy 数据库模型

│   ├── schemas/        # Pydantic DTO (请求/响应模型)

│   ├── services/       # 复杂业务逻辑 (进度计算等)

│   ├── db/             # 数据库连接与 Session 管理

│   └── main.py         # FastAPI 入口

├── alembic/            # 数据库迁移脚本

├── tests/              # pytest 测试用例

├── .env                # 环境变量

└── requirements.txt

7\. 非功能需求与安全

时区处理：所有时间戳在数据库中均以 UTC 存储。用户表记录 timezone，后端根据该字段进行聚合计算，前端负责本地化显示。



并发控制：打卡操作需防止“重复开启”，在 Service 层通过状态检查或数据库唯一索引防止同一个用户同时拥有两条 status='running' 的记录。



安全性：使用 PasswordHash 加密存储；所有 API 接口需经过 JWT 验证；实现行级权限检查（用户只能访问自己的数据）。

