"use client";

import { useTranslation } from "@/i18n";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  collapsed?: boolean;
  className?: string;
}

export function LanguageSwitcher({ collapsed, className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useTranslation();

  const toggleLanguage = () => {
    setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN');
  };

  return (
    <button
      onClick={toggleLanguage}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors",
        collapsed && "justify-center",
        className
      )}
      title={locale === 'zh-CN' ? 'Switch to English' : '切换到中文'}
    >
      <Globe className="h-5 w-5 flex-shrink-0" />
      {!collapsed && (
        <span className="text-sm">
          {locale === 'zh-CN' ? 'English' : '中文'}
        </span>
      )}
    </button>
  );
}
