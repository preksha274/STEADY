/**
 * STEADY Move Coach - Customized Daily Session Routine Generator (Rule-Based Engine)
 * Determines today's personalized routine based on:
 * 1. Today's Diary Entry (energy, fatigue, mood, sleep - unlogged is valid state)
 * 2. Personal Response Curve ON/OFF window estimate
 * 3. Live Cue Designer winning cue modality & tempo
 * 4. Severity Meter tier
 *
 * Enforces pure rule-table explainability for clinical review.
 */

import { CueType } from "./cueEngine";
import { getActiveCue } from "./cues";
import { getDiaryEntries } from "./diary";
import { getSeverity, fetchSeverityAsync } from "./severity";

export type PostureMode = "standing" | "seated" | "mixed";

export interface PlannedExercise {
  id: string;
  name: string;
  category: string;
  targetBenefit: string;
  description: string;
  posture: PostureMode;
  targetReps: number;
  prompts: string[];
}

export interface TodaySessionPlan {
  routineId: string;
  routineTitle: string;
  postureMode: PostureMode;
  selectedExercises: PlannedExercise[];
  targetRepsPerExercise: number;
  targetRounds: number;
  pacingTempoBpm: number;
  pacingCueType: CueType;
  rationale: string;
  diaryLogged: boolean;
  fatigueShrinkThresholdPct: number;
}

export const EXERCISE_CATALOG: Record<string, PlannedExercise> = {
  big_reach: {
    id: "big_reach",
    name: "Big Overhead & Lateral Reach",
    category: "Amplitude (LSVT BIG)",
    targetBenefit: "Bradykinesia & Micro-movement reduction",
    description: "Extend both arms as high and wide as possible on the metronome beat.",
    posture: "standing",
    targetReps: 6,
    prompts: [
      "Bigger reach! Stretch fingertips to the ceiling.",
      "Open your chest wide!",
      "Reach equally high with both arms.",
      "Excellent extension! Hold and lower slowly.",
    ],
  },
  high_knees: {
    id: "high_knees",
    name: "High Marching & Step Clearance",
    category: "Gait & Stride",
    targetBenefit: "Freezing of Gait (FOG) prevention",
    description: "March in place lifting each knee toward hip level to ensure foot clearance.",
    posture: "standing",
    targetReps: 6,
    prompts: [
      "Lift knees high — clear the floor cleanly!",
      "Step right on the metronome beat.",
      "Keep your torso upright and tall.",
      "Great stride height and steady rhythm!",
    ],
  },
  torso_twist: {
    id: "torso_twist",
    name: "Axial Torso & Trunk Rotation",
    category: "Axial Mobility",
    targetBenefit: "Reduces core rigidity & helps turning",
    description: "Seated or standing, rotate your shoulders and head smoothly side-to-side.",
    posture: "seated",
    targetReps: 6,
    prompts: [
      "Rotate smoothly through your ribcage.",
      "Follow the turn with your eyes.",
      "Keep hips facing forward as shoulders turn.",
      "Wonderful axial mobility!",
    ],
  },
  sit_to_stand: {
    id: "sit_to_stand",
    name: "Sit-to-Stand Chair Transfers",
    category: "Functional Strength",
    targetBenefit: "Safe chair transfers & leg power",
    description: "Push through heels to rise to full standing posture, then lower with control.",
    posture: "mixed",
    targetReps: 6,
    prompts: [
      "Nose over toes — power through your heels!",
      "Stand fully tall at the top.",
      "Lower yourself down with steady control.",
      "Strong power from your quadriceps!",
    ],
  },
  heel_toe_rock: {
    id: "heel_toe_rock",
    name: "Heel-to-Toe Rocking Balance",
    category: "Dynamic Balance",
    targetBenefit: "Ankle flexibility & center-of-mass control",
    description: "Rock smoothly from heels to toes in sync with the sensory cue pulse.",
    posture: "standing",
    targetReps: 6,
    prompts: [
      "Shift weight smoothly from heels to balls of feet.",
      "Feel the floor beneath your toes.",
      "Keep your core lightly engaged for balance.",
      "Steady, centered equilibrium!",
    ],
  },
  posture_reset: {
    id: "posture_reset",
    name: "Posture Reset & Scapular Squeeze",
    category: "Postural Stability",
    targetBenefit: "Corrects forward stoop (camptocormia)",
    description: "Draw shoulder blades back and down while aligning chin over breastbone.",
    posture: "seated",
    targetReps: 6,
    prompts: [
      "Pinch shoulder blades together gently.",
      "Lift collarbones and tuck chin slightly.",
      "Breathe deeply into your expanded chest.",
      "Excellent upright alignment!",
    ],
  },
  lateral_step: {
    id: "lateral_step",
    name: "Lateral Clock Stepping",
    category: "Agility & Stepping",
    targetBenefit: "Multi-directional stepping & fall protection",
    description: "Step out wide to 3 o'clock and 9 o'clock positions and return to center.",
    posture: "standing",
    targetReps: 6,
    prompts: [
      "Take a wide, confident side step!",
      "Push back firmly to your solid center.",
      "Step wide to break any freezing risk.",
      "Sharp, deliberate foot placement!",
    ],
  },
};

