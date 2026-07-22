# hermes ⇄ TimeTracker MCP

让 hermes（Claude 智能体）免登录、方便地读写时间管理系统。

## 架构（两层）

1. **后端 API Key 旁路** —— 后端 `HERMES_API_KEY`（见根目录 `.env`）。任何带
   `X-API-Key: <key>` 请求头的调用，都会以 `HERMES_USER_EMAIL`（默认
   `shaohuizy@gmail.com`）的身份执行，**完全跳过 JWT 登录/刷新/过期**。前端原有
   的登录方式不受影响，两条路径并存。
2. **MCP server（本目录）** —— 把常用操作封装成 MCP 工具，内部自动带上密钥。
   hermes 直接拿到工具，调用零摩擦。

## 工具

| 工具 | 作用 |
| --- | --- |
| `list_goals()` | 列出本季度可记录的季度目标（拿 `goal_id` 用） |
| `list_time_logs(days_back=1)` | 最近 N 天的时间记录（默认今天），北京时间 |
| `get_current_session()` | 当前是否有正在计时的会话 |
| `start_timer(goal_id, note="")` | 开始实时计时 |
| `stop_timer(note="")` | 停止当前计时并记录时长 |
| `add_manual_log(goal_id, start_time, end_time, note="")` | 事后补录，时间为北京时间 `YYYY-MM-DD HH:MM` |
| `get_weekly_report()` | 本周汇总 |

所有对外的时间都是**北京时间（UTC+8）**，与后端存储的 UTC 转换在本层完成。

## 运行

需要 **Python 3.10+**。

```bash
cd hermes-mcp
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export TIMETRACKER_API_URL=http://localhost:8080/api/v1   # 公网部署换成实际域名
export HERMES_API_KEY=<与后端 .env 中一致的密钥>
python server.py
```

## 注册到 Claude / hermes

在 hermes 的 MCP 配置里加一个 stdio server（示例 `claude_desktop_config.json` 或
Claude Code 的 `.mcp.json`）：

```json
{
  "mcpServers": {
    "timetracker": {
      "command": "/绝对路径/hermes-mcp/.venv/bin/python",
      "args": ["/绝对路径/hermes-mcp/server.py"],
      "env": {
        "TIMETRACKER_API_URL": "http://localhost:8080/api/v1",
        "HERMES_API_KEY": "<密钥>"
      }
    }
  }
}
```

之后 hermes 即可用自然语言驱动，例如「记录我今天下午两点到四点在做 AI learning」→
它会 `list_goals()` 找到目标，再 `add_manual_log(...)`。

## 安全

- 密钥等价于 shaohuizy 账号的完整读写权限，**务必保密**、勿提交到 git（`.env`
  已被忽略）。
- 公网部署建议同时给后端加 HTTPS；如需轮换，改后端 `.env` 的 `HERMES_API_KEY`
  并重启 backend 即可，旧密钥立即失效。
