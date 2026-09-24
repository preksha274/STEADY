import React from "react";
import { Card } from "@/components/Card";
import { Activity } from "lucide-react";

export default function MovePage() {
  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Move Coach</h1>
          <p className="text-xs text-[#64748B]">Personalized exercise & movement micro-sessions</p>
        </div>
        <div className="p-2.5 rounded-2xl bg-amber-50 text-[#F59E0B]">
          <Activity className="w-6 h-6" />
        </div>
      </header>

      <Card>
        <p className="text-sm text-[#64748B]">Move Coach Placeholder</p>
      </Card>
    </div>
  );
}
