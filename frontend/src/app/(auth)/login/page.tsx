"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import toast from "react-hot-toast";
import { Clock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.email) {
      setErrors((prev) => ({ ...prev, email: "请输入邮箱" }));
      return;
    }
    if (!formData.password) {
      setErrors((prev) => ({ ...prev, password: "请输入密码" }));
      return;
    }

    setIsLoading(true);
    try {
      const tokens = await authApi.login(formData.email, formData.password);
      setTokens(tokens.access_token, tokens.refresh_token);

      const user = await authApi.getMe();
      setUser(user);

      toast.success("登录成功！");
      router.push("/dashboard");
    } catch (error: any) {
      const message = error.response?.data?.detail || "登录失败，请检查邮箱和密码";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Clock className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">欢迎回来</h1>
          <p className="text-gray-500 mt-1">登录您的 TimeTracker 账户</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label="邮箱"
            placeholder="your@email.com"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            error={errors.email}
          />

          <Input
            id="password"
            type="password"
            label="密码"
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            error={errors.password}
          />

          <Button type="submit" className="w-full" isLoading={isLoading}>
            登录
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          还没有账户？{" "}
          <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            立即注册
          </Link>
        </div>
      </Card>
    </div>
  );
}
