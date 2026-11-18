"use client";
import { useEffect, useState } from "react";
import { Award, Gift } from "lucide-react";
import toast from "react-hot-toast";
import { Goal } from "@/types";
import { useTranslation } from "@/i18n";
import api from "@/lib/api";
import { Reward, useJournal } from "@/lib/journal";

export default function RewardShelf({
  goals,
  year,
  justCompleted,
}: {
  goals: Goal[];
  year: number;
  justCompleted: string;
}) {
  const { isZh: zh } = useTranslation();
  const { data, error, reload } = useJournal<Reward[]>("rewards?year=" + year);
  const [goal, setGoal] = useState("");
  const [reward, setReward] = useState("");
  const [outcome, setOutcome] = useState("");
  const [saving, setSaving] = useState(false);
  const words = (cn: string, en: string) => (zh ? cn : en);
  useEffect(() => {
    if (justCompleted) setGoal(justCompleted);
  }, [justCompleted]);
  const choices = goals.filter((g) => g.status === "completed" && !data?.some((r) => r.goal_id === g.id));
  const selected = choices.find((g) => g.id === goal);
  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || saving) return;
    setSaving(true);
    try {
      await api.put("/api/v1/journal/rewards/" + selected.id, {
        reward: reward.trim() || words("完成纪念章", "Completion badge"),
        outcome: outcome.trim(),
      });
      toast.success(words("完成纪念已收藏", "Reward collected"));
      setGoal("");
      setReward("");
      setOutcome("");
      reload();
    } catch {
      toast.error(
        words("领取未确认，请刷新奖励后再试。", "Please refresh rewards to check before retrying."),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="paper shelf" id="rewards">
      <h2>
        <Gift size={20} />
        {words("完成奖励", "Goal rewards")}
      </h2>
      <p className="muted">
        {words(
          "确认完成一个目标，就可以为自己选一份奖励，也可以留下一件做成的事。",
          "After confirming a goal is complete, choose a reward and keep a note of what you accomplished.",
        )}
      </p>
      {error ? (
        <button className="text-link" onClick={reload}>
          {words("重新读取奖励", "Reload rewards")}
        </button>
      ) : !data ? (
        <p>{words("读取中…", "Loading…")}</p>
      ) : (
        <>
          {!!choices.length && (
            <form className="reward-form" onSubmit={claim}>
              <label>
                {words("已完成的目标", "Completed goal")}
                <select value={selected?.id || ""} onChange={(e) => setGoal(e.target.value)} required>
                  <option value="">{words("选择要庆祝的目标", "Choose a goal to celebrate")}</option>
                  {choices.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.year}
                      {g.quarter ? " Q" + g.quarter : ""} · {g.title}
                    </option>
                  ))}
                </select>
              </label>
              {selected && (
                <>
                  <label>
                    {words("给自己的奖励", "Your reward")}
                    <input
                      maxLength={160}
                      value={reward}
                      placeholder={words(
                        "完成纪念章，或自选一份奖励",
                        "Completion badge, or choose a personal reward",
                      )}
                      onChange={(e) => setReward(e.target.value)}
                    />
                  </label>
                  <label>
                    {words("完成了什么（选填）", "What did you finish? (optional)")}
                    <textarea maxLength={4000} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
                  </label>
                  <button className="solid-button" disabled={saving}>
                    <Gift size={15} />
                    {words("领取奖励", "Collect reward")}
                  </button>
                </>
              )}
            </form>
          )}
          {data.length > 0 ? (
            <ul className="stamp-list">
              {data.map((r) => (
                <li key={r.goal_id}>
                  <Award size={24} />
                  <div>
                    <strong>{r.reward}</strong>
                    <small>
                      {r.title} · {r.day}
                    </small>
                    {r.outcome && <p>{r.outcome}</p>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            !choices.length && (
              <p className="empty-note">
                {words(
                  "这一年的第一枚完成纪念章会出现在这里。",
                  "Your first reward for this year's goals will appear here.",
                )}
              </p>
            )
          )}
        </>
      )}
    </section>
  );
}
