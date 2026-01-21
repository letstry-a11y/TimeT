# TimeT 项目需求与开发计划

## 概述
本文档记录 TimeT 项目的功能需求和开发计划，用于跟踪开发进度。

---

## 需求一：愿景-目标关联增强 ✅ 已完成

### 需求描述
1. **愿景管理增强**：愿景可以进行修改，并能够看到其关联的年度目标以及季度目标的情况
2. **目标管理增强**：年度目标能够关联到愿景，并能够修改关联

### 实现内容

#### 1. 愿景页面增强 (`frontend/src/app/(dashboard)/visions/page.tsx`)
- 愿景卡片可展开/收起，显示关联的目标
- 显示年度目标数量和季度目标数量统计
- 展开后显示年度目标列表，每个年度目标下显示其季度子目标
- 显示目标状态和进度条

#### 2. 目标页面增强 (`frontend/src/app/(dashboard)/goals/page.tsx`)
- 编辑年度目标时可以修改关联的愿景
- 愿景选择器在创建和编辑年度目标时都显示

#### 3. 国际化支持
新增翻译键：
- `visions.yearlyGoalsCount`: 年度目标 / Yearly Goals
- `visions.quarterlyGoalsCount`: 季度目标 / Quarterly Goals
- `visions.expandGoals`: 查看目标 / View Goals
- `visions.collapseGoals`: 收起 / Collapse
- `visions.noAssociatedGoals`: 暂无关联目标 / No associated goals

### 修改的文件
| 文件 | 修改内容 |
|------|---------|
| `frontend/src/app/(dashboard)/visions/page.tsx` | 添加展开/收起功能，显示关联目标 |
| `frontend/src/app/(dashboard)/goals/page.tsx` | 修复编辑时愿景关联，显示愿景选择器 |
| `frontend/src/i18n/locales/zh-CN.ts` | 添加中文翻译 |
| `frontend/src/i18n/locales/en-US.ts` | 添加英文翻译 |
| `frontend/src/i18n/types.ts` | 添加翻译类型定义 |

---

## 需求二：时间追踪器增强 🔄 待开发

### 需求描述
1. **按天记录**：Time Tracker 需要按天来记录所有的 records
2. **天/周视图**：具备按天或按周显示当前的所有 records
3. **计划功能**：支持提前计划某个时间段做某个工作
4. **完成状态**：计划任务可以标记完成/未完成状态

### 功能详细说明

#### 记录类型
| 类型 | 说明 | 状态 |
|------|------|------|
| `clock_in` | 实时打卡 | 无状态 |
| `manual` | 手动补录 | 无状态 |
| `planned` | 计划任务（新增） | pending/completed/not_completed |

#### 计划状态
| 状态 | 说明 | 显示 |
|------|------|------|
| `pending` | 待完成 | 显示 [✓完成] [✗未完成] 按钮 |
| `completed` | 已完成 | 显示 ✓ 已完成（绿色） |
| `not_completed` | 未完成 | 显示 ✗ 未完成（红色） |

### UI 设计

```
┌─────────────────────────────────────────────────────┐
│ 时间追踪                                             │
│ 记录你的每一分钟                    [创建计划] [开始计时] │
├─────────────────────────────────────────────────────┤
│ [< 上一周]  2025年1月20日 - 1月26日  [下一周 >]       │
│ 视图: [按天 ●] [按周 ○]                              │
├─────────────────────────────────────────────────────┤
│ 📅 2025-01-21 周二                     总计: 5.5h    │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ⏱ 09:00-11:00  Q1:学习K8s    [打卡] 2h         │ │
│ │ 📋 14:00-16:00  Q1:项目开发   [计划] 待完成 [✓][✗]│ │
│ │ ✍ 16:30-18:00  Q1:写文档     [补录] 1.5h       │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ 📅 2025-01-20 周一                     总计: 4h     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ⏱ 10:00-12:00  Q1:学习K8s    [打卡] 2h         │ │
│ │ 📋 14:00-16:00  Q1:项目开发   [计划] 已完成 ✓   │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 实现计划

#### Phase 1: 后端数据模型和 API

**1.1 修改模型 (`backend/app/models/time_log.py`)**
```python
# 新增 TimeLogStatus 枚举
class TimeLogStatus(str, Enum):
    PENDING = "pending"           # 待完成
    COMPLETED = "completed"       # 已完成
    NOT_COMPLETED = "not_completed"  # 未完成

