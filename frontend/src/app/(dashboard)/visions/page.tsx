"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useVisions } from "@/hooks/useVisions";
import { Vision } from "@/types";
import { Plus, Edit2, Trash2, Target } from "lucide-react";

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

export default function VisionsPage() {
  const { visions, isLoading, createVision, updateVision, deleteVision } = useVisions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVision, setEditingVision] = useState<Vision | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    target_year: new Date().getFullYear() + 5,
    color: COLORS[0],
  });

  const t = useTranslations("visions");
  const tCommon = useTranslations("common");

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
        await createVision(formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t("deleteConfirm"))) {
      await deleteVision(id);
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
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("createVision")}
        </Button>
      </div>

      {/* Visions Grid */}
      {visions.length === 0 ? (
        <Card className="text-center py-12">
          <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{t("noVisions")}</h3>
          <p className="text-gray-500 mb-4">{t("noVisionsHint")}</p>
          <Button onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("createVision")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visions.map((vision) => (
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
                    {t("targetYearLabel", { year: vision.target_year })}
                  </p>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVision ? t("editVision") : t("createVision")}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="title"
            label={t("visionTitle")}
            placeholder={t("visionTitlePlaceholder")}
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("visionDescription")}
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              rows={3}
              placeholder={t("visionDescriptionPlaceholder")}
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <Input
            id="target_year"
            type="number"
            label={t("targetYear")}
            value={formData.target_year}
            onChange={(e) => setFormData((prev) => ({ ...prev, target_year: parseInt(e.target.value) }))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("color")}
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
              {tCommon("cancel")}
            </Button>
            <Button type="submit" className="flex-1">
              {editingVision ? tCommon("save") : tCommon("create")}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
