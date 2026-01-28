import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getCurrentQuarter(): number {
  const month = new Date().getMonth();
  return Math.floor(month / 3) + 1;
}

export function formatDuration(minutes: number | undefined, locale: string = 'en-US'): string {
  if (!minutes || minutes <= 0) {
    return locale === 'zh-CN' ? '0分钟' : '0m';
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (locale === 'zh-CN') {
    if (hours > 0 && mins > 0) {
      return `${hours}小时${mins}分钟`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else {
      return `${mins}分钟`;
    }
  } else {
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }
}

export function getStatusLabel(status: string, locale: string = 'en-US'): string {
  const labels: Record<string, Record<string, string>> = {
    'zh-CN': {
      not_started: '未开始',
      in_progress: '进行中',
      completed: '已完成',
      paused: '已暂停',
      cancelled: '已取消',
      pending: '待完成',
      not_completed: '未完成',
    },
    'en-US': {
      not_started: 'Not Started',
      in_progress: 'In Progress',
      completed: 'Completed',
      paused: 'Paused',
      cancelled: 'Cancelled',
      pending: 'Pending',
      not_completed: 'Not Completed',
    },
  };

  return labels[locale]?.[status] || labels['en-US']?.[status] || status;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    cancelled: 'bg-red-100 text-red-700',
    pending: 'bg-orange-100 text-orange-700',
    not_completed: 'bg-red-100 text-red-700',
  };

  return colors[status] || 'bg-gray-100 text-gray-700';
}

export function getWeekDates(date: Date | undefined): Date[] {
  if (!date) date = new Date();
  const dates: Date[] = [];
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function formatWeekRange(dates: Date[] | undefined, locale: string = 'en-US'): string {
  if (!dates || dates.length === 0) return '';
  const start = dates[0];
  const end = dates[dates.length - 1];

  if (locale === 'zh-CN') {
    return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
  }

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(locale, options)} - ${end.toLocaleDateString(locale, options)}`;
}

export function formatDayHeader(date: Date | undefined, locale: string = 'en-US'): string {
  if (!date) return '';
  const today = new Date();
  const isToday = isSameDay(date, today);

  const weekday = date.toLocaleDateString(locale, { weekday: 'short' });
  const dayNum = date.getDate();

  if (locale === 'zh-CN') {
    return isToday ? `今天 ${dayNum}日` : `${weekday} ${dayNum}日`;
  }

  return isToday ? `Today ${dayNum}` : `${weekday} ${dayNum}`;
}

export function isSameDay(date1: Date | undefined, date2: Date | undefined): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function toDateString(date: Date | undefined): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeOnly(dateString: string | undefined, locale: string = 'en-US'): string {
  if (!dateString) return '';
  const date = parseUtcDateString(dateString);
  return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function parseUtcDateString(dateString: string | undefined): Date {
  if (!dateString) return new Date();
  // Backend stores UTC time, but may not include "Z" suffix
  // Ensure proper UTC parsing
  if (!dateString.endsWith('Z') && !dateString.includes('+') && !dateString.includes('-', 10)) {
    return new Date(dateString + 'Z');
  }
  return new Date(dateString);
}

export function formatHoursDecimal(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) {
    return '0.0h';
  }
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}
