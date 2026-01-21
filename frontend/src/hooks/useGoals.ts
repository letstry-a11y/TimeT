"use client";

import { useState, useEffect, useCallback } from "react";
import { goalApi } from "@/lib/api";
import { Goal, GoalCreate } from "@/types";
import { getTranslation, useLanguageStore } from "@/i18n";
import toast from "react-hot-toast";

const t = (key: string) => getTranslation(useLanguageStore.getState().locale, key);

interface GoalFilters {
  vision_id?: string;
  goal_type?: string;
  year?: number;
  quarter?: number;
  parent_id?: string;
}

export function useGoals(filters?: GoalFilters) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await goalApi.list(filters);
      setGoals(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(t('goals.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [filters?.vision_id, filters?.goal_type, filters?.year, filters?.quarter, filters?.parent_id]);

  const createGoal = async (data: GoalCreate) => {
    try {
      const newGoal = await goalApi.create(data);
      setGoals((prev) => [...prev, newGoal]);
      toast.success(t('goals.createSuccess'));
      return newGoal;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('goals.createFailed'));
      throw err;
    }
  };

  const updateGoal = async (id: string, data: Partial<Goal>) => {
    try {
      const updated = await goalApi.update(id, data);
      setGoals((prev) => prev.map((g) => (g.id === id ? updated : g)));
      toast.success(t('goals.updateSuccess'));
      return updated;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('goals.updateFailed'));
      throw err;
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await goalApi.delete(id);
      setGoals((prev) => prev.filter((g) => g.id !== id));
      toast.success(t('goals.deleteSuccess'));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('goals.deleteFailed'));
      throw err;
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  return {
    goals,
    isLoading,
    error,
    refetch: fetchGoals,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
