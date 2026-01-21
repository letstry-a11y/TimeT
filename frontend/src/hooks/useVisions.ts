"use client";

import { useState, useEffect, useCallback } from "react";
import { visionApi } from "@/lib/api";
import { Vision, VisionCreate } from "@/types";
import { getTranslation, useLanguageStore } from "@/i18n";
import toast from "react-hot-toast";

const t = (key: string) => getTranslation(useLanguageStore.getState().locale, key);

export function useVisions() {
  const [visions, setVisions] = useState<Vision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await visionApi.list();
      setVisions(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(t('visions.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createVision = async (data: VisionCreate) => {
    try {
      const newVision = await visionApi.create(data);
      setVisions((prev) => [...prev, newVision]);
      toast.success(t('visions.createSuccess'));
      return newVision;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('visions.createFailed'));
      throw err;
    }
  };

  const updateVision = async (id: string, data: Partial<Vision>) => {
    try {
      const updated = await visionApi.update(id, data);
      setVisions((prev) => prev.map((v) => (v.id === id ? updated : v)));
      toast.success(t('visions.updateSuccess'));
      return updated;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('visions.updateFailed'));
      throw err;
    }
  };

  const deleteVision = async (id: string) => {
    try {
      await visionApi.delete(id);
      setVisions((prev) => prev.filter((v) => v.id !== id));
      toast.success(t('visions.deleteSuccess'));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('visions.deleteFailed'));
      throw err;
    }
  };

  useEffect(() => {
    fetchVisions();
  }, [fetchVisions]);

  return {
    visions,
    isLoading,
    error,
    refetch: fetchVisions,
    createVision,
    updateVision,
    deleteVision,
  };
}
