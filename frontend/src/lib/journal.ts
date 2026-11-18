import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatDuration, getBeijingNow, toDateString } from "@/lib/utils";
import { GoalStatus } from "@/types";

export type Period = "week" | "month" | "quarter" | "year" | "five_year";
export type Life = "rest" | "travel" | "daily" | "other";
export type Category = Life | "goal";
export const periods: Period[] = ["week", "month", "quarter", "year", "five_year"];
export const lifeCategories: Life[] = ["rest", "travel", "daily", "other"];
const names: Record<Period | Category, [string, string]> = {
  week: ["周", "Week"],
  month: ["月", "Month"],
  quarter: ["季度", "Quarter"],
  year: ["年", "Year"],
  five_year: ["五年", "Five years"],
  goal: ["目标投入", "Goal time"],
  rest: ["休息", "Rest"],
  travel: ["通勤与出行", "Travel"],
  daily: ["日常生活", "Daily life"],
  other: ["其他活动", "Other activity"],
};
export function name(key: Period | Category, zh: boolean) {
  return names[key][zh ? 0 : 1];
}
export function duration(value: number, zh: boolean) {
  return formatDuration(Math.round(value), zh ? "zh-CN" : "en-US");
}
export function today() {
  return toDateString(getBeijingNow());
}
export function shiftDay(day: string, offset: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return toDateString(date);
}
export function dayLabel(
  day: string,
  zh: boolean,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", weekday: "short" },
) {
  return new Date(day + "T12:00:00Z").toLocaleDateString(zh ? "zh-CN" : "en-US", {
    ...options,
    timeZone: "UTC",
  });
}
export function clockMinute(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function localInput(day: string, minute: number) {
  return minute === 1440 ? shiftDay(day, 1) + "T00:00" : day + "T" + clockMinute(minute);
}

export interface Entry {
  id: string;
  goal_id: string | null;
  title: string;
  category: Category;
  note: string;
  start_time: string;
  end_time: string | null;
  state: "actual" | "running" | "planned" | "skipped";
  is_plan: boolean;
}
export interface FocusGoal {
  id: string;
  title: string;
  logged_hours: number;
  target_hours: number;
  recent_minutes: number;
  recent_days: number;
}
export interface JournalDay {
  day: string;
  actual_minutes: number;
  goal_minutes: number;
  life_minutes: number;
  overlap_minutes: number;
  entries: Entry[];
  gaps: { start_minute: number; end_minute: number }[];
  goals: FocusGoal[];
}
export interface Reward {
  title: string;
  goal_id: string;
  reward: string;
  outcome: string;
  day: string;
}
export interface ReviewStep {
  kind: "first_entry" | "confirm_plan" | "small_session" | "repeat_or_adjust";
  title?: string;
  category?: Category;
  count?: number;
  minutes?: number;
}
export interface Review {
  kind: Period;
  start: string;
  end: string;
  as_of: string;
  partial: boolean;
  previous_start: string;
  previous_end: string;
  minutes: number;
  previous_minutes: number;
  days: number;
  entries: number;
  goal_minutes: number;
  life_minutes: number;
  overlap_minutes: number;
  plans: { pending: number; completed: number; skipped: number };
  trend: { date: string; minutes: number }[];
  distribution: { key: string; title: string; category: Category; minutes: number }[];
  goals: {
    id: string;
    title: string;
    quarter: number;
    year: number;
    status: GoalStatus;
    period_minutes: number;
    target_hours: number;
  }[];
  rewards: Omit<Reward, "goal_id">[];
  steps: ReviewStep[];
  fingerprint: string;
  evaluated_at: string;
}
export interface ArchiveHeader {
  id: string;
  kind: Period;
  start: string;
  version: number;
  created_at: string;
}
export interface Archive extends ArchiveHeader {
  report: Review;
  reflection: string;
  next_step: string;
}
export interface Preview {
  report: Review;
  latest: Archive | null;
}

export function stepText(s: ReviewStep, zh: boolean): string {
  const label = s.title || (s.category ? name(s.category, zh) : "");
  switch (s.kind) {
    case "first_entry":
      return zh
        ? "从还记得的一段活动开始，记下它的起止时间。"
        : "Start with one activity you remember and record its times.";
    case "confirm_plan":
      return zh
        ? `有 ${s.count} 项计划等待确认。挑一项核对实际时段，再决定是否计入。`
        : `Check the actual times of one of the ${s.count} unconfirmed plans.`;
    case "small_session":
      return zh
        ? `「${label}」在这段时间还没有记录。如果仍想推进，下次可以先留 15 分钟。`
        : `No time was logged for “${label}” in this period. If it still matters, try a 15-minute session.`;
    case "repeat_or_adjust":
      return zh
        ? `「${label}」记录了 ${duration(s.minutes || 0, true)}。回想哪一次最有价值，下个周期试着保留那一次的安排。`
        : `You recorded ${duration(s.minutes || 0, false)} for “${label}”. Pick a session that worked and try its timing again.`;
  }
}
export function useJournal<T>(path: string | null, refresh: number | string = 0) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ path: string; revision: number; value?: T; failed?: boolean }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api
      .get<T>("/api/v1/journal/" + path, { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setResult({ path, revision, value: r.data });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult((last) => ({
            path,
            revision,
            failed: true,
            value: last?.path === path ? last.value : undefined,
          }));
        }
      });
    return () => controller.abort();
  }, [path, revision, refresh]);
  const matched = result?.path === path ? result : undefined;
  return { data: matched?.value, error: !!matched?.failed, reload: () => setRevision((v) => v + 1) };
}
