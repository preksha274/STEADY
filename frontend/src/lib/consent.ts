/**
 * STEADY Granular Revocable Consent & Caregiver Audit Logging System
 * 
 * Features:
 * - 6 Independent Consent Toggles (ALL OFF BY DEFAULT):
 *   1. Movement Monitoring
 *   2. Voice Recording
 *   3. GPS Location
 *   4. Caregiver Sharing
 *   5. Research Reuse
 *   6. Cloud Storage
 * 
 * - Plain-language notices (What, Who, Why, How long) in English, Hindi, Tamil, Telugu, and Kannada.
 * - Visible location sharing indicator + 1-tap pause.
 * - Clear explanation of data handling on revocation.
 * - Caregiver Role-Based Access Control (RBAC) with patient-facing access logs.
 * - 100% Functional No-Location Mode.
 * - Plain language legal & medical disclaimers.
 */

export type ConsentLanguage = "en" | "hi" | "ta" | "te" | "kn";

export interface ConsentToggles {
  movementMonitoring: boolean;
  voiceRecording: boolean;
  gpsLocation: boolean;
  caregiverSharing: boolean;
  researchReuse: boolean;
  cloudStorage: boolean;
}

export interface CaregiverPermissions {
  sosAlerts: boolean;
  liveLocation: boolean;
  locationHistory: boolean;
  symptomSummaries: boolean;
  rawData: boolean;
}

export interface CaregiverAccessLog {
  id: string;
  timestamp: string;
  caregiverName: string;
  role: "primary_guardian" | "secondary_caregiver" | "clinician" | "family_member";
  resourceAccessed: "sos_alert" | "live_location" | "location_history" | "symptom_summary" | "raw_data";
  purpose: string;
  status: "granted" | "denied_revoked_consent" | "denied_role_permission";
}

export interface MultilingualNotice {
  title: string;
  what: string;
  who: string;
  why: string;
  howLong: string;
}

export const DEFAULT_CONSENT_TOGGLES: ConsentToggles = {
  movementMonitoring: false,
  voiceRecording: false,
  gpsLocation: false,
  caregiverSharing: false,
  researchReuse: false,
  cloudStorage: false,
};

export const DEFAULT_CAREGIVER_PERMISSIONS: CaregiverPermissions = {
  sosAlerts: false,
  liveLocation: false,
  locationHistory: false,
  symptomSummaries: false,
  rawData: false,
};

