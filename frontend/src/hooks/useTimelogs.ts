"use client";

import { useState, useEffect, useCallback } from "react";
import { timelogApi } from "@/lib/api";
import { TimeLog, TimeLogStart, TimeLogManual } from "@/types";
import { getTranslation, useLanguageStore } from "@/i18n";
import toast from "react-hot-toast";

const t = (key: string) => getTranslation(useLanguageStore.getState().locale, key);

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
      toast.error(t('tracker.loadFailed'));
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
      toast.success(t('tracker.startSuccess'));
      return session;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.startFailed'));
      throw err;
    }
  };

  const stopSession = async (id: string, note?: string) => {
    try {
      const updated = await timelogApi.stop(id, note);
      setCurrentSession(null);
      setTimelogs((prev) => prev.map((log) => (log.id === id ? updated : log)));
      toast.success(t('tracker.stopSuccess'));
      return updated;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.stopFailed'));
      throw err;
    }
  };

  const createManual = async (data: TimeLogManual) => {
    try {
      const newLog = await timelogApi.createManual(data);
      setTimelogs((prev) => [newLog, ...prev]);
      toast.success(t('tracker.addSuccess'));
      return newLog;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.addFailed'));
      throw err;
    }
  };

  const deleteTimelog = async (id: string) => {
    try {
      await timelogApi.delete(id);
      setTimelogs((prev) => prev.filter((log) => log.id !== id));
      toast.success(t('tracker.deleteSuccess'));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.deleteFailed'));
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
