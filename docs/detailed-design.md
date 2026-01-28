# 详细设计需求 (Detailed Design Requirements)

## 简介
该文档将代码层面的设计与实现细节对齐到需求，包括主要数据模型、关键 API、服务逻辑位置、前端调用点以及验证要点，便于开发与代码审查。

## 主要数据模型（摘要）
- `User` (backend/app/models/user.py)：字段包括 `id, email, username, hashed_password, is_active, is_superuser, created_at`，关系到 visions/goals/timelogs。
- `Vision` (backend/app/models/vision.py)：`id, user_id, title, description, target_year, sort_order, is_archived`。
- `Goal` (backend/app/models/goal.py)：`id, user_id, vision_id?, parent_id?, goal_type (yearly|quarterly), year, quarter, target_hours, accumulated_hours, status`，支持自引用 parent/children。
- `TimeLog` (backend/app/models/time_log.py)：`id, user_id, goal_id, task_id?, log_type (clock_in|manual|planned), status (pending|completed|not_completed), start_time, end_time, duration_minutes, note`。

## 关键 API 与实现位置（示例）
- Auth: `/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh` — 实现在 `backend/app/api/v1/endpoints/auth`，依赖 `backend/app/core/security.py`、`backend/app/crud/user.py`。
- Timelogs: `/api/v1/timelogs/start`, `/api/v1/timelogs/{id}/stop`, `/api/v1/timelogs/planned`, `/api/v1/timelogs/{id}/status` — 业务逻辑在 `backend/app/crud/timelog.py` 与 `backend/app/services/time_tracking.py`。
- Goals: `/api/v1/goals`, `/api/v1/goals/{id}/tree` — 验证规则与树构建位于 `backend/app/services/goal_hierarchy.py`。

## 业务规则与约束（须在实现中保证）
- 目标层级限制：年度目标必须关联愿景；季度目标必须关联年度目标（`goal_hierarchy.py` 验证）。
- 计时约束：同一用户只能存在一个运行中的 `clock_in`；`planned` 仅在标记为 `completed` 时计入累计时长（`crud/timelog.py`）。
- 数据隔离：所有查询应基于 `user_id` 限制结果，防止越权访问（middleware 或依赖注入 `get_current_user`）。

## 前端与接口对齐（示例文件）
- `frontend/src/lib/api.ts`：Axios 实例、拦截器（token 注入与刷新）。
- `frontend/src/hooks/useTimelogs.ts`：封装 timelog 接口调用（start/stop/create/update/delete）。
- `frontend/src/store/auth.ts`：token 本地持久化（Zustand persist）。

## 验证与测试要点
- 使用现有 pytest 用例（`backend/tests/api/*`）验证：注册/登录、目标创建/校验、时长记录流程、计划任务状态流转、权限控制。
- 集成测试：建议增加端到端测试覆盖典型用户流程（注册→创建愿景→创建目标→开始计时→停止计时→报告查看）。

## 参考位置（关键文件）
- `backend/app/crud/timelog.py`
- `backend/app/services/goal_hierarchy.py`
- `frontend/src/lib/api.ts`
- `backend/run.py`, `runstep.txt`（运行与端口说明）

## 未决/需确认项
- `Task` 模型的字段和约束（`backend/app/models/task.py` 若存在需确认）。
- 计划任务的重复/排期冲突策略（前端/后端如何校验重叠）。
- 生产级别监控与备份策略。
