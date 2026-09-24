"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { FreezeFab } from "./FreezeFab";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();

  // Hide nav and freeze button on /login and /onboarding
  const isAuthPage = pathname === "/login" || pathname === "/onboarding";

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#172554] antialiased">
      <main className={`flex-1 ${isAuthPage ? "" : "pb-24"}`}>
        {children}
      </main>
      {!isAuthPage && (
        <>
          <FreezeFab />
          <BottomNav />
        </>
      )}
    </div>
  );
};
