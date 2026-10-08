"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusDot } from "@/components/StatusDot";
import {
  isLocationSharingEnabled,
  setLocationSharingEnabled,
} from "@/components/SafetyEngine";
import {
  GuardianSettings,
  LinkedGuardian,
  LocationPing,
  PairingCode,
  SafeZone,
  createPairingCode,
  createSafeZone,
  deleteSafeZone,
  getGuardianSettings,
  getLatestLocation,
  getLinkedGuardians,
  listSafeZones,
  registerActivity,
  sendLocationPing,
  triggerSos,
  unlinkGuardian,
  updateGuardianSettings,
} from "@/lib/guardian";
import { formatCoordinates, getCurrentLocation, GeoError } from "@/lib/location";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  Crosshair,
  KeyRound,
  MapPin,
  Moon,
  Plus,
  ShieldCheck,
  Siren,
  Trash2,
  Users,
  X,
} from "lucide-react";

function timeAgo(iso?: string | null): string {
  if (!iso) return "Never";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "Unknown";
  const mins = Math.floor((Date.now() - parsed) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const THRESHOLD_OPTIONS = [30, 60, 120, 180, 360, 720];

export default function SafetyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // SOS
  const [sosArmed, setSosArmed] = useState(false);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosSentAt, setSosSentAt] = useState<string | null>(null);

  // Location
  const [sharingPref, setSharingPref] = useState<boolean | null>(null);
  const sharing = sharingPref ?? isLocationSharingEnabled();
  const [latest, setLatest] = useState<LocationPing | null>(null);
  const [pingBusy, setPingBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Pairing
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [guardians, setGuardians] = useState<LinkedGuardian[]>([]);

  // Safe zones
  const [zones, setZones] = useState<SafeZone[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [zoneLat, setZoneLat] = useState("");
  const [zoneLng, setZoneLng] = useState("");
  const [zoneRadius, setZoneRadius] = useState("200");
  const [zoneBusy, setZoneBusy] = useState(false);

  // Awareness settings
  const [settings, setSettings] = useState<GuardianSettings | null>(null);
  const [threshold, setThreshold] = useState(180);
  const [nightEnabled, setNightEnabled] = useState(false);
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("07:00");
  const [settingsBusy, setSettingsBusy] = useState(false);

  const showToast = (message: string) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(null), 3200);
  };

  const loadAll = useCallback(async () => {
    const [nextGuardians, nextZones, nextSettings, nextLatest] = await Promise.all([
      getLinkedGuardians(),
      listSafeZones(),
      getGuardianSettings(),
      getLatestLocation(),
    ]);
    setGuardians(nextGuardians);
    setZones(nextZones);
    setLatest(nextLatest);
    if (nextSettings) {
      setSettings(nextSettings);
      setThreshold(nextSettings.inactivity_threshold_min);
      setNightEnabled(nextSettings.night_awareness.enabled);
      setNightStart(nextSettings.night_awareness.start_time);
      setNightEnd(nextSettings.night_awareness.end_time);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleGenerateCode = async () => {
    setPairingBusy(true);
    const code = await createPairingCode(10);
    setPairingBusy(false);
    if (code) {
      setPairing(code);
      showToast("Pairing code generated.");
    } else {
      showToast("Could not generate a code right now.");
    }
  };

  const handleUnlink = async (linkId: string) => {
    const removed = await unlinkGuardian(linkId);
    showToast(removed ? "Guardian unlinked." : "Could not remove that link.");
    if (removed) void loadAll();
  };

  const captureAndSend = async (): Promise<LocationPing | null> => {
    try {
      setGeoError(null);
      const position = await getCurrentLocation();
      const ping = await sendLocationPing(position);
      if (ping) setLatest(ping);
      return ping;
    } catch (err) {
      const geo = err as GeoError;
      setGeoError(geo?.message || "Unable to read your location.");
      return null;
    }
  };

  const handleSendPing = async () => {
    setPingBusy(true);
    const ping = await captureAndSend();
    setPingBusy(false);
    showToast(
      ping
        ? "Location shared with your guardian."
        : "Location not shared. Check permission and try again."
    );
  };

  const handleToggleSharing = async (enabled: boolean) => {
    setSharingPref(enabled);
    setLocationSharingEnabled(enabled);
    if (enabled) {
      const ping = await captureAndSend();
      showToast(
        ping
          ? "Location sharing on. Pings send about once a minute."
          : "Location sharing on, but permission is needed to send pings."
      );
    } else {
      showToast("Location sharing stopped.");
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setGeoError(null);
      const position = await getCurrentLocation();
      setZoneLat(position.latitude.toFixed(6));
      setZoneLng(position.longitude.toFixed(6));
      showToast("Filled in your current coordinates.");
    } catch (err) {
      const geo = err as GeoError;
      setGeoError(geo?.message || "Unable to read your location.");
    }
  };

  const handleAddZone = async (event: React.FormEvent) => {
    event.preventDefault();
    const lat = parseFloat(zoneLat);
    const lng = parseFloat(zoneLng);
    const radius = parseFloat(zoneRadius);
    if (!zoneName.trim() || Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(radius)) {
      showToast("Please fill in name, coordinates and radius.");
      return;
    }
    setZoneBusy(true);
    const created = await createSafeZone({
      name: zoneName.trim(),
      latitude: lat,
      longitude: lng,
      radius_m: radius,
      enabled: true,
    });
    setZoneBusy(false);
    if (created) {
      setZoneName("");
      setZoneLat("");
      setZoneLng("");
      showToast("Safe zone added.");
      setZones(await listSafeZones());
    } else {
      showToast("Could not add that safe zone.");
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    const removed = await deleteSafeZone(zoneId);
    showToast(removed ? "Safe zone removed." : "Could not remove that zone.");
    if (removed) setZones(await listSafeZones());
  };

  const handleSaveSettings = async () => {
    setSettingsBusy(true);
    const saved = await updateGuardianSettings({
      inactivity_threshold_min: threshold,
      night_awareness: {
        enabled: nightEnabled,
        start_time: nightStart,
        end_time: nightEnd,
      },
    });
    setSettingsBusy(false);
    if (saved) {
      setSettings(saved);
      showToast("Awareness settings saved.");
    } else {
      showToast("Could not save settings.");
    }
  };

  const handleSos = async () => {
    if (!sosArmed) {
      setSosArmed(true);
      showToast("Tap SOS again to confirm.");
      window.setTimeout(() => setSosArmed(false), 6000);
      return;
    }
    setSosBusy(true);
    const alert = await triggerSos();
    setSosBusy(false);
    setSosArmed(false);
    if (alert) {
      setSosSentAt(alert.created_at);
      void registerActivity(false, "sos_button");
      void loadAll();
    } else {
      showToast("SOS could not be recorded. Try again.");
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 sm:p-6 space-y-4">
        <div className="h-28 bg-slate-100 rounded-3xl animate-pulse" />
        <div className="h-64 bg-slate-100 rounded-3xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 sm:p-6 space-y-5 pb-24">
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#172554] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="space-y-1">
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
              Safety &amp; Safe Zones
            </h1>
            <p className="text-xs text-[#64748B]">
              Pair guardians, share location and manage safe zones
            </p>
          </div>
        </div>
      </header>

      {/* SOS */}
      <Card className={sosSentAt ? "border-red-200" : ""}>
        <div className="flex items-center gap-2 mb-3">
          <Siren className="w-4 h-4 text-red-600" />
          <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            SOS
          </span>
          <span className="text-[10px] text-[#64748B] normal-case tracking-normal">
            Awareness alert to your guardian list
          </span>
        </div>

        <button
          onClick={() => void handleSos()}
          disabled={sosBusy}
          className={`w-full min-h-[64px] rounded-2xl font-bold text-lg text-white transition-all duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-60 ${
            sosArmed
              ? "bg-red-700 shadow-lg ring-4 ring-red-300 animate-pulse"
              : "bg-red-500 hover:bg-red-600 shadow-md"
          }`}
        >
          {sosBusy ? "Sending…" : sosArmed ? "Confirm — send SOS now" : "Send SOS"}
        </button>

        <p className="text-[11px] text-[#64748B] mt-2 leading-snug">
          Creates a critical alert with your latest location. STEADY does not call
          emergency services — tap twice to confirm.
        </p>

        {sosSentAt && (
          <div className="mt-3 p-2.5 rounded-xl bg-red-50 border-[0.5px] border-red-200 text-[11px] text-red-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>SOS recorded at {timeAgo(sosSentAt)} (guardians notified in-app).</span>
          </div>
        )}
      </Card>

      {/* Location sharing */}
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#172554]">Location sharing</div>
              <div className="text-[11px] text-[#64748B] truncate">
                {sharing ? "On — pings about once a minute" : "Off — nothing is sent"}
              </div>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={sharing}
            aria-label="Toggle location sharing"
            onClick={() => void handleToggleSharing(!sharing)}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 cursor-pointer ${
              sharing ? "bg-[#2563EB]" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${
                sharing ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wider">Latest ping</div>
          <div className="text-xs font-semibold text-[#172554] mt-0.5 font-mono">
            {formatCoordinates(latest?.latitude, latest?.longitude)}
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            {timeAgo(latest?.captured_at || latest?.received_at)}
            {latest?.accuracy_m ? ` · ±${Math.round(latest.accuracy_m)}m` : ""}
          </div>
        </div>

        {geoError && (
          <p className="text-[11px] text-red-600 mt-2 leading-snug">{geoError}</p>
        )}

        <Button
          variant="outline"
          fullWidth
          className="mt-3"
          onClick={() => void handleSendPing()}
          disabled={pingBusy}
        >
          <Crosshair className="w-4 h-4" />
          <span>{pingBusy ? "Sharing…" : "Share my location now"}</span>
        </Button>
      </Card>

      {/* Guardian pairing */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-[#2563EB]" />
          <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Linked guardians
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] text-center">
          {pairing ? (
            <>
              <div className="text-[11px] text-[#64748B] uppercase tracking-wider mb-1">
                Share this code with your caregiver
              </div>
              <div className="text-3xl font-extrabold text-[#2563EB] tracking-[0.3em] font-mono">
                {pairing.code}
              </div>
              <div className="text-[11px] text-[#64748B] mt-1.5 flex items-center justify-center gap-1">
                <Clock className="w-3 h-3" />
                Expires at{" "}
                {new Date(pairing.expires_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-[#172554]">No active code</div>
              <p className="text-[11px] text-[#64748B] mt-1 mb-3 leading-snug">
                Generate a short-lived, single-use code. Your guardian enters it on their
                Guardian Safety screen.
              </p>
            </>
          )}
          <PrimaryButton
            fullWidth
            className="mt-3"
            onClick={() => void handleGenerateCode()}
            disabled={pairingBusy}
            icon={<KeyRound className="w-4 h-4" />}
          >
            {pairingBusy ? "Generating…" : pairing ? "Generate a new code" : "Generate pairing code"}
          </PrimaryButton>
        </div>

        <div className="space-y-2 mt-3">
          {guardians.length === 0 && (
            <p className="text-[11px] text-[#64748B]">
              No guardians linked yet — alerts and location will only be visible to you.
            </p>
          )}
          {guardians.map((guardian) => (
            <div
              key={guardian.link_id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#172554] truncate">
                  {guardian.guardian_label || guardian.guardian_email || guardian.guardian_id}
                </div>
                <div className="text-[10px] text-[#64748B]">
                  Linked {timeAgo(guardian.linked_at)}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleUnlink(guardian.link_id)}
                aria-label="Unlink guardian"
              >
                <X className="w-3.5 h-3.5" />
                <span>Unlink</span>
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Safe zones */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
              Safe zones
            </span>
          </div>
          <span className="text-[11px] text-[#64748B]">{zones.length} configured</span>
        </div>

        <div className="space-y-2 mb-3">
          {zones.length === 0 && (
            <p className="text-[11px] text-[#64748B]">
              No safe zones yet. Add one so your guardian is alerted when you leave it.
            </p>
          )}
          {zones.map((zone) => (
            <div
              key={zone.id}
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#172554] truncate">{zone.name}</div>
                <div className="text-[10px] text-[#64748B] font-mono">
                  {formatCoordinates(zone.latitude, zone.longitude)} · {zone.radius_m}m
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <StatusDot
                  status={zone.enabled ? "success" : "baseline"}
                  label={zone.enabled ? "On" : "Off"}
                  size="sm"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleDeleteZone(zone.id)}
                  aria-label="Delete safe zone"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleAddZone} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#172554] mb-1 uppercase tracking-wider">
              Zone name
            </label>
            <input
              type="text"
              value={zoneName}
              onChange={(e) => setZoneName(e.target.value)}
              placeholder="e.g. Home"
              className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[#172554] mb-1 uppercase tracking-wider">
                Latitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={zoneLat}
                onChange={(e) => setZoneLat(e.target.value)}
                placeholder="12.9716"
                className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#172554] mb-1 uppercase tracking-wider">
                Longitude
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={zoneLng}
                onChange={(e) => setZoneLng(e.target.value)}
                placeholder="77.5946"
                className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 items-end">
            <div>
              <label className="block text-xs font-semibold text-[#172554] mb-1 uppercase tracking-wider">
                Radius (m)
              </label>
              <input
                type="number"
                min={50}
                max={5000}
                value={zoneRadius}
                onChange={(e) => setZoneRadius(e.target.value)}
                className="w-full h-12 px-3.5 bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <Button
              variant="outline"
              type="button"
              onClick={() => void handleUseCurrentLocation()}
            >
              <Crosshair className="w-4 h-4" />
              <span>Use my location</span>
            </Button>
          </div>

          <PrimaryButton
            fullWidth
            type="submit"
            disabled={zoneBusy}
            icon={<Plus className="w-4 h-4" />}
          >
            {zoneBusy ? "Adding…" : "Add safe zone"}
          </PrimaryButton>
        </form>
      </Card>

      {/* Awareness settings */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-[#2563EB]" />
          <span className="text-xs font-semibold text-[#172554] uppercase tracking-wider">
            Awareness settings
          </span>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#172554] mb-1.5 uppercase tracking-wider">
              Prolonged inactivity alert after
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {THRESHOLD_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => setThreshold(minutes)}
                  className={`min-h-[44px] py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    threshold === minutes
                      ? "bg-[#2563EB] text-white border-[#2563EB]"
                      : "bg-[#F8FAFC] text-[#172554] border-[#E2E8F0] hover:border-slate-300"
                  }`}
                >
                  {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#64748B] mt-1.5">
              While the app is open, no significant movement for this long raises one
              inactivity alert for your guardian.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#F8FAFC] border-[0.5px] border-[#E2E8F0]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-semibold text-[#172554]">Night awareness</span>
              </div>
              <button
                role="switch"
                aria-checked={nightEnabled}
                aria-label="Toggle night awareness"
                onClick={() => setNightEnabled((value) => !value)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                  nightEnabled ? "bg-indigo-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                    nightEnabled ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="block text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                  Start
                </label>
                <input
                  type="time"
                  value={nightStart}
                  onChange={(e) => setNightStart(e.target.value)}
                  className="w-full h-11 px-3 bg-white border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mb-1">
                  End
                </label>
                <input
                  type="time"
                  value={nightEnd}
                  onChange={(e) => setNightEnd(e.target.value)}
                  className="w-full h-11 px-3 bg-white border-[0.5px] border-[#E2E8F0] rounded-xl text-sm text-[#172554] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#64748B] mt-2">
              Movement reported during this window raises one night-activity alert per night.
            </p>
          </div>

          <div className="text-[11px] text-[#64748B]">
            Last recorded activity:{" "}
            <span className="font-medium text-[#172554]">
              {settings?.last_activity_at ? timeAgo(settings.last_activity_at) : "No activity yet"}
            </span>
          </div>

          <PrimaryButton
            fullWidth
            onClick={() => void handleSaveSettings()}
            disabled={settingsBusy}
            icon={<CheckCircle2 className="w-4 h-4" />}
          >
            {settingsBusy ? "Saving…" : "Save settings"}
          </PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
