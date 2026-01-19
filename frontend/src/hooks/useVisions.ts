"use client";

import { useState, useEffect, useCallback } from "react";
import { visionApi } from "@/lib/api";
import { Vision, VisionCreate } from "@/types";
import toast from "react-hot-toast";

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
      toast.error("加载愿景失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createVision = async (data: VisionCreate) => {
    try {
      const newVision = await visionApi.create(data);
      setVisions((prev) => [...prev, newVision]);
      toast.success("愿景创建成功");
      return newVision;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "创建失败");
      throw err;
    }
  };

  const updateVision = async (id: string, data: Partial<Vision>) => {
    try {
      const updated = await visionApi.update(id, data);
      setVisions((prev) => prev.map((v) => (v.id === id ? updated : v)));
      toast.success("愿景更新成功");
      return updated;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "更新失败");
      throw err;
    }
  };

  const deleteVision = async (id: string) => {
    try {
      await visionApi.delete(id);
      setVisions((prev) => prev.filter((v) => v.id !== id));
      toast.success("愿景已删除");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "删除失败");
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
