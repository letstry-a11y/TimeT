"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  Pencil,
  Play,
  Plus,
  Square,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { TrackerEntryDialog, type EntryDraft } from "@/components/journal/TrackerEntryDialog";
import { formatElapsed, useElapsedTime } from "@/components/Timer";
import { useGoals } from "@/hooks/useGoals";
import { useTimelogs } from "@/hooks/useTimelogs";
import { useTranslation } from "@/i18n";
import { dayLabel, today } from "@/lib/journal";
import {
  getBeijingNow,
  formatDuration,
  getWeekDates,
  formatWeekRange,
  isSameDay,
  toDateString,
  formatTimeOnly,
  parseUtcDateString,
} from "@/lib/utils";
import type { TimeLog } from "@/types";
import "./tracker.css";

type ViewMode = "day" | "week";
type Dialog = "manual" | "plan" | "edit";
const emptyDraft: EntryDraft = { goal_id: "", start_time: "", end_time: "", note: "" };

interface DayGroup {
  date: Date;
  dateStr: string;
  logs: TimeLog[];
  totalMinutes: number;
}

function beijingInputToUtcIso(local: string): string {
  return new Date(local + "+08:00").toISOString();
}

function toDateTimeLocal(stamp: string): string {
  return parseUtcDateString(stamp).toISOString().slice(0, 16);
}

