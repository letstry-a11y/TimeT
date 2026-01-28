# 架构需求 (Architecture Requirements)

## 简介
本节定义 TimeTracker 系统的架构级别需求，覆盖部署拓扑、服务间通信、可扩展性、容器化及运行时约束。目标是保证系统在开发与生产场景下可部署、可监控并满足性能/安全要求。

## 架构概述（2-3句）
系统采用三层架构：Next.js 前端（UI）→ FastAPI 后端（REST API）→ 数据存储（SQLite/ PostgreSQL），可选 Redis + Celery 用于异步任务，Nginx 用作反向代理与静态托管。

## 功能点
- API 版本化与前缀：所有后端接口暴露在 `/api/v1` 下，可通过配置修改 `API_V1_PREFIX`。
- 反向代理：Nginx 将 `/api` 转发到后端（8000），根路径和静态资源交由前端（3000/静态构建）处理。
- 异步任务：业务可选使用 Celery（连接 Redis）处理耗时任务并在 worker 中运行。

## 非功能/约束
- 容器化：提供 `docker/Dockerfile.*` 与 `docker-compose*.yml`，支持开发和生产镜像构建。
- 端口与服务：后端 8000，前端 3000，Postgres 5432（若启用），Redis 6379（若启用）。
- 配置驱动：敏感配置（SECRET_KEY、DATABASE_URL、REDIS_URL）通过环境变量或 `.env` 注入。

## 部署拓扑（简要）
- 单机开发：`docker-compose.yml`（默认使用 SQLite）；
- 开发/测试：`docker-compose.dev.yml` 使用 Postgres+Redis；
- 生产建议：使用 Postgres（持久化）、外部 TLS 终端（LB 或 ingress）、以及后端水平扩展与任务队列。

## 健康与监控
- 后端应提供 `/health` 健康检查端点；Dockerfiles 中包含 healthcheck 配置。
- 日志与指标应暴露给宿主或聚合系统（建议：Prometheus + Grafana，未实现）。

## 关键引用（实现位置）
- `docker-compose.yml`：服务列表、默认 DB 配置和端口。
- `docker/nginx.conf`：反向代理规则与超时配置。
- `docker/Dockerfile.backend`：后端容器化及运行命令（uvicorn）。

---

## 未决问题 / 建议
- 确认生产部署的 DB 目标（Postgres 推荐）与备份策略。
- TLS/证书策略：建议在外部 LB 或 ingress 终端处理 HTTPS。
- 指标与告警策略需补充（例如响应时间、队列长度、错误率）。
