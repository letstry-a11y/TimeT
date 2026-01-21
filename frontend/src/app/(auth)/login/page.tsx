"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useTranslation } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import toast from "react-hot-toast";
import { Clock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setTokens, setUser } = useAuthStore();
  const { t } = useTranslation();
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
      setErrors((prev) => ({ ...prev, email: t('auth.emailRequired') }));
      return;
    }
    if (!formData.password) {
      setErrors((prev) => ({ ...prev, password: t('auth.passwordRequired') }));
      return;
    }

    setIsLoading(true);
    try {
      const tokens = await authApi.login(formData.email, formData.password);
      setTokens(tokens.access_token, tokens.refresh_token);

      const user = await authApi.getMe();
      setUser(user);

      toast.success(t('auth.loginSuccess'));
      router.push("/dashboard");
    } catch (error: any) {
      const message = error.response?.data?.detail || t('auth.loginFailed');
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher className="bg-white shadow-sm" />
      </div>
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Clock className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.welcomeBack')}</h1>
          <p className="text-gray-500 mt-1">{t('auth.loginToAccount')}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            type="email"
            label={t('auth.email')}
            placeholder={t('auth.emailPlaceholder')}
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            error={errors.email}
          />

          <Input
            id="password"
            type="password"
            label={t('auth.password')}
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            error={errors.password}
          />

          <Button type="submit" className="w-full" isLoading={isLoading}>
            {t('auth.login')}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {t('auth.noAccount')}{" "}
          <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            {t('auth.registerNow')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
