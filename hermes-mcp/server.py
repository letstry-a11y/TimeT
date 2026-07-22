"""hermes ⇄ TimeTracker MCP server.

Exposes the TimeTracker time-management API to an LLM agent (hermes) as a small
set of MCP tools. Auth is a single static API key (see backend HERMES_API_KEY),
sent as an `X-API-Key` header on every request — no login / token refresh.

Run:
    TIMETRACKER_API_URL=http://localhost:8080/api/v1 \
    HERMES_API_KEY=<your-key> \
    python server.py

All times exposed to / accepted from the agent are **Beijing time (UTC+8)**;
conversion to/from the UTC the backend stores happens here.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.environ.get("TIMETRACKER_API_URL", "http://localhost:8080/api/v1").rstrip("/")
API_KEY = os.environ.get("HERMES_API_KEY", "")

BEIJING = timezone(timedelta(hours=8))

mcp = FastMCP("timetracker")


def _client() -> httpx.Client:
    if not API_KEY:
        raise RuntimeError("HERMES_API_KEY env var is not set")
    return httpx.Client(
        base_url=API_URL,
        headers={"X-API-Key": API_KEY},
        timeout=15.0,
    )


def _beijing_str_to_utc_iso(local: str) -> str:
    """'2026-07-22 14:00' (Beijing) -> '2026-07-22T06:00:00Z' (UTC)."""
    dt = datetime.fromisoformat(local.strip().replace("T", " "))
    dt = dt.replace(tzinfo=BEIJING)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _utc_iso_to_beijing(iso: str | None) -> str | None:
    """Backend naive-UTC string -> Beijing 'YYYY-MM-DD HH:MM' for display."""
    if not iso:
        return None
    s = iso[:-1] if iso.endswith("Z") else iso
    dt = datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
    return dt.astimezone(BEIJING).strftime("%Y-%m-%d %H:%M")


def _slim_log(log: dict) -> dict:
    """Trim a raw timelog to the fields hermes cares about (Beijing times)."""
    return {
        "id": log["id"],
        "goal_id": log["goal_id"],
        "log_type": log.get("log_type"),
        "status": log.get("status"),
        "start_time": _utc_iso_to_beijing(log.get("start_time")),
        "end_time": _utc_iso_to_beijing(log.get("end_time")),
        "duration_minutes": log.get("duration_minutes"),
        "note": log.get("note"),
        "is_running": log.get("is_running"),
    }


@mcp.tool()
def list_goals() -> list[dict]:
    """List the current-quarter quarterly goals (id + title + progress).

    Use this first to discover the goal_id you need for start_timer /
    add_manual_log. Time can only be logged against quarterly goals.
    """
    now = datetime.now(BEIJING)
    quarter = (now.month - 1) // 3 + 1
    with _client() as c:
        r = c.get("/goals", params={"year": now.year, "goal_type": "quarterly"})
        r.raise_for_status()
        goals = r.json()
    return [
        {
            "id": g["id"],
            "title": g.get("title"),
            "quarter": g.get("quarter"),
            "status": g.get("status"),
            "target_hours": g.get("target_hours"),
            "accumulated_hours": g.get("accumulated_hours"),
        }
        for g in goals
        if g.get("quarter") == quarter and g.get("status") != "completed"
    ]


@mcp.tool()
def list_time_logs(days_back: int = 1) -> list[dict]:
    """List time logs from the last `days_back` days (default 1 = today).

    Times are returned in Beijing time. days_back=1 covers today; use a larger
    number to look further back.
    """
    start = (datetime.now(BEIJING) - timedelta(days=max(days_back - 1, 0))).date()
    with _client() as c:
        r = c.get("/timelogs", params={"start_date": start.isoformat(), "limit": 100})
        r.raise_for_status()
        logs = r.json()
    return [_slim_log(x) for x in logs]


@mcp.tool()
def get_current_session() -> dict | None:
    """Return the currently running timer session, or null if none is running."""
    with _client() as c:
        r = c.get("/timelogs/current")
        r.raise_for_status()
        data = r.json()
    return _slim_log(data) if data else None


@mcp.tool()
def start_timer(goal_id: str, note: str = "") -> dict:
    """Start a live clock-in timer for a quarterly goal. Only one may run at a time."""
    payload = {"goal_id": goal_id}
    if note:
        payload["note"] = note
    with _client() as c:
        r = c.post("/timelogs/start", json=payload)
        r.raise_for_status()
        return _slim_log(r.json())


@mcp.tool()
def stop_timer(note: str = "") -> dict:
    """Stop the currently running timer and record its duration."""
    with _client() as c:
        cur = c.get("/timelogs/current")
        cur.raise_for_status()
        session = cur.json()
        if not session:
            raise RuntimeError("No timer is currently running")
        body = {"note": note} if note else {}
        r = c.patch(f"/timelogs/{session['id']}/stop", json=body)
        r.raise_for_status()
        return _slim_log(r.json())


@mcp.tool()
def add_manual_log(goal_id: str, start_time: str, end_time: str, note: str = "") -> dict:
    """Add a completed time entry after the fact.

    start_time / end_time are Beijing local time, format 'YYYY-MM-DD HH:MM'
    (e.g. '2026-07-22 14:00'). end_time must be after start_time.
    """
    payload = {
        "goal_id": goal_id,
        "start_time": _beijing_str_to_utc_iso(start_time),
        "end_time": _beijing_str_to_utc_iso(end_time),
    }
    if note:
        payload["note"] = note
    with _client() as c:
        r = c.post("/timelogs", json=payload)
        r.raise_for_status()
        return _slim_log(r.json())


@mcp.tool()
def get_weekly_report() -> dict:
    """Get this week's time-tracking summary (Beijing timezone)."""
    with _client() as c:
        r = c.get("/reports/weekly", params={"tz_offset": 480})
        r.raise_for_status()
        return r.json()


if __name__ == "__main__":
    mcp.run()
