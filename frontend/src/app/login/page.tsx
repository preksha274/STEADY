"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Activity, Eye, EyeOff, Mail, Lock, Sun, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("sarah.miller@example.com");
  const [password, setPassword] = useState("steady2026");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (val: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Client-side email validation
    if (!email || !validateEmail(email)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      // Simulate auth verification / Firebase Auth email-password provider check
      await new Promise((resolve) => setTimeout(resolve, 600));

      // For mock/demo accounts or standard credentials:
      // Known demo test passwords or any standard matching login
      const isFamilyRole = email.toLowerCase().includes("family") || email.toLowerCase().includes("caregiver");
      const userRole = isFamilyRole ? "family" : "patient";

      // Store authenticated session
      if (typeof window !== "undefined") {
        const sessionData = {
          user_id: `user_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
          email: email,
          role: userRole,
          name: email.split("@")[0],
          is_authenticated: true,
          authenticated_at: new Date().toISOString(),
        };
        localStorage.setItem("steady_user_session", JSON.stringify(sessionData));
        localStorage.setItem("steady_auth_token", `tok_${Date.now()}`);
      }

      // Route based on users.role per spec
      if (userRole === "patient") {
        router.push("/today");
      } else {
        // Family-role accounts go to Family Home (or /today if dedicated family home not standalone)
        router.push("/today");
      }
    } catch (err) {
      // Account-enumeration safe generic error
      setErrorMessage("Incorrect email or password. Please check your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-background-gradient">
      <div className="bg-white rounded-[24px] p-6 sm:p-8 max-w-md w-full shadow-lg border-[0.5px] border-[#E2E8F0] space-y-6 text-left">
        
        {/* Brand Logo Mark with Brand Gradient */}
        <div className="text-center space-y-2">
          <div
            className="inline-flex p-3.5 rounded-[18px] text-white shadow-md mb-2"
            style={{
              background: "linear-gradient(135deg, #2563EB 0%, #6366F1 50%, #8B5CF6 100%)",
            }}
          >
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
        <form onSubmit={handleSignIn} className="space-y-4" noValidate>
          
          {/* Email Field (48px+ tall, standard validation) */}
          <div className="space-y-1.5">
            <label
              htmlFor="email-input"
              className="block text-xs font-semibold text-[#172554] uppercase tracking-wider"
            >
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Mail className="w-5 h-5" />
              </div>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="your.email@example.com"
                className="w-full min-h-[48px] h-12 pl-11 pr-4 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-normal text-[#172554] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Password Field (48px+ tall, show/hide toggle) */}
          <div className="space-y-1.5">
            <label
              htmlFor="password-input"
              className="block text-xs font-semibold text-[#172554] uppercase tracking-wider"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#64748B]">
                <Lock className="w-5 h-5" />
              </div>
              <input
                id="password-input"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="••••••••"
                className="w-full min-h-[48px] h-12 pl-11 pr-12 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-normal text-[#172554] placeholder-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 min-h-[48px] min-w-[44px] flex items-center justify-center text-[#64748B] hover:text-[#172554] focus:outline-none cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Clear inline error near password field */}
            {errorMessage && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-start gap-2 animate-fadeIn mt-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Primary Action: Gradient Primary CTA Button (48px+ height, white text) */}
          <PrimaryButton
            type="submit"
            fullWidth
            disabled={isLoading}
            className="mt-3 min-h-[48px]"
          >
            <span>{isLoading ? "Signing In..." : "Sign In"}</span>
          </PrimaryButton>
        </form>

        {/* Visually Secondary Link to Sign Up */}
        <div className="text-center pt-1">
          <p className="text-xs text-[#64748B]">
            Don&apos;t have an account?{" "}
            <Link
              href="/onboarding"
              className="text-[#2563EB] font-medium hover:underline inline-flex items-center min-h-[44px] px-1"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Accessibility Note near bottom */}
        <div className="p-3 bg-[#EFF6FF] border-[0.5px] border-[#BFDBFE] rounded-2xl flex items-center gap-2.5 text-xs text-[#1E40AF]">
          <Sun className="w-4 h-4 text-[#2563EB] shrink-0" />
          <span className="font-normal">
            Simple mode available after sign-in.
          </span>
        </div>

      </div>
    </div>
  );
}
