"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useGoals } from "@/hooks/useGoals";
import { useVisions } from "@/hooks/useVisions";
import { Goal, GoalCreate } from "@/types";
import { getCurrentYear, getCurrentQuarter, getStatusLabel, getStatusColor, formatDuration } from "@/lib/utils";
import { Plus, Edit2, Trash2, Flag, ChevronRight, ChevronDown } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "not_started", label: "未开始" },
  { value: "in_progress", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "paused", label: "已暂停" },
  { value: "cancelled", label: "已取消" },
];

export default function GoalsPage() {
  const currentYear = getCurrentYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);

  const { goals, isLoading, createGoal, updateGoal, deleteGoal, refetch } = useGoals({
    year: selectedYear,
    quarter: selectedQuarter || undefined,
  });
  const { visions } = useVisions();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<GoalCreate>({
    title: "",
    description: "",
    goal_type: "quarterly",
    year: currentYear,
    quarter: getCurrentQuarter(),
    vision_id: "",
    parent_id: "",
    target_hours: 0,
  });

  // Group goals by hierarchy
  const yearlyGoals = useMemo(() => {
    return goals.filter((g) => g.goal_type === "yearly");
  }, [goals]);

  const quarterlyGoals = useMemo(() => {
    return goals.filter((g) => g.goal_type === "quarterly");
  }, [goals]);

  const getChildGoals = (parentId: string) => {
    return quarterlyGoals.filter((g) => g.parent_id === parentId);
  };

  const toggleExpand = (goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
  };

  const handleOpenCreate = (type: "yearly" | "quarterly", parentId?: string) => {
    setEditingGoal(null);
    setFormData({
      title: "",
      description: "",
      goal_type: type,
      year: selectedYear,
      quarter: type === "quarterly" ? getCurrentQuarter() : undefined,
      vision_id: type === "yearly" ? (visions[0]?.id || "") : "",
      parent_id: type === "quarterly" ? (parentId || yearlyGoals[0]?.id || "") : "",
      target_hours: 0,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || "",
      goal_type: goal.goal_type,
      year: goal.year,
      quarter: goal.quarter,
      vision_id: goal.vision_id || "",
      parent_id: goal.parent_id || "",
      target_hours: goal.target_hours || 0,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = { ...formData };
      if (data.goal_type === "yearly") {
        delete data.parent_id;
        delete data.quarter;
      } else {
        delete data.vision_id;
      }

      if (editingGoal) {
        await updateGoal(editingGoal.id, {
          title: data.title,
          description: data.description,
          target_hours: data.target_hours,
        });
      } else {
        await createGoal(data);
      }
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("确定要删除这个目标吗？子目标也会被删除。")) {
      await deleteGoal(id);
    }
  };

  const handleStatusChange = async (goalId: string, status: string) => {
    await updateGoal(goalId, { status });
  };

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
          <h1 className="text-2xl font-bold text-gray-900">目标管理</h1>
          <p className="text-gray-500 mt-1">管理你的年度目标和季度目标</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleOpenCreate("yearly")}>
            <Plus className="h-4 w-4 mr-2" />
            年度目标
          </Button>
          <Button onClick={() => handleOpenCreate("quarterly")}>
            <Plus className="h-4 w-4 mr-2" />
            季度目标
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex gap-4 items-center">
          <Select
            id="year"
            label="年份"
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            options={[
              { value: (currentYear - 1).toString(), label: `${currentYear - 1}年` },
              { value: currentYear.toString(), label: `${currentYear}年` },
              { value: (currentYear + 1).toString(), label: `${currentYear + 1}年` },
            ]}
            className="w-32"
          />
          <Select
            id="quarter"
            label="季度"
            value={selectedQuarter?.toString() || ""}
            onChange={(e) => setSelectedQuarter(e.target.value ? parseInt(e.target.value) : null)}
            options={[
              { value: "", label: "全部" },
              { value: "1", label: "Q1" },
              { value: "2", label: "Q2" },
              { value: "3", label: "Q3" },
              { value: "4", label: "Q4" },
            ]}
            className="w-32"
          />
        </div>
      </Card>

      {/* Goals List */}
      {yearlyGoals.length === 0 && quarterlyGoals.length === 0 ? (
        <Card className="text-center py-12">
          <Flag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有目标</h3>
          <p className="text-gray-500 mb-4">创建年度目标，然后分解为季度目标</p>
          <Button onClick={() => handleOpenCreate("yearly")}>
            <Plus className="h-4 w-4 mr-2" />
            创建年度目标
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {yearlyGoals.map((yearlyGoal) => {
            const children = getChildGoals(yearlyGoal.id);
            const isExpanded = expandedGoals.has(yearlyGoal.id);

            return (
              <Card key={yearlyGoal.id} className="p-0 overflow-hidden">
                {/* Yearly Goal Header */}
                <div className="p-4 bg-gray-50 border-b">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(yearlyGoal.id)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </button>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          年度目标
                        </span>
                        <h3 className="font-semibold">{yearlyGoal.title}</h3>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <ProgressBar
                          value={yearlyGoal.progress_percentage}
                          size="sm"
                          className="w-48"
                        />
                        <span className="text-sm text-gray-500">
                          {formatDuration(yearlyGoal.accumulated_hours * 60)}
                          {yearlyGoal.target_hours && ` / ${yearlyGoal.target_hours}h`}
                        </span>
                      </div>
                    </div>
                    <select
                      value={yearlyGoal.status}
                      onChange={(e) => handleStatusChange(yearlyGoal.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(yearlyGoal.status)}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenCreate("quarterly", yearlyGoal.id)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg"
                        title="添加季度目标"
                      >
                        <Plus className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(yearlyGoal)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg"
                      >
                        <Edit2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(yearlyGoal.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quarterly Goals */}
                {isExpanded && (
                  <div className="divide-y">
                    {children.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 text-sm">
                        暂无季度目标，
                        <button
                          onClick={() => handleOpenCreate("quarterly", yearlyGoal.id)}
                          className="text-primary-600 hover:underline"
                        >
                          点击添加
                        </button>
                      </div>
                    ) : (
                      children.map((qGoal) => (
                        <div key={qGoal.id} className="p-4 pl-12 hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                  Q{qGoal.quarter}
                                </span>
                                <span className="font-medium">{qGoal.title}</span>
                              </div>
                              <div className="flex items-center gap-4 mt-2">
                                <ProgressBar
                                  value={qGoal.progress_percentage}
                                  size="sm"
                                  className="w-40"
                                />
                                <span className="text-sm text-gray-500">
                                  {formatDuration(qGoal.accumulated_hours * 60)}
                                  {qGoal.target_hours && ` / ${qGoal.target_hours}h`}
                                </span>
                              </div>
                            </div>
                            <select
                              value={qGoal.status}
                              onChange={(e) => handleStatusChange(qGoal.id, e.target.value)}
                              className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(qGoal.status)}`}
                            >
                              {STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleOpenEdit(qGoal)}
                                className="p-1.5 hover:bg-gray-200 rounded-lg"
                              >
                                <Edit2 className="h-4 w-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleDelete(qGoal.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {/* Orphan quarterly goals */}
          {quarterlyGoals.filter((g) => !g.parent_id).length > 0 && (
            <Card>
              <h3 className="font-semibold mb-4 text-gray-500">未关联的季度目标</h3>
              <div className="space-y-3">
                {quarterlyGoals
                  .filter((g) => !g.parent_id)
                  .map((qGoal) => (
                    <div key={qGoal.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span>{qGoal.title}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(qGoal.status)}`}>
                          {getStatusLabel(qGoal.status)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGoal ? "编辑目标" : `创建${formData.goal_type === "yearly" ? "年度" : "季度"}目标`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            label="目标标题"
            placeholder="例如：完成项目开发"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              placeholder="目标描述..."
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {!editingGoal && formData.goal_type === "yearly" && (
            <Select
              id="vision"
              label="关联愿景"
              value={formData.vision_id || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, vision_id: e.target.value }))}
              options={[
                { value: "", label: "请选择愿景" },
                ...visions.map((v) => ({ value: v.id, label: v.title })),
              ]}
              required
            />
          )}

          {!editingGoal && formData.goal_type === "quarterly" && (
            <>
              <Select
                id="parent"
                label="关联年度目标"
                value={formData.parent_id || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, parent_id: e.target.value }))}
                options={[
                  { value: "", label: "请选择年度目标" },
                  ...yearlyGoals.map((g) => ({ value: g.id, label: g.title })),
                ]}
                required
              />
              <Select
                id="quarter"
                label="季度"
                value={formData.quarter?.toString() || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, quarter: parseInt(e.target.value) }))}
                options={[
                  { value: "1", label: "Q1 (1-3月)" },
                  { value: "2", label: "Q2 (4-6月)" },
                  { value: "3", label: "Q3 (7-9月)" },
                  { value: "4", label: "Q4 (10-12月)" },
                ]}
                required
              />
            </>
          )}

          <Input
            id="target_hours"
            type="number"
            label="目标时长 (小时)"
            placeholder="0"
            value={formData.target_hours || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, target_hours: parseFloat(e.target.value) || 0 }))}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              取消
            </Button>
            <Button type="submit" className="flex-1">
              {editingGoal ? "保存" : "创建"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