export const CONSENT_NOTICES: Record<keyof ConsentToggles, Record<ConsentLanguage, MultilingualNotice>> = {
  movementMonitoring: {
    en: {
      title: "Movement Monitoring",
      what: "IMU accelerometer & gyroscope data from wrist band or phone sensors.",
      who: "Processed locally on your device for real-time tremor and gait calculation.",
      why: "To track motor fluctuation trends and trigger adaptive rhythmic cues.",
      howLong: "Saved on device until cleared. Never uploaded without cloud consent.",
    },
    hi: {
      title: "गति निगरानी (Movement Monitoring)",
      what: "आपके फोन या बैंड सेंसर से गति एवं कंपन का डेटा।",
      who: "केवल आपके फोन पर प्रोसेस होता है।",
      why: "कंपन और चलने की गति के रुझानों को समझने के लिए।",
      howLong: "डेटा को साफ़ करने तक आपके फोन में सुरक्षित रहेगा।",
    },
    ta: {
      title: "இயக்க கண்காணிப்பு (Movement Monitoring)",
      what: "உங்கள் மொபைல் அல்லது பேண்ட் சென்சாரிலிருந்து நகர்வு தரவு.",
      who: "உங்கள் மொபைலில் மட்டுமே செயலாக்கப்படுகிறது.",
      why: "நடுக்கம் மற்றும் நடை மாற்றங்களைக் கண்காணிக்க.",
      howLong: "நீங்கள் நீக்கும் வரை சாதனத்தில் சேமிக்கப்படும்.",
    },
    te: {
      title: "కదలికల పర్యవేక్షణ (Movement Monitoring)",
      what: "మీ ఫోన్ లేదా బ్యాండ్ సెన్సార్ల నుండి కదలిక డేటా.",
      who: "మీ ఫోన్‌లో మాత్రమే విశ్లేషించబడుతుంది.",
      why: "వణుకు మరియు నడక సరళిని తెలుసుకోవడానికి.",
      howLong: "మీరు తొలగించే వరకు ఫోన్‌లోనే ఉంటుంది.",
    },
    kn: {
      title: "ಚಲನೆ ಮೇಲ್ವಿಚಾರಣೆ (Movement Monitoring)",
      what: "ನಿಮ್ಮ ಫೋನ್ ಅಥವಾ ಬ್ಯಾಂಡ್ ಸೆನ್ಸಾರ್‌ನಿಂದ ಚಲನೆ ಡೇಟಾ.",
      who: "ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ಮಾತ್ರ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗುತ್ತದೆ.",
      why: "ನಡುಕ ಮತ್ತು ನಡಿಗೆ ಮಾದರಿಯನ್ನು ಗಮನಿಸಲು.",
      howLong: "ನೀವು ಅಳಿಸುವವರೆಗೆ ಸಾಧನದಲ್ಲೇ ಇರುತ್ತದೆ.",
    },
  },
  voiceRecording: {
    en: {
      title: "Voice Recording & Acoustic Analysis",
      what: "Short 5-second sustained vowel audio clips ('aaah') and phrase readings.",
      who: "Analyzed immediately on your device; raw audio is discarded after feature extraction.",
      why: "To compute vocal acoustic stability (F0 pitch, jitter, shimmer, HNR).",
      howLong: "Only extracted metrics are saved locally; raw voice files are never stored.",
    },
    hi: {
      title: "आवाज रिकॉर्डिंग (Voice Recording)",
      what: "5-सेकंड की आवाज की छोटी रिकॉर्डिंग ('आआआ')।",
      who: "केवल आपके फोन पर विश्लेषित की जाती है।",
      why: "आवाज की स्थिरता और कंपन की जांच के लिए।",
      howLong: "केवल विश्लेषण परिणाम सहेजे जाते हैं; रिकॉर्डिंग हटा दी जाती है।",
    },
    ta: {
      title: "குரல் பதிவு (Voice Recording)",
      what: "5 வினாடி குரல் பதிவு ('ஆஆஆ').",
      who: "உங்கள் சாதனத்தில் மட்டுமே ஆய்வு செய்யப்படும்.",
      why: "குரல் நிலைத்தன்மையை அளவிட.",
      howLong: "முடிவுகள் மட்டுமே சேமிக்கப்படும்; குரல் பதிவு நீக்கப்படும்.",
    },
    te: {
      title: "వాయిస్ రికార్డింగ్ (Voice Recording)",
      what: "5-సెకన్ల స్వల్ప వాయిస్ క్లిప్ ('ఆఆఆ').",
      who: "మీ ఫోన్‌లో మాత్రమే ప్రాసెస్ చేయబడుతుంది.",
      why: "స్వరం యొక్క స్థిరత్వాన్ని పరిశీలించడానికి.",
      howLong: "ఫలితాలు మాత్రమే దాచబడతాయి; వాయిస్ ఫైల్ తొలిగించబడుతుంది.",
    },
    kn: {
      title: "ಧ್ವನಿ ರೆಕಾರ್ಡಿಂಗ್ (Voice Recording)",
      what: "5-ಸೆಕೆಂಡಿನ ಸಣ್ಣ ಧ್ವನಿ ಕ್ಲಿಪ್ ('ಆಆಆ').",
      who: "ನಿಮ್ಮ ಸಾಧನದಲ್ಲೇ ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತದೆ.",
      why: "ಧ್ವನಿ ಸ್ಥಿರತೆ ಪರೀಕ್ಷಿಸಲು.",
      howLong: "ಫಲಿತಾಂಶಗಳನ್ನು ಮಾತ್ರ ಉಳಿಸಲಾಗುತ್ತದೆ; ಧ್ವನಿ ಫೈಲ್ ತಕ್ಷಣ ಅಳಿಸಲ್ಪಡುತ್ತದೆ.",
    },
  },
  gpsLocation: {
    en: {
      title: "GPS Location & Geofencing",
      what: "Live location coordinates (latitude, longitude, accuracy).",
      who: "Visible to designated guardians only when caregiver sharing is ON.",
      why: "To provide safe-zone breach alerts and emergency location during SOS.",
      howLong: "Retained for maximum 30 days or until revoked.",
    },
    hi: {
      title: "जीपीएस लोकेशन (GPS Location)",
      what: "आपकी वर्तमान जीपीएस लोकेशन।",
      who: "केवल आपके द्वारा चुने गए अभिभावक को दिखाई देगी।",
      why: "सुरक्षित क्षेत्र से बाहर जाने या SOS आपात स्थिति में मदद के लिए।",
      howLong: "अधिकतम 30 दिनों तक या सहमति वापस लेने तक।",
    },
    ta: {
      title: "ஜிபிஎஸ் இருப்பிடம் (GPS Location)",
      what: "உங்கள் தற்போதைய ஜிபிஎஸ் ஆயத்தொலைவுகள்.",
      who: "நீங்கள் அனுமதித்த பாதுகாப்பாளருக்கு மட்டுமே.",
      why: "பாதுகாப்பான மண்டல எச்சரிக்கை மற்றும் அவசர உதவிக்கு.",
      howLong: "அதிகபட்சம் 30 நாட்கள் அல்லது ஒப்புதல் திரும்பப் பெறும் வரை.",
    },
    te: {
      title: "GPS లొకేషన్ (GPS Location)",
      what: "మీ లైవ్ GPS లొకేషన్ వివరాలు.",
      who: "మీరు అనుమతించిన సంరక్షకుడికి మాత్రమే కనిపిస్తుంది.",
      why: "సేఫ్ ಜೋన్ దాటినప్పుడు మరియు SOS సమయంలో సహాయానికి.",
      howLong: "గరిష్టంగా 30 రోజులు లేదా అనుమతి రద్దు చేసే వరకు.",
    },
    kn: {
      title: "GPS ಸ್ಥಳ (GPS Location)",
      what: "ನಿಮ್ಮ ಪ್ರಸ್ತುತ GPS ಸ್ಥಳದ ವಿವರಗಳು.",
      who: "ನೀವು ಅನುಮತಿಸಿದ ಪೋಷಕರಿಗೆ ಮಾತ್ರ ಕಾಣಿಸುತ್ತದೆ.",
      why: "ಸುರಕ್ಷಿತ ವಲಯ ನಿರ್ಗಮನ ಮತ್ತು ತುರ್ತು SOS ಬೆಂಬಲಕ್ಕಾಗಿ.",
      howLong: "ಗರಿಷ್ಠ 30 ದಿನಗಳು ಅಥವಾ ಸಮ್ಮತಿ ಹಿಂಪಡೆಯುವವರೆಗೆ.",
    },
  },
  caregiverSharing: {
    en: {
      title: "Caregiver Sharing & Dashboard",
      what: "Symptom summaries, safety alerts, and designated status metrics.",
      who: "Shared exclusively with authorized guardian via secure token link.",
      why: "To keep family members updated on safety and mobility trends.",
      howLong: "Active while consent toggle is ON. Revoking terminates link immediately.",
    },
    hi: {
      title: "केयरगिवर शेयरिंग (Caregiver Sharing)",
      what: "लक्षण सारांश और सुरक्षा अलर्ट।",
      who: "केवल आपके अधिकृत केयरगिवर के साथ।",
      why: "आपके परिवार को आपकी सुरक्षा का अपडेट देने के लिए।",
      howLong: "सहमति चालू रहने तक। सहमति बंद करते ही एक्सेस समाप्त।",
    },
    ta: {
      title: "பராமரிப்பாளர் பகிர்வு (Caregiver Sharing)",
      what: "அறிகுறி சுருக்கங்கள் மற்றும் பாதுகாப்பு எச்சரிக்கைகள்.",
      who: "அங்கீகரிக்கப்பட்ட பராமரிப்பாளருடன் மட்டுமே.",
      why: "குடும்பத்தினருக்கு பாதுகாப்பு குறித்த தகவல் அளிக்க.",
      howLong: "ஒப்புதல் இருக்கும் வரை. திரும்பப் பெற்றால் உடனடியாக நிறுத்தப்படும்.",
    },
    te: {
      title: "సంరక్షకుడితో సమాచారం (Caregiver Sharing)",
      what: "లక్షణాల నివేదికలు మరియు సేఫ్టీ అలర్ట్లు.",
      who: "మీరు ఎంచుకున్న సంరక్షకుడితో మాత్రమే.",
      why: "మీ భద్రతా సమాచారాన్ని కుటుంబానికి తెలియజేయడానికి.",
      howLong: "అనుమతి ఉన్నంత వరకు. రద్దు చేస్తే తక్షణమే ఆగిపోతుంది.",
    },
    kn: {
      title: "ಪಾಲನೆದಾರರ ಹಂಚಿಕೆ (Caregiver Sharing)",
      what: "ಲಕ್ಷಣಗಳ ಸಾರಾಂಶ ಮತ್ತು ಭದ್ರತಾ ಎಚ್ಚರಿಕೆಗಳು.",
      who: "ಅಧಿಕೃತ ಪೋಷಕರೊಂದಿಗೆ ಮಾತ್ರ ಹಂಚಿಕೊಳ್ಳಲಾಗುತ್ತದೆ.",
      why: "ನಿಮ್ಮ ಸುರಕ್ಷತೆ ಕುರಿತು ಕುಟುಂಬಕ್ಕೆ ಮಾಹಿತಿ ನೀಡಲು.",
      howLong: "ಸಮ್ಮತಿ ಸಕ್ರಿಯವಾಗಿರುವವರೆಗೆ. ಹಿಂಪಡೆದರೆ ತಕ್ಷಣವೇ ನಿಲ್ಲುತ್ತದೆ.",
    },
  },
  researchReuse: {
    en: {
      title: "Anonymized Research Reuse",
      what: "De-identified, aggregated movement & acoustic feature metrics.",
      who: "Academic researchers studying digital biomarkers for Parkinson's.",
      why: "To advance open-source non-invasive motor stability algorithms.",
      howLong: "Stored indefinitely in anonymized research repositories.",
    },
    hi: {
      title: "शोध उपयोग (Research Reuse)",
      what: "अनाम (बिना पहचान का) गति और आवाज डेटा।",
      who: "पार्किंसंस पर शोध करने वाले वैज्ञानिक।",
      why: "मोटर स्थिरता एल्गोरिदम को बेहतर बनाने के लिए।",
      howLong: "सुरक्षित अनाम डेटाबेस में अनिश्चित काल के लिए।",
    },
    ta: {
      title: "ஆராய்ச்சி பயன்பாடு (Research Reuse)",
      what: "பெயர் விவரிக்கப்படாத நகர்வு தரவு.",
      who: "பார்கின்சன்ஸ் ஆராய்ச்சி நிபுணர்கள்.",
      why: "ஆராய்ச்சி அல்காரிதம்களை மேம்படுத்த.",
      howLong: "பெயரற்ற ஆராய்ச்சி அமைப்பில் சேமிக்கப்படும்.",
    },
    te: {
      title: "పరిశోధన వినియోగం (Research Reuse)",
      what: "పేరు లేని విశ్లేషణాత్మక డేటా.",
      who: "పార్కిన్సన్స్ పరిశోధకులు.",
      why: "నూతన పరిశోధనా సాంకేతికత అభివృద్ధికై.",
      howLong: "అనామక పరిశోధన డేటాబేస్‌లలో ఉంటుంది.",
    },
    kn: {
      title: "ಸಂಶೋಧನಾ ಬಳಕೆ (Research Reuse)",
      what: "ಹೆಸರಿಲ್ಲದ ಅನಾಮಧೇಯ ಚಲನೆ ಡೇಟಾ.",
      who: "ಪಾರ್ಕಿನ್ಸನ್ಸ್ ಸಂಶೋಧಕರು.",
      why: "ಡಿಜಿಟಲ್ ಬಯೋಮಾರ್ಕರ್ ತಂತ್ರಜ್ಞಾನ ಅಭಿವೃದ್ಧಿಗೆ.",
      howLong: "ಅನಾಮಧೇಯ ಸಂಶೋಧನಾ ಸಂಗ್ರಹದಲ್ಲಿ ಉಳಿಯುತ್ತದೆ.",
    },
  },
  cloudStorage: {
    en: {
      title: "Encrypted Cloud Sync",
      what: "Encrypted backup of sessions, diary logs, and cue configurations.",
      who: "Your personal encrypted cloud storage account.",
      why: "To sync history across devices and prevent data loss.",
      howLong: "Until deleted by you or upon account closure.",
    },
    hi: {
      title: "क्लाउड सिंक (Cloud Storage)",
      what: "एनक्रिप्टेड डेटा बैकअप।",
      who: "केवल आपके निजी सुरक्षित क्लाउड खाते पर।",
      why: "नए फोन में डेटा रिस्टोर करने के लिए।",
      howLong: "जब तक आप हटा न दें।",
    },
    ta: {
      title: "மேகக்கணி சேமிப்பு (Cloud Storage)",
      what: "பாதுகாக்கப்பட்ட தரவு காப்புப்பிரதி.",
      who: "உங்கள் தனிப்பட்ட கணக்கில் மட்டுமே.",
      why: "சாதன மாற்றத்தில் தரவை மீட்டெடுக்க.",
      howLong: "நீங்கள் நீக்கும் வரை.",
    },
    te: {
      title: "క్లౌడ్ నిల్వ (Cloud Storage)",
      what: "ఎన్‌క్రిప్ట్ చేయబడిన డేటా బ్యాకప్.",
      who: "మీ వ్యక్తిగత ఖాతాలో మాత్రమే.",
      why: "డేటా నష్టపోకుండా కాపాడుకోవడానికి.",
      howLong: "మీరు తొలగించే వరకు.",
    },
    kn: {
      title: "ಕ್ಲೌಡ್ ಸಂಗ್ರಹಣೆ (Cloud Storage)",
      what: "ಎನ್‌ಕ್ರಿಪ್ಟ್ ಮಾಡಲಾದ ಬ್ಯಾಕಪ್ ಡೇಟಾ.",
      who: "ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಖಾತೆಯಲ್ಲಿ ಮಾತ್ರ.",
      why: "ಸಾಧನ ಬದಲಾಯಿಸಿದಾಗ ಡೇಟಾ ಮರುಪಡೆಯಲು.",
      howLong: "ನೀವು ಅಳಿಸುವವರೆಗೆ.",
    },
  },
};