# TimeLog 模型新增字段
status: Mapped[Optional[TimeLogStatus]] = mapped_column(
    SQLEnum(TimeLogStatus),
    nullable=True,
    default=None
)
```

**1.2 修改 Schema (`backend/app/schemas/timelog.py`)**
```python
# 新增 TimeLogPlanned Schema
class TimeLogPlanned(BaseModel):
    goal_id: str
    start_time: datetime
    end_time: datetime
    note: Optional[str] = None

# 新增 TimeLogStatusUpdate Schema
class TimeLogStatusUpdate(BaseModel):
    status: TimeLogStatus
```

**1.3 修改 CRUD (`backend/app/crud/timelog.py`)**
```python
def create_planned(db: Session, user_id: str, data: TimeLogPlanned) -> TimeLog:
    """创建计划记录"""
    pass

def update_status(db: Session, timelog_id: str, status: TimeLogStatus) -> TimeLog:
    """更新计划状态"""
    pass
```

**1.4 新增 API 端点 (`backend/app/api/v1/endpoints/timelogs.py`)**
```python
# POST /timelogs/planned - 创建计划
# PATCH /timelogs/{id}/status - 更新状态
```

#### Phase 2: 前端类型和 API

**2.1 修改类型 (`frontend/src/types/index.ts`)**
```typescript
export type TimeLogType = "clock_in" | "manual" | "planned";
export type TimeLogStatus = "pending" | "completed" | "not_completed";

export interface TimeLog {
  // ...existing fields
  status?: TimeLogStatus;
}
```

**2.2 修改 API (`frontend/src/lib/api.ts`)**
```typescript
timelogApi = {
  // ...existing
  createPlanned(data: TimeLogPlanned): Promise<TimeLog>,
  updateStatus(id: string, status: TimeLogStatus): Promise<TimeLog>,
}
```

**2.3 修改 Hook (`frontend/src/hooks/useTimelogs.ts`)**
```typescript
// 新增 createPlanned 和 updateStatus 方法
```

#### Phase 3: 前端 UI 重构

**修改 `frontend/src/app/(dashboard)/tracker/page.tsx`**
- 日期选择器（选择查看哪天/哪周）
- 天/周视图切换按钮
- 按天分组显示记录列表
- 创建计划的模态框
- 计划记录的完成/未完成标记按钮

#### Phase 4: 国际化

**新增翻译**
```typescript
// zh-CN
tracker: {
  planned: '计划',
  createPlan: '创建计划',
  planTime: '计划时间',
  markCompleted: '标记完成',
  markNotCompleted: '标记未完成',
  statusPending: '待完成',
  statusCompleted: '已完成',
  statusNotCompleted: '未完成',
  dayView: '按天',
  weekView: '按周',
  prevWeek: '上一周',
  nextWeek: '下一周',
  totalDayHours: '当天总计',
}
```

### 文件修改清单

| 文件 | 修改内容 | 状态 |
|------|---------|------|
| `backend/app/models/time_log.py` | 新增 TimeLogStatus 枚举和 status 字段 | 待开发 |
| `backend/app/schemas/timelog.py` | 新增 TimeLogPlanned、TimeLogStatusUpdate Schema | 待开发 |
| `backend/app/crud/timelog.py` | 新增 create_planned、update_status 函数 | 待开发 |
| `backend/app/api/v1/endpoints/timelogs.py` | 新增 /planned 和 /{id}/status 端点 | 待开发 |
| `frontend/src/types/index.ts` | 新增 TimeLogStatus 类型和字段 | 待开发 |
| `frontend/src/lib/api.ts` | 新增 createPlanned、updateStatus API | 待开发 |
| `frontend/src/hooks/useTimelogs.ts` | 新增 createPlanned、updateStatus 方法 | 待开发 |
| `frontend/src/app/(dashboard)/tracker/page.tsx` | 重构 UI：日期分组、天/周切换、计划功能 | 待开发 |
| `frontend/src/i18n/locales/zh-CN.ts` | 新增翻译 | 待开发 |
| `frontend/src/i18n/locales/en-US.ts` | 新增翻译 | 待开发 |

### 验证方案

1. **计划功能验证**
   - 创建明天的计划任务
   - 创建今天的计划任务
   - 标记计划为已完成
   - 标记计划为未完成

2. **视图功能验证**
   - 切换天/周视图
   - 点击上一周/下一周导航
   - 记录按天正确分组显示
   - 每天总计时长正确

3. **现有功能兼容**
   - 实时打卡功能正常
   - 手动补录功能正常
   - 删除记录功能正常

---

## 更新日志

| 日期 | 内容 |
|------|------|
| 2025-01-21 | 完成需求一：愿景-目标关联增强 |
| 2025-01-21 | 创建需求二计划：时间追踪器增强 |
