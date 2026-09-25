"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  MapPin,
  Plus,
  ArrowLeft,
  Bed,
  DoorOpen,
  Bath,
  Utensils,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";

interface HazardSpot {
  id: string;
  name: string;
  trigger: string;
  hazardLevel: "danger" | "warning" | "good";
  hazardText: string;
}

interface RoomHazard {
  id: string;
  name: string;
  hazardLevel: "danger" | "warning" | "good";
  hazardLabel: string;
  episodeCount: number;
  spots: HazardSpot[];
}

function getRoomIcon(roomId: string): React.ElementType {
  switch (roomId) {
    case "bedroom":
      return Bed;
    case "hallway":
      return DoorOpen;
    case "bathroom":
      return Bath;
    case "kitchen":
      return Utensils;
    default:
      return MapPin;
  }
}

const DEFAULT_ROOMS: RoomHazard[] = [
  {
    id: "bedroom",
    name: "Bedroom",
    hazardLevel: "warning",
    hazardLabel: "Moderate Hazard",
    episodeCount: 2,
    spots: [
      {
        id: "b1",
        name: "Bedside turning path",
        trigger: "Tight 180° turn on waking",
        hazardLevel: "warning",
        hazardText: "Moderate",
      },
      {
        id: "b2",
        name: "Closet doorway threshold",
        trigger: "Dim lighting & narrow door frame",
        hazardLevel: "good",
        hazardText: "Low",
      },
    ],
  },
  {
    id: "hallway",
    name: "Hallway",
    hazardLevel: "danger",
    hazardLabel: "High Hazard",
    episodeCount: 5,
    spots: [
      {
        id: "h1",
        name: "Main corridor intersection",
        trigger: "Sudden direction change & carpet transition",
        hazardLevel: "danger",
        hazardText: "High",
      },
      {
        id: "h2",
        name: "Front door threshold",
        trigger: "Narrow entry gate hesitation",
        hazardLevel: "danger",
        hazardText: "High",
      },
    ],
  },
  {
    id: "bathroom",
    name: "Bathroom",
    hazardLevel: "danger",
    hazardLabel: "High Hazard",
    episodeCount: 4,
    spots: [
      {
        id: "ba1",
        name: "Shower entry threshold",
        trigger: "Slick tile & cramped step-in",
        hazardLevel: "danger",
        hazardText: "High",
      },
      {
        id: "ba2",
        name: "Sink to toilet pivot",
        trigger: "Small pivot in confined space",
        hazardLevel: "warning",
        hazardText: "Moderate",
      },
    ],
  },
  {
    id: "kitchen",
    name: "Kitchen",
    hazardLevel: "warning",
    hazardLabel: "Moderate Hazard",
    episodeCount: 3,
    spots: [
      {
        id: "k1",
        name: "Refrigerator & island turn",
        trigger: "Carrying dishes around island",
        hazardLevel: "warning",
        hazardText: "Moderate",
      },
      {
        id: "k2",
        name: "Pantry doorway",
        trigger: "Narrow doorway bottleneck",
        hazardLevel: "good",
        hazardText: "Low",
      },
    ],
  },
];