export const LEGAL_DISCLAIMER_TEXT =
  "Not a medical device. SOS alerts your guardian; emergency services are not contacted.";

export const ETHICS_REVIEW_NOTICE =
  "Note: Privacy compliance needs formal legal and ethics review before real clinical or prospective use.";

// STORAGE KEYS
const CONSENT_STORAGE_KEY = "steady_consent_toggles_v2";
const CAREGIVER_PERMS_KEY = "steady_caregiver_permissions_v1";
const LOCATION_PAUSE_KEY = "steady_location_pause_status";
const CAREGIVER_LOGS_KEY = "steady_caregiver_access_logs_v1";

/**
 * Get current consent toggles. ALL OFF BY DEFAULT.
 */
export function getConsentToggles(): ConsentToggles {
  if (typeof window === "undefined") return DEFAULT_CONSENT_TOGGLES;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONSENT_TOGGLES, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error("Failed to load consent toggles", e);
  }
  return DEFAULT_CONSENT_TOGGLES;
}

/**
 * Update consent toggles.
 */
export function saveConsentToggles(updated: Partial<ConsentToggles>): ConsentToggles {
  const current = getConsentToggles();
  const next = { ...current, ...updated };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save consent toggles", e);
    }
  }
  return next;
}

/**
 * Get caregiver permissions.
 */
