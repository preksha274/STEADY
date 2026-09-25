"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Activity, Lock, Mail, ArrowRight, ShieldCheck, Sparkles, Sun } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("sarah.miller@example.com");
  const [password, setPassword] = useState("••••••••");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/onboarding");
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-background-gradient">
      <div className="bg-white rounded-[24px] p-6 sm:p-8 max-w-md w-full shadow-lg border-[0.5px] border-[#E2E8F0] space-y-6 text-left">
        {/* Header & Gradient Logo Mark */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 rounded-[18px] bg-brand-gradient text-white shadow-md mb-2">
            <Activity className="w-8 h-8 stroke-[2.25]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#172554]">
            STEADY
          </h1>
          <p className="text-sm font-normal text-[#64748B]">
            Parkinson&apos;s movement companion &amp; forecast engine
          </p>
        </div>

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full h-12 pl-11 pr-4 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-normal text-[#172554] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 pl-11 pr-4 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-normal text-[#172554] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Gradient Primary CTA (48px+ height, white text) */}
          <PrimaryButton type="submit" fullWidth className="mt-2">
            <span>Sign In</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </PrimaryButton>
        </form>

        {/* Link to Create Account */}
        <div className="text-center pt-1">
          <p className="text-xs text-[#64748B]">
            Don&apos;t have an account?{" "}
            <Link
              href="/onboarding"
              className="text-[#2563EB] font-medium hover:underline inline-flex items-center min-h-[44px]"
            >
              Create Account &amp; Build Baseline
            </Link>
          </p>
        </div>

        {/* Accessibility Note Box */}
        <div className="p-3 bg-[#EFF6FF] border-[0.5px] border-[#BFDBFE] rounded-2xl flex items-center gap-2.5 text-xs text-[#1E40AF]">
          <Sun className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span className="font-normal">
            Simple mode available after sign-in for oversized text and high-contrast prompts.
          </span>
        </div>
      </div>
    </div>
  );
}
