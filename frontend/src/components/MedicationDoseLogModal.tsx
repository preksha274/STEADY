"use client";

import React, { useState, useEffect } from "react";
import { useAnalysis } from "@/context/AnalysisContext";
import { addDoseLog } from "@/lib/diary";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Pill, X, Clock, Check, Sparkles } from "lucide-react";

interface MedicationDoseLogModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const MedicationDoseLogModal: React.FC<MedicationDoseLogModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onSuccess,
}) => {
  const { isDoseLogModalOpen, setIsDoseLogModalOpen } = useAnalysis();

  const isOpen = propIsOpen !== undefined ? propIsOpen : isDoseLogModalOpen;
  const handleClose = () => {
    if (propOnClose) propOnClose();
    setIsDoseLogModalOpen(false);
  };

  const [medication, setMedication] = useState("Levodopa / Carbidopa 25/100mg");
  const [doseTime, setDoseTime] = useState("");
  const [state, setState] = useState<"on" | "off">("on");
  const [dosageNote, setDosageNote] = useState("1 tablet with water");

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setDoseTime(`${hours}:${minutes}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    addDoseLog(state);
    if (onSuccess) onSuccess();
    handleClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dose-log-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172554]/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-[20px] border-[0.5px] border-[#E2E8F0] shadow-2xl p-5 sm:p-6 max-w-sm w-full relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2.5 text-[#172554]">
            <div className="p-2 rounded-xl bg-[#EFF6FF] text-[#2563EB]">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h2 id="dose-log-modal-title" className="text-base font-semibold text-[#172554]">
                Medication Dose Log
              </h2>
              <p className="text-xs text-[#64748B]">Log taken dose & motor state</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Close medication dose log"
            className="p-2 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Medication Field (≥ 48px tall) */}
        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Medication
          </label>
          <input
            type="text"
            value={medication}
            onChange={(e) => setMedication(e.target.value)}
            className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-normal text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
            placeholder="e.g. Levodopa / Carbidopa"
          />
        </div>

        {/* Time Field (≥ 48px tall) */}
        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Dose Time
          </label>
          <div className="relative">
            <input
              type="time"
              value={doseTime}
              onChange={(e) => setDoseTime(e.target.value)}
              className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm font-medium text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
            />
          </div>
        </div>

        {/* ON / OFF Segmented Toggle (≥ 44px buttons) */}
        <div className="space-y-1.5 text-left">
          <label className="block text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Current Motor State
          </label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8FAFC] rounded-2xl border-[0.5px] border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setState("on")}
              className={`min-h-[44px] py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                state === "on"
                  ? "bg-[#10B981] text-white shadow-xs font-medium"
                  : "text-[#065F46] hover:bg-emerald-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
              <span>ON (Good)</span>
            </button>
            <button
              type="button"
              onClick={() => setState("off")}
              className={`min-h-[44px] py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                state === "off"
                  ? "bg-[#F59E0B] text-white shadow-xs font-medium"
                  : "text-[#92400E] hover:bg-amber-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
              <span>OFF (Wearing Off)</span>
            </button>
          </div>
        </div>

        {/* Save Button (PrimaryButton, 48px+ height) */}
        <PrimaryButton fullWidth onClick={handleSave}>
          <Check className="w-4 h-4 mr-1 stroke-[2.5]" />
          <span>Save Dose Log</span>
        </PrimaryButton>
      </div>
    </div>
  );
};