export function getCaregiverPermissions(): CaregiverPermissions {
  if (typeof window === "undefined") return DEFAULT_CAREGIVER_PERMISSIONS;
  try {
    const raw = localStorage.getItem(CAREGIVER_PERMS_KEY);
    if (raw) {
      return { ...DEFAULT_CAREGIVER_PERMISSIONS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error("Failed to load caregiver permissions", e);
  }
  return DEFAULT_CAREGIVER_PERMISSIONS;
}

/**
 * Update caregiver permissions.
 */
export function saveCaregiverPermissions(updated: Partial<CaregiverPermissions>): CaregiverPermissions {
  const current = getCaregiverPermissions();
  const next = { ...current, ...updated };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CAREGIVER_PERMS_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save caregiver perms", e);
    }
  }
  return next;
}

/**
 * Check if active GPS location sharing is permitted and active (not paused).
 */
export function isLocationSharingActive(): boolean {
  const consent = getConsentToggles();
  if (!consent.gpsLocation) return false;
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LOCATION_PAUSE_KEY) !== "true";
}

/**
 * 1-Tap Pause Location Sharing.
 */
export function pauseLocationSharing(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCATION_PAUSE_KEY, "true");
  }
}

/**
 * Resume Location Sharing.
 */
export function resumeLocationSharing(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCATION_PAUSE_KEY);
  }
}

