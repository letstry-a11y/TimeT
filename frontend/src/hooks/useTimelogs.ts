"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { timelogApi } from "@/lib/api";
import { TimeLog, TimeLogStart, TimeLogManual, TimeLogPlanned, TimeLogStatus } from "@/types";
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
  const request = useRef(0);
  const reading = useRef(false);
  const writeVersion = useRef(0);
  const { goal_id, start_date, end_date, log_type } = filters || {};

  const fetchTimelogs = useCallback(async (background = false) => {
    if (background && reading.current) return;
    const id = ++request.current;
    reading.current = true;
    if (!background) {
      setIsLoading(true);
      setError(null);
    }
    try {
      // A save can finish while a list request is in flight. Read again before
      // replacing the list so an older response cannot undo that change.
      while (id === request.current) {
        const version = writeVersion.current;
        const data = await timelogApi.list({ goal_id, start_date, end_date, log_type });
        if (id !== request.current) return;
        if (version !== writeVersion.current) continue;
        setTimelogs(data);
        setError(null);
        return;
      }
    } catch (err: any) {
      if (id !== request.current || background) return;
      setError(err.message);
      toast.error(t('tracker.loadFailed'));
    } finally {
      if (id === request.current) {
        reading.current = false;
        setIsLoading(false);
      }
    }
  }, [goal_id, start_date, end_date, log_type]);

  const storeTimelog = (row: TimeLog) => {
    writeVersion.current++;
    setTimelogs(previous => [row, ...previous.filter(log => log.id !== row.id)]);
  };

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
      storeTimelog(session);
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
      storeTimelog(updated);
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
      storeTimelog(newLog);
      toast.success(t('tracker.addSuccess'));
      return newLog;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.addFailed'));
      throw err;
    }
  };

  const createPlanned = async (data: TimeLogPlanned) => {
    try {
      const newLog = await timelogApi.createPlanned(data);
      storeTimelog(newLog);
      toast.success(t('tracker.planSuccess'));
      return newLog;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.planFailed'));
      throw err;
    }
  };

  const updateStatus = async (id: string, status: TimeLogStatus) => {
    try {
      const updated = await timelogApi.updateStatus(id, status);
      storeTimelog(updated);
      toast.success(t('tracker.statusUpdateSuccess'));
      return updated;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.statusUpdateFailed'));
      throw err;
    }
  };

  const updateTimelog = async (id: string, data: Partial<TimeLog>) => {
    try {
      const updated = await timelogApi.update(id, data);
      storeTimelog(updated);
      toast.success(t('tracker.updateSuccess'));
      return updated;
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.updateFailed'));
      throw err;
    }
  };

  const deleteTimelog = async (id: string) => {
    try {
      await timelogApi.delete(id);
      writeVersion.current++;
      setTimelogs((prev) => prev.filter((log) => log.id !== id));
      toast.success(t('tracker.deleteSuccess'));
    } catch (err: any) {
      toast.error(err.response?.data?.detail || t('tracker.deleteFailed'));
      throw err;
    }
  };

  useEffect(() => {
    void fetchTimelogs();
    void fetchCurrentSession();
    const refreshVisible = () => {
      if (document.visibilityState === 'visible') void fetchTimelogs(true);
    };
    window.addEventListener('focus', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = window.setInterval(refreshVisible, 10000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      request.current += 1;
      reading.current = false;
    };
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
    createPlanned,
    updateStatus,
    updateTimelog,
    deleteTimelog,
  };
}
