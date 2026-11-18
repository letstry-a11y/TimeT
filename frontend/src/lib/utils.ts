import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 北京时间固定按 UTC+8 处理，不依赖浏览器本地时区
const BJ_OFFSET_MS = 8 * 60 * 60 * 1000;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 将 UTC 毫秒数转换为"北京时间 Date 对象"。
 * 返回的 Date 对象，其 UTC getters (getUTCFullYear/getUTCMonth/...)
 * 返回北京时间对应的年/月/日/时/分，且不受浏览器本地时区影响。
 */
export function utcToBeijingDate(utcMs: number): Date {
  return new Date(utcMs + BJ_OFFSET_MS);
}

/** 获取当前北京时间对应的 Date 对象（UTC getters 返回北京时间） */
export function getBeijingNow(): Date {
  return utcToBeijingDate(Date.now());
}

/** 从后端 ISO 字符串解析出原始 UTC 毫秒数 */
export function parseUtcMs(dateString: string | undefined): number {
  if (!dateString) return Date.now();
  const withZ = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateString) ? dateString : dateString + 'Z';
  return new Date(withZ).getTime();
}

/**
 * 解析后端返回的 UTC ISO 字符串，返回"北京时间 Date 对象"。
 * 所有日期/时间展示都应基于该对象使用 UTC getters 或 timeZone: 'UTC'。
 */
export function parseUtcDateString(dateString: string | undefined): Date {
  return utcToBeijingDate(parseUtcMs(dateString));
}

export function getCurrentYear(): number {
  return getBeijingNow().getUTCFullYear();
}

export function getCurrentQuarter(): number {
  const month = getBeijingNow().getUTCMonth();
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
  if (!date) date = getBeijingNow();
  const dates: Date[] = [];
  const day = date.getUTCDay();
  const monday = new Date(date.getTime());
  monday.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1));
  monday.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime());
    d.setUTCDate(monday.getUTCDate() + i);
    d.setUTCHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

export function formatWeekRange(dates: Date[] | undefined, locale: string = 'en-US'): string {
  if (!dates || dates.length === 0) return '';
  const start = dates[0];
  const end = dates[dates.length - 1];

  if (locale === 'zh-CN') {
    return `${start.getUTCMonth() + 1}月${start.getUTCDate()}日 - ${end.getUTCMonth() + 1}月${end.getUTCDate()}日`;
  }

  return `${start.toLocaleDateString(locale, { timeZone: 'UTC', month: 'short', day: 'numeric' })} - ${end.toLocaleDateString(locale, { timeZone: 'UTC', month: 'short', day: 'numeric' })}`;
}

export function formatDayHeader(date: Date | undefined, locale: string = 'en-US'): string {
  if (!date) return '';
  const today = getBeijingNow();
  const isToday = isSameDay(date, today);

  const weekday = date.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
  const dayNum = date.getUTCDate();

  if (locale === 'zh-CN') {
    return isToday ? `今天 ${dayNum}日` : `${weekday} ${dayNum}日`;
  }

  return isToday ? `Today ${dayNum}` : `${weekday} ${dayNum}`;
}

export function isSameDay(date1: Date | undefined, date2: Date | undefined): boolean {
  if (!date1 || !date2) return false;
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

export function toDateString(date: Date | undefined): string {
  if (!date) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimeOnly(dateString: string | undefined, locale: string = 'en-US'): string {
  if (!dateString) return '';
  const date = parseUtcDateString(dateString);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatHoursDecimal(minutes: number | undefined): string {
  if (!minutes || minutes <= 0) {
    return '0.0h';
  }
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
}
