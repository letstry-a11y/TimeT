"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import {
  Archive as ArchiveIcon,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useTranslation } from "@/i18n";
import {
  Archive,
  ArchiveHeader,
  Period,
  Preview,
  name,
  periods,
  shiftDay,
  today,
  useJournal,
} from "@/lib/journal";
import ReviewBody, { exportReview } from "@/components/journal/ReviewBody";

function ReviewEditor({
  preview,
  reload,
  open,
  zh,
}: {
  preview: Preview;
  reload: () => void;
  open: (id: string) => void;
  zh: boolean;
}) {
  const { report, latest } = preview;
  const [reflection, setReflection] = useState(latest?.reflection || "");
  const [next, setNext] = useState(latest?.next_step || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const w = (cn: string, en: string) => (zh ? cn : en);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.post<Archive>("/api/v1/journal/archives", {
        kind: report.kind,
        anchor: report.start,
        base_version: latest?.version || 0,
        fingerprint: report.fingerprint,
        evaluated_at: report.evaluated_at,
        reflection,
        next_step: next,
      });
      toast.success(w("复盘已归档", "Review archived"));
      open(response.data.id);
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 409
          ? w(
              "数据或档案已有更新。刷新预览，核对后可以再次保存。",
              "Data or archive changed. Refresh the preview before saving again.",
            )
          : w(
              "保存未确认，请先查看历史档案。",
              "Save could not be confirmed. Check the archive before retrying.",
            ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="paper review-notes">
      <h2>
        <BookOpen size={18} />
        {w("写下这次复盘", "Your reflection")}
      </h2>
      {latest && (
        <p className="muted">
          {latest.report.fingerprint !== report.fingerprint
            ? w("补录或数据变化已反映在本次预览中。", "This preview includes changes since the last save.") +
              " "
            : ""}
          <Link className="text-link" href={"/reviews?saved=" + latest.id}>
            {w("查看上一份存档", "View latest saved version")} · v{latest.version}
          </Link>
        </p>
      )}
      <label>
        {w("我想记住什么", "What would you like to remember?")}
        <textarea
          maxLength={12000}
          rows={3}
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
        />
      </label>
      <label>
        {w("下个周期想试的一件事", "One thing to try next period")}
        <textarea maxLength={3000} rows={2} value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              reload();
              setError("");
            }}
            className="text-link"
          >
            {w("刷新预览", "Refresh preview")}
          </button>
        </p>
      )}
      <div className="header-actions">
        <button className="solid-button" disabled={busy} onClick={save}>
          <Save size={16} />
          {latest ? w("保存版本", "Save version") : w("保存复盘", "Save review")}
        </button>
        <button className="quiet-button" onClick={() => exportReview(report, reflection, next, zh)}>
          <Download size={15} />
          Markdown
        </button>
      </div>
    </section>
  );
}

