"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookMarked,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Flag,
  LogOut,
  Menu,
  PanelsTopLeft,
  X,
} from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "@/i18n";
import { useAuthStore } from "@/store/auth";

const pages = [
  { path: "/dashboard", icon: CalendarDays, zh: "时间手帐", en: "Time journal" },
  { path: "/tracker", icon: Clock, zh: "计时与计划", en: "Timer & plans" },
  { path: "/goals", icon: Flag, zh: "目标与奖励", en: "Goals & rewards" },
  { path: "/reviews", icon: BookMarked, zh: "周期复盘", en: "Periodic reviews" },
  { path: "/visions", icon: Compass, zh: "我的愿景", en: "Visions" },
  { path: "/overview", icon: PanelsTopLeft, zh: "目标概览", en: "Goal overview" },
  { path: "/reports", icon: BarChart3, zh: "数据报表", en: "Reports" },
];

export function Sidebar() {
  const path = usePathname();
  const { isZh: zh, t } = useTranslation();
  const { user, logout } = useAuthStore();
  const [small, setSmall] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <aside className={["journal-sidebar", small ? "narrow" : "", open ? "mobile-open" : ""].join(" ")}>
      <div className="brand-row">
        <Link href="/dashboard" className="brand" title="TimeTracker" onClick={() => setOpen(false)}>
          <span>
            <Clock size={21} strokeWidth={2.25} />
          </span>
          <b>TimeTracker</b>
        </Link>
        <button
          className="desktop-toggle"
          onClick={() => setSmall(!small)}
          aria-label={zh ? "切换导航宽度" : "Toggle navigation width"}
        >
          {small ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
        <button
          className="mobile-toggle"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={zh ? "导航菜单" : "Navigation menu"}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <nav aria-label={zh ? "主导航" : "Main navigation"}>
        {pages.map((p) => (
          <Link
            href={p.path}
            key={p.path}
            title={zh ? p.zh : p.en}
            aria-current={path === p.path ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <p.icon size={19} />
            <span>{zh ? p.zh : p.en}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="account-name">{user?.username}</div>
        <LanguageSwitcher collapsed={small} />
        <button
          className="logout"
          title={t("nav.logout")}
          aria-label={t("nav.logout")}
          onClick={() => {
            logout();
            window.location.href = "/login";
          }}
        >
          <LogOut size={17} />
          <span>{t("nav.logout")}</span>
        </button>
      </div>
    </aside>
  );
}
