"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { locales, localeNames, type Locale } from "@/i18n/config";

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

export function LanguageSwitcher({ collapsed = false }: LanguageSwitcherProps) {
  const t = useTranslations("language");
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const handleLocaleChange = (newLocale: Locale) => {
    startTransition(() => {
      // Set cookie and reload page to apply new locale
      document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
      window.location.reload();
    });
  };

  const nextLocale: Locale = locale === "zh-CN" ? "en" : "zh-CN";

  return (
    <button
      onClick={() => handleLocaleChange(nextLocale)}
      disabled={isPending}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 w-full transition-colors",
        collapsed && "justify-center",
        isPending && "opacity-50 cursor-not-allowed"
      )}
      title={t("switch")}
    >
      <Globe className="h-5 w-5" />
      {!collapsed && (
        <span className="text-sm">
          {localeNames[nextLocale]}
        </span>
      )}
    </button>
  );
}