/**
 * Deterministic rule-based routine selection
 */
export function getTodaySessionPlan(isDemoMode: boolean = false): TodaySessionPlan {
  // 1. Pull winning cue directly from Live Cue Designer
  const activeCue = getActiveCue(isDemoMode);
  const winningType: CueType = activeCue?.type || "audio";
  const winningBpm: number = activeCue?.bpm || 88;

  // 2. Pull today's diary entry
  const entries = getDiaryEntries(isDemoMode);
  const latestDiary = entries && entries.length > 0 ? entries[0] : null;

  const fatigue = latestDiary?.fatigue || null;
  const mood = latestDiary?.mood || null;
  const sleepQuality = latestDiary?.sleepQuality || null;
  const diaryLogged = latestDiary !== null;

  // 3. Pull severity tier
  const severity = getSeverity(isDemoMode);
  const isHighSeverity = severity.tremor.level === "high" || severity.slowness.level === "high";

  // RULE A: High fatigue / Low mood / Wearing-off -> Seated Gentle
  if ((fatigue !== null && fatigue >= 4) || (mood !== null && mood === 1) || (isHighSeverity && fatigue !== null && fatigue >= 3)) {
    return {
      routineId: "seated_gentle",
      routineTitle: "Seated Gentle Mobility Routine",
      postureMode: "seated",
      selectedExercises: [
        EXERCISE_CATALOG["torso_twist"],
        EXERCISE_CATALOG["posture_reset"],
        EXERCISE_CATALOG["sit_to_stand"],
      ],
      targetRepsPerExercise: 6,
      targetRounds: 1,
      pacingTempoBpm: Math.max(60, winningBpm - 4),
      pacingCueType: winningType,
      rationale: `Seated gentle routine selected due to reported high fatigue (${fatigue !== null ? `fatigue ${fatigue}/5` : 'elevated'}). Preserves energy while maintaining axial spinal mobility and posture.`,
      diaryLogged: true,
      fatigueShrinkThresholdPct: 20.0,
    };
  }

  // RULE B: High energy / Good morning state -> Standing High-Amplitude
  if (mood !== null && mood >= 3 && (fatigue === null || fatigue <= 2)) {
    return {
      routineId: "standing_amplitude",
      routineTitle: "High-Amplitude Standing Routine (LSVT BIG)",
      postureMode: "standing",
      selectedExercises: [
        EXERCISE_CATALOG["big_reach"],
        EXERCISE_CATALOG["high_knees"],
        EXERCISE_CATALOG["lateral_step"],
        EXERCISE_CATALOG["sit_to_stand"],
      ],
      targetRepsPerExercise: 6,
      targetRounds: 2,
      pacingTempoBpm: winningBpm,
      pacingCueType: winningType,
      rationale: `Full standing amplitude routine (LSVT BIG principles) selected during your high energy window to maximize stride and reach span.`,
      diaryLogged: true,
      fatigueShrinkThresholdPct: 25.0,
    };
  }

  // RULE C: Unlogged diary fallback
  if (!diaryLogged) {
    return {
      routineId: "baseline_standard",
      routineTitle: "Balanced Movement Baseline",
      postureMode: "mixed",
      selectedExercises: [
        EXERCISE_CATALOG["big_reach"],
        EXERCISE_CATALOG["high_knees"],
        EXERCISE_CATALOG["sit_to_stand"],
        EXERCISE_CATALOG["torso_twist"],
      ],
      targetRepsPerExercise: 6,
      targetRounds: 1,
      pacingTempoBpm: winningBpm,
      pacingCueType: winningType,
      rationale: `Standard balanced routine calibrated to your ${winningBpm} BPM ${winningType.toUpperCase()} cue. (Daily diary not yet logged today — using safe default baseline).`,
      diaryLogged: false,
      fatigueShrinkThresholdPct: 25.0,
    };
  }

  // RULE D: Standard balanced midday routine
  return {
    routineId: "balanced_mobility",
    routineTitle: "Daily Balanced Mobility Routine",
    postureMode: "mixed",
    selectedExercises: [
      EXERCISE_CATALOG["big_reach"],
      EXERCISE_CATALOG["high_knees"],
      EXERCISE_CATALOG["sit_to_stand"],
      EXERCISE_CATALOG["posture_reset"],
    ],
    targetRepsPerExercise: 6,
    targetRounds: 1,
    pacingTempoBpm: winningBpm,
    pacingCueType: winningType,
    rationale: `Balanced mobility routine matched to your steady midday state and ${winningBpm} BPM ${winningType.toUpperCase()} rhythm.`,
    diaryLogged: true,
    fatigueShrinkThresholdPct: 25.0,
  };
}
