"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuthStore } from "@/store/auth";
import { useVisions } from "@/hooks/useVisions";
import { useGoals } from "@/hooks/useGoals";
import { useTimelogs } from "@/hooks/useTimelogs";
import { reportApi } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { getCurrentYear, getCurrentQuarter, formatDuration, getStatusLabel, getStatusColor, parseUtcDateString } from "@/lib/utils";
import { Target, Flag, Clock, TrendingUp, Play } from "lucide-react";
import Link from "next/link";
import { WeeklyReport } from "@/types";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { visions } = useVisions();
  const { goals } = useGoals({ year: getCurrentYear() });
  const { currentSession } = useTimelogs();
  const { t, locale } = useTranslation();
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  // 默认展示当前季度，可手动切换查看其它季度的目标
  const [selectedQuarter, setSelectedQuarter] = useState<number>(getCurrentQuarter());

  useEffect(() => {
    const fetchWeeklyReport = async () => {
      try {
        const report = await reportApi.getWeekly();
        setWeeklyReport(report);
      } catch (err) {
        console.error("Failed to fetch weekly report");
      }
    };
    fetchWeeklyReport();
  }, []);

  const yearlyGoals = goals.filter((g) => g.goal_type === "yearly");

  // 季度目标需要按父目标的 sort_order 排序，然后再按自身的 sort_order 排序
  const quarterlyGoals = goals
    .filter((g) => g.goal_type === "quarterly" && g.quarter === selectedQuarter)
    .sort((a, b) => {
      // 找到各自的父年度目标
      const parentA = yearlyGoals.find(y => y.id === a.parent_id);
      const parentB = yearlyGoals.find(y => y.id === b.parent_id);

      // 先按父目标的 sort_order 排序
      const parentSortA = parentA?.sort_order ?? 0;
      const parentSortB = parentB?.sort_order ?? 0;
      if (parentSortA !== parentSortB) {
        return parentSortA - parentSortB;
      }

      // 父目标相同时，按自身的 sort_order 排序
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t('dashboard.greeting', { username: user?.username || '' })}
        </h1>
        <p className="text-gray-500 mt-1">
          {t('dashboard.yearQuarter', { year: getCurrentYear(), quarter: getCurrentQuarter() })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{visions.length}</p>
              <p className="text-sm text-gray-500">{t('dashboard.visions')}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Flag className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{quarterlyGoals.length}</p>
              <p className="text-sm text-gray-500">{t('dashboard.quarterlyGoals')}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {weeklyReport ? `${weeklyReport.total_hours.toFixed(1)}h` : "-"}
              </p>
              <p className="text-sm text-gray-500">{t('dashboard.weeklyInput')}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {quarterlyGoals.length > 0
                  ? `${(quarterlyGoals.reduce((sum, g) => sum + g.progress_percentage, 0) / quarterlyGoals.length).toFixed(0)}%`
                  : "-"}
              </p>
              <p className="text-sm text-gray-500">{t('dashboard.averageProgress')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Current Session */}
      {currentSession && (
        <Card className="border-green-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-full animate-pulse">
                <Play className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium text-green-800">{t('dashboard.inProgress')}</p>
                <p className="text-sm text-green-600">
                  {t('dashboard.startedAt', { time: parseUtcDateString(currentSession.start_time).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false }) })}
                </p>
              </div>
            </div>
            <Link
              href="/tracker"
              className="btn-primary text-sm"
            >
              {t('common.viewDetails')}
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quarterly Goals */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.thisQuarterGoals')}</h2>
            <div className="flex items-center gap-3">
              <div className="w-20">
                <Select
                  id="dashboard-quarter"
                  value={selectedQuarter.toString()}
                  onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                  options={[
                    { value: "1", label: "Q1" },
                    { value: "2", label: "Q2" },
                    { value: "3", label: "Q3" },
                    { value: "4", label: "Q4" },
                  ]}
                />
              </div>
              <Link href="/goals" className="text-sm text-primary-600 hover:text-primary-700">
                {t('common.viewAll')}
              </Link>
            </div>
          </div>
          {quarterlyGoals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {t('dashboard.noQuarterlyGoals')}
              <Link href="/goals" className="text-primary-600 hover:underline">
                {t('dashboard.goCreate')}
              </Link>
            </p>
          ) : (
            <div className="space-y-4">
              {quarterlyGoals.slice(0, 5).map((goal) => (
                <div key={goal.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{goal.title}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(goal.status)}`}>
                      {getStatusLabel(goal.status, locale)}
                    </span>
                  </div>
                  <ProgressBar
                    value={goal.progress_percentage}
                    size="sm"
                    showLabel={false}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatDuration(goal.accumulated_hours * 60, locale)}</span>
                    <span>{goal.target_hours ? t('dashboard.target', { hours: goal.target_hours }) : t('dashboard.noTarget')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Weekly Breakdown */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.weeklyDistribution')}</h2>
            <Link href="/reports" className="text-sm text-primary-600 hover:text-primary-700">
              {t('dashboard.viewReport')}
            </Link>
          </div>
          {weeklyReport ? (
            <div className="space-y-3">
              {weeklyReport.daily_breakdown.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-20">
                    {new Date(day.date).toLocaleDateString(locale, { weekday: "short" })}
                  </span>
                  <div className="flex-1">
                    <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (day.hours / 8) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium w-12 text-right">
                    {day.hours.toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('common.loading')}</p>
          )}
        </Card>

        {/* Visions Overview */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t('dashboard.visionsOverview')}</h2>
            <Link href="/visions" className="text-sm text-primary-600 hover:text-primary-700">
              {t('dashboard.manageVisions')}
            </Link>
          </div>
          {visions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {t('dashboard.noVisions')}
              <Link href="/visions" className="text-primary-600 hover:underline">
                {t('dashboard.goCreate')}
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {visions.slice(0, 4).map((vision) => (
                <div
                  key={vision.id}
                  className="p-3 rounded-lg border border-gray-200 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: vision.color || "#6366f1" }}
                    />
                    <span className="font-medium">{vision.title}</span>
                  </div>
                  {vision.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                      {vision.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Goals This Week */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">{t('dashboard.topGoalsThisWeek')}</h2>
          {weeklyReport && weeklyReport.top_goals.length > 0 ? (
            <div className="space-y-3">
              {weeklyReport.top_goals.map((goal, index) => (
                <div key={goal.goal_id} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400 w-6">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{goal.title}</p>
                  </div>
                  <span className="text-sm font-medium text-primary-600">
                    {goal.hours.toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">{t('dashboard.noTimeRecords')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
