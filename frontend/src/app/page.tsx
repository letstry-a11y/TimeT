"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function Home() {
  const router = useRouter();
  const { accessToken, hasHydrated, setLoading } = useAuthStore();

  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage
    if (!hasHydrated) {
      return;
    }

    setLoading(false);
    // Check accessToken instead of isAuthenticated since isAuthenticated is not persisted
    if (accessToken) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }, [hasHydrated, accessToken, router, setLoading]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
    </div>
  );
}
