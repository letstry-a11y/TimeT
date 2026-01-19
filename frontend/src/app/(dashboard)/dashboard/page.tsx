"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuthStore } from "@/store/auth";
import { useVisions } from "@/hooks/useVisions";
import { useGoals } from "@/hooks/useGoals";
import { useTimelogs } from "@/hooks/useTimelogs";
import { reportApi } from "@/lib/api";
import { getCurrentYear, getCurrentQuarter, formatDuration, getStatusLabel, getStatusColor } from "@/lib/utils";
import { Target, Flag, Clock, TrendingUp, Play } from "lucide-react";
import Link from "next/link";
import { WeeklyReport } from "@/types";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { visions } = useVisions();
  const { goals } = useGoals({ year: getCurrentYear() });
  const { currentSession } = useTimelogs();
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);

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

  const quarterlyGoals = goals.filter((g) => g.goal_type === "quarterly" && g.quarter === getCurrentQuarter());
  const yearlyGoals = goals.filter((g) => g.goal_type === "yearly");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          你好，{user?.username}！
        </h1>
        <p className="text-gray-500 mt-1">
          {getCurrentYear()} 年 Q{getCurrentQuarter()} · 让每一分钟都有意义
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
              <p className="text-sm text-gray-500">愿景</p>
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
              <p className="text-sm text-gray-500">本季度目标</p>
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
              <p className="text-sm text-gray-500">本周投入</p>
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
              <p className="text-sm text-gray-500">平均进度</p>
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
                <p className="font-medium text-green-800">正在进行中</p>
                <p className="text-sm text-green-600">
                  开始于 {new Date(currentSession.start_time).toLocaleTimeString("zh-CN")}
                </p>
              </div>
            </div>
            <Link
              href="/tracker"
              className="btn-primary text-sm"
            >
              查看详情
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quarterly Goals */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">本季度目标</h2>
            <Link href="/goals" className="text-sm text-primary-600 hover:text-primary-700">
              查看全部
            </Link>
          </div>
          {quarterlyGoals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              还没有本季度目标，
              <Link href="/goals" className="text-primary-600 hover:underline">
                去创建
              </Link>
            </p>
          ) : (
            <div className="space-y-4">
              {quarterlyGoals.slice(0, 5).map((goal) => (
                <div key={goal.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{goal.title}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(goal.status)}`}>
                      {getStatusLabel(goal.status)}
                    </span>
                  </div>
                  <ProgressBar
                    value={goal.progress_percentage}
                    size="sm"
                    showLabel={false}
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>{formatDuration(goal.accumulated_hours * 60)}</span>
                    <span>{goal.target_hours ? `目标 ${goal.target_hours}h` : "无目标"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Weekly Breakdown */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">本周时间分布</h2>
            <Link href="/reports" className="text-sm text-primary-600 hover:text-primary-700">
              查看报表
            </Link>
          </div>
          {weeklyReport ? (
            <div className="space-y-3">
              {weeklyReport.daily_breakdown.map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-20">
                    {new Date(day.date).toLocaleDateString("zh-CN", { weekday: "short" })}
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
            <p className="text-gray-500 text-center py-8">加载中...</p>
          )}
        </Card>

        {/* Visions Overview */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">愿景概览</h2>
            <Link href="/visions" className="text-sm text-primary-600 hover:text-primary-700">
              管理愿景
            </Link>
          </div>
          {visions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              还没有愿景，
              <Link href="/visions" className="text-primary-600 hover:underline">
                去创建
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
          <h2 className="text-lg font-semibold mb-4">本周投入最多</h2>
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
            <p className="text-gray-500 text-center py-8">本周还没有时间记录</p>
          )}
        </Card>
      </div>
    </div>
  );
}
