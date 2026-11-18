"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken, hasHydrated, setUser, logout, setLoading } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage before checking auth
    if (!hasHydrated) {
      return;
    }

    const checkAuth = async () => {
      if (!accessToken) {
        router.push("/login");
        return;
      }

      try {
        const user = await authApi.getMe();
        setUser(user);
        setIsReady(true);
      } catch (error) {
        // Only logout if the error is not handled by the interceptor
        // The interceptor will handle token refresh for 401 errors
        logout();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [hasHydrated, accessToken, router, setUser, logout, setLoading]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="app-frame">
      <Sidebar />
      <main className="app-content">
        {children}
      </main>
    </div>
  );
}
