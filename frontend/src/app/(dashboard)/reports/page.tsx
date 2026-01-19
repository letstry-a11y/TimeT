"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { reportApi } from "@/lib/api";
import { VisionAlignmentReport, GoalProgressReport, WeeklyReport } from "@/types";
import { getCurrentYear, getCurrentQuarter, getStatusLabel, getStatusColor, formatDuration } from "@/lib/utils";
import { BarChart3, PieChart, TrendingUp, Calendar } from "lucide-react";

export default function ReportsPage() {
  const [selectedYear, setSelectedYear] = useState(getCurrentYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(getCurrentQuarter());

  const [visionReport, setVisionReport] = useState<VisionAlignmentReport | null>(null);
  const [goalReport, setGoalReport] = useState<GoalProgressReport | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const [vision, goal, weekly] = await Promise.all([
          reportApi.getVisionAlignment(),
          reportApi.getGoalProgress(selectedYear, selectedQuarter || undefined),
          reportApi.getWeekly(),
        ]);
        setVisionReport(vision);
        setGoalReport(goal);
        setWeeklyReport(weekly);
      } catch (err) {
        console.error("Failed to fetch reports");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [selectedYear, selectedQuarter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">报表分析</h1>
          <p className="text-gray-500 mt-1">了解你的时间都花在哪里</p>
        </div>
        <div className="flex gap-3">
          <Select
            id="report-year"
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            options={[
              { value: (getCurrentYear() - 1).toString(), label: `${getCurrentYear() - 1}年` },
              { value: getCurrentYear().toString(), label: `${getCurrentYear()}年` },
            ]}
            className="w-28"
          />
          <Select
            id="report-quarter"
            value={selectedQuarter?.toString() || ""}
            onChange={(e) => setSelectedQuarter(e.target.value ? parseInt(e.target.value) : null)}
            options={[
              { value: "", label: "全年" },
              { value: "1", label: "Q1" },
              { value: "2", label: "Q2" },
              { value: "3", label: "Q3" },
              { value: "4", label: "Q4" },
            ]}
            className="w-24"
          />
        </div>
      </div>

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
              <p className="text-sm text-gray-500">总投入时间</p>
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
              <p className="text-sm text-gray-500">已完成目标</p>
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
              <p className="text-sm text-gray-500">本周投入</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vision Alignment */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">愿景对齐度</h2>
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
                  总计: {visionReport.total_hours.toFixed(1)} 小时
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              暂无数据
            </div>
          )}
        </Card>

        {/* Weekly Breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">本周时间分布</h2>
          </div>

          {weeklyReport ? (
            <div className="space-y-3">
              {weeklyReport.daily_breakdown.map((day) => {
                const dayName = new Date(day.date).toLocaleDateString("zh-CN", {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
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
                  共 {weeklyReport.total_hours.toFixed(1)} 小时
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              暂无数据
            </div>
          )}
        </Card>
      </div>

      {/* Goal Progress */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-semibold">目标进度</h2>
        </div>

        {goalReport && goalReport.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">目标</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">类型</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">状态</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">进度</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-500">投入时间</th>
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
                        {goal.goal_type === "yearly" ? "年度" : `Q${goal.quarter}`}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(goal.status)}`}>
                        {getStatusLabel(goal.status)}
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
            暂无目标数据
          </div>
        )}
      </Card>

      {/* Top Goals This Week */}
      {weeklyReport && weeklyReport.top_goals.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-4">本周投入最多的目标</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {weeklyReport.top_goals.map((goal, index) => (
              <div key={goal.goal_id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-300">#{index + 1}</span>
                  <div className="flex-1">
                    <p className="font-medium line-clamp-1">{goal.title}</p>
                    <p className="text-primary-600 font-semibold">{goal.hours.toFixed(1)} 小时</p>
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
