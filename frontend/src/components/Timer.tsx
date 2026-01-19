"use client";

import { useState, useEffect } from "react";
import { Play, Square, Pause } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatTime } from "@/lib/utils";

interface TimerProps {
  isRunning: boolean;
  startTime?: string;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function Timer({ isRunning, startTime, onStart, onStop, disabled }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && startTime) {
      const updateElapsed = () => {
        const start = new Date(startTime).getTime();
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

  const formatElapsed = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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
          停止
        </Button>
      ) : (
        <Button
          size="lg"
          onClick={onStart}
          disabled={disabled}
          className="w-40 h-14 text-lg"
        >
          <Play className="h-6 w-6 mr-2" />
          开始
        </Button>
      )}
    </div>
  );
}
