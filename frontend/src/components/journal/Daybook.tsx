"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Compass,
  Gift,
  Pencil,
  Plus,
  Timer,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/store/auth";
import api, { timelogApi } from "@/lib/api";
import { parseUtcMs } from "@/lib/utils";
import {
  JournalDay,
  Entry,
  Preview,
  clockMinute,
  dayLabel,
  duration,
  localInput,
  name,
  shiftDay,
  today,
  useJournal,
} from "@/lib/journal";
import CaptureDialog, { Capture, inputTime } from "./CaptureDialog";

const paints = { goal: "#237969", rest: "#ce8f4d", travel: "#687fb1", daily: "#ad707f", other: "#757d88" };
function bounds(entry: Entry, day: string) {
  const base = Date.parse(day + "T00:00:00+08:00");
  const minute = (ms: number) => Math.max(0, Math.min(1440, Math.round((ms - base) / 60000)));
  return [
    minute(parseUtcMs(entry.start_time)),
    minute(entry.end_time ? parseUtcMs(entry.end_time) : Date.now()),
  ];
}

function Timeline({ value, zh }: { value: JournalDay; zh: boolean }) {
  const tracks = [
    {
      label: zh ? "实际" : "Actual",
      entries: value.entries.filter((e) => e.state === "actual" || e.state === "running"),
    },
    {
      label: zh ? "计划" : "Plans",
      entries: value.entries.filter((e) => e.is_plan && e.state !== "skipped"),
    },
  ];
  return (
    <div className="time-chart">
      {tracks.map((track, i) => (
        <div className="time-track" key={i}>
          <span>{track.label}</span>
          <div className="time-rail">
            {value.available_start_minute > 0 && (
              <span
                className="quiet-hours"
                aria-hidden="true"
                style={{ width: value.available_start_minute / 14.4 + "%" }}
              />
            )}
            {track.entries.map((e) => {
              const [a, b] = bounds(e, value.day);
              return (
                <span
                  key={e.id}
                  className={e.state === "running" ? "active-block" : ""}
                  style={{
                    left: a / 14.4 + "%",
                    width: Math.max(0.15, (b - a) / 14.4) + "%",
                    backgroundColor: i === 1 ? "#9981b1" : paints[e.category],
                  }}
                  title={`${clockMinute(a)}–${clockMinute(b)} · ${e.note || e.title || name(e.category, zh)}`}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="rail-axis">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
      {value.available_start_minute > 0 && (
        <p className="planning-window">
          {zh ? "每日可用时段" : "Daily planning window"} {clockMinute(value.available_start_minute)}–24:00
          {" · "}{duration(1440 - value.available_start_minute, zh)}
        </p>
      )}
    </div>
  );
}

export default function Daybook() {
  const { isZh: zh } = useTranslation();
  const words = (cn: string, en: string) => (zh ? cn : en);
  const [day, setDay] = useState(today);
  const [preset, setPreset] = useState<Capture | null>(null);
  const [selectedFocus, setSelectedFocus] = useState("");
  const userId = useAuthStore((s) => s.user?.id);
  const focusKey = userId
    ? "timet-focus:" + userId + ":" + day.slice(0, 4) + "-Q" + Math.ceil(Number(day.slice(5, 7)) / 3)
    : "";
  useEffect(() => {
    try {
      setSelectedFocus(focusKey ? localStorage.getItem(focusKey) || "" : "");
    } catch {
      setSelectedFocus("");
    }
  }, [focusKey]);
  const chooseFocus = (id: string) => {
    setSelectedFocus(id);
    try {
      if (focusKey) localStorage.setItem(focusKey, id);
    } catch {
      /* This session still uses the selection. */
    }
  };
  const [pending, setPending] = useState("");
  const [refresh, setRefresh] = useState(0);
  const daily = useJournal<JournalDay>(`day?day=${day}`, refresh);
  const weekly = useJournal<Preview>(`review?kind=week&anchor=${day}`, refresh);
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("day");
    if (wanted && /^\d{4}-\d{2}-\d{2}$/.test(wanted) && wanted <= today()) setDay(wanted);
    const onFocus = () => setRefresh((v) => v + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const data = daily.data,
    week = weekly.data?.report;
  const focus = data?.goals.find((g) => g.id === selectedFocus) || data?.goals[0];
  const nowMs = Date.now();
  const startMinute = data?.available_start_minute ?? 0;
  const midnight = Date.parse(day + "T00:00:00+08:00");
  const minuteOfDay = (nowMs - midnight) / 60000;
  const outsideFocusWindow = startMinute > 0 && (minuteOfDay < startMinute || minuteOfDay + 15 > 1440);
  useEffect(() => {
    if (!startMinute || day !== today()) return;
    const now = Date.now();
    const nextMidnight = midnight + 1440 * 60000;
    const boundaries = [midnight + startMinute * 60000, nextMidnight - 15 * 60000 + 1, nextMidnight];
    const next = Math.min(...boundaries.filter((boundary) => boundary > now));
    if (!Number.isFinite(next)) return;
    const timer = window.setTimeout(() => {
      setDay(today());
      setRefresh((v) => v + 1);
    }, next - now + 20);
    return () => window.clearTimeout(timer);
  }, [day, midnight, startMinute, refresh]);
  const running = data?.entries.find((e) => e.state === "running");
  const nextPlan = data?.entries.find(
    (e) => e.state === "planned" && e.end_time && parseUtcMs(e.end_time) > nowMs,
  );
  const untilPlan = nextPlan ? Math.floor((parseUtcMs(nextPlan.start_time) - nowMs) / 60000) : Infinity;
  const selectDay = (v: string) => {
    if (v && v >= "1900-01-01" && v <= today()) {
      setPreset(null);
      setDay(v);
    }
  };
  const saveDone = () => {
    setPreset(null);
    setRefresh((v) => v + 1);
  };
  const add = () => {
    const now = Math.floor((Date.now() - midnight) / 60000);
    const last = Math.min(1440, now);
    setPreset(last > startMinute
      ? { start: localInput(day, Math.max(startMinute, last - 25)), end: localInput(day, last) }
      : { start: "", end: "" });
  };
  const act = async (entry: Entry, verb: "confirm" | "remove") => {
    if (pending) return;
    if (verb === "remove" && !window.confirm(words("删除这段生活记录？", "Delete this activity?"))) return;
    setPending(entry.id);
    try {
      if (verb === "confirm") await timelogApi.updateStatus(entry.id, "completed");
      else await api.delete("/api/v1/journal/activities/" + entry.id);
      setRefresh((v) => v + 1);
      toast.success(words("已更新", "Updated"));
    } catch {
      toast.error(
        words("未能更新，请刷新核对此时段。", "Could not update. Refresh and check this interval."),
      );
    } finally {
      setPending("");
    }
  };
  const refreshButton = (
    <button className="text-link" onClick={() => setRefresh((v) => v + 1)}>
      {words("重新加载", "Reload")}
    </button>
  );
  return (
    <div className="journal-page">
      <header className="journal-header">
        <div>
          <p className="context-line">
            <CalendarDays size={15} />
            {dayLabel(day, zh, { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
          <h1>{words("时间手帐", "Time journal")}</h1>
        </div>
        <div className="header-actions">
          <Link className="quiet-button" href="/tracker">
            <Timer size={16} />
            {words("计时与计划", "Timer & plans")}
          </Link>
          <button className="solid-button" disabled={!data} onClick={add}>
            <Plus size={17} />
            {words("记一段时间", "Log time")}
          </button>
        </div>
      </header>
      <div className="day-picker">
        <div className="inline-controls">
          <button aria-label={words("前一天", "Previous day")} onClick={() => selectDay(shiftDay(day, -1))}>
            <ChevronLeft size={18} />
          </button>
          <input
            aria-label={words("查看日期", "Journal date")}
            type="date"
            min="1900-01-01"
            max={today()}
            value={day}
            onChange={(e) => selectDay(e.target.value)}
          />
          <button
            aria-label={words("后一天", "Next day")}
            disabled={day >= today()}
            onClick={() => selectDay(shiftDay(day, 1))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button className="text-link" onClick={() => selectDay(today())}>
          {words("今天", "Today")}
        </button>
      </div>
      {daily.error && (
        <p role="alert">
          {words("这一天的记录加载失败。", "Could not load this day.")} {refreshButton}
        </p>
      )}
      {!data ? (
        !daily.error && <p role="status">{words("正在读取时间记录…", "Loading your day…")}</p>
      ) : (
        <>
          <div className="journal-columns">
            <section className="paper day-summary">
              <h2>
                <Clock3 size={19} />
                {words("一天的时间", "Day at a glance")}
              </h2>
              <p className="big-duration">{duration(data.actual_minutes, zh)}</p>
              <div className="metric-notes">
                <span>
                  <i style={{ background: paints.goal }} />
                  {words("目标投入", "Goals")} {duration(data.goal_minutes, zh)}
                </span>
                <span>
                  <i style={{ background: paints.rest }} />
                  {words("生活时间", "Everyday")} {duration(data.life_minutes, zh)}
                </span>
              </div>
              <Timeline value={data} zh={zh} />
              {data.overlap_minutes > 0 && (
                <p className="muted">
                  {words("总时长已扣除记录重叠的 ", "Total excludes overlapping time of ")}
                  {duration(data.overlap_minutes, zh)}
                </p>
              )}
            </section>
            <section className="paper pace-card">
              <h2>
                <BookOpen size={19} />
                {words("这一周的节奏", "Week in view")}
              </h2>
              {week ? (
                <>
                  <p>
                    <strong>{duration(week.minutes, zh)}</strong>
                    <span>
                      {" "}
                      · {week.days} {words("个记录日", "days recorded")}
                    </span>
                  </p>
                  <div className="spark-week">
                    {week.trend.map((b) => (
                      <button
                        key={b.date}
                        onClick={() => selectDay(b.date)}
                        disabled={b.date > today()}
                        aria-pressed={b.date === day}
                        title={b.date + " · " + duration(b.minutes, zh)}
                        aria-label={b.date + " · " + duration(b.minutes, zh)}
                      >
                        <span className="spark-track">
                          <i
                            style={{
                              height: b.minutes
                                ? Math.max(
                                    5,
                                    (b.minutes / Math.max(1, ...week.trend.map((t) => t.minutes))) * 100,
                                  ) + "%"
                                : 0,
                            }}
                          />
                        </span>
                        <small>{dayLabel(b.date, zh, { weekday: "narrow" })}</small>
                      </button>
                    ))}
                  </div>
                  <Link className="text-link" href={`/reviews?kind=week&date=${day}`}>
                    {words("打开本周复盘", "Open weekly review")} <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <p>{weekly.error ? refreshButton : words("正在读取…", "Loading…")}</p>
              )}
            </section>
          </div>
          <div className="journal-columns second-row">
            <section className="paper">
              <div className="section-title">
                <h2>{words("按时间查看", "Timeline")}</h2>
                <span>
                  {data.entries.length} {words("段", "entries")}
                </span>
              </div>
              {data.entries.length === 0 && (
                <p className="empty-note">
                  {words(
                    "这一天还没有记录。可以先记下刚刚做过的一件事。",
                    "No entries for this day yet. Start with one thing you remember.",
                  )}
                </p>
              )}
              <ul className="entry-list">
                {data.entries.map((e) => {
                  const [a, b] = bounds(e, day);
                  const label = e.note || e.title || name(e.category, zh);
                  const state =
                    e.state === "planned"
                      ? words("计划待确认", "Planned")
                      : e.state === "skipped"
                        ? words("已跳过", "Skipped")
                        : e.state === "running"
                          ? words("计时中", "Running")
                          : e.is_plan
                            ? words("计划已完成", "Confirmed plan")
                            : words("已记录", "Recorded");
                  return (
                    <li key={e.id}>
                      <span className="entry-time">
                        {clockMinute(a)}
                        <small>{clockMinute(b)}</small>
                      </span>
                      <i className="entry-pin" style={{ background: paints[e.category] }} />
                      <div className="entry-text">
                        <strong>{label}</strong>
                        <small>
                          {[e.note ? e.title || name(e.category, zh) : "", state].filter(Boolean).join(" · ")}
                        </small>
                      </div>
                      <div className="entry-actions">
                        {e.state === "planned" && e.end_time && parseUtcMs(e.end_time) <= Date.now() && (
                          <button
                            className="text-link"
                            disabled={!!pending}
                            onClick={() => act(e, "confirm")}
                          >
                            <Check size={14} />
                            {words("按此时段完成", "Confirm times")}
                          </button>
                        )}
                        {e.end_time && (
                          <button
                            aria-label={words("编辑时段", "Edit interval") + " " + label}
                            onClick={() =>
                              setPreset({
                                start: inputTime(e.start_time),
                                end: inputTime(e.end_time!),
                                entry: e,
                              })
                            }
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        {!e.goal_id && (
                          <button
                            disabled={!!pending}
                            aria-label={words("删除生活记录", "Delete activity") + " " + label}
                            onClick={() => act(e, "remove")}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                        {e.state === "running" && (
                          <Link className="text-link" href="/tracker">
                            {words("打开计时器", "Open timer")}
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <details className="gap-list">
                <summary>
                  {words("查看可补记时段", "Show available intervals")} · {data.gaps.length}
                </summary>
                <p>
                  {words(
                    "只补记你记得的部分，空白也可以保留。",
                    "Record the parts you remember. Open time can stay open.",
                  )}
                </p>
                {data.gaps.map((g) => (
                  <button
                    key={g.start_minute}
                    onClick={() =>
                      setPreset({
                        start: localInput(day, g.start_minute),
                        end: localInput(day, g.end_minute),
                      })
                    }
                  >
                    <Plus size={13} /> {clockMinute(g.start_minute)}–{clockMinute(g.end_minute)}
                  </button>
                ))}
              </details>
            </section>
            <aside className="side-stack">
              {day === today() && (
                <section className="paper focus-card">
                  <h2>
                    <Compass size={19} />
                    {words("下一小步", "Next small step")}
                  </h2>
                  {running ? (
                    <>
                      <p>
                        {words("正在计时", "Timer running")} · <strong>{running.title}</strong>
                      </p>
                      <Link className="text-link" href="/tracker">
                        {words("回到当前计时", "Return to timer")} <ArrowRight size={14} />
                      </Link>
                    </>
                  ) : nextPlan && untilPlan < 15 ? (
                    <>
                      <p>
                        {words("这段时间已有安排", "You have a plan in this time")} ·{" "}
                        <strong>{nextPlan.note || nextPlan.title}</strong>
                      </p>
                      <p>
                        {inputTime(nextPlan.start_time).slice(11)}–{inputTime(nextPlan.end_time!).slice(11)}
                      </p>
                      <Link className="text-link" href="/tracker">
                        {words("查看计划", "View plan")} <ArrowRight size={14} />
                      </Link>
                    </>
                  ) : outsideFocusWindow ? (
                    <p>
                      {minuteOfDay < startMinute
                        ? words("今天的可用时段从 ", "Today's planning window opens at ") + clockMinute(startMinute) + (zh ? " 开始。" : ".")
                        : words("今天的可用时段即将结束。", "Today's planning window is almost over.")}
                    </p>
                  ) : focus ? (
                    <>
                      <label className="sr-only" htmlFor="focus-goal">
                        {words("选择关注目标", "Choose focus goal")}
                      </label>
                      <select id="focus-goal" value={focus.id} onChange={(e) => chooseFocus(e.target.value)}>
                        {data.goals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                      {selectedFocus && (
                        <button className="text-link" onClick={() => chooseFocus("")}>
                          {words("恢复系统推荐", "Use suggested goal")}
                        </button>
                      )}
                      <p>
                        {words("近七天", "Last seven days")} {duration(focus.recent_minutes, zh)} ·{" "}
                        {focus.recent_days} {words("个记录日", "active days")}
                      </p>
                      {focus.target_hours > 0 && (
                        <>
                          <div className="thin-rail">
                            <i
                              style={{
                                width: Math.min(100, (focus.logged_hours / focus.target_hours) * 100) + "%",
                              }}
                            />
                          </div>
                          <small>
                            {words("季度投入", "Quarter time")} {focus.logged_hours} / {focus.target_hours} h
                          </small>
                        </>
                      )}
                      <p>
                        {words(
                          "结合季度预算和近七天的记录，选一段 15 分钟的小任务就可以开始。",
                          "Choose a 15-minute task using your quarter budget and recent activity.",
                        )}
                      </p>
                      <Link className="text-link" href={`/tracker?goal=${focus.id}`}>
                        {words("用这个目标计时", "Use this goal in timer")} <ArrowRight size={14} />
                      </Link>
                    </>
                  ) : (
                    <Link className="text-link" href="/goals">
                      {words("选择一个季度目标", "Set a quarterly goal")} <ArrowRight size={14} />
                    </Link>
                  )}
                </section>
              )}
              <section className="paper reward-link">
                <Coffee size={21} />
                <div>
                  <h2>{words("我的完成奖励", "My goal rewards")}</h2>
                  <Link className="text-link" href="/goals#rewards">
                    {words("查看奖励与成果", "View rewards and outcomes")} <Gift size={14} />
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
      {preset && data && (
        <CaptureDialog preset={preset} day={data} saved={saveDone} close={() => setPreset(null)} />
      )}
    </div>
  );
}
