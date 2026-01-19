"use client";

import { useState, useEffect, useCallback } from "react";
import { timelogApi } from "@/lib/api";
import { TimeLog, TimeLogStart, TimeLogManual } from "@/types";
import toast from "react-hot-toast";

interface TimelogFilters {
  goal_id?: string;
  start_date?: string;
  end_date?: string;
  log_type?: string;
}

export function useTimelogs(filters?: TimelogFilters) {
  const [timelogs, setTimelogs] = useState<TimeLog[]>([]);
  const [currentSession, setCurrentSession] = useState<TimeLog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTimelogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await timelogApi.list(filters);
      setTimelogs(data);
    } catch (err: any) {
      setError(err.message);
      toast.error("加载时间记录失败");
    } finally {
      setIsLoading(false);
    }
  }, [filters?.goal_id, filters?.start_date, filters?.end_date, filters?.log_type]);

  const fetchCurrentSession = useCallback(async () => {
    try {
      const data = await timelogApi.getCurrent();
      setCurrentSession(data);
    } catch (err) {
      setCurrentSession(null);
    }
  }, []);

  const startSession = async (data: TimeLogStart) => {
    try {
      const session = await timelogApi.start(data);
      setCurrentSession(session);
      setTimelogs((prev) => [session, ...prev]);
      toast.success("开始计时");
      return session;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "开始计时失败");
      throw err;
    }
  };

  const stopSession = async (id: string, note?: string) => {
    try {
      const updated = await timelogApi.stop(id, note);
      setCurrentSession(null);
      setTimelogs((prev) => prev.map((t) => (t.id === id ? updated : t)));
      toast.success("计时已停止");
      return updated;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "停止计时失败");
      throw err;
    }
  };

  const createManual = async (data: TimeLogManual) => {
    try {
      const newLog = await timelogApi.createManual(data);
      setTimelogs((prev) => [newLog, ...prev]);
      toast.success("时间记录已添加");
      return newLog;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "添加失败");
      throw err;
    }
  };

  const deleteTimelog = async (id: string) => {
    try {
      await timelogApi.delete(id);
      setTimelogs((prev) => prev.filter((t) => t.id !== id));
      toast.success("记录已删除");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "删除失败");
      throw err;
    }
  };

  useEffect(() => {
    fetchTimelogs();
    fetchCurrentSession();
  }, [fetchTimelogs, fetchCurrentSession]);

  return {
    timelogs,
    currentSession,
    isLoading,
    error,
    refetch: fetchTimelogs,
    refetchCurrent: fetchCurrentSession,
    startSession,
    stopSession,
    createManual,
    deleteTimelog,
  };
}
