"use client";

import { useState, useEffect } from "react";
import { Play, Square, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/i18n";
import { cn, parseUtcMs } from "@/lib/utils";

interface TimerProps {
  isRunning: boolean;
  startTime?: string;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

// 格式化时间的辅助函数
export function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// 计算已过时间的 hook
export function useElapsedTime(isRunning: boolean, startTime?: string): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && startTime) {
      const updateElapsed = () => {
        const start = parseUtcMs(startTime);
        const now = Date.now();
        setElapsed(Math.floor((now - start) / 1000));
      };

      updateElapsed();
      interval = setInterval(updateElapsed, 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, startTime]);

  return elapsed;
}

// 紧凑型计时器显示组件
interface CompactTimerDisplayProps {
  elapsed: number;
  isRunning: boolean;
}

export function CompactTimerDisplay({ elapsed, isRunning }: CompactTimerDisplayProps) {
  return (
    <span className={cn(
      "text-2xl font-mono font-bold tabular-nums",
      isRunning ? "text-green-700" : "text-gray-900"
    )}>
      {formatElapsed(elapsed)}
    </span>
  );
}

// 状态指示器组件
interface StatusIndicatorProps {
  isRunning: boolean;
}

export function StatusIndicator({ isRunning }: StatusIndicatorProps) {
  return (
    <div className={cn(
      "p-2 rounded-full shrink-0",
      isRunning ? "bg-green-500" : "bg-gray-100"
    )}>
      {isRunning ? (
        <Play className="h-4 w-4 text-white" />
      ) : (
        <Clock className="h-4 w-4 text-gray-500" />
      )}
    </div>
  );
}

// 原有的大型计时器组件（保留向后兼容）
export function Timer({ isRunning, startTime, onStart, onStop, disabled }: TimerProps) {
  const elapsed = useElapsedTime(isRunning, startTime);
  const { t } = useTranslation();

  return (
    <div className="text-center">
      <div className="text-6xl font-mono font-bold text-gray-900 mb-6">
        {formatElapsed(elapsed)}
      </div>
      {isRunning ? (
        <Button
          size="lg"
          variant="danger"
          onClick={onStop}
          className="w-40 h-14 text-lg"
        >
          <Square className="h-6 w-6 mr-2" />
          {t('timer.stop')}
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={onStart}
          disabled={disabled}
          className="w-40 h-14 text-lg"
        >
          <Play className="h-6 w-6 mr-2" />
          {t('timer.start')}
        </Button>
      )}
    </div>
  );
}
