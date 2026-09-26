"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { FreezeAssistModal } from "./FreezeAssistModal";
import { MedicationDoseLogModal } from "./MedicationDoseLogModal";
import { VoiceAssistantModal } from "./VoiceAssistantModal";
import { MoreSheet } from "./MoreSheet";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const pathname = usePathname();

  // Hide bottom nav on full-screen focused flows like /login, /onboarding, /simple
  const hideBottomNav =
    pathname === "/login" ||
    pathname === "/onboarding" ||
    pathname === "/simple" ||
    pathname === "/freeze-assist";

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#172554] antialiased">
      <main className={`flex-1 ${hideBottomNav ? "" : "pb-24"}`}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
      <FreezeAssistModal />
      <MedicationDoseLogModal />
      <VoiceAssistantModal />
      <MoreSheet />
    </div>
  );
};
