import axios from "axios";
import toast from "react-hot-toast";
import { useAuthStore } from "@/store/auth";
import {
  User,
  Token,
  Vision,
  VisionCreate,
  Goal,
  GoalCreate,
  TimeLog,
  TimeLogStart,
  TimeLogManual,
  TimeLogPlanned,
  TimeLogStatus,
  WeeklyReport,
  VisionAlignmentReport,
  GoalProgressReport,
  PeriodReport,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    if (Array.isArray(response.data?.warnings)) {
      response.data.warnings.forEach((warning: string) => toast(warning, { duration: 8000, icon: "⚠️" }));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token } = response.data;
          useAuthStore.getState().setTokens(access_token, refresh_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          window.location.href = "/login";
          return Promise.reject(refreshError);
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  async login(email: string, password: string): Promise<Token> {
    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    const response = await api.post("/api/v1/auth/login", formData, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data;
  },

  async register(email: string, username: string, password: string): Promise<User> {
    const response = await api.post("/api/v1/auth/register", {
      email,
      username,
      password,
    });
    return response.data;
  },

  async getMe(): Promise<User> {
    const response = await api.get("/api/v1/users/me");
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<Token> {
    const response = await api.post("/api/v1/auth/refresh", {
      refresh_token: refreshToken,
    });
    return response.data;
  },
};

// Vision API
export const visionApi = {
  async list(): Promise<Vision[]> {
    const response = await api.get("/api/v1/visions");
    return response.data;
  },

  async get(id: string): Promise<Vision> {
    const response = await api.get(`/api/v1/visions/${id}`);
    return response.data;
  },

  async create(data: VisionCreate): Promise<Vision> {
    const response = await api.post("/api/v1/visions", data);
    return response.data;
  },

  async update(id: string, data: Partial<Vision>): Promise<Vision> {
    const response = await api.put(`/api/v1/visions/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/visions/${id}`);
  },
};

// Goal API
interface GoalFilters {
  include_archived?: boolean;
  vision_id?: string;
  goal_type?: string;
  year?: number;
  quarter?: number;
  parent_id?: string;
}

async function listPages<T>(path: string, params: URLSearchParams): Promise<T[]> {
  const rows: T[] = [];
  params.set("limit", "100");
  for (let skip = 0; ; skip += 100) {
    params.set("skip", String(skip));
    const page = (await api.get<T[]>(path, { params })).data;
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

export const goalApi = {
  async list(filters?: GoalFilters): Promise<Goal[]> {
    const params = new URLSearchParams();
    if (filters?.include_archived) params.set("include_archived", "true");
    if (filters?.vision_id) params.append("vision_id", filters.vision_id);
    if (filters?.goal_type) params.append("goal_type", filters.goal_type);
    if (filters?.year) params.append("year", String(filters.year));
    if (filters?.quarter) params.append("quarter", String(filters.quarter));
    if (filters?.parent_id) params.append("parent_id", filters.parent_id);

    return listPages<Goal>("/api/v1/goals", params);
  },

  async get(id: string): Promise<Goal> {
    const response = await api.get(`/api/v1/goals/${id}`);
    return response.data;
  },

  async create(data: GoalCreate): Promise<Goal> {
    const response = await api.post("/api/v1/goals", data);
    return response.data;
  },

  async update(id: string, data: Partial<Goal>): Promise<Goal> {
    const response = await api.put(`/api/v1/goals/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/goals/${id}`);
  },
};

// TimeLog API
interface TimelogFilters {
  goal_id?: string;
  start_date?: string;
  end_date?: string;
  log_type?: string;
}

export const timelogApi = {
  async list(filters?: TimelogFilters): Promise<TimeLog[]> {
    const params = new URLSearchParams();
    if (filters?.goal_id) params.append("goal_id", filters.goal_id);
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    if (filters?.log_type) params.append("log_type", filters.log_type);

    return listPages<TimeLog>("/api/v1/timelogs", params);
  },

  async get(id: string): Promise<TimeLog> {
    const response = await api.get(`/api/v1/timelogs/${id}`);
    return response.data;
  },

  async getCurrent(): Promise<TimeLog | null> {
    const response = await api.get("/api/v1/timelogs/current");
    return response.data;
  },

  async start(data: TimeLogStart): Promise<TimeLog> {
    const response = await api.post("/api/v1/timelogs/start", data);
    return response.data;
  },

  async stop(id: string, note?: string): Promise<TimeLog> {
    const response = await api.patch(`/api/v1/timelogs/${id}/stop`, { note });
    return response.data;
  },

  async createManual(data: TimeLogManual, checkOverlap = true): Promise<TimeLog> {
    const response = await api.post("/api/v1/timelogs", data, { params: { check_overlap: checkOverlap } });
    return response.data;
  },

  async createPlanned(data: TimeLogPlanned): Promise<TimeLog> {
    const response = await api.post("/api/v1/timelogs/planned", data);
    return response.data;
  },

  async updateStatus(id: string, status: TimeLogStatus): Promise<TimeLog> {
    const response = await api.patch(`/api/v1/timelogs/${id}/status`, { status }, { params: { check_overlap: true } });
    return response.data;
  },

  async update(id: string, data: Partial<TimeLog>, checkOverlap = true): Promise<TimeLog> {
    const response = await api.put(`/api/v1/timelogs/${id}`, data, { params: { check_overlap: checkOverlap } });
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/timelogs/${id}`);
  },
};

// Report API
export const reportApi = {
  async getPeriod(year: number, quarter?: number): Promise<PeriodReport> {
    const params = new URLSearchParams({ year: String(year) });
    if (quarter) params.set("quarter", String(quarter));
    return (await api.get(`/api/v1/reports/period?${params.toString()}`)).data;
  },
  async getWeekly(weekStart?: string): Promise<WeeklyReport> {
    const params = new URLSearchParams();
    if (weekStart) params.append("week_start", weekStart);
    // 固定使用北京时间 UTC+8
    params.append("tz_offset", "480");

    const response = await api.get(`/api/v1/reports/weekly?${params.toString()}`);
    return response.data;
  },

  async getVisionAlignment(startDate?: string, endDate?: string): Promise<VisionAlignmentReport> {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    const response = await api.get(`/api/v1/reports/vision-alignment?${params.toString()}`);
    return response.data;
  },

  async getGoalProgress(year: number, quarter?: number): Promise<GoalProgressReport> {
    const params = new URLSearchParams();
    params.append("year", String(year));
    if (quarter) params.append("quarter", String(quarter));

    const response = await api.get(`/api/v1/reports/goal-progress?${params.toString()}`);
    return response.data;
  },
};

export default api;