export default function DangerZonesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rooms, setRooms] = useState<RoomHazard[]>(DEFAULT_ROOMS);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("hallway");
  const [isAddSpotOpen, setIsAddSpotOpen] = useState(false);
  const [newSpotName, setNewSpotName] = useState("");
  const [newSpotTrigger, setNewSpotTrigger] = useState("");
  const [newSpotLevel, setNewSpotLevel] = useState<"danger" | "warning" | "good">("warning");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("steady_danger_zones");
      if (stored) {
        setRooms(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load danger zones", e);
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0];

  const handleAddSpot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpotName.trim()) return;

    const newSpot: HazardSpot = {
      id: `spot-${Date.now()}`,
      name: newSpotName.trim(),
      trigger: newSpotTrigger.trim() || "Hesitation trigger",
      hazardLevel: newSpotLevel,
      hazardText: newSpotLevel === "danger" ? "High" : newSpotLevel === "warning" ? "Moderate" : "Low",
    };

    const updated = rooms.map((room) => {
      if (room.id === selectedRoomId) {
        return {
          ...room,
          spots: [...room.spots, newSpot],
          episodeCount: room.episodeCount + 1,
        };
      }
      return room;
    });

    setRooms(updated);
    try {
      localStorage.setItem("steady_danger_zones", JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }

    setNewSpotName("");
    setNewSpotTrigger("");
    setIsAddSpotOpen(false);
    showToast(`Added hazard spot to ${selectedRoom.name}`);
  };

  if (!mounted) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  const SelectedRoomIcon = getRoomIcon(selectedRoom.id);

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.back()}
              className="p-1.5 text-[#64748B] hover:text-[#172554] hover:bg-slate-100 rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-[#172554] tracking-tight">
                Danger Zones
              </h1>
              <p className="text-xs text-[#64748B]">Home hazard map & freeze trigger tracker</p>
            </div>
          </div>
          <div className="p-2.5 rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <MapPin className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* 2x2 Room Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between pl-1">
          <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Home Zones (Tap room to inspect)
          </span>
          <span className="text-[11px] text-[#64748B]">4 zones mapped</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {rooms.map((room) => {
            const Icon = getRoomIcon(room.id);
            const isSelected = room.id === selectedRoomId;
            return (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={`p-4 rounded-[18px] border-[0.5px] text-left transition-all duration-200 flex flex-col justify-between min-h-[120px] cursor-pointer ${
                  isSelected
                    ? "bg-[#EFF6FF] border-[#2563EB] shadow-md ring-2 ring-[#2563EB]/40 scale-[1.02]"
                    : "bg-white border-[#E2E8F0] hover:border-slate-300 hover:shadow-xs"
                }`}
              >
                <div className="flex items-start justify-between w-full">
                  <div
                    className={`p-2.5 rounded-xl ${
                      isSelected ? "bg-[#2563EB] text-white" : "bg-slate-100 text-[#172554]"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-[#64748B]">
                    {room.episodeCount} freezes
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 w-full">
                  <div className="text-sm font-semibold text-[#172554]">{room.name}</div>
                  <StatusDot
                    status={room.hazardLevel}
                    label={room.hazardLabel}
                    size="sm"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tapped Room Detail Section */}
      <Card className="space-y-4 border-[0.5px] border-[#E2E8F0]">
        <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-3">
          <div className="flex items-center gap-2">
            <SelectedRoomIcon className="w-5 h-5 text-[#2563EB]" />
            <div>
              <h2 className="text-base font-semibold text-[#172554]">
                {selectedRoom.name} Hazards
              </h2>
              <p className="text-xs text-[#64748B]">
                {selectedRoom.spots.length} flagged hesitation spots
              </p>
            </div>
          </div>
          <StatusDot status={selectedRoom.hazardLevel} label={selectedRoom.hazardLabel} size="sm" />
        </div>



        {/* Spot List */}
        <div className="space-y-2.5">
          {selectedRoom.spots.map((spot) => (
            <div
              key={spot.id}
              className="p-3 bg-[#F8FAFC] rounded-2xl border-[0.5px] border-[#E2E8F0] flex items-start justify-between gap-3 text-left"
            >
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[#172554] flex items-center gap-1.5">
                  <span>{spot.name}</span>
                </div>
                <div className="text-[11px] text-[#64748B] font-normal leading-snug">
                  Trigger: {spot.trigger}
                </div>
              </div>
              <StatusDot status={spot.hazardLevel} label={spot.hazardText} size="sm" />
            </div>
          ))}
        </div>

        {/* Action: Add a Spot */}
        <div className="pt-2 flex gap-2">
          <Button
            variant="outline"
            fullWidth
            onClick={() => setIsAddSpotOpen(true)}
            className="border-[#2563EB]/40 text-[#2563EB] hover:bg-[#EFF6FF]"
          >
            <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
            <span>Add a Spot</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => router.push("/freeze-assist")}
            className="px-4"
          >
            <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
            <span className="hidden sm:inline">Freeze Assist</span>
          </Button>
        </div>
      </Card>

      {/* Add Spot Modal */}
      {isAddSpotOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#172554]/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-[20px] border-[0.5px] border-[#E2E8F0] shadow-2xl p-5 sm:p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b-[0.5px] border-[#E2E8F0] pb-2.5">
              <h3 className="text-base font-semibold text-[#172554]">
                Add Spot to {selectedRoom.name}
              </h3>
              <button
                onClick={() => setIsAddSpotOpen(false)}
                className="p-1.5 text-[#64748B] hover:text-[#172554] rounded-full min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSpot} className="space-y-3.5 text-left">
              <div>
                <label className="block text-xs font-semibold text-[#172554] mb-1 uppercase tracking-wider">
                  Spot Location
                </label>
                <input
                  type="text"
                  required
                  value={newSpotName}
                  onChange={(e) => setNewSpotName(e.target.value)}
                  placeholder="e.g. Bedside rug transition"
                  className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172554] mb-1 uppercase tracking-wider">
                  Trigger / Movement Context
                </label>
                <input
                  type="text"
                  value={newSpotTrigger}
                  onChange={(e) => setNewSpotTrigger(e.target.value)}
                  placeholder="e.g. Turning around in tight space"
                  className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#172554] mb-1.5 uppercase tracking-wider">
                  Hazard Level
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setNewSpotLevel("danger")}
                    className={`min-h-[44px] py-2 rounded-xl text-xs font-medium border transition-all ${
                      newSpotLevel === "danger"
                        ? "bg-[#EF4444] text-white border-[#EF4444]"
                        : "bg-[#F8FAFC] text-[#991B1B] border-[#FECACA]"
                    }`}
                  >
                    High
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSpotLevel("warning")}
                    className={`min-h-[44px] py-2 rounded-xl text-xs font-medium border transition-all ${
                      newSpotLevel === "warning"
                        ? "bg-[#F59E0B] text-white border-[#F59E0B]"
                        : "bg-[#F8FAFC] text-[#92400E] border-[#FDE68A]"
                    }`}
                  >
                    Moderate
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSpotLevel("good")}
                    className={`min-h-[44px] py-2 rounded-xl text-xs font-medium border transition-all ${
                      newSpotLevel === "good"
                        ? "bg-[#10B981] text-white border-[#10B981]"
                        : "bg-[#F8FAFC] text-[#065F46] border-[#A7F3D0]"
                    }`}
                  >
                    Low
                  </button>
                </div>
              </div>

              <PrimaryButton fullWidth type="submit">
                <span>Save Spot</span>
              </PrimaryButton>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
