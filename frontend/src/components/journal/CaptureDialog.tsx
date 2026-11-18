"use client";

import { useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/i18n";
import api, { timelogApi } from "@/lib/api";
import { Entry, JournalDay, Life, lifeCategories, name, useJournal } from "@/lib/journal";
import { parseUtcDateString, parseUtcMs } from "@/lib/utils";

export interface Capture {
  start: string;
  end: string;
  entry?: Entry;
  goal?: string;
}
export function inputTime(utc: string) {
  return parseUtcDateString(utc).toISOString().slice(0, 16);
}

export default function CaptureDialog({
  preset,
  day,
  close,
  saved,
}: {
  preset: Capture;
  day: JournalDay;
  close: () => void;
  saved: () => void;
}) {
  const { isZh: zh } = useTranslation();
  const entry = preset.entry;
  const [mode, setMode] = useState<"goal" | "life">(
    entry ? (entry.goal_id ? "goal" : "life") : day.goals.length ? "goal" : "life",
  );
  const [start, setStart] = useState(preset.start);
  const [end, setEnd] = useState(preset.end);
  const [goal, setGoal] = useState(entry?.goal_id || preset.goal || "");
  const [category, setCategory] = useState<Life>(
    entry && entry.category !== "goal" ? entry.category : "daily",
  );
  const [note, setNote] = useState(entry?.note || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [activityId] = useState(() => entry?.id || crypto.randomUUID());
  const selectedDay = start.slice(0, 10);
  const alternate = useJournal<JournalDay>(
    selectedDay && selectedDay !== day.day ? "day?day=" + selectedDay : null,
  );
  const options = selectedDay === day.day ? day.goals : alternate.data?.goals || [];
  const goalChoices = options.map((g) => ({ value: g.id, label: g.title }));
  if (entry?.goal_id && !goalChoices.some((g) => g.value === entry.goal_id)) {
    goalChoices.push({ value: entry.goal_id, label: entry.title });
  }
  const isPlan = entry?.state === "planned" || entry?.state === "skipped";
  const words = (cn: string, en: string) => (zh ? cn : en);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;
    setError("");
    const timestamp = (value: string, original?: string | null) =>
      original && inputTime(original) === value
        ? new Date(parseUtcMs(original)).toISOString()
        : value + ":00+08:00";
    const start_time = timestamp(start, entry?.start_time),
      end_time = timestamp(end, entry?.end_time);
    if (!start || !end || Date.parse(end_time) <= Date.parse(start_time))
      return setError(words("结束时间应晚于开始时间。", "Choose an end after the start."));
    if (!isPlan && Date.parse(end_time) > Date.now())
      return setError(
        words(
          "实际记录需要已经结束的时段。未来的活动可以在计时与计划页安排。",
          "Use elapsed time for an actual entry. Schedule future time in Tracker.",
        ),
      );
    if (mode === "goal" && !goalChoices.some((g) => g.value === goal))
      return setError(words("请选择活动当天的目标。", "Choose a goal for this date."));
    pending.current = true;
    setBusy(true);
    try {
      if (mode === "life") {
        await api.put("/api/v1/journal/activities/" + activityId, {
          category,
          start_time,
          end_time,
          note: note.trim(),
        });
      } else if (entry) {
        await timelogApi.update(
          entry.id,
          { goal_id: goal, start_time, end_time, note: note.trim() },
          !isPlan,
        );
      } else {
        await timelogApi.createManual({ goal_id: goal, start_time, end_time, note: note.trim() }, true);
      }
      toast.success(words("已保存", "Saved"));
      saved();
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 409
          ? words(
              "这个时段已有记录或计划，可调整时间，或直接确认已有计划。",
              "An entry or plan already covers this time. Adjust the interval or confirm the existing plan.",
            )
          : words(
              "保存未确认。请核对当天记录后再试。",
              "Save could not be confirmed. Check the day before retrying.",
            ),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!pending.current) close();
      }}
      title={entry ? words("调整时段", "Edit interval") : words("记一段时间", "Log an interval")}
    >
      <form className="journal-form" onSubmit={submit}>
        {!entry && (
          <div className="choice-strip" aria-label={words("记录类型", "Entry type")}>
            <button type="button" aria-pressed={mode === "goal"} onClick={() => setMode("goal")}>
              {words("目标投入", "Goal time")}
            </button>
            <button type="button" aria-pressed={mode === "life"} onClick={() => setMode("life")}>
              {words("生活时间", "Everyday time")}
            </button>
          </div>
        )}
        {mode === "goal" ? (
          <Select
            id="capture-goal"
            label={words("关联目标", "Goal")}
            value={goal}
            required
            onChange={(e) => setGoal(e.target.value)}
            options={[{ value: "", label: words("选择目标", "Choose a goal") }, ...goalChoices]}
          />
        ) : (
          <Select
            id="capture-category"
            label={words("活动类型", "Activity type")}
            value={category}
            onChange={(e) => setCategory(e.target.value as Life)}
            options={lifeCategories.map((k) => ({ value: k, label: name(k, zh) }))}
          />
        )}
        <Input
          id="capture-start"
          type="datetime-local"
          label={words("开始（北京时间）", "Start (Beijing time)")}
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <Input
          id="capture-end"
          type="datetime-local"
          label={words("结束（北京时间）", "End (Beijing time)")}
          required
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
        <Input
          id="capture-note"
          label={words("备注（选填）", "Note (optional)")}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={close}>
            {words("取消", "Cancel")}
          </Button>
          <Button type="submit" isLoading={busy}>
            {words("保存记录", "Save entry")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