export default function TrackerPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(getBeijingNow);
  const [entryAnchor, setEntryAnchor] = useState("");
  const scrolledAnchor = useRef("");
  useEffect(() => {
    const readLocation = () => {
      const day = new URLSearchParams(window.location.search).get("day");
      if (day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
        const date = new Date(day + "T00:00:00Z");
        if (toDateString(date) === day) {
          setCurrentDate(date);
          setViewMode("day");
        }
      }
      const anchor = window.location.hash.slice(1);
      scrolledAnchor.current = "";
      setEntryAnchor(anchor.startsWith("log-") ? anchor : "");
    };
    readLocation();
    window.addEventListener("hashchange", readLocation);
    window.addEventListener("popstate", readLocation);
    return () => {
      window.removeEventListener("hashchange", readLocation);
      window.removeEventListener("popstate", readLocation);
    };
  }, []);
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const firstDay = viewMode === "day" ? currentDate : weekDates[0];
  const lastDay = viewMode === "day" ? currentDate : weekDates[6];
  // The existing list API filters on UTC start dates. Request the UTC dates
  // touching the visible Beijing window, and group them locally below.
  const utcDay = (d: Date, time: string) =>
    new Date(toDateString(d) + time + "+08:00").toISOString().slice(0, 10);
  const { goals: allGoals } = useGoals({ include_archived: true });

  // All quarterly goals (including completed), sorted by parent yearly goal's
  // sort_order, then by their own sort_order. Used to resolve goal titles for
  // existing timelogs — completed goals must stay resolvable here, otherwise
  // logs linked to a finished quarter render as "Unknown Goal".
  const allQuarterlyGoals = useMemo(() => {
    const yearlyGoals = allGoals.filter((g) => g.goal_type === "yearly");
    const quarterlyGoals = allGoals.filter((g) => g.goal_type === "quarterly");

    return quarterlyGoals.sort((a, b) => {
      const parentA = yearlyGoals.find((y) => y.id === a.parent_id);
      const parentB = yearlyGoals.find((y) => y.id === b.parent_id);

      const parentSortA = parentA?.sort_order ?? 0;
      const parentSortB = parentB?.sort_order ?? 0;

      if (parentSortA !== parentSortB) {
        return parentSortA - parentSortB;
      }

      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [allGoals]);

  const choicesFor = (local: string) => {
    const day = local.slice(0, 10) || today();
    const quarter = Math.ceil(Number(day.slice(5, 7)) / 3);
    return allQuarterlyGoals.filter(
      (g) =>
        !g.is_archived &&
        ["not_started", "in_progress"].includes(g.status) &&
        g.year === Number(day.slice(0, 4)) &&
        g.quarter === quarter,
    );
  };
  const goals = choicesFor(today());

  const {
    timelogs,
    currentSession,
    isLoading,
    error,
    startSession,
    stopSession,
    createManual,
    createPlanned,
    updateStatus,
    updateTimelog,
    deleteTimelog,
    refetch,
  } = useTimelogs({ start_date: utcDay(firstDay, "T00:00"), end_date: utcDay(lastDay, "T23:59") });
  const { t, locale, isZh } = useTranslation();

  const elapsed = useElapsedTime(!!currentSession, currentSession?.start_time);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [note, setNote] = useState("");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [manualData, setManualData] = useState<EntryDraft>(emptyDraft);
  const [planData, setPlanData] = useState<EntryDraft>(emptyDraft);
  const [editData, setEditData] = useState<(EntryDraft & { id: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("goal");
    if (requested && allQuarterlyGoals.some((g) => g.id === requested)) setSelectedGoalId(requested);
  }, [allQuarterlyGoals]);
  const manualGoals = choicesFor(manualData.start_time);
  const planGoals = choicesFor(planData.start_time);
  const editGoals = choicesFor(editData?.start_time || "");
  const timerGoal = goals.some((g) => g.id === selectedGoalId) ? selectedGoalId : "";

  // Group timelogs by day
  const groupedLogs = useMemo(() => {
    const groups: DayGroup[] = [];
    const dateMap = new Map<string, DayGroup>();

    // Sort logs by start_time descending (parseUtcDateString returns Beijing Date)
    const sortedLogs = [...timelogs].sort(
      (a, b) => parseUtcDateString(b.start_time).getTime() - parseUtcDateString(a.start_time).getTime(),
    );

    for (const log of sortedLogs) {
      const logDate = parseUtcDateString(log.start_time);
      const dateStr = toDateString(logDate);

      // Filter by date range based on view mode
      if (viewMode === "day") {
        if (!isSameDay(logDate, currentDate)) continue;
      } else {
        const weekStart = new Date(weekDates[0].getTime());
        weekStart.setUTCHours(0, 0, 0, 0);
        const weekEnd = new Date(weekDates[6].getTime());
        weekEnd.setUTCHours(23, 59, 59, 999);
        if (logDate.getTime() < weekStart.getTime() || logDate.getTime() > weekEnd.getTime()) continue;
      }

      if (!dateMap.has(dateStr)) {
        const dayGroup: DayGroup = {
          date: new Date(logDate.getTime()),
          dateStr,
          logs: [],
          totalMinutes: 0,
        };
        dateMap.set(dateStr, dayGroup);
        groups.push(dayGroup);
      }

      const group = dateMap.get(dateStr)!;
      group.logs.push(log);
      // Only count completed logs (not planned pending/not_completed)
      if (log.duration_minutes && (log.log_type !== "planned" || log.status === "completed")) {
        group.totalMinutes += log.duration_minutes;
      }
    }

    // Sort groups by date descending
    groups.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Sort logs within each group by start_time
    for (const group of groups) {
      group.logs.sort(
        (a, b) => parseUtcDateString(a.start_time).getTime() - parseUtcDateString(b.start_time).getTime(),
      );
    }

    return groups;
  }, [timelogs, currentDate, viewMode, weekDates]);

  useEffect(() => {
    if (!entryAnchor || isLoading || scrolledAnchor.current === entryAnchor) return;
    const row = document.getElementById(entryAnchor);
    if (row) {
      row.scrollIntoView({ block: "nearest" });
      scrolledAnchor.current = entryAnchor;
    }
  }, [entryAnchor, groupedLogs, isLoading]);

  const navigate = (direction: number) => {
    const move = viewMode === "day" ? direction : direction * 7;
    setCurrentDate((date) => {
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + move);
      return next;
    });
  };

  const runAction = async (action: () => Promise<unknown>) => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try {
      await action();
    } catch {
      // useTimelogs displays the API error. Keep the current form and its draft.
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };

  const handleTimer = async () => {
    if (currentSession) {
      await stopSession(currentSession.id, note || undefined);
      void refetch();
    } else {
      if (!timerGoal) return;
      await startSession({ goal_id: timerGoal, note: note || undefined });
    }
    setNote("");
  };

  const saveEntry = async (draft: EntryDraft) => {
    const start_time = beijingInputToUtcIso(draft.start_time);
    const end_time = beijingInputToUtcIso(draft.end_time);
    const body = { goal_id: draft.goal_id, start_time, end_time, note: draft.note || undefined };
    if (dialog === "edit" && editData) {
      await updateTimelog(editData.id, {
        ...body,
        duration_minutes: (Date.parse(end_time) - Date.parse(start_time)) / 60000,
      });
      setEditData(null);
    } else if (dialog === "plan") {
      await createPlanned(body);
      setPlanData(emptyDraft);
    } else if (dialog === "manual") {
      await createManual(body);
      setManualData(emptyDraft);
    }
    setDialog(null);
  };

  const openEdit = (log: TimeLog) => {
    setEditData({
      id: log.id,
      goal_id: log.goal_id,
      start_time: toDateTimeLocal(log.start_time),
      end_time: log.end_time ? toDateTimeLocal(log.end_time) : "",
      note: log.note || "",
    });
    setDialog("edit");
  };

  const currentGoal = allQuarterlyGoals.find((goal) => goal.id === currentSession?.goal_id);
  // A historical log can belong to a goal which is now completed or archived.
  const retainedGoal = allQuarterlyGoals.find((goal) => goal.id === editData?.goal_id);
  const editChoices =
    retainedGoal && !editGoals.some((g) => g.id === retainedGoal.id)
      ? [retainedGoal, ...editGoals]
      : editGoals;
  const dateStr = toDateString(currentDate);
  const journalUrl = dateStr <= today() ? "/dashboard?day=" + dateStr : "/dashboard";
  const records = groupedLogs.flatMap((group) => group.logs);
  const recordedMinutes = groupedLogs.reduce((total, group) => total + group.totalMinutes, 0);
  const pendingPlans = records.filter((log) => log.log_type === "planned" && log.status === "pending").length;
  const kindLabels = {
    clock_in: t("tracker.clockIn"),
    manual: t("tracker.manual"),
    planned: t("tracker.planned"),
  };
  const statusLabels = {
    pending: t("tracker.statusPending"),
    completed: t("tracker.statusCompleted"),
    not_completed: t("tracker.statusNotCompleted"),
  };
  const waitingForRecords = isLoading || !!error;

  return (
    <div className="journal-page tracker-page">
      <header className="journal-header">
        <div>
          <p className="context-line">
            <CalendarDays size={15} />
            {dayLabel(dateStr, isZh, { year: "numeric", month: "long", day: "numeric", weekday: "long" })}
          </p>
          <h1>{t("tracker.title")}</h1>
        </div>
        <div className="header-actions">
          <button type="button" className="quiet-button" onClick={() => setDialog("plan")}>
            <CalendarClock size={16} /> {t("tracker.createPlan")}
          </button>
          <button type="button" className="solid-button" onClick={() => setDialog("manual")}>
            <Plus size={17} /> {t("tracker.manualEntry")}
          </button>
        </div>
      </header>

      <div className="journal-columns">
        <section className="paper day-summary tracker-timer" aria-labelledby="timer-heading">
          <div className="section-title">
            <h2 id="timer-heading">
              <Timer size={19} /> {t("tracker.sessionTimer")}
            </h2>
            {currentSession && (
              <span role="status" className="tracker-live">
                {t("tracker.running")}
              </span>
            )}
          </div>
          <div className="tracker-clock">
            <strong className="big-duration" role="timer" aria-label={t("tracker.elapsed")}>
              {formatElapsed(elapsed)}
            </strong>
            <button
              type="button"
              className="solid-button"
              disabled={saving || (!currentSession && !timerGoal)}
              onClick={() => void runAction(handleTimer)}
            >
              {currentSession ? <Square size={15} /> : <Play size={16} />}
              {t(currentSession ? "timer.stop" : "timer.start")}
            </button>
          </div>
          <div className="tracker-fields">
            {currentSession ? (
              <div className="tracker-current-goal">
                <strong>
                  {currentGoal ? `Q${currentGoal.quarter} · ${currentGoal.title}` : t("tracker.unknownGoal")}
                </strong>
                <small>
                  {t("dashboard.startedAt", { time: formatTimeOnly(currentSession.start_time, locale) })}
                </small>
              </div>
            ) : (
              <Select
                id="goal"
                label={t("tracker.selectGoal")}
                value={timerGoal}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                options={[
                  { value: "", label: t("tracker.selectQuarterlyGoal") },
                  ...goals.map((g) => ({ value: g.id, label: `Q${g.quarter} · ${g.title}` })),
                ]}
              />
            )}
            <Input
              id="note"
              label={t("tracker.note")}
              placeholder={t("tracker.notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </section>

        <section className="paper pace-card tracker-view" aria-labelledby="view-heading">
          <div className="section-title">
            <h2 id="view-heading">
              <CalendarDays size={19} /> {t("tracker.browse")}
            </h2>
            <div className="choice-strip" role="group" aria-label={t("tracker.view")}>
              <button type="button" aria-pressed={viewMode === "day"} onClick={() => setViewMode("day")}>
                {t("tracker.dayView")}
              </button>
              <button type="button" aria-pressed={viewMode === "week"} onClick={() => setViewMode("week")}>
                {t("tracker.weekView")}
              </button>
            </div>
          </div>
          <div className="day-picker">
            <div className="inline-controls">
              <button
                type="button"
                aria-label={t(viewMode === "day" ? "tracker.prevDay" : "tracker.prevWeek")}
                onClick={() => navigate(-1)}
              >
                <ChevronLeft size={17} />
              </button>
              <input
                type="date"
                aria-label={t("tracker.date")}
                value={dateStr}
                onChange={(e) => {
                  if (e.currentTarget.valueAsDate) setCurrentDate(e.currentTarget.valueAsDate);
                }}
              />
              <button
                type="button"
                aria-label={t(viewMode === "day" ? "tracker.nextDay" : "tracker.nextWeek")}
                onClick={() => navigate(1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <button type="button" className="text-link" onClick={() => setCurrentDate(getBeijingNow())}>
              {t("tracker.today")}
            </button>
          </div>
          <dl className="tracker-totals">
            <div>
              <dt>{t("tracker.loggedGoalTime")}</dt>
              <dd>{waitingForRecords ? "—" : formatDuration(Math.round(recordedMinutes), locale)}</dd>
            </div>
            <div>
              <dt>{t("tracker.pendingPlans")}</dt>
              <dd>{waitingForRecords ? "—" : pendingPlans}</dd>
            </div>
          </dl>
          <Link className="text-link" href={journalUrl}>
            <BookOpen size={15} /> {t("tracker.openJournal")} <ArrowRight size={14} />
          </Link>
        </section>
      </div>

      <section className="paper tracker-records" aria-labelledby="records-heading" aria-busy={isLoading}>
        <div className="section-title">
          <h2 id="records-heading">
            <List size={19} /> {t("tracker.goalRecords")}
          </h2>
          {!waitingForRecords && <span>{t("tracker.totalRecords", { count: records.length })}</span>}
        </div>
        {viewMode === "week" && <p className="context-line">{formatWeekRange(weekDates, locale)}</p>}
        {error ? (
          <p className="empty-note" role="alert">
            {t("tracker.loadFailed")}{" "}
            <button type="button" className="text-link" onClick={() => void refetch()}>
              {t("tracker.retry")}
            </button>
          </p>
        ) : isLoading ? (
          <p className="empty-note" role="status">
            {t("common.loading")}
          </p>
        ) : groupedLogs.length === 0 ? (
          <p className="empty-note">{t("tracker.noRecords")}</p>
        ) : (
          groupedLogs.map((group) => (
            <div key={group.dateStr} className="tracker-day-group">
              {viewMode === "week" && (
                <div className="section-title tracker-day-heading">
                  <h3>{dayLabel(group.dateStr, isZh)}</h3>
                  <span>
                    {t("tracker.totalDayHours")} · {formatDuration(Math.round(group.totalMinutes), locale)}
                  </span>
                </div>
              )}
              <ul className="entry-list tracker-list">
                {group.logs.map((log) => {
                  const goal = allQuarterlyGoals.find((g) => g.id === log.goal_id);
                  const goalName = goal ? `Q${goal.quarter} · ${goal.title}` : t("tracker.unknownGoal");
                  const label = log.note || goalName;
                  const planned = log.log_type === "planned";
                  const pendingPlan = planned && log.status === "pending";
                  const status = log.is_running
                    ? t("tracker.running")
                    : planned && log.status
                      ? statusLabels[log.status]
                      : "";
                  const start = formatTimeOnly(log.start_time, locale);
                  const length =
                    !log.is_running &&
                    log.duration_minutes != null &&
                    (!planned || pendingPlan || log.status === "completed")
                      ? formatDuration(Math.round(log.duration_minutes), locale)
                      : "";
                  const actionLabel = (action: string) => `${action} · ${start} · ${label}`;
                  return (
                    <li
                      key={log.id}
                      id={`log-${log.id}`}
                      aria-current={entryAnchor === `log-${log.id}` ? "true" : undefined}
                      data-kind={log.log_type}
                      data-state={log.is_running ? "running" : log.status}
                    >
                      <span className="entry-time">
                        {start}
                        <small>{log.end_time ? formatTimeOnly(log.end_time, locale) : "—"}</small>
                      </span>
                      <i className="entry-pin" aria-hidden="true" />
                      <div className="entry-text">
                        <strong>{label}</strong>
                        <small>
                          {[log.note && goalName, kindLabels[log.log_type] || log.log_type, status]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </div>
                      {length && <span className="tracker-length">{length}</span>}
                      {!log.is_running && (
                        <div className="entry-actions">
                          {pendingPlan && (
                            <>
                              <button
                                type="button"
                                disabled={saving}
                                aria-label={actionLabel(t("tracker.markCompleted"))}
                                title={t("tracker.markCompleted")}
                                onClick={() => void runAction(() => updateStatus(log.id, "completed"))}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                aria-label={actionLabel(t("tracker.markNotCompleted"))}
                                title={t("tracker.markNotCompleted")}
                                onClick={() => void runAction(() => updateStatus(log.id, "not_completed"))}
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            disabled={saving}
                            aria-label={actionLabel(t("common.edit"))}
                            title={t("common.edit")}
                            onClick={() => openEdit(log)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            className="tracker-delete"
                            aria-label={actionLabel(t("common.delete"))}
                            title={t("common.delete")}
                            onClick={() => {
                              if (window.confirm(t("tracker.deleteConfirm")))
                                void runAction(() => deleteTimelog(log.id));
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {dialog === "manual" && (
        <TrackerEntryDialog
          kind="manual"
          draft={manualData}
          goals={manualGoals}
          saving={saving}
          onChange={setManualData}
          onClose={() => setDialog(null)}
          onSave={() => runAction(() => saveEntry(manualData))}
        />
      )}
      {dialog === "plan" && (
        <TrackerEntryDialog
          kind="plan"
          draft={planData}
          goals={planGoals}
          saving={saving}
          onChange={setPlanData}
          onClose={() => setDialog(null)}
          onSave={() => runAction(() => saveEntry(planData))}
        />
      )}
      {dialog === "edit" && editData && (
        <TrackerEntryDialog
          kind="edit"
          draft={editData}
          goals={editChoices}
          saving={saving}
          onChange={(values) => setEditData({ ...values, id: editData.id })}
          onClose={() => {
            setDialog(null);
            setEditData(null);
          }}
          onSave={() => runAction(() => saveEntry(editData))}
        />
      )}
    </div>
  );
}
