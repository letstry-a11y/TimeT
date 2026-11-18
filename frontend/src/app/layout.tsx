import type { Metadata } from "next";
import "./globals.css";
import "./journal.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "TimeTracker",
  description: "个人时间手帐、目标与周期复盘",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
