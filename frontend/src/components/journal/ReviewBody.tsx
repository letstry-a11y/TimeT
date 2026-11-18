"use client";
import { useState } from "react";
import { Activity, Compass, Flag, Gift } from "lucide-react";
import { Review, duration, name, dayLabel, stepText } from "@/lib/journal";
import { getStatusLabel } from "@/lib/utils";

export function comparison(r: Review, zh: boolean) {
  if (!r.previous_minutes)
    return zh ? "上一周期的对照时段尚无实际记录" : "No recorded time in the comparison period";
  const delta = r.minutes - r.previous_minutes;
  if (Math.abs(delta) < 0.01) return zh ? "与上一可比时段持平" : "The same as the comparison period";
  const d = duration(Math.abs(delta), zh);
  return zh
    ? `比上一可比时段${delta > 0 ? "多" : "少"} ${d}`
    : `${d} ${delta > 0 ? "more" : "less"} than the comparison period`;
}

export default function ReviewBody({ r, zh }: { r: Review; zh: boolean }) {
  const words = (cn: string, en: string) => (zh ? cn : en);
  const [selected, setSelected] = useState("");
  const highest = Math.max(1, ...r.trend.map((b) => b.minutes));
  const point =
    r.trend.find((b) => b.date === selected) || r.trend.reduce((a, b) => (a.minutes >= b.minutes ? a : b));
  const label = (d: string) =>
    r.kind === "five_year"
      ? d.slice(0, 4)
      : r.kind === "year" || r.kind === "quarter"
        ? dayLabel(d, zh, { month: "short" })
        : r.kind === "week"
          ? dayLabel(d, zh, { weekday: "short" })
          : String(Number(d.slice(8)));
  const lead = r.distribution[0];
  return (
    <>
      <section className="review-summary paper">
        <div>
          <span>{words("已记录的时间", "Recorded time")}</span>
          <strong className="big-duration">{duration(r.minutes, zh)}</strong>
          <small>{comparison(r, zh)}</small>
        </div>
        <div>
          <span>{words("记录日", "Active days")}</span>
          <strong>{r.days}</strong>
          <small>
            {r.entries} {words("段实际记录", "actual entries")}
          </small>
        </div>
        <div>
          <span>{words("已确认计划", "Confirmed plans")}</span>
          <strong>{r.plans.completed}</strong>
          <small>
            {r.plans.pending} {words("待确认", "pending")} · {r.plans.skipped} {words("已跳过", "skipped")}
          </small>
        </div>
      </section>
      <div className="journal-columns review-charts">
        <section className="paper">
          <div className="section-title">
            <h2>
              <Activity size={18} />
              {words("时间趋势", "Time trend")}
            </h2>
            <span>{words("按北京时间", "Beijing time")}</span>
          </div>
          <div
            className={r.trend.length > 15 ? "trend-bars dense" : "trend-bars"}
            role="group"
            aria-label={words("各时段实际时长", "Actual time by interval")}
          >
            {r.trend.map((b, i) => (
              <button
                type="button"
                key={b.date}
                onClick={() => setSelected(b.date)}
                aria-pressed={point.date === b.date}
                aria-label={b.date + " " + duration(b.minutes, zh)}
                title={b.date + " · " + duration(b.minutes, zh)}
              >
                <span className="bar-space">
                  <i style={{ height: b.minutes ? Math.max(3, (b.minutes / highest) * 100) + "%" : 0 }} />
                </span>
                <small>
                  {r.trend.length <= 15 || i % 5 === 0 || i === r.trend.length - 1 ? label(b.date) : " "}
                </small>
              </button>
            ))}
          </div>
          <div className="chart-key">
            <strong>
              {label(point.date)} · {duration(point.minutes, zh)}
            </strong>
            <span>
              {words("对照", "Compared with")} {r.previous_start} – {r.previous_end}
            </span>
          </div>
        </section>
        <section className="paper">
          <h2>{words("时间用在了哪里", "Where time went")}</h2>
          <p className="muted">
            {words("目标", "Goals")} {duration(r.goal_minutes, zh)} · {words("生活", "Everyday")}{" "}
            {duration(r.life_minutes, zh)}
          </p>
          {r.overlap_minutes > 0 && (
            <p className="muted">
              {words("总时长已扣除重叠的 ", "Total excludes overlapping time of ")}
              {duration(r.overlap_minutes, zh)}
            </p>
          )}
          {lead ? (
            <ul className="share-bars">
              {r.distribution.slice(0, 5).map((row) => (
                <li key={row.key}>
                  <div>
                    <span>{row.title || name(row.category, zh)}</span>
                    <strong>{duration(row.minutes, zh)}</strong>
                  </div>
                  <div className="thin-rail">
                    <i style={{ width: (row.minutes / lead.minutes) * 100 + "%" }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">
              {words("这个周期还没有实际记录。", "No actual time recorded for this period.")}
            </p>
          )}
          {r.distribution.length > 5 && (
            <details>
              <summary>
                {words("查看全部分布", "All categories")} ({r.distribution.length})
              </summary>
              {r.distribution.slice(5).map((v) => (
                <p key={v.key}>
                  {v.title || name(v.category, zh)} · {duration(v.minutes, zh)}
                </p>
              ))}
            </details>
          )}
        </section>
      </div>
      <section className="paper">
        <h2>
          <Compass size={19} />
          {words("观察与下一步", "Observations and next steps")}
        </h2>
        <p className="observation">
          {r.partial
            ? words(
                "当前周期按已经过的时段与上期比较。",
                "This period is compared with the elapsed portion of the previous one.",
              )
            : words(
                "本期与上一个完整周期比较。",
                "This period is compared with the previous full period.",
              )}{" "}
          {comparison(r, zh)}
          {zh ? "。" : "."}
        </p>
        <ul className="action-list">
          {r.steps.map((s) => (
            <li key={s.kind}>{stepText(s, zh)}</li>
          ))}
        </ul>
      </section>
      <details className="paper detail-paper">
        <summary>
          <Flag size={18} />
          {words("季度目标与成果", "Quarterly goals and outcomes")}{" "}
          <span>
            {r.goals.filter((g) => g.status === "completed").length} / {r.goals.length}{" "}
            {words("已确认完成（生成时）", "confirmed complete at generation")}
          </span>
        </summary>
        <p className="muted">
          {words(
            "投入按本期实际时段计算。预算是整个季度的预算，状态取生成复盘时的值。",
            "Time covers this period. Budgets cover each full quarter. Status is captured when the review is generated.",
          )}
        </p>
        {r.goals.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    words("目标", "Goal"),
                    words("本期投入", "Period time"),
                    words("整季预算", "Quarter budget"),
                    words("确认状态", "Status"),
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.goals.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <small>
                        {g.year} · Q{g.quarter}
                      </small>
                      {g.title}
                    </td>
                    <td>{duration(g.period_minutes, zh)}</td>
                    <td>{g.target_hours ? g.target_hours + " h" : "—"}</td>
                    <td>{getStatusLabel(g.status, zh ? "zh-CN" : "en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>{words("这个周期没有季度目标。", "No quarterly goals for this period.")}</p>
        )}
        {r.rewards.map((a, i) => (
          <p className="award-note" key={i}>
            <Gift size={16} />
            <span>
              {a.day} · {a.title} · {a.reward}
              {a.outcome && " · " + a.outcome}
            </span>
          </p>
        ))}
      </details>
    </>
  );
}

export function exportReview(r: Review, reflection: string, next: string, zh: boolean, version?: number) {
  const w = (cn: string, en: string) => (zh ? cn : en);
  const lines = [
    `# ${name(r.kind, zh)}${w("复盘", " review")} · ${r.start} — ${r.end}`,
    `${w("统计截至", "As of")} ${r.as_of} · Asia/Shanghai${version ? " · v" + version : ""}`,
    `${w("已记录", "Recorded")}: ${duration(r.minutes, zh)} (${r.days} ${w("个记录日", "active days")}, ${r.entries} ${w("段", "entries")})`,
    `${w("对照时段", "Comparison")}: ${r.previous_start} — ${r.previous_end} · ${duration(r.previous_minutes, zh)} · ${comparison(r, zh)}`,
    `${w("目标投入 / 生活", "Goal / everyday time")}: ${duration(r.goal_minutes, zh)} / ${duration(r.life_minutes, zh)}`,
    `${w("总时长扣除重叠", "Overlap excluded from total")}: ${duration(r.overlap_minutes || 0, zh)}`,
    `${w("计划（完成 / 待确认 / 跳过）", "Plans (confirmed / pending / skipped)")}: ${r.plans.completed} / ${r.plans.pending} / ${r.plans.skipped}`,
    "## " + w("时间趋势", "Time trend"),
    ...r.trend.map((v) => "- " + v.date + " · " + duration(v.minutes, zh)),
    "## " + w("投入分布", "Allocation"),
    ...r.distribution.map((v) => "- " + (v.title || name(v.category, zh)) + " · " + duration(v.minutes, zh)),
    "## " +
      w(
        "季度目标（本期时长 / 整季预算 / 生成时状态）",
        "Goals (period time / quarter budget / status at generation)",
      ),
    ...r.goals.map(
      (g) =>
        `- ${g.year} Q${g.quarter} · ${g.title} · ${duration(g.period_minutes, zh)} / ${g.target_hours || "—"} h · ${getStatusLabel(g.status, zh ? "zh-CN" : "en-US")}`,
    ),
    "## " + w("收获与奖励", "Outcomes and rewards"),
    ...r.rewards.map((a) => `- ${a.day} · ${a.title} · ${a.reward} ${a.outcome}`),
    "## " + w("建议", "Suggestions"),
    ...r.steps.map((s) => "- " + stepText(s, zh)),
    "## " + w("我的观察", "My reflection"),
    reflection,
    "## " + w("下一步", "My next step"),
    next,
  ];
  const url = URL.createObjectURL(
    new Blob([lines.join("\n\n") + "\n"], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `TimeTracker-${r.kind}-${r.start}${version ? "-v" + version : ""}.md`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