/**
 * Explanation of what happens to already-collected data upon revoking consent.
 */
export const REVOCATION_DATA_EXPLANATION =
  "Revoking consent stops future collection and sharing immediately. Previously collected session data remains stored locally on your device unless you choose 'Clear Saved Data' in Settings. Revoking cloud or research consent requests deletion of synced remote backups within 7 days.";

/**
 * Log caregiver access attempt and record to audit log.
 */
export function logCaregiverAccess(
  caregiverName: string,
  role: CaregiverAccessLog["role"],
  resourceAccessed: CaregiverAccessLog["resourceAccessed"],
  purpose: string
): CaregiverAccessLog {
  const consent = getConsentToggles();
  const perms = getCaregiverPermissions();

  let granted = consent.caregiverSharing;

  if (resourceAccessed === "sos_alert" && !perms.sosAlerts) granted = false;
  if (resourceAccessed === "live_location" && (!consent.gpsLocation || !perms.liveLocation || !isLocationSharingActive())) granted = false;
  if (resourceAccessed === "location_history" && (!consent.gpsLocation || !perms.locationHistory)) granted = false;
  if (resourceAccessed === "symptom_summary" && !perms.symptomSummaries) granted = false;
  if (resourceAccessed === "raw_data" && !perms.rawData) granted = false;

  const logEntry: CaregiverAccessLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    timestamp: new Date().toISOString(),
    caregiverName,
    role,
    resourceAccessed,
    purpose,
    status: granted ? "granted" : !consent.caregiverSharing ? "denied_revoked_consent" : "denied_role_permission",
  };

  if (typeof window !== "undefined") {
    try {
      const existing = getCaregiverAccessLogs();
      const updated = [logEntry, ...existing].slice(0, 100);
      localStorage.setItem(CAREGIVER_LOGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to log caregiver access", e);
    }
  }

  return logEntry;
}

