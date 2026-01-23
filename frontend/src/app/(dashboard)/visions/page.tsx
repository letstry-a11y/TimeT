"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useVisions } from "@/hooks/useVisions";
import { useTranslation } from "@/i18n";
import { goalApi } from "@/lib/api";
import { Vision, Goal } from "@/types";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
import { Plus, Edit2, Trash2, Target, ChevronDown, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

export default function VisionsPage() {
  const { visions, isLoading, createVision, updateVision, deleteVision, refetch } = useVisions();
  const { t, locale } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVision, setEditingVision] = useState<Vision | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target_year: new Date().getFullYear() + 5,
    color: COLORS[0],
  });

  // 展开/收起状态和目标数据
  const [expandedVisions, setExpandedVisions] = useState<Set<string>>(new Set());
  const [visionGoals, setVisionGoals] = useState<Record<string, Goal[]>>({});
  const [loadingGoals, setLoadingGoals] = useState<Set<string>>(new Set());

  // 加载愿景关联的目标
  const loadVisionGoals = async (visionId: string) => {
    setLoadingGoals(prev => new Set(prev).add(visionId));
    try {
      // 1. 获取直接关联到愿景的年度目标
      const yearlyGoals = await goalApi.list({ vision_id: visionId });

      // 2. 获取这些年度目标下的季度目标
      const quarterlyGoalsPromises = yearlyGoals.map(yearly =>
        goalApi.list({ parent_id: yearly.id })
      );
      const quarterlyGoalsArrays = await Promise.all(quarterlyGoalsPromises);
      const quarterlyGoals = quarterlyGoalsArrays.flat();

      // 3. 合并年度目标和季度目标
      const allGoals = [...yearlyGoals, ...quarterlyGoals];
      setVisionGoals(prev => ({ ...prev, [visionId]: allGoals }));
    } catch (err) {
      console.error("Failed to load vision goals:", err);
    } finally {
      setLoadingGoals(prev => {
        const next = new Set(prev);
        next.delete(visionId);
        return next;
      });
    }
  };

  // 切换展开/收起
  const toggleExpand = async (visionId: string) => {
    const newExpanded = new Set(expandedVisions);
    if (newExpanded.has(visionId)) {
      newExpanded.delete(visionId);
    } else {
      newExpanded.add(visionId);
      if (!visionGoals[visionId]) {
        await loadVisionGoals(visionId);
      }
    }
    setExpandedVisions(newExpanded);
  };

  // 获取目标统计
  const getGoalStats = (goals: Goal[] | undefined) => {
    if (!goals) return { yearly: 0, quarterly: 0, completed: 0, inProgress: 0 };
    const yearly = goals.filter(g => g.goal_type === 'yearly').length;
    const quarterly = goals.filter(g => g.goal_type === 'quarterly').length;
    const completed = goals.filter(g => g.status === 'completed').length;
    const inProgress = goals.filter(g => g.status === 'in_progress').length;
    return { yearly, quarterly, completed, inProgress };
  };

  const handleOpenCreate = () => {
    setEditingVision(null);
    setFormData({
      title: "",
      description: "",
      target_year: new Date().getFullYear() + 5,
      color: COLORS[0],
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vision: Vision) => {
    setEditingVision(vision);
    setFormData({
      title: vision.title,
      description: vision.description || "",
      target_year: vision.target_year || new Date().getFullYear() + 5,
      color: vision.color || COLORS[0],
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingVision) {
        await updateVision(editingVision.id, formData);
      } else {
        // 新建时设置 sort_order 为最大值 + 1，确保新项目在列表末尾
        const maxSortOrder = visions.length > 0
          ? Math.max(...visions.map(v => v.sort_order))
          : -1;
        await createVision({ ...formData, sort_order: maxSortOrder + 1 });
      }
      setIsModalOpen(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('visions.deleteConfirm'))) {
      await deleteVision(id);
    }
  };

  const handleMoveVision = async (visionId: string, direction: 'up' | 'down') => {
    const currentIndex = visions.findIndex(v => v.id === visionId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= visions.length) return;

    const currentVision = visions[currentIndex];
    const targetVision = visions[targetIndex];

    try {
      // 使用索引作为新的 sort_order（交换后的位置）
      await updateVision(currentVision.id, { sort_order: targetIndex });
      await updateVision(targetVision.id, { sort_order: currentIndex });
      // 重新获取列表以确保顺序正确
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
          <h1 className="text-2xl font-bold text-gray-900">{t('visions.title')}</h1>
          <p className="text-gray-500 mt-1">{t('visions.description')}</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('visions.createVision')}
        </Button>
      </div>

      {/* Visions Grid */}
      {visions.length === 0 ? (
        <Card className="text-center py-12">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t('visions.noVisions')}</h3>
          <p className="text-gray-500 mb-4">{t('visions.noVisionsHint')}</p>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('visions.createVision')}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visions.map((vision) => {
            const isExpanded = expandedVisions.has(vision.id);
            const goals = visionGoals[vision.id];
            const stats = getGoalStats(goals);
            const isLoadingVisionGoals = loadingGoals.has(vision.id);
            const yearlyGoals = goals?.filter(g => g.goal_type === 'yearly') || [];

            return (
              <Card key={vision.id} className="relative group">
                <div
                  className="absolute top-0 left-0 w-full h-1 rounded-t-xl"
                  style={{ backgroundColor: vision.color || COLORS[0] }}
                />
                <div className="pt-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: vision.color || COLORS[0] }}
                      />
                      <h3 className="font-semibold text-lg">{vision.title}</h3>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleMoveVision(vision.id, 'up')}
                        disabled={visions.indexOf(vision) === 0}
                        className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('common.moveUp')}
                      >
                        <ArrowUp className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleMoveVision(vision.id, 'down')}
                        disabled={visions.indexOf(vision) === visions.length - 1}
                        className="p-1.5 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title={t('common.moveDown')}
                      >
                        <ArrowDown className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(vision)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                      >
                        <Edit2 className="h-4 w-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => handleDelete(vision.id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                  {vision.description && (
                    <p className="text-gray-500 mt-2 text-sm line-clamp-2">
                      {vision.description}
                    </p>
                  )}
                  {vision.target_year && (
                    <p className="text-xs text-gray-400 mt-3">
                      {t('visions.targetYear')}: {vision.target_year}
                    </p>
                  )}

                  {/* 目标统计和展开按钮 */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    {goals && (
                      <div className="flex gap-4 text-xs text-gray-500 mb-2">
                        <span>{t('visions.yearlyGoalsCount')}: {stats.yearly}</span>
                        <span>{t('visions.quarterlyGoalsCount')}: {stats.quarterly}</span>
                      </div>
                    )}
                    <button
                      onClick={() => toggleExpand(vision.id)}
                      className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          {t('visions.collapseGoals')}
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-4 w-4" />
                          {t('visions.expandGoals')}
                        </>
                      )}
                    </button>
                  </div>

                  {/* 展开的目标列表 */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {isLoadingVisionGoals ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary-600"></div>
                        </div>
                      ) : yearlyGoals.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-2">
                          {t('visions.noAssociatedGoals')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {yearlyGoals.map(yearly => {
                            const children = goals?.filter(g => g.parent_id === yearly.id) || [];
                            return (
                              <div key={yearly.id} className="text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium flex-1 truncate">{yearly.title}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusColor(yearly.status)}`}>
                                    {getStatusLabel(yearly.status, locale)}
                                  </span>
                                </div>
                                <div className="mt-1">
                                  <ProgressBar value={yearly.progress_percentage} size="sm" />
                                </div>
                                {children.length > 0 && (
                                  <div className="ml-3 mt-2 space-y-1.5 border-l-2 border-gray-100 pl-3">
                                    {children.map(child => (
                                      <div key={child.id} className="flex items-center gap-2 text-xs text-gray-600">
                                        <span className="truncate flex-1">Q{child.quarter}: {child.title}</span>
                                        <span className={`px-1.5 py-0.5 rounded ${getStatusColor(child.status)}`}>
                                          {getStatusLabel(child.status, locale)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVision ? t('visions.editVision') : t('visions.createVision')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            label={t('visions.visionTitle')}
            placeholder={t('visions.visionTitlePlaceholder')}
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('visions.visionDescription')}
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={3}
              placeholder={t('visions.descriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <Input
            id="target_year"
            type="number"
            label={t('visions.targetYear')}
            value={formData.target_year}
            onChange={(e) => setFormData((prev) => ({ ...prev, target_year: parseInt(e.target.value) }))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('visions.color')}
            </label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-transform ${
                    formData.color === color ? "ring-2 ring-offset-2 ring-primary-500 scale-110" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setFormData((prev) => ({ ...prev, color }))}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1">
              {editingVision ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
