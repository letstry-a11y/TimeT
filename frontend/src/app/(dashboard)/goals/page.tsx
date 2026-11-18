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
import RewardShelf from "@/components/journal/RewardShelf";
import { useTranslation } from "@/i18n";
import { Goal, GoalCreate, GoalStatus } from "@/types";
import { getCurrentYear, getCurrentQuarter, getStatusLabel, getStatusColor, formatDuration } from "@/lib/utils";
import { Plus, Edit2, Trash2, Flag, ChevronRight, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";

export default function GoalsPage() {
  const { t, locale } = useTranslation();
  const currentYear = getCurrentYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedQuarter, setSelectedQuarter] = useState<number | null>(null);
  const [justCompleted, setJustCompleted] = useState("");

  // 不传递 quarter 参数，获取所有目标，然后在前端筛选
  const { goals, isLoading, createGoal, updateGoal, deleteGoal, refetch } = useGoals({
    year: selectedYear,
  });
  const { visions } = useVisions();

  const STATUS_OPTIONS = [
    { value: "not_started", label: t('goals.notStarted') },
    { value: "in_progress", label: t('goals.inProgress') },
    { value: "completed", label: t('goals.completed') },
    { value: "paused", label: t('goals.paused') },
    { value: "cancelled", label: t('goals.cancelled') },
  ];

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
    let filtered = goals.filter((g) => g.goal_type === "quarterly");

    // 如果选择了特定季度，只显示该季度的目标
    if (selectedQuarter) {
      filtered = filtered.filter((g) => g.quarter === selectedQuarter);
    }

    // 按父年度目标的 sort_order 排序，再按自身的 sort_order 排序
    return filtered.sort((a, b) => {
      const parentA = yearlyGoals.find(y => y.id === a.parent_id);
      const parentB = yearlyGoals.find(y => y.id === b.parent_id);

      const parentSortA = parentA?.sort_order ?? 0;
      const parentSortB = parentB?.sort_order ?? 0;

      if (parentSortA !== parentSortB) {
        return parentSortA - parentSortB;
      }

      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [goals, selectedQuarter, yearlyGoals]);

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
        const updateData: Partial<Goal> = {
          title: data.title,
          description: data.description,
          target_hours: data.target_hours,
        };
        // 年度目标可以修改愿景关联
        if (editingGoal.goal_type === 'yearly') {
          updateData.vision_id = data.vision_id || undefined;
        }
        await updateGoal(editingGoal.id, updateData);
      } else {
        // 新建时设置 sort_order 为最大值 + 1，确保新项目在列表末尾
        let maxSortOrder = -1;
        if (data.goal_type === "yearly") {
          maxSortOrder = yearlyGoals.length > 0
            ? Math.max(...yearlyGoals.map(g => g.sort_order))
            : -1;
        } else {
          // 季度目标只在同一父目标下计算最大值
          const siblings = quarterlyGoals.filter(g => g.parent_id === data.parent_id);
          maxSortOrder = siblings.length > 0
            ? Math.max(...siblings.map(g => g.sort_order))
            : -1;
        }
        await createGoal({ ...data, sort_order: maxSortOrder + 1 });
      }
      setIsModalOpen(false);
      refetch();
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('goals.deleteConfirm'))) {
      await deleteGoal(id);
    }
  };

  const handleStatusChange = async (goalId: string, status: GoalStatus) => {
    await updateGoal(goalId, { status });
    if (status === "completed") {
      setJustCompleted(goalId);
      document.getElementById("rewards")?.scrollIntoView({ block: "start" });
    }
  };

  const handleMoveYearlyGoal = async (goalId: string, direction: 'up' | 'down') => {
    const currentIndex = yearlyGoals.findIndex(g => g.id === goalId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= yearlyGoals.length) return;

    const currentGoal = yearlyGoals[currentIndex];
    const targetGoal = yearlyGoals[targetIndex];

    try {
      // 使用索引作为新的 sort_order（交换后的位置）
      await updateGoal(currentGoal.id, { sort_order: targetIndex });
      await updateGoal(targetGoal.id, { sort_order: currentIndex });
      refetch();
    } catch (err) {
      // 错误已在 hook 中处理
    }
  };

  const handleMoveQuarterlyGoal = async (goalId: string, parentId: string, direction: 'up' | 'down') => {
    const siblings = quarterlyGoals.filter(g => g.parent_id === parentId);
    const currentIndex = siblings.findIndex(g => g.id === goalId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= siblings.length) return;

    const currentGoal = siblings[currentIndex];
    const targetGoal = siblings[targetIndex];

    try {
      // 使用索引作为新的 sort_order（交换后的位置）
      await updateGoal(currentGoal.id, { sort_order: targetIndex });
      await updateGoal(targetGoal.id, { sort_order: currentIndex });
      refetch();
    } catch (err) {
      // 错误已在 hook 中处理
    }
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
          <h1 className="text-2xl font-bold text-gray-900">{t('goals.management')}</h1>
          <p className="text-gray-500 mt-1">{t('goals.description')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => handleOpenCreate("yearly")}>
            <Plus className="h-4 w-4 mr-2" />
            {t('goals.yearlyGoal')}
          </Button>
          <Button onClick={() => handleOpenCreate("quarterly")}>
            <Plus className="h-4 w-4 mr-2" />
            {t('goals.quarterlyGoal')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <RewardShelf year={selectedYear} goals={goals} justCompleted={justCompleted}/>
      <Card className="p-4">
        <div className="flex gap-4 items-center">
          <Select
            id="year"
            label={t('goals.year')}
            value={selectedYear.toString()}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            options={[
              { value: (currentYear - 1).toString(), label: locale === 'zh-CN' ? `${currentYear - 1}年` : `${currentYear - 1}` },
              { value: currentYear.toString(), label: locale === 'zh-CN' ? `${currentYear}年` : `${currentYear}` },
              { value: (currentYear + 1).toString(), label: locale === 'zh-CN' ? `${currentYear + 1}年` : `${currentYear + 1}` },
              { value: (currentYear + 2).toString(), label: locale === 'zh-CN' ? `${currentYear + 2}年` : `${currentYear + 2}` },
              { value: (currentYear + 3).toString(), label: locale === 'zh-CN' ? `${currentYear + 3}年` : `${currentYear + 3}` },
              { value: (currentYear + 4).toString(), label: locale === 'zh-CN' ? `${currentYear + 4}年` : `${currentYear + 4}` },
              { value: (currentYear + 5).toString(), label: locale === 'zh-CN' ? `${currentYear + 5}年` : `${currentYear + 5}` },
            ]}
            className="w-32"
          />
          <Select
            id="quarter"
            label={t('goals.quarter')}
            value={selectedQuarter?.toString() || ""}
            onChange={(e) => setSelectedQuarter(e.target.value ? parseInt(e.target.value) : null)}
            options={[
              { value: "", label: t('goals.all') },
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('goals.noGoals')}</h3>
          <p className="text-gray-500 mb-4">{t('goals.noGoalsHint')}</p>
          <Button onClick={() => handleOpenCreate("yearly")}>
            <Plus className="h-4 w-4 mr-2" />
            {t('goals.createYearlyGoal')}
          </Button>
        </Card>
      ) : selectedQuarter ? (
        /* 选择了特定季度时，只显示该季度的目标（扁平列表） */
        <div className="space-y-4">
          {quarterlyGoals.length === 0 ? (
            <Card className="text-center py-12">
              <Flag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {t('goals.noQuarterlyGoalsForQuarter', { quarter: selectedQuarter })}
              </h3>
              <Button onClick={() => handleOpenCreate("quarterly")}>
                <Plus className="h-4 w-4 mr-2" />
                {t('goals.quarterlyGoal')}
              </Button>
            </Card>
          ) : (
            quarterlyGoals.map((qGoal) => {
              const parentGoal = yearlyGoals.find(y => y.id === qGoal.parent_id);
              return (
                <Card key={qGoal.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Q{qGoal.quarter}
                        </span>
                        <span className="font-medium">{qGoal.title}</span>
                      </div>
                      {parentGoal && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('goals.parentGoal')}: {parentGoal.title}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2">
                        <ProgressBar
                          value={qGoal.progress_percentage}
                          size="sm"
                          className="w-48"
                        />
                        <span className="text-sm text-gray-500">
                          {formatDuration(qGoal.accumulated_hours * 60, locale)}
                          {qGoal.target_hours && ` / ${qGoal.target_hours}h`}
                        </span>
                      </div>
                    </div>
                    <select
                      value={qGoal.status}
                      onChange={(e) => handleStatusChange(qGoal.id, e.target.value as GoalStatus)}
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
                        onClick={() => handleMoveQuarterlyGoal(qGoal.id, qGoal.parent_id || '', 'up')}
                        disabled={quarterlyGoals.indexOf(qGoal) === 0}
                        className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('common.moveUp')}
                      >
                        <ArrowUp className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleMoveQuarterlyGoal(qGoal.id, qGoal.parent_id || '', 'down')}
                        disabled={quarterlyGoals.indexOf(qGoal) === quarterlyGoals.length - 1}
                        className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('common.moveDown')}
                      >
                        <ArrowDown className="h-4 w-4 text-gray-500" />
                      </button>
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
                </Card>
              );
            })
          )}
        </div>
      ) : (
        /* 未选择季度时，显示层级结构（年度目标 + 季度目标） */
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
                          {t('goals.yearlyGoal')}
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
                          {formatDuration(yearlyGoal.accumulated_hours * 60, locale)}
                          {yearlyGoal.target_hours && ` / ${yearlyGoal.target_hours}h`}
                        </span>
                      </div>
                    </div>
                    <select
                      value={yearlyGoal.status}
                      onChange={(e) => handleStatusChange(yearlyGoal.id, e.target.value as GoalStatus)}
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
                        onClick={() => handleMoveYearlyGoal(yearlyGoal.id, 'up')}
                        disabled={yearlyGoals.indexOf(yearlyGoal) === 0}
                        className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('common.moveUp')}
                      >
                        <ArrowUp className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleMoveYearlyGoal(yearlyGoal.id, 'down')}
                        disabled={yearlyGoals.indexOf(yearlyGoal) === yearlyGoals.length - 1}
                        className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('common.moveDown')}
                      >
                        <ArrowDown className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleOpenCreate("quarterly", yearlyGoal.id)}
                        className="p-1.5 hover:bg-gray-200 rounded-lg"
                        title={t('goals.addQuarterlyGoal')}
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
                        {t('goals.noQuarterlyGoals')}
                        <button
                          onClick={() => handleOpenCreate("quarterly", yearlyGoal.id)}
                          className="text-primary-600 hover:underline"
                        >
                          {t('goals.clickToAdd')}
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
                                  {formatDuration(qGoal.accumulated_hours * 60, locale)}
                                  {qGoal.target_hours && ` / ${qGoal.target_hours}h`}
                                </span>
                              </div>
                            </div>
                            <select
                              value={qGoal.status}
                              onChange={(e) => handleStatusChange(qGoal.id, e.target.value as GoalStatus)}
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
                                onClick={() => handleMoveQuarterlyGoal(qGoal.id, yearlyGoal.id, 'up')}
                                disabled={children.indexOf(qGoal) === 0}
                                className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                title={t('common.moveUp')}
                              >
                                <ArrowUp className="h-4 w-4 text-gray-500" />
                              </button>
                              <button
                                onClick={() => handleMoveQuarterlyGoal(qGoal.id, yearlyGoal.id, 'down')}
                                disabled={children.indexOf(qGoal) === children.length - 1}
                                className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                                title={t('common.moveDown')}
                              >
                                <ArrowDown className="h-4 w-4 text-gray-500" />
                              </button>
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
              <h3 className="font-semibold mb-4 text-gray-500">{t('goals.unlinkedQuarterlyGoals')}</h3>
              <div className="space-y-3">
                {quarterlyGoals
                  .filter((g) => !g.parent_id)
                  .map((qGoal) => (
                    <div key={qGoal.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span>{qGoal.title}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(qGoal.status)}`}>
                          {getStatusLabel(qGoal.status, locale)}
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
        title={editingGoal ? t('goals.editGoal') : (formData.goal_type === "yearly" ? t('goals.createYearlyGoal') : t('goals.createQuarterlyGoal'))}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            label={t('goals.goalTitle')}
            placeholder={t('goals.goalTitlePlaceholder')}
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('goals.goalDescription')}</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={2}
              placeholder={t('goals.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* 创建或编辑年度目标时显示愿景选择器 */}
          {(editingGoal?.goal_type === "yearly" || (!editingGoal && formData.goal_type === "yearly")) && (
            <Select
              id="vision"
              label={t('goals.relatedVision')}
              value={formData.vision_id || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, vision_id: e.target.value }))}
              options={[
                { value: "", label: t('goals.selectVision') },
                ...visions.map((v) => ({ value: v.id, label: v.title })),
              ]}
            />
          )}

          {!editingGoal && formData.goal_type === "quarterly" && (
            <>
              <Select
                id="parent"
                label={t('goals.relatedYearlyGoal')}
                value={formData.parent_id || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, parent_id: e.target.value }))}
                options={[
                  { value: "", label: t('goals.selectYearlyGoal') },
                  ...yearlyGoals.map((g) => ({ value: g.id, label: g.title })),
                ]}
                required
              />
              <Select
                id="quarter"
                label={t('goals.quarter')}
                value={formData.quarter?.toString() || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, quarter: parseInt(e.target.value) }))}
                options={[
                  { value: "1", label: t('goals.q1') },
                  { value: "2", label: t('goals.q2') },
                  { value: "3", label: t('goals.q3') },
                  { value: "4", label: t('goals.q4') },
                ]}
                required
              />
            </>
          )}

          <Input
            id="target_hours"
            type="number"
            label={t('goals.targetHours')}
            placeholder="0"
            value={formData.target_hours || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, target_hours: parseFloat(e.target.value) || 0 }))}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1">
              {editingGoal ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
