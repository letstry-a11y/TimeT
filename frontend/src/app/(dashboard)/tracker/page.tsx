"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Timer } from "@/components/Timer";
import { useGoals } from "@/hooks/useGoals";
import { useTimelogs } from "@/hooks/useTimelogs";
import { useTranslation } from "@/i18n";
import { getCurrentYear, formatDateTime, formatDuration } from "@/lib/utils";
import { Clock, Plus, Trash2 } from "lucide-react";

export default function TrackerPage() {
  const { goals } = useGoals({ year: getCurrentYear(), goal_type: "quarterly" });
  const {
    timelogs,
    currentSession,
    isLoading,
    startSession,
    stopSession,
    createManual,
    deleteTimelog,
    refetch,
  } = useTimelogs();
  const { t, locale } = useTranslation();

  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [note, setNote] = useState("");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualData, setManualData] = useState({
    goal_id: "",
    start_time: "",
    end_time: "",
    note: "",
  });

  useEffect(() => {
    if (goals.length > 0 && !selectedGoalId) {
      setSelectedGoalId(goals[0].id);
    }
    if (goals.length > 0 && !manualData.goal_id) {
      setManualData((prev) => ({ ...prev, goal_id: goals[0].id }));
    }
  }, [goals, selectedGoalId, manualData.goal_id]);

  const handleStart = async () => {
    if (!selectedGoalId) return;
    await startSession({ goal_id: selectedGoalId, note: note || undefined });
    setNote("");
  };

  const handleStop = async () => {
    if (!currentSession) return;
    await stopSession(currentSession.id, note || undefined);
    setNote("");
    refetch();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.goal_id || !manualData.start_time || !manualData.end_time) return;

    await createManual({
      goal_id: manualData.goal_id,
      start_time: new Date(manualData.start_time).toISOString(),
      end_time: new Date(manualData.end_time).toISOString(),
      note: manualData.note || undefined,
    });

    setIsManualModalOpen(false);
    setManualData({
      goal_id: goals[0]?.id || "",
      start_time: "",
      end_time: "",
      note: "",
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t('tracker.deleteConfirm'))) {
      await deleteTimelog(id);
    }
  };

  const currentGoal = goals.find((g) => g.id === (currentSession?.goal_id || selectedGoalId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('tracker.title')}</h1>
          <p className="text-gray-500 mt-1">{t('tracker.description')}</p>
        </div>
        <Button variant="secondary" onClick={() => setIsManualModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('tracker.manualEntry')}
        </Button>
      </div>

      {/* Timer Section */}
      <Card className="py-8">
        <div className="max-w-md mx-auto">
          {!currentSession && (
            <div className="mb-8">
              <Select
                id="goal"
                label={t('tracker.selectGoal')}
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                options={[
                  { value: "", label: t('tracker.selectQuarterlyGoal') },
                  ...goals.map((g) => ({
                    value: g.id,
                    label: `Q${g.quarter}: ${g.title}`,
                  })),
                ]}
              />
            </div>
          )}

          {currentSession && currentGoal && (
            <div className="text-center mb-6">
              <p className="text-sm text-gray-500">{t('dashboard.inProgress')}</p>
              <p className="text-lg font-semibold text-primary-600">
                Q{currentGoal.quarter}: {currentGoal.title}
              </p>
            </div>
          )}

          <Timer
            isRunning={!!currentSession}
            startTime={currentSession?.start_time}
            onStart={handleStart}
            onStop={handleStop}
            disabled={!selectedGoalId || goals.length === 0}
          />

          <div className="mt-8">
            <Input
              id="note"
              label={t('tracker.note')}
              placeholder={t('tracker.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Recent Logs */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('tracker.recentRecords')}</h2>
          <span className="text-sm text-gray-500">
            {t('tracker.totalRecords', { count: timelogs.length })}
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : timelogs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('tracker.noRecords')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {timelogs.slice(0, 10).map((log) => {
              const goal = goals.find((g) => g.id === log.goal_id);
              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg border ${
                    log.is_running ? "border-green-200 bg-green-50" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {log.is_running && (
                          <span className="flex h-2 w-2">
                            <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                        )}
                        <span className="font-medium">
                          {goal ? `Q${goal.quarter}: ${goal.title}` : t('tracker.unknownGoal')}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          log.log_type === "clock_in" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                        }`}>
                          {log.log_type === "clock_in" ? t('tracker.clockIn') : t('tracker.manual')}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {formatDateTime(log.start_time, locale)}
                        {log.end_time && ` - ${formatDateTime(log.end_time, locale)}`}
                      </div>
                      {log.note && (
                        <p className="text-sm text-gray-600 mt-1">{log.note}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {log.duration_minutes && (
                        <span className="text-lg font-semibold text-primary-600">
                          {formatDuration(log.duration_minutes, locale)}
                        </span>
                      )}
                      {!log.is_running && (
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Manual Entry Modal */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title={t('tracker.manualEntry')}
      >
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <Select
            id="manual-goal"
            label={t('tracker.selectGoal')}
            value={manualData.goal_id}
            onChange={(e) => setManualData((prev) => ({ ...prev, goal_id: e.target.value }))}
            options={[
              { value: "", label: t('tracker.selectQuarterlyGoal') },
              ...goals.map((g) => ({
                value: g.id,
                label: `Q${g.quarter}: ${g.title}`,
              })),
            ]}
            required
          />

          <Input
            id="start-time"
            type="datetime-local"
            label={t('tracker.startTime')}
            value={manualData.start_time}
            onChange={(e) => setManualData((prev) => ({ ...prev, start_time: e.target.value }))}
            required
          />

          <Input
            id="end-time"
            type="datetime-local"
            label={t('tracker.endTime')}
            value={manualData.end_time}
            onChange={(e) => setManualData((prev) => ({ ...prev, end_time: e.target.value }))}
            required
          />

          <Input
            id="manual-note"
            label={t('tracker.note')}
            placeholder={t('tracker.notePlaceholder')}
            value={manualData.note}
            onChange={(e) => setManualData((prev) => ({ ...prev, note: e.target.value }))}
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setIsManualModalOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
