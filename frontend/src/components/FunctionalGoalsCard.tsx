"use client";

import React, { useState, useEffect } from "react";
import {
  getTaskGoals,
  saveTaskGoals,
  recordTaskCheckIn,
  getAllTaskTrends,
  DEFAULT_SUGGESTED_GOALS,
  TaskCheckInEntry,
} from "@/lib/functionalTasks";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import {
  Target,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Minus,
  Sparkles,
  Plus,
  X,
  Calendar,
  Check,
  Edit3,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface FunctionalGoalsCardProps {
  onOpenCheckIn?: () => void;
  showManageButton?: boolean;
  compact?: boolean;
}

export function FunctionalGoalsCard({
  showManageButton = true,
  compact = false,
}: FunctionalGoalsCardProps) {
  const [mounted, setMounted] = useState(false);
  const [goals, setGoals] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<{
    goals: string[];
    history: Array<{ dateLabel: string; [taskName: string]: any }>;
    latestRatings: Array<{ taskName: string; score: number; trend: "improving" | "stable" | "worsening" }>;
  }>({ goals: [], history: [], latestRatings: [] });

  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);

  // Check-in form state
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [checkInDone, setCheckInDone] = useState(false);

  // Management form state
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [customGoalInput, setCustomGoalInput] = useState("");

  const refreshData = () => {
    const activeGoals = getTaskGoals();
    setGoals(activeGoals);
    const trends = getAllTaskTrends();
    setTrendData(trends);

    // Default ratings for check-in
    const defaultR: Record<string, number> = {};
    activeGoals.forEach((g) => {
      defaultR[g] = 2; // Default 2 (mild)
    });
    setRatings(defaultR);
    setSelectedGoals(activeGoals);
  };

  useEffect(() => {
    setMounted(true);
    refreshData();
  }, []);

  if (!mounted) return null;

  const handleScoreSelect = (taskName: string, score: number) => {
    setRatings((prev) => ({ ...prev, [taskName]: score }));
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    recordTaskCheckIn(ratings);
    setCheckInDone(true);
    setTimeout(() => {
      setCheckInDone(false);
      setIsCheckInOpen(false);
      refreshData();
    }, 1200);
  };

  const handleToggleGoal = (goal: string) => {
    if (selectedGoals.includes(goal)) {
      if (selectedGoals.length <= 1) return; // keep at least 1 goal
      setSelectedGoals(selectedGoals.filter((g) => g !== goal));
    } else {
      if (selectedGoals.length >= 5) return; // max 5
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleAddCustomGoal = () => {
    const trimmed = customGoalInput.trim();
    if (trimmed && !selectedGoals.includes(trimmed)) {
      setSelectedGoals([...selectedGoals, trimmed]);
      setCustomGoalInput("");
    }
  };

  const handleSaveGoals = () => {
    saveTaskGoals(selectedGoals);
    setIsManageOpen(false);
    refreshData();
  };

  const colors = ["#8B5CF6", "#06B6D4", "#10B981", "#F59E0B", "#EC4899"];

  const getDifficultyLabel = (score: number) => {
    switch (score) {
      case 1:
        return { label: "1 • Easy", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case 2:
        return { label: "2 • Mild", color: "bg-blue-50 text-blue-700 border-blue-200" };
      case 3:
        return { label: "3 • Moderate", color: "bg-amber-50 text-amber-800 border-amber-200" };
      case 4:
        return { label: "4 • Hard", color: "bg-orange-50 text-orange-800 border-orange-200" };
      case 5:
        return { label: "5 • Very Hard", color: "bg-rose-50 text-rose-800 border-rose-200" };
      default:
        return { label: `${score}`, color: "bg-slate-50 text-slate-700 border-slate-200" };
    }
  };

  return (
    <Card className="space-y-4 border-[0.5px] border-purple-200/80 bg-gradient-to-b from-purple-50/40 to-white relative overflow-hidden">
      {/* Header with distinct self-reported badge */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-100 text-[#8B5CF6]">
              <Target className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-extrabold text-[#172554] tracking-tight">
              Your Functional Goals
            </h3>
            <span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Patient Self-Reported
            </span>
          </div>
          <p className="text-xs text-slate-500 font-normal">
            Personal daily tasks rated 1 (easy) to 5 (very hard). Lower score = improvement.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showManageButton && (
            <button
              onClick={() => setIsManageOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Edit functional goals"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Goals</span>
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCheckInOpen(true)}
            className="border-purple-200 text-[#8B5CF6] hover:bg-purple-50 text-xs font-bold shrink-0"
          >
            <Calendar className="w-3.5 h-3.5 mr-1" />
            <span>Check-in</span>
          </Button>
        </div>
      </div>

      {/* Task ratings list summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {trendData.latestRatings.map((item, idx) => {
          const diff = getDifficultyLabel(item.score);
          const color = colors[idx % colors.length];

          return (
            <div
              key={item.taskName}
              className="p-3 rounded-2xl bg-white border border-purple-100/90 shadow-2xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-xs font-bold text-slate-800 truncate"
                  style={{ color }}
                >
                  {item.taskName}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${diff.color}`}
                >
                  {diff.label}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="text-[10px]">Trend:</span>
                {item.trend === "improving" ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Easier</span>
                  </span>
                ) : item.trend === "worsening" ? (
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Harder</span>
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium flex items-center gap-1">
                    <Minus className="w-3.5 h-3.5 text-slate-400" />
                    <span>Stable</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend Line Chart (Visually distinct purple theme with lower=better label) */}
      {!compact && trendData.history.length > 0 && (
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Difficulty Over Time (1-5 Scale)</span>
            <span className="text-purple-600 font-bold">↓ Lower is better</span>
          </div>

          <div className="h-36 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.history} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1E1B4B",
                    borderRadius: "12px",
                    border: "none",
                    color: "#fff",
                    fontSize: "11px",
                  }}
                />
                {goals.map((goal, idx) => (
                  <Line
                    key={goal}
                    type="monotone"
                    dataKey={goal}
                    name={goal}
                    stroke={colors[idx % colors.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: colors[idx % colors.length] }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* QUICK CHECK-IN MODAL (Takes under 15 seconds) */}
      {isCheckInOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-purple-100 space-y-5 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#172554]">
                  Quick Weekly Functional Check-in
                </h3>
                <p className="text-xs text-slate-500">
                  Rate difficulty over the past week (1 = Easy, 5 = Very Hard).
                </p>
              </div>
              <button
                onClick={() => setIsCheckInOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {checkInDone ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div className="text-base font-extrabold text-[#172554]">
                  Check-in Logged!
                </div>
                <p className="text-xs text-slate-500">
                  Your functional task progress has been saved to your timeline.
                </p>
              </div>
            ) : (
              <form onSubmit={handleCheckInSubmit} className="space-y-4">
                {goals.map((taskName) => {
                  const currentVal = ratings[taskName] ?? 2;
                  return (
                    <div
                      key={taskName}
                      className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{taskName}</span>
                        <span className="font-extrabold text-purple-700">
                          {currentVal === 1
                            ? "1 • Easy"
                            : currentVal === 2
                            ? "2 • Mild"
                            : currentVal === 3
                            ? "3 • Moderate"
                            : currentVal === 4
                            ? "4 • Hard"
                            : "5 • Very Hard"}
                        </span>
                      </div>

                      {/* 1-5 Difficulty Rating Buttons */}
                      <div className="grid grid-cols-5 gap-1.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleScoreSelect(taskName, val)}
                            className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              currentVal === val
                                ? val <= 2
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : val === 3
                                  ? "bg-amber-500 text-white shadow-xs"
                                  : "bg-rose-600 text-white shadow-xs"
                                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  className="bg-[#8B5CF6] hover:bg-purple-700 text-white font-bold py-3 text-sm rounded-2xl shadow-md"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Save Functional Check-in
                </Button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* EDIT / MANAGE FUNCTIONAL GOALS MODAL */}
      {isManageOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-purple-100 space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-[#172554]">
                  Manage Your Personal Goals
                </h3>
                <p className="text-xs text-slate-500">
                  Select or add 2–3 daily tasks to track self-rated difficulty over time.
                </p>
              </div>
              <button
                onClick={() => setIsManageOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Suggested Goals:
              </div>
              <div className="space-y-1.5">
                {DEFAULT_SUGGESTED_GOALS.map((suggested) => {
                  const isSelected = selectedGoals.includes(suggested);
                  return (
                    <button
                      key={suggested}
                      type="button"
                      onClick={() => handleToggleGoal(suggested)}
                      className={`w-full text-left p-3 rounded-2xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? "bg-purple-50 border-purple-300 text-purple-900 shadow-2xs font-bold"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{suggested}</span>
                      {isSelected ? (
                        <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                      ) : (
                        <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Goal Input */}
              <div className="pt-2 space-y-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Add Custom Goal:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Tying shoes, Opening jar..."
                    value={customGoalInput}
                    onChange={(e) => setCustomGoalInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomGoal}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => setIsManageOpen(false)}
                className="border-slate-300 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleSaveGoals}
                className="bg-[#8B5CF6] hover:bg-purple-700 text-white font-bold"
              >
                Save Goals
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
