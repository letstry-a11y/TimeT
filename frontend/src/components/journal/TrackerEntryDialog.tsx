"use client";

import type { FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useTranslation } from "@/i18n";
import type { Goal } from "@/types";

export interface EntryDraft {
  goal_id: string;
  start_time: string;
  end_time: string;
  note: string;
}

interface Props {
  kind: "manual" | "plan" | "edit";
  draft: EntryDraft;
  goals: Goal[];
  saving: boolean;
  onChange: (value: EntryDraft) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
}

export function TrackerEntryDialog({ kind, draft, goals, saving, onChange, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const plan = kind === "plan";
  const timePrefix = kind === "manual" ? "" : kind + "-";
  const titles = { manual: "tracker.manualEntry", plan: "tracker.createPlan", edit: "tracker.editRecord" };
  const close = () => {
    if (!saving) onClose();
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSave();
  };

  return (
    <Modal isOpen onClose={close} title={t(titles[kind])}>
      <form className="journal-form" onSubmit={submit} aria-busy={saving}>
        <Select
          id={kind + "-goal"}
          label={t("tracker.selectGoal")}
          value={goals.some((g) => g.id === draft.goal_id) ? draft.goal_id : ""}
          onChange={(e) => onChange({ ...draft, goal_id: e.target.value })}
          options={[
            { value: "", label: t("tracker.selectQuarterlyGoal") },
            ...goals.map((g) => ({ value: g.id, label: `Q${g.quarter} · ${g.title}` })),
          ]}
          required
        />
        <div className="tracker-time-fields">
          <Input
            id={timePrefix + "start-time"}
            type="datetime-local"
            label={t(plan ? "tracker.planStartTime" : "tracker.startTime")}
            value={draft.start_time}
            onChange={(e) => onChange({ ...draft, start_time: e.target.value })}
            required
          />
          <Input
            id={timePrefix + "end-time"}
            type="datetime-local"
            label={t(plan ? "tracker.planEndTime" : "tracker.endTime")}
            value={draft.end_time}
            onChange={(e) => onChange({ ...draft, end_time: e.target.value })}
            required
          />
        </div>
        <Input
          id={kind + "-note"}
          label={t("tracker.note")}
          placeholder={t(plan ? "tracker.planNotePlaceholder" : "tracker.notePlaceholder")}
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
        />
        <div className="tracker-dialog-actions">
          <button type="button" className="quiet-button" onClick={close} disabled={saving}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="solid-button" disabled={saving}>
            {t(plan ? "tracker.createPlan" : "common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