function ArchiveList({ zh, kind, refresh }: { zh: boolean; kind: Period; refresh: string }) {
  const [page, setPage] = useState(0);
  const size = 8;
  const { data, error, reload } = useJournal<ArchiveHeader[]>(
    `archives?kind=${kind}&skip=${page * size}&limit=${size + 1}`,
    refresh,
  );
  const w = (cn: string, en: string) => (zh ? cn : en);
  return (
    <section className="paper" id="archive">
      <div className="section-title">
        <h2>
          <ArchiveIcon size={18} />
          {w("历史档案", "Saved reviews")}
        </h2>
        <span>{name(kind, zh)}</span>
      </div>
      {error ? (
        <button onClick={reload} className="text-link">
          {w("重试", "Retry")}
        </button>
      ) : !data ? (
        <p>{w("正在读取…", "Loading…")}</p>
      ) : (
        <>
          {data.length ? (
            <div className="archive-links">
              {data.slice(0, size).map((a) => (
                <Link key={a.id} href={"/reviews?saved=" + a.id}>
                  <div>
                    <strong>
                      {a.start} · {name(kind, zh)}
                      {w("复盘", " review")}
                    </strong>
                    <small>v{a.version}</small>
                  </div>
                  <ArrowRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-note">
              {w(
                "这个周期类型还没有存档。保存一次复盘，就能随时回来查看。",
                "No saved reviews for this period type yet.",
              )}
            </p>
          )}
          {(page > 0 || data.length > size) && (
            <div className="header-actions">
              <button disabled={!page} className="quiet-button" onClick={() => setPage(page - 1)}>
                {w("上一页", "Previous")}
              </button>
              <button
                disabled={data.length <= size}
                className="quiet-button"
                onClick={() => setPage(page + 1)}
              >
                {w("下一页", "Next")}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Reviews() {
  const { isZh: zh } = useTranslation();
  const params = useSearchParams(),
    router = useRouter();
  const saved = params.get("saved") || "";
  const searchKind = params.get("kind") as Period;
  const kind = periods.includes(searchKind) ? searchKind : "week";
  const selected = params.get("date") || today();
  const anchor =
    /^\d{4}-\d{2}-\d{2}$/.test(selected) && selected >= "1900-01-01" && selected <= today()
      ? selected
      : today();
  const live = useJournal<Preview>(saved ? null : `review?kind=${kind}&anchor=${anchor}`);
  const archived = useJournal<Archive>(saved ? "archives/" + encodeURIComponent(saved) : null);
  const r = saved ? archived.data?.report : live.data?.report;
  const w = (cn: string, en: string) => (zh ? cn : en);
  const choose = (p: Period, d: string) => {
    if (d && d >= "1900-01-01" && d <= today())
      router.push(`/reviews?kind=${p}&date=${d}`, { scroll: false });
  };
  useEffect(() => {
    if (saved) window.scrollTo({ top: 0 });
  }, [saved]);
  return (
    <div className="journal-page">
      <header className="journal-header">
        <div>
          <p className="context-line">
            <BookOpen size={15} />
            {w("个人时间档案", "Personal time archive")}
          </p>
          <h1>{w("周期复盘", "Periodic reviews")}</h1>
        </div>
        <a className="quiet-button" href="#archive">
          <ArchiveIcon size={16} />
          {w("历史档案", "Saved reviews")}
        </a>
      </header>
      <nav className="choice-strip period-tabs" aria-label={w("复盘周期", "Review period")}>
        {periods.map((k) => (
          <button
            key={k}
            aria-pressed={k === (r?.kind || kind)}
            onClick={() => choose(k, r?.as_of || anchor)}
          >
            {name(k, zh)}
          </button>
        ))}
      </nav>
      {saved && (
        <button className="text-link" onClick={() => choose(r?.kind || kind, r?.start || anchor)}>
          <ArrowLeft size={14} />
          {w("回到实时复盘", "Back to live review")}
        </button>
      )}
      <div className="period-heading">
        {r && (
          <div>
            <h2>
              {r.start} <span>—</span> {r.end}
            </h2>
            <p>
              {saved
                ? w("已归档", "Archived") + " · v" + archived.data?.version
                : r.partial
                  ? w("进行中", "In progress")
                  : w("完整周期", "Full period")}{" "}
              · {w("统计截至", "As of")} {r.as_of}
            </p>
          </div>
        )}
        {!saved && (
          <div className="inline-controls">
            <button
              aria-label={w("上一周期", "Previous period")}
              disabled={!r || r.start <= "1900-01-01"}
              onClick={() => r && choose(kind, shiftDay(r.start, -1))}
            >
              <ChevronLeft size={17} />
            </button>
            <input
              type="date"
              aria-label={w("按日期查看周期", "Choose period by date")}
              min="1900-01-01"
              max={today()}
              value={anchor}
              onChange={(e) => choose(kind, e.target.value)}
            />
            <button
              aria-label={w("下一周期", "Next period")}
              disabled={!r || r.end >= today()}
              onClick={() => r && choose(kind, shiftDay(r.end, 1))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
      {(saved ? archived.error : live.error) && (
        <p role="alert">
          {w("复盘读取失败。", "Could not open this review.")}{" "}
          <button className="text-link" onClick={saved ? archived.reload : live.reload}>
            {w("重试", "Retry")}
          </button>
        </p>
      )}
      {!r ? (
        !(saved ? archived.error : live.error) && (
          <p role="status">{w("正在整理记录…", "Reading your records…")}</p>
        )
      ) : (
        <>
          <ReviewBody key={r.kind + r.start} r={r} zh={zh} />
          {saved && archived.data ? (
            <section className="paper review-notes">
              <h2>{w("我的观察", "My reflection")}</h2>
              <p>{archived.data.reflection || "—"}</p>
              <h2>{w("下一步", "Next step")}</h2>
              <p>{archived.data.next_step || "—"}</p>
              <button
                className="quiet-button"
                onClick={() => {
                  const a = archived.data!;
                  exportReview(r, a.reflection, a.next_step, zh, a.version);
                }}
              >
                <Download size={15} />
                Markdown
              </button>
            </section>
          ) : (
            live.data && (
              <ReviewEditor
                key={r.kind + r.start}
                preview={live.data}
                reload={live.reload}
                open={(id) => router.push("/reviews?saved=" + id)}
                zh={zh}
              />
            )
          )}
        </>
      )}
      <ArchiveList key={r?.kind || kind} kind={r?.kind || kind} refresh={saved} zh={zh} />
    </div>
  );
}
export default function ReviewsPage() {
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <Reviews />
    </Suspense>
  );
}
