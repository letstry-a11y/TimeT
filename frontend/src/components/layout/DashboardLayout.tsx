"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/lib/api";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, accessToken, setUser, logout, setLoading } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
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
        logout();
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [accessToken, router, setUser, logout, setLoading]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
