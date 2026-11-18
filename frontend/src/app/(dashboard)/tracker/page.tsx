"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { today } from "@/lib/journal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { useElapsedTime, formatElapsed, StatusIndicator, CompactTimerDisplay } from "@/components/Timer";
import { useGoals } from "@/hooks/useGoals";
import { useTimelogs } from "@/hooks/useTimelogs";
import { useTranslation } from "@/i18n";
import {
  cn,
  getBeijingNow,
  formatDuration,
  formatHoursDecimal,
  getWeekDates,
  formatWeekRange,
  formatDayHeader,
  isSameDay,
  toDateString,
  formatTimeOnly,
  parseUtcDateString,
} from "@/lib/utils";
import { TimeLog, TimeLogStatus } from "@/types";
import {
  Clock,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Check,
  X,
  Timer as TimerIcon,
  FileText,
  CalendarClock,
  Pencil,
  Play,
  Square,
} from "lucide-react";

type ViewMode = "day" | "week";

interface DayGroup {
  date: Date;
  dateStr: string;
  logs: TimeLog[];
  totalMinutes: number;
}

function beijingInputToUtcIso(local: string): string {
  return new Date(local + "+08:00").toISOString();
}

// Helper to convert ISO string to datetime-local format (显示北京时间)
const toDateTimeLocal = (isoString: string) => {
  const date = parseUtcDateString(isoString);
  // parseUtcDateString 返回 Beijing Date（UTC getters 即北京时间）
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export default function TrackerPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(getBeijingNow);
  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);
  const firstDay = viewMode === "day" ? currentDate : weekDates[0];
  const lastDay = viewMode === "day" ? currentDate : weekDates[6];
  // The existing list API filters on UTC start dates. Request the UTC dates
  // touching the visible Beijing window, and group them locally below.
  const utcDay = (d: Date, time: string) => new Date(toDateString(d) + time + "+08:00").toISOString().slice(0, 10);
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
    return allQuarterlyGoals.filter(g => !g.is_archived && ["not_started", "in_progress"].includes(g.status)
      && g.year === Number(day.slice(0, 4)) && g.quarter === quarter);
  };
  const goals = choicesFor(today());

  const {
    timelogs,
    currentSession,
    isLoading,
    startSession,
    stopSession,
    createManual,
    createPlanned,
    updateStatus,
    updateTimelog,
    deleteTimelog,
    refetch,
  } = useTimelogs({ start_date: utcDay(firstDay, "T00:00"), end_date: utcDay(lastDay, "T23:59") });
  const { t, locale } = useTranslation();

  // Timer elapsed time
  const elapsed = useElapsedTime(!!currentSession, currentSession?.start_time);

  // State for timer section
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [note, setNote] = useState("");


  // State for modals
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [manualData, setManualData] = useState({
    goal_id: "",
    start_time: "",
    end_time: "",
    note: "",
  });
  const [planData, setPlanData] = useState({
    goal_id: "",
    start_time: "",
    end_time: "",
    note: "",
  });
  const [editData, setEditData] = useState<{
    id: string;
    goal_id: string;
    start_time: string;
    end_time: string;
    note: string;
    log_type: string;
  } | null>(null);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("goal");
    if (requested && allQuarterlyGoals.some(g => g.id === requested)) setSelectedGoalId(requested);
  }, [allQuarterlyGoals]);
  const manualGoals = choicesFor(manualData.start_time);
  const planGoals = choicesFor(planData.start_time);
  const editGoals = choicesFor(editData?.start_time || "");
  const timerGoal = goals.some(g => g.id === selectedGoalId) ? selectedGoalId : "";

  // Group timelogs by day
  const groupedLogs = useMemo(() => {
    const groups: DayGroup[] = [];
    const dateMap = new Map<string, DayGroup>();

    // Sort logs by start_time descending (parseUtcDateString returns Beijing Date)
    const sortedLogs = [...timelogs].sort(
      (a, b) => parseUtcDateString(b.start_time).getTime() - parseUtcDateString(a.start_time).getTime()
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
      group.logs.sort((a, b) => parseUtcDateString(a.start_time).getTime() - parseUtcDateString(b.start_time).getTime());
    }

    return groups;
  }, [timelogs, currentDate, viewMode, weekDates]);

  // Navigation handlers
  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setUTCDate(newDate.getUTCDate() - 1);
    } else {
      newDate.setUTCDate(newDate.getUTCDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "day") {
      newDate.setUTCDate(newDate.getUTCDate() + 1);
    } else {
      newDate.setUTCDate(newDate.getUTCDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(getBeijingNow());
  };

  // Timer handlers
  const handleStart = async () => {
    if (!timerGoal) return;
    await startSession({ goal_id: timerGoal, note: note || undefined });
    setNote("");
  };

  const handleStop = async () => {
    if (!currentSession) return;
    await stopSession(currentSession.id, note || undefined);
    setNote("");
    refetch();
  };

  // Manual entry handler
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.goal_id || !manualData.start_time || !manualData.end_time) return;

    await createManual({
      goal_id: manualData.goal_id,
      start_time: beijingInputToUtcIso(manualData.start_time),
      end_time: beijingInputToUtcIso(manualData.end_time),
      note: manualData.note || undefined,
    });

    setIsManualModalOpen(false);
    setManualData({
      goal_id: "",
      start_time: "",
      end_time: "",
      note: "",
    });
  };

  // Planned task handler
  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planData.goal_id || !planData.start_time || !planData.end_time) return;

    await createPlanned({
      goal_id: planData.goal_id,
      start_time: beijingInputToUtcIso(planData.start_time),
      end_time: beijingInputToUtcIso(planData.end_time),
      note: planData.note || undefined,
    });

    setIsPlanModalOpen(false);
    setPlanData({
      goal_id: "",
      start_time: "",
      end_time: "",
      note: "",
    });
  };

  // Edit handler - open modal with log data
  const handleOpenEdit = (log: TimeLog) => {
    setEditData({
      id: log.id,
      goal_id: log.goal_id,
      start_time: toDateTimeLocal(log.start_time),
      end_time: log.end_time ? toDateTimeLocal(log.end_time) : "",
      note: log.note || "",
      log_type: log.log_type,
    });
    setIsEditModalOpen(true);
  };

  // Edit submit handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData || !editData.goal_id || !editData.start_time || !editData.end_time) return;

    const startTime = new Date(beijingInputToUtcIso(editData.start_time));
    const endTime = new Date(beijingInputToUtcIso(editData.end_time));
    const durationMinutes = (endTime.getTime() - startTime.getTime()) / 1000 / 60;

    await updateTimelog(editData.id, {
      goal_id: editData.goal_id,
      start_time: beijingInputToUtcIso(editData.start_time),
      end_time: beijingInputToUtcIso(editData.end_time),
      duration_minutes: durationMinutes,
      note: editData.note || undefined,
    });

    setIsEditModalOpen(false);
    setEditData(null);
  };

  // Status update handlers
  const handleMarkCompleted = async (id: string) => {
    await updateStatus(id, "completed");
  };

  const handleMarkNotCompleted = async (id: string) => {
    await updateStatus(id, "not_completed");
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    if (window.confirm(t("tracker.deleteConfirm"))) {
      await deleteTimelog(id);
    }
  };

  // Get log type icon and label
  const getLogTypeInfo = (log: TimeLog) => {
    switch (log.log_type) {
      case "clock_in":
        return {
          icon: <TimerIcon className="h-4 w-4" />,
          label: t("tracker.clockIn"),
          bgColor: "bg-blue-100 text-blue-700",
        };
      case "manual":
        return {
          icon: <FileText className="h-4 w-4" />,
          label: t("tracker.manual"),
          bgColor: "bg-gray-100 text-gray-700",
        };
      case "planned":
        return {
          icon: <CalendarClock className="h-4 w-4" />,
          label: t("tracker.planned"),
          bgColor: "bg-purple-100 text-purple-700",
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          label: log.log_type,
          bgColor: "bg-gray-100 text-gray-700",
        };
    }
  };

  // Get status display
  const getStatusDisplay = (status: TimeLogStatus | undefined) => {
    switch (status) {
      case "pending":
        return {
          label: t("tracker.statusPending"),
          className: "text-yellow-600",
        };
      case "completed":
        return {
          label: t("tracker.statusCompleted"),
          className: "text-green-600",
        };
      case "not_completed":
        return {
          label: t("tracker.statusNotCompleted"),
          className: "text-red-600",
        };
      default:
        return null;
    }
  };

  const currentGoal = allQuarterlyGoals.find((g) => g.id === (currentSession?.goal_id || selectedGoalId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("tracker.title")}</h1>
          <p className="text-gray-500 mt-1">{t("tracker.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsPlanModalOpen(true)}>
            <CalendarClock className="h-4 w-4 mr-2" />
            {t("tracker.createPlan")}
          </Button>
          <Button variant="secondary" onClick={() => setIsManualModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("tracker.manualEntry")}
          </Button>
        </div>
      </div>

      {/* Timer Section - Compact Layout */}
      <Card className={cn(
        "p-4 transition-colors",
        currentSession && "border-green-200 bg-green-50"
      )}>
        {/* Row 1: Main controls */}
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <StatusIndicator isRunning={!!currentSession} />

          {/* Goal selector or current goal */}
          <div className="flex-1 min-w-0">
            {currentSession && currentGoal ? (
              <div>
                <p className="font-medium text-green-800 truncate">
                  Q{currentGoal.quarter}: {currentGoal.title}
                </p>
                <p className="text-sm text-green-600">
                  {t("dashboard.startedAt", {
                    time: formatTimeOnly(currentSession.start_time, locale),
                  })}
                </p>
              </div>
            ) : (
              <Select
                id="goal"
                value={timerGoal}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                options={[
                  { value: "", label: t("tracker.selectQuarterlyGoal") },
                  ...goals.map((g) => ({
                    value: g.id,
                    label: `Q${g.quarter}: ${g.title}`,
                  })),
                ]}
              />
            )}
          </div>

          {/* Timer display */}
          <CompactTimerDisplay
            elapsed={elapsed}
            isRunning={!!currentSession}
          />

          {/* Action button */}
          {currentSession ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleStop}
              className="w-24 shrink-0"
            >
              <Square className="h-4 w-4 mr-1" />
              {t("timer.stop")}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={!timerGoal}
              className="w-24 shrink-0"
            >
              <Play className="h-4 w-4 mr-1" />
              {t("timer.start")}
            </Button>
          )}
        </div>

        {/* Row 2: Note input */}
        <div className="mt-3 pl-11">
          <Input
            id="note"
            placeholder={t("tracker.notePlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="text-sm"
          />
        </div>
      </Card>

      <Link className="text-link" href={"/dashboard?day=" + toDateString(currentDate)}>
        {locale === "zh-CN" ? "查看这一天的完整时间轴与生活记录 →" : "Open this day's full timeline and everyday activities →"}
      </Link>
      {/* Records Section */}
      <Card>
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-lg font-medium min-w-[200px] text-center">
              {viewMode === "day"
                ? formatDayHeader(currentDate, locale)
                : formatWeekRange(weekDates, locale)}
            </span>
            <Button variant="secondary" size="sm" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={goToToday}>
              {t("tracker.today")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 mr-2">{t("tracker.view")}:</span>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 text-sm ${
                  viewMode === "day"
                    ? "bg-primary-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t("tracker.dayView")}
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 text-sm ${
                  viewMode === "week"
                    ? "bg-primary-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {t("tracker.weekView")}
              </button>
            </div>
          </div>
        </div>

        {/* Records List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : groupedLogs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t("tracker.noRecords")}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedLogs.map((group) => (
              <div key={group.dateStr}>
                {/* Day Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {formatDayHeader(group.date, locale)}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {t("tracker.totalDayHours")}: {formatHoursDecimal(group.totalMinutes)}
                  </span>
                </div>

                {/* Day's Logs */}
                <div className="space-y-3">
                  {group.logs.map((log) => {
                    const goal = allQuarterlyGoals.find((g) => g.id === log.goal_id);
                    const typeInfo = getLogTypeInfo(log);
                    const statusDisplay =
                      log.log_type === "planned" ? getStatusDisplay(log.status) : null;

                    return (
                      <div
                        key={log.id}
                        className={`p-4 rounded-lg border ${
                          log.is_running
                            ? "border-green-200 bg-green-50"
                            : log.log_type === "planned" && log.status === "pending"
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Running indicator */}
                              {log.is_running && (
                                <span className="flex h-2 w-2">
                                  <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
                                </span>
                              )}

                              {/* Time range */}
                              <span className="text-sm text-gray-500 font-mono">
                                {formatTimeOnly(log.start_time)}
                                {log.end_time && `-${formatTimeOnly(log.end_time)}`}
                              </span>

                              {/* Goal */}
                              <span className="font-medium">
                                {goal ? `Q${goal.quarter}: ${goal.title}` : t("tracker.unknownGoal")}
                              </span>

                              {/* Log type badge */}
                              <span
                                className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded ${typeInfo.bgColor}`}
                              >
                                {typeInfo.icon}
                                {typeInfo.label}
                              </span>

                              {/* Status for planned tasks */}
                              {statusDisplay && (
                                <span className={`text-sm font-medium ${statusDisplay.className}`}>
                                  {log.status === "completed" && <Check className="inline h-4 w-4 mr-1" />}
                                  {log.status === "not_completed" && <X className="inline h-4 w-4 mr-1" />}
                                  {statusDisplay.label}
                                </span>
                              )}
                            </div>

                            {/* Note */}
                            {log.note && <p className="text-sm text-gray-600 mt-1">{log.note}</p>}
                          </div>

                          {/* Right side: Duration and actions */}
                          <div className="flex items-center gap-2 ml-4">
                            {/* Duration (only for completed entries) */}
                            {log.duration_minutes &&
                              (log.log_type !== "planned" || log.status === "completed") && (
                                <span className="text-lg font-semibold text-primary-600">
                                  {formatDuration(log.duration_minutes, locale)}
                                </span>
                              )}

                            {/* Planned duration for pending tasks */}
                            {log.log_type === "planned" &&
                              log.status === "pending" &&
                              log.duration_minutes && (
                                <span className="text-lg font-semibold text-gray-400">
                                  {formatDuration(log.duration_minutes, locale)}
                                </span>
                              )}

                            {/* Status action buttons for pending planned tasks */}
                            {log.log_type === "planned" && log.status === "pending" && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleMarkCompleted(log.id)}
                                  className="p-1.5 hover:bg-green-100 rounded-lg text-green-600"
                                  title={t("tracker.markCompleted")}
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleMarkNotCompleted(log.id)}
                                  className="p-1.5 hover:bg-red-100 rounded-lg text-red-600"
                                  title={t("tracker.markNotCompleted")}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}

                            {/* Edit button - show for all non-running logs */}
                            {!log.is_running && (
                              <button
                                onClick={() => handleOpenEdit(log)}
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600"
                                title={t("tracker.editPlan")}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}

                            {/* Delete button */}
                            {!log.is_running && (
                              <button
                                onClick={() => handleDelete(log.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title={t("tracker.manualEntry")}
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <Select
            id="manual-goal"
            label={t("tracker.selectGoal")}
            value={manualGoals.some(g => g.id === manualData.goal_id) ? manualData.goal_id : ""}
            onChange={(e) => setManualData((prev) => ({ ...prev, goal_id: e.target.value }))}
            options={[
              { value: "", label: t("tracker.selectQuarterlyGoal") },
              ...manualGoals.map((g) => ({
                value: g.id,
                label: `Q${g.quarter}: ${g.title}`,
              })),
            ]}
            required
          />

          <Input
            id="start-time"
            type="datetime-local"
            label={t("tracker.startTime")}
            value={manualData.start_time}
            onChange={(e) => setManualData((prev) => ({ ...prev, start_time: e.target.value }))}
            required
          />

          <Input
            id="end-time"
            type="datetime-local"
            label={t("tracker.endTime")}
            value={manualData.end_time}
            onChange={(e) => setManualData((prev) => ({ ...prev, end_time: e.target.value }))}
            required
          />

          <Input
            id="manual-note"
            label={t("tracker.note")}
            placeholder={t("tracker.notePlaceholder")}
            value={manualData.note}
            onChange={(e) => setManualData((prev) => ({ ...prev, note: e.target.value }))}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsManualModalOpen(false)}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Plan Modal */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title={t("tracker.createPlan")}
      >
        <form onSubmit={handlePlanSubmit} className="space-y-4">
          <Select
            id="plan-goal"
            label={t("tracker.selectGoal")}
            value={planGoals.some(g => g.id === planData.goal_id) ? planData.goal_id : ""}
            onChange={(e) => setPlanData((prev) => ({ ...prev, goal_id: e.target.value }))}
            options={[
              { value: "", label: t("tracker.selectQuarterlyGoal") },
              ...planGoals.map((g) => ({
                value: g.id,
                label: `Q${g.quarter}: ${g.title}`,
              })),
            ]}
            required
          />

          <Input
            id="plan-start-time"
            type="datetime-local"
            label={t("tracker.planStartTime")}
            value={planData.start_time}
            onChange={(e) => setPlanData((prev) => ({ ...prev, start_time: e.target.value }))}
            required
          />

          <Input
            id="plan-end-time"
            type="datetime-local"
            label={t("tracker.planEndTime")}
            value={planData.end_time}
            onChange={(e) => setPlanData((prev) => ({ ...prev, end_time: e.target.value }))}
            required
          />

          <Input
            id="plan-note"
            label={t("tracker.note")}
            placeholder={t("tracker.planNotePlaceholder")}
            value={planData.note}
            onChange={(e) => setPlanData((prev) => ({ ...prev, note: e.target.value }))}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPlanModalOpen(false)}
              className="flex-1"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {t("tracker.createPlan")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Plan/Record Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditData(null);
        }}
        title={t("tracker.editRecord")}
      >
        {editData && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <Select
              id="edit-goal"
              label={t("tracker.selectGoal")}
              value={editData.goal_id}
              onChange={(e) => setEditData((prev) => prev ? { ...prev, goal_id: e.target.value } : null)}
              options={[
                { value: "", label: t("tracker.selectQuarterlyGoal") },
                // Include the log's current goal even if it's completed (and thus
                // filtered out of `goals`), so editing an old log keeps its goal.
                ...(editData.goal_id && !editGoals.some((g) => g.id === editData.goal_id)
                  ? allQuarterlyGoals
                      .filter((g) => g.id === editData.goal_id)
                      .map((g) => ({ value: g.id, label: `Q${g.quarter}: ${g.title}` }))
                  : []),
                ...editGoals.map((g) => ({
                  value: g.id,
                  label: `Q${g.quarter}: ${g.title}`,
                })),
              ]}
              required
            />

            <Input
              id="edit-start-time"
              type="datetime-local"
              label={t("tracker.startTime")}
              value={editData.start_time}
              onChange={(e) => setEditData((prev) => prev ? { ...prev, start_time: e.target.value } : null)}
              required
            />

            <Input
              id="edit-end-time"
              type="datetime-local"
              label={t("tracker.endTime")}
              value={editData.end_time}
              onChange={(e) => setEditData((prev) => prev ? { ...prev, end_time: e.target.value } : null)}
              required
            />

            <Input
              id="edit-note"
              label={t("tracker.note")}
              placeholder={t("tracker.notePlaceholder")}
              value={editData.note}
              onChange={(e) => setEditData((prev) => prev ? { ...prev, note: e.target.value } : null)}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditData(null);
                }}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" className="flex-1">
                {t("common.save")}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
