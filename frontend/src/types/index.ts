// User types
export interface User {
  id: string;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

// Auth types
export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginRequest {
  username: string; // email
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

// Vision types
export interface Vision {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  target_year?: number;
  color?: string;
  icon?: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface VisionCreate {
  title: string;
  description?: string;
  target_year?: number;
  color?: string;
  icon?: string;
  sort_order?: number;
}

// Goal types
export type GoalType = "yearly" | "quarterly";
export type GoalStatus = "not_started" | "in_progress" | "completed" | "paused" | "cancelled";

export interface Goal {
  id: string;
  user_id: string;
  vision_id?: string;
  parent_id?: string;
  title: string;
  description?: string;
  goal_type: GoalType;
  status: GoalStatus;
  year: number;
  quarter?: number;
  start_date?: string;
  end_date?: string;
  target_hours?: number;
  accumulated_hours: number;
  progress_percentage: number;
  color?: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  children?: Goal[];
}

export interface GoalCreate {
  title: string;
  description?: string;
  goal_type: GoalType;
  status?: GoalStatus;
  year: number;
  quarter?: number;
  start_date?: string;
  end_date?: string;
  target_hours?: number;
  color?: string;
  sort_order?: number;
  vision_id?: string;
  parent_id?: string;
}

// TimeLog types
export type TimeLogType = "clock_in" | "manual" | "planned";
export type TimeLogStatus = "pending" | "completed" | "not_completed";

export interface TimeLog {
  id: string;
  user_id: string;
  goal_id: string;
  task_id?: string;
  log_type: TimeLogType;
  status?: TimeLogStatus;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  note?: string;
  tags?: string;
  is_running: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeLogStart {
  goal_id: string;
  task_id?: string;
  note?: string;
  tags?: string;
}

export interface TimeLogManual {
  goal_id: string;
  task_id?: string;
  start_time: string;
  end_time: string;
  note?: string;
  tags?: string;
}

export interface TimeLogPlanned {
  goal_id: string;
  task_id?: string;
  start_time: string;
  end_time: string;
  note?: string;
  tags?: string;
}

export interface TimeLogStatusUpdate {
  status: TimeLogStatus;
}

export interface TimeLogStats {
  total_minutes: number;
  total_hours: number;
  log_count: number;
  by_goal?: Record<string, number>[];
  by_date?: Record<string, number>[];
}

// Report types
export interface VisionAlignmentItem {
  vision_id: string;
  vision_title: string;
  hours: number;
  percentage: number;
}

export interface VisionAlignmentReport {
  report_type: string;
  generated_at: string;
  total_hours: number;
  data: VisionAlignmentItem[];
}

export interface GoalProgressItem {
  goal_id: string;
  title: string;
  goal_type: string;
  status: string;
  target_hours?: number;
  accumulated_hours: number;
  progress_percentage: number;
  quarter?: number;
}

export interface GoalProgressReport {
  report_type: string;
  generated_at: string;
  year: number;
  quarter?: number;
  data: GoalProgressItem[];
}

export interface DailyStats {
  date: string;
  hours: number;
  log_count: number;
}

export interface WeeklyReport {
  start_date: string;
  end_date: string;
  total_hours: number;
  daily_breakdown: DailyStats[];
  top_goals: { goal_id: string; title: string; hours: number }[];
}
