"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { authApi } from "@/lib/api";
import { useTranslation, useLanguageStore } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import toast from "react-hot-toast";
import { Clock } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { hasHydrated: langHydrated } = useLanguageStore();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Wait for client-side hydration to complete
  useEffect(() => {
    if (langHydrated) {
      setIsHydrated(true);
    }
  }, [langHydrated]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.emailInvalid');
    }

    if (!formData.username) {
      newErrors.username = t('auth.usernameRequired');
    } else if (formData.username.length < 3) {
      newErrors.username = t('auth.usernameMinLength');
    }

    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (formData.password.length < 8) {
      newErrors.password = t('auth.passwordMinLength');
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    try {
      await authApi.register(formData.email, formData.username, formData.password);
      toast.success(t('auth.registerSuccess'));
      router.push("/login");
    } catch (error: any) {
      const message = error.response?.data?.detail || t('auth.registerFailed');
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
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.createAccount')}</h1>
          <p className="text-gray-500 mt-1">{t('auth.startTracking')}</p>
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
            id="username"
            type="text"
            label={t('auth.username')}
            placeholder={t('auth.usernamePlaceholder')}
            value={formData.username}
            onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
            error={errors.username}
          />

          <Input
            id="password"
            type="password"
            label={t('auth.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={formData.password}
            onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
            error={errors.password}
          />

          <Input
            id="confirmPassword"
            type="password"
            label={t('auth.confirmPassword')}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            value={formData.confirmPassword}
            onChange={(e) => setFormData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            error={errors.confirmPassword}
          />

          <Button type="submit" className="w-full" isLoading={isLoading}>
            {t('auth.register')}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          {t('auth.hasAccount')}{" "}
          <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            {t('auth.loginNow')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
