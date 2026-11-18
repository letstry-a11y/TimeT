"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { reportApi } from "@/lib/api";
import { useTranslation } from "@/i18n";
import { VisionAlignmentReport, GoalProgressReport, WeeklyReport, PeriodReport } from "@/types";
import { getCurrentYear, getCurrentQuarter, getStatusLabel, getStatusColor, formatDuration, parseUtcDateString } from "@/lib/utils";
import { BarChart3, PieChart, TrendingUp, Calendar } from "lucide-react";

export default function ReportsPage() {
  const { t, locale } = useTranslation();
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(getCurrentQuarter());

  const [visionReport, setVisionReport] = useState<VisionAlignmentReport | null>(null);
  const [goalReport, setGoalReport] = useState<GoalProgressReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [periodReport, setPeriodReport] = useState<PeriodReport | null>(null);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchReports = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const [vision, goal, weekly, period] = await Promise.all([
          // Vision Alignment shows the all-time total per vision (not scoped to
          // the selected quarter). Only Goal Progress below uses year/quarter.
          reportApi.getVisionAlignment(),
          reportApi.getGoalProgress(selectedYear, selectedQuarter || undefined),
          reportApi.getWeekly(),
          reportApi.getPeriod(selectedYear, selectedQuarter || undefined),
        ]);
        if (cancelled) return;
        setPeriodReport(period);
        setVisionReport(vision);
        setGoalReport(goal);
        setWeeklyReport(weekly);
      } catch (err) {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchReports();
    return () => { cancelled = true; };
  }, [selectedYear, selectedQuarter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) return <Card><p role="alert">{locale === "zh-CN" ? "报表加载失败，请刷新重试。" : "Could not load reports. Please reload."}</p></Card>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('reports.title')}</h1>
          <p className="text-gray-500 mt-1">{t('reports.description')}</p>
        </div>
        <div className="flex gap-3">
          <Select
            id="report-year"
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            options={[
              { value: (getCurrentYear() - 1).toString(), label: locale === 'zh-CN' ? `${getCurrentYear() - 1}年` : `${getCurrentYear() - 1}` },
              { value: getCurrentYear().toString(), label: locale === 'zh-CN' ? `${getCurrentYear()}年` : `${getCurrentYear()}` },
            ]}
            className="w-28"
          />
          <Select
            id="report-quarter"
            value={selectedQuarter?.toString() || ""}
            onChange={(e) => setSelectedQuarter(e.target.value ? parseInt(e.target.value) : null)}
            options={[
              { value: "", label: t('reports.wholeYear') },
              { value: "1", label: "Q1" },
              { value: "2", label: "Q2" },
              { value: "3", label: "Q3" },
              { value: "4", label: "Q4" },
            ]}
            className="w-24"
          />
        </div>
      </div>

      {periodReport && (
        <Card>
          <h2 className="text-lg font-semibold">{locale === "zh-CN" ? "所选期间 · 北京时间" : "Selected period · Beijing time"}</h2>
          <p className="text-sm text-gray-500 mt-1">{periodReport.start_date} — {periodReport.end_date} · {locale === "zh-CN" ? "统计截至" : "As of"} {periodReport.as_of}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div><p className="text-2xl font-bold">{periodReport.calendar_hours.toFixed(1)}h</p><p className="text-sm text-gray-500">{locale === "zh-CN" ? "实际发生日期投入" : "Hours by activity date"}</p></div>
            <div><p className="text-2xl font-bold">{periodReport.goal_hours.toFixed(1)} / {periodReport.target_hours.toFixed(1)}h</p><p className="text-sm text-gray-500">{locale === "zh-CN" ? "所选季度目标累计 / 预算" : "Assigned quarterly goals / budget"}</p></div>
            <div><p className="text-2xl font-bold">{periodReport.elapsed_percentage}%</p><p className="text-sm text-gray-500">{locale === "zh-CN" ? "期间时间已过" : "Period elapsed"}</p></div>
          </div>
          <p className="text-sm text-gray-500 mt-4">{locale === "zh-CN" ? "实际投入按记录开始日期统计；目标累计包含归属这些目标的跨期记录。下方历史累计和当前周数据独立展示。" : "Activity totals use start dates; goal totals include cross-period entries. All-time and current-week figures below are separate."}</p>
          {periodReport.cross_period_log_count > 0 && <p className="text-sm text-amber-700 mt-2">{locale === "zh-CN" ? `有 ${periodReport.cross_period_log_count} 条记录的发生日期与目标季度不一致，请核对归属。` : `${periodReport.cross_period_log_count} entries belong to a different quarter. Review their assignment.`}</p>}
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {visionReport ? `${visionReport.total_hours.toFixed(1)}h` : "-"}
              </p>
              <p className="text-sm text-gray-500">{locale === 'zh-CN' ? '历史累计投入（全部日期）' : 'All-time recorded hours'}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {goalReport
                  ? goalReport.data.filter((g) => g.status === "completed").length
                  : "-"}
              </p>
              <p className="text-sm text-gray-500">{t('reports.completedGoals')}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {weeklyReport ? `${weeklyReport.total_hours.toFixed(1)}h` : "-"}
              </p>
              <p className="text-sm text-gray-500">{t('reports.weeklyInput')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vision Alignment */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">{locale === 'zh-CN' ? '愿景分布（历史累计）' : 'Vision alignment (all time)'}</h2>
          </div>

          {visionReport && visionReport.data.length > 0 ? (
            <div className="space-y-4">
              {visionReport.data.map((item, index) => {
                const colors = [
                  "bg-blue-500",
                  "bg-purple-500",
                  "bg-pink-500",
                  "bg-orange-500",
                  "bg-green-500",
                ];
                return (
                  <div key={item.vision_id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{item.vision_title}</span>
                      <span className="text-sm text-gray-500">
                        {item.hours.toFixed(1)}h ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${colors[index % colors.length]} rounded-full transition-all`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Legend */}
              <div className="pt-4 border-t mt-4">
                <p className="text-sm text-gray-500 text-center">
                  {t('reports.totalHours', { hours: visionReport.total_hours.toFixed(1) })}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('common.noData')}
            </div>
          )}
        </Card>

        {/* Weekly Breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">{t('reports.weeklyDistribution')}</h2>
          </div>

          {weeklyReport ? (
            <div className="space-y-3">
              {weeklyReport.daily_breakdown.map((day) => {
                const dayName = parseUtcDateString(day.date + "T00:00:00").toLocaleDateString(locale, {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                  timeZone: "UTC",
                });
                const maxHours = 10;
                const percentage = Math.min(100, (day.hours / maxHours) * 100);

                return (
                  <div key={day.date} className="flex items-center gap-3">
                    <span className="text-sm text-gray-500 w-24">{dayName}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      >
                        {day.hours > 0 && (
                          <span className="text-xs text-white font-medium">
                            {day.hours.toFixed(1)}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t mt-4 flex justify-between text-sm">
                <span className="text-gray-500">
                  {weeklyReport.start_date} - {weeklyReport.end_date}
                </span>
                <span className="font-medium text-primary-600">
                  {t('reports.totalHours', { hours: weeklyReport.total_hours.toFixed(1) })}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('common.noData')}
            </div>
          )}
        </Card>
      </div>

      {periodReport && (
        <Card>
          <h2 className="text-lg font-semibold mb-2">{locale === "zh-CN" ? "执行频率与剩余安排" : "Consistency and remaining effort"}</h2>
          <p className="text-sm text-gray-500 mb-3">{locale === "zh-CN" ? "本周从" : "Week from"} {periodReport.week_start} · {locale === "zh-CN" ? "频率为有记录的天数；剩余每周投入从统计次日起计算。" : "Frequency counts days with records; remaining effort starts the day after the report date."}</p>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-left"><th className="p-2">{locale === "zh-CN" ? "目标 / 验收要求" : "Goal / acceptance"}</th><th className="p-2">{locale === "zh-CN" ? "原始达成率" : "Actual progress"}</th><th className="p-2">{locale === "zh-CN" ? "本周天数" : "Days this week"}</th><th className="p-2">{locale === "zh-CN" ? "最近记录" : "Latest record"}</th><th className="p-2">{locale === "zh-CN" ? "剩余 h/周" : "Remaining h/week"}</th></tr></thead>
            <tbody>{periodReport.goals.map(goal => <tr key={goal.goal_id} className="border-b align-top">
              <td className="p-2"><p className="font-medium">{goal.title}</p>{goal.acceptance && <details className="max-w-lg mt-1 text-gray-500"><summary className="cursor-pointer">{locale === "zh-CN" ? "查看计划与验收要求" : "Plan and acceptance criteria"}</summary><p className="mt-2 whitespace-pre-wrap">{goal.acceptance}</p></details>}</td>
              <td className="p-2">{goal.raw_percentage == null ? "—" : `${goal.raw_percentage}%`}</td><td className="p-2">{goal.active_days_this_week}</td><td className="p-2 whitespace-nowrap">{goal.last_record || "—"}</td><td className="p-2">{goal.remaining_hours_per_week == null ? "—" : goal.remaining_hours_per_week.toFixed(1)}</td>
            </tr>)}</tbody>
          </table></div>
        </Card>
      )}

      {/* Goal Progress */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold">{t('reports.goalProgress')}</h2>
        </div>

        {goalReport && goalReport.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">{t('reports.goal')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">{t('reports.type')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">{t('reports.status')}</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">{t('reports.progress')}</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">{t('reports.timeSpent')}</th>
                </tr>
              </thead>
              <tbody>
                {goalReport.data.map((goal) => (
                  <tr key={goal.goal_id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium">{goal.title}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          goal.goal_type === "yearly"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {goal.goal_type === "yearly" ? t('reports.yearly') : `Q${goal.quarter}`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(goal.status)}`}>
                        {getStatusLabel(goal.status, locale)}
                      </span>
                    </td>
                    <td className="py-3 px-4 w-48">
                      <ProgressBar value={goal.progress_percentage} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-medium">{goal.accumulated_hours.toFixed(1)}h</span>
                      {goal.target_hours && (
                        <span className="text-gray-400 text-sm"> / {goal.target_hours}h</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            {t('reports.noGoalData')}
          </div>
        )}
      </Card>

      {/* Top Goals This Week */}
      {weeklyReport && weeklyReport.top_goals.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">{t('reports.topGoalsThisWeek')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weeklyReport.top_goals.map((goal, index) => (
              <div key={goal.goal_id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium line-clamp-1">{goal.title}</p>
                    <p className="text-primary-600 font-semibold">{goal.hours.toFixed(1)} {t('common.hours')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