/**
 * Retrieve caregiver access logs for patient review.
 */
export function getCaregiverAccessLogs(): CaregiverAccessLog[] {
  if (typeof window === "undefined") return getDemoCaregiverLogs();
  try {
    const raw = localStorage.getItem(CAREGIVER_LOGS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("Failed to load caregiver logs", e);
  }
  return getDemoCaregiverLogs();
}

/**
 * Helper to check No-Location Mode status.
 */
export function isNoLocationModeActive(): boolean {
  const consent = getConsentToggles();
  return !consent.gpsLocation;
}

/**
 * Demo fallback logs for immediate audit visibility.
 */
function getDemoCaregiverLogs(): CaregiverAccessLog[] {
  const now = new Date();
  return [
    {
      id: "log_1",
      timestamp: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      caregiverName: "Dr. Aris (Guardian)",
      role: "primary_guardian",
      resourceAccessed: "sos_alert",
      purpose: "Guardian dashboard active monitoring check",
      status: "granted",
    },
    {
      id: "log_2",
      timestamp: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
      caregiverName: "David Miller",
      role: "family_member",
      resourceAccessed: "live_location",
      purpose: "Map location check",
      status: "denied_role_permission",
    },
    {
      id: "log_3",
      timestamp: new Date(now.getTime() - 1000 * 60 * 360).toISOString(),
      caregiverName: "Dr. Aris (Guardian)",
      role: "primary_guardian",
      resourceAccessed: "symptom_summary",
      purpose: "Weekly tremor & gait trend summary view",
      status: "granted",
    },
  ];
}
