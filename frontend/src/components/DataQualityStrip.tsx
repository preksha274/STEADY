"use client";

import React from "react";
import { ConfidenceLevel } from "./ConfidenceBadge";
import { Activity, Video, Brain } from "lucide-react";

interface ModalityStatus {
  active: boolean;
  confidence?: ConfidenceLevel;
  reason?: string;
}

interface DataQualityStripProps {
  motion?: ModalityStatus;
  camera?: ModalityStatus;
  eeg?: ModalityStatus;
  className?: string;
}

export const DataQualityStrip: React.FC<DataQualityStripProps> = ({
  motion,
  camera,
  eeg,
  className = "",
}) => {
  const getDotStyle = (status?: ModalityStatus) => {
    if (!status || !status.active) {
      return {
        dot: "bg-slate-300",
        text: "text-slate-400",
        label: "Not provided",
      };
    }
    if (status.confidence === "high") {
      return {
        dot: "bg-[#10B981] ring-2 ring-emerald-100",
        text: "text-emerald-700 font-bold",
        label: "Good quality",
      };
    }
    if (status.confidence === "medium") {
      return {
        dot: "bg-[#F59E0B] ring-2 ring-amber-100",
        text: "text-amber-700 font-bold",
        label: "Fair quality",
      };
    }
    return {
      dot: "bg-[#EF4444] ring-2 ring-rose-100",
      text: "text-rose-700 font-bold",
      label: "Low confidence",
    };
  };

  const motionStyle = getDotStyle(motion);
  const cameraStyle = getDotStyle(camera);
  const eegStyle = getDotStyle(eeg);

  return (
    <div
      className={`bg-white border border-[#E2E8F0] rounded-2xl p-3 flex items-center justify-between shadow-xs ${className}`}
    >
      <div className="text-xs font-semibold text-[#172554] flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB]" />
        <span>Quality Strip:</span>
      </div>

      <div className="flex items-center gap-3.5 text-xs">
        {/* Motion Status */}
        <div
          className="flex items-center gap-1.5"
          title={motion?.reason || `Motion: ${motionStyle.label}`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${motionStyle.dot}`} />
          <span className={motionStyle.text}>Motion</span>
        </div>

        {/* Camera Status */}
        <div
          className="flex items-center gap-1.5"
          title={camera?.reason || `Camera: ${cameraStyle.label}`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${cameraStyle.dot}`} />
          <span className={cameraStyle.text}>Camera</span>
        </div>

        {/* EEG Status */}
        <div
          className="flex items-center gap-1.5"
          title={eeg?.reason || `EEG: ${eegStyle.label}`}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${eegStyle.dot}`} />
          <span className={eegStyle.text}>EEG</span>
        </div>
      </div>
    </div>
  );
};
