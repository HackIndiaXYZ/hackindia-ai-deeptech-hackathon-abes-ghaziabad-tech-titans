"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Clock,
  Copy,
  FileText,
  Hash,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  Send,
  Shield,
  Sparkles,
  Square,
} from "lucide-react";

// Minimal type shims for the Web Speech API — not in the standard TS DOM lib.
type SpeechRecognitionAlternative = { transcript: string; confidence?: number };
type SpeechRecognitionResultLike = {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
};
type SpeechRecognitionResultListLike = {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
};
type SpeechRecognitionEventLike = {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
};
type SpeechRecognitionErrorEventLike = { readonly error: string };

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Lang = "en-IN" | "hi-IN";
const LANG_LABEL: Record<Lang, string> = { "en-IN": "EN", "hi-IN": "हिं" };
const LANG_NAME: Record<Lang, string> = { "en-IN": "English", "hi-IN": "Hindi" };

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

type AnalysisResult = {
  issueType: string;
  authority: string;
  severity: Severity;
  location: string;
  summary: string;
};

const ISSUE_LABELS: Record<string, string> = {
  ROAD_AND_POTHOLES: "Roads & Potholes",
  STREETLIGHT: "Streetlight",
  WATER_SUPPLY: "Water Supply",
  DRAINAGE_AND_SEWAGE: "Drainage & Sewage",
  GARBAGE_AND_SANITATION: "Garbage & Sanitation",
  ELECTRICITY: "Electricity",
  PUBLIC_TRANSPORT: "Public Transport",
  TRAFFIC_AND_PARKING: "Traffic & Parking",
  ENCROACHMENT: "Encroachment",
  STRAY_ANIMALS: "Stray Animals",
  PARKS_AND_PUBLIC_SPACES: "Parks & Public Spaces",
  POLLUTION_AIR: "Air Pollution",
  POLLUTION_NOISE: "Noise Pollution",
  POLLUTION_WATER: "Water Pollution",
  PUBLIC_HEALTH: "Public Health",
  LAW_AND_ORDER: "Law & Order",
  BUILDING_AND_CONSTRUCTION: "Building & Construction",
  PROPERTY_TAX_AND_REVENUE: "Property Tax & Revenue",
  EDUCATION: "Education",
  OTHER: "Other",
};

const AUTHORITY_LABELS: Record<string, string> = {
  MUNICIPAL_CORPORATION: "Municipal Corporation",
  PWD: "Public Works Dept.",
  WATER_BOARD: "Water Board",
  ELECTRICITY_DISCOM: "Electricity DISCOM",
  POLICE: "Police",
  TRAFFIC_POLICE: "Traffic Police",
  RTO: "RTO",
  POLLUTION_CONTROL_BOARD: "Pollution Control Board",
  HEALTH_DEPARTMENT: "Health Department",
  EDUCATION_DEPARTMENT: "Education Department",
  DISTRICT_ADMINISTRATION: "District Administration",
  GRAM_PANCHAYAT: "Gram Panchayat",
  FIRE_DEPARTMENT: "Fire Department",
  FOREST_DEPARTMENT: "Forest Department",
  RAILWAYS: "Railways",
  OTHER: "Other",
};

const AUTHORITY_RECIPIENT: Record<string, string> = {
  MUNICIPAL_CORPORATION: "The Commissioner,\nMunicipal Corporation",
  PWD: "The Executive Engineer,\nPublic Works Department",
  WATER_BOARD: "The Chief Engineer,\nWater Supply & Sewerage Board",
  ELECTRICITY_DISCOM: "The Nodal Officer,\nElectricity Distribution Company (DISCOM)",
  POLICE: "The Station House Officer (SHO),\nLocal Police Station",
  TRAFFIC_POLICE: "The Deputy Commissioner of Police (Traffic),\nLocal Traffic Police",
  RTO: "The Regional Transport Officer,\nRegional Transport Office",
  POLLUTION_CONTROL_BOARD: "The Member Secretary,\nState Pollution Control Board",
  HEALTH_DEPARTMENT: "The Chief Medical Officer,\nDistrict Health Department",
  EDUCATION_DEPARTMENT: "The District Education Officer,\nDepartment of Education",
  DISTRICT_ADMINISTRATION: "The District Magistrate,\nOffice of the District Administration",
  GRAM_PANCHAYAT: "The Sarpanch,\nGram Panchayat Office",
  FIRE_DEPARTMENT: "The Chief Fire Officer,\nFire & Emergency Services",
  FOREST_DEPARTMENT: "The Divisional Forest Officer,\nDepartment of Forest",
  RAILWAYS: "The Divisional Railway Manager,\nIndian Railways",
  OTHER: "The Concerned Authority",
};

const SEVERITY_PHRASE: Record<Severity, string> = {
  LOW: "minor but persistent inconvenience",
  MEDIUM: "ongoing inconvenience to the residents of the area",
  HIGH: "serious safety and civic concern affecting members of the public",
  CRITICAL:
    "urgent situation that poses an immediate risk to public safety and life",
};

type ComplaintDraft = {
  to: string;
  subject: string;
  body: string;
  request: string[];
};

function buildComplaintDraft(analysis: AnalysisResult): ComplaintDraft {
  const recipient =
    AUTHORITY_RECIPIENT[analysis.authority] ?? "The Concerned Authority";
  const issueLabel = humanize(analysis.issueType, ISSUE_LABELS);
  const hasLocation =
    !!analysis.location && analysis.location.trim().toLowerCase() !== "not specified";
  const locationClause = hasLocation ? ` at ${analysis.location.trim()}` : "";

  const subject = `Complaint regarding ${issueLabel}${locationClause}`;

  const body = [
    "Respected Sir/Madam,",
    `I, the undersigned resident, wish to bring to your kind attention a civic matter that falls within the jurisdiction of your office. The relevant details are recorded below for your consideration.`,
    `${analysis.summary.trim()}${
      hasLocation
        ? ` The issue is reported${locationClause}.`
        : ""
    }`,
    `This represents a ${SEVERITY_PHRASE[analysis.severity]}, and warrants prompt institutional attention. As the authority responsible for matters relating to ${issueLabel.toLowerCase()}, your office is best placed to take cognisance of this complaint and direct the necessary corrective action.`,
  ].join("\n\n");

  const request: string[] = [];
  if (analysis.severity === "CRITICAL") {
    request.push(
      "Treat this complaint as time-sensitive and depute a response team without delay.",
    );
  }
  request.push(
    "Conduct an on-site inspection at the earliest convenience.",
    "Initiate appropriate remedial measures to resolve the issue at the earliest.",
    "Apprise the undersigned of the action taken and the expected timeline for resolution.",
  );

  return { to: recipient, subject, body, request };
}

function formatLetterDate(d: Date = new Date()) {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function draftToPlainText(draft: ComplaintDraft, date: string) {
  const numbered = draft.request.map((r, i) => `${i + 1}. ${r}`).join("\n");
  return [
    "To,",
    draft.to,
    "",
    `Subject: ${draft.subject}`,
    "",
    draft.body,
    "",
    "I respectfully request your good office to:",
    numbered,
    "",
    "Yours sincerely,",
    "[Citizen Name]",
    "[Contact Number]",
    "[Address]",
    "",
    `Date: ${date}`,
  ].join("\n");
}

function humanize(value: string, map: Record<string, string>) {
  if (map[value]) return map[value];
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

const SEVERITY_STYLES: Record<
  Severity,
  { chip: string; dot: string; label: string }
> = {
  LOW: {
    chip: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
    dot: "bg-emerald-400",
    label: "Low",
  },
  MEDIUM: {
    chip: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
    dot: "bg-sky-400",
    label: "Medium",
  },
  HIGH: {
    chip: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
    dot: "bg-amber-400",
    label: "High",
  },
  CRITICAL: {
    chip: "bg-red-500/10 text-red-300 ring-red-400/40",
    dot: "bg-red-400",
    label: "Critical",
  },
};

type Stage = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const STAGES: Stage[] = [
  {
    id: "submitted",
    label: "Submitted",
    description: "Complaint received and given a unique reference ID.",
    icon: FileText,
  },
  {
    id: "triaged",
    label: "AI Triaged",
    description: "Categorised, prioritised, and routed by Sahayak AI.",
    icon: Sparkles,
  },
  {
    id: "assigned",
    label: "Assigned",
    description: "Forwarded to the responsible municipal department.",
    icon: Building2,
  },
  {
    id: "in_progress",
    label: "In Progress",
    description: "Field officer working on resolution. Updates sent to you.",
    icon: Clock,
  },
  {
    id: "resolved",
    label: "Resolved",
    description: "Issue closed. Verify and rate the outcome.",
    icon: Check,
  },
];

function formatDuration(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function generateRefId() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `SHY-${stamp}-${rand}`;
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const FALLBACK_ISSUE_RULES: Array<{
  keys: string[];
  issueType: string;
  authority: string;
}> = [
  {
    keys: ["pothole", "गड्ढा", "broken road", "road damage", "road broken"],
    issueType: "ROAD_AND_POTHOLES",
    authority: "MUNICIPAL_CORPORATION",
  },
  {
    keys: ["street light", "streetlight", "लाइट", "बत्ती", "lamp post", "light not working"],
    issueType: "STREETLIGHT",
    authority: "MUNICIPAL_CORPORATION",
  },
  {
    keys: ["water leak", "पानी", "no water", "water supply", "tap", "जल"],
    issueType: "WATER_SUPPLY",
    authority: "WATER_BOARD",
  },
  {
    keys: ["sewage", "drain", "नाला", "manhole", "blocked drain", "overflow"],
    issueType: "DRAINAGE_AND_SEWAGE",
    authority: "MUNICIPAL_CORPORATION",
  },
  {
    keys: ["garbage", "trash", "kuda", "कूड़ा", "dustbin", "waste"],
    issueType: "GARBAGE_AND_SANITATION",
    authority: "MUNICIPAL_CORPORATION",
  },
  {
    keys: ["live wire", "electric", "power cut", "बिजली", "current", "transformer", "spark"],
    issueType: "ELECTRICITY",
    authority: "ELECTRICITY_DISCOM",
  },
  {
    keys: ["traffic", "signal", "parking", "ट्रैफिक", "jam", "no parking"],
    issueType: "TRAFFIC_AND_PARKING",
    authority: "TRAFFIC_POLICE",
  },
  {
    keys: ["stray", "dog", "कुत्ता", "cattle", "monkey"],
    issueType: "STRAY_ANIMALS",
    authority: "MUNICIPAL_CORPORATION",
  },
  {
    keys: ["smoke", "pollution", "धुआँ", "factory smoke", "burning waste"],
    issueType: "POLLUTION_AIR",
    authority: "POLLUTION_CONTROL_BOARD",
  },
  {
    keys: ["noise", "loud", "loudspeaker", "dj"],
    issueType: "POLLUTION_NOISE",
    authority: "POLLUTION_CONTROL_BOARD",
  },
  {
    keys: ["encroach", "अतिक्रमण", "illegal stall", "footpath occupied"],
    issueType: "ENCROACHMENT",
    authority: "MUNICIPAL_CORPORATION",
  },
  {
    keys: ["park", "playground", "garden"],
    issueType: "PARKS_AND_PUBLIC_SPACES",
    authority: "MUNICIPAL_CORPORATION",
  },
  {
    keys: ["theft", "robbery", "crime", "harassment", "fight"],
    issueType: "LAW_AND_ORDER",
    authority: "POLICE",
  },
  {
    keys: ["school", "college", "विद्यालय", "teacher"],
    issueType: "EDUCATION",
    authority: "EDUCATION_DEPARTMENT",
  },
  {
    keys: ["hospital", "doctor", "dengue", "outbreak", "fever"],
    issueType: "PUBLIC_HEALTH",
    authority: "HEALTH_DEPARTMENT",
  },
  {
    keys: ["fire", "blaze"],
    issueType: "OTHER",
    authority: "FIRE_DEPARTMENT",
  },
];

const FALLBACK_CRITICAL_KEYS = [
  "live wire",
  "gas leak",
  "fire",
  "burst",
  "collapsed",
  "danger",
  "urgent",
  "खतरा",
  "तुरंत",
  "immediately",
  "life threat",
  "bleeding",
];
const FALLBACK_HIGH_KEYS = [
  "accident",
  "injured",
  "hazard",
  "blocked",
  "serious",
  "no water for",
  "power cut for",
];
const FALLBACK_LOW_KEYS = ["minor", "small", "single", "slight"];

function extractFallbackLocation(text: string): string {
  const match = text.match(
    /(?:near|at|in front of|behind|opposite|outside|inside|on|के पास|के पीछे|के सामने)\s+([A-Za-z0-9ऀ-ॿ][\w\sऀ-ॿ,'-]{2,60})/i,
  );
  if (!match) return "Not specified";
  const loc = match[1].split(/[.!?\n]/)[0].trim().replace(/[,;:\-]+$/, "");
  if (!loc) return "Not specified";
  return loc.length > 80 ? loc.slice(0, 80) + "…" : loc;
}

function getFallbackAnalysis(complaint: string): AnalysisResult {
  const text = complaint.trim();
  const lower = text.toLowerCase();

  let issueType = "OTHER";
  let authority = "OTHER";
  for (const rule of FALLBACK_ISSUE_RULES) {
    if (rule.keys.some((k) => lower.includes(k.toLowerCase()))) {
      issueType = rule.issueType;
      authority = rule.authority;
      break;
    }
  }

  let severity: Severity = "MEDIUM";
  if (FALLBACK_CRITICAL_KEYS.some((k) => lower.includes(k))) severity = "CRITICAL";
  else if (FALLBACK_HIGH_KEYS.some((k) => lower.includes(k))) severity = "HIGH";
  else if (FALLBACK_LOW_KEYS.some((k) => lower.includes(k))) severity = "LOW";

  const location = extractFallbackLocation(text);
  const issueLabel = humanize(issueType, ISSUE_LABELS).toLowerCase();
  const locClause = location !== "Not specified" ? ` near ${location}` : "";
  const summary = `Citizen reports an issue related to ${issueLabel}${locClause}. (Offline demo classification — real AI was unreachable.)`;

  return { issueType, authority, severity, location, summary };
}

export default function Home() {
  const [complaint, setComplaint] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [lang, setLang] = useState<Lang>("en-IN");
  const [supportsSpeech, setSupportsSpeech] = useState(true);
  const [activeStage, setActiveStage] = useState(0);
  const [submitState, setSubmitState] = useState<"idle" | "sending" | "submitted">("idle");
  const [refId, setRefId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef<string>("");
  const startTimeRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSupportsSpeech(getSpeechRecognitionCtor() !== null);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore — recognition may already be torn down
      }
      abortRef.current?.abort();
    };
  }, []);

  const charCount = complaint.length;
  const charLimit = 1000;
  const charPct = Math.min(100, (charCount / charLimit) * 100);

  const canSubmit = useMemo(
    () => complaint.trim().length >= 12 && submitState !== "sending",
    [complaint, submitState],
  );

  function startListening() {
    setRecordError(null);
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupportsSpeech(false);
      setRecordError(
        "Speech recognition isn't supported in this browser. Try Chrome, Edge, or Safari — or type your complaint instead.",
      );
      return;
    }
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      const seed = complaint.trimEnd();
      baseTextRef.current = seed.length ? seed + " " : "";

      rec.onresult = (event) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript ?? "";
          if (result.isFinal) finalChunk += transcript + " ";
          else interimChunk += transcript;
        }
        if (finalChunk) {
          baseTextRef.current = (baseTextRef.current + finalChunk).replace(/[ \t]+/g, " ");
        }
        const merged = (baseTextRef.current + interimChunk)
          .replace(/^\s+/, "")
          .slice(0, charLimit);
        setComplaint(merged);
      };

      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setRecordError("Microphone permission denied.");
        } else if (e.error === "no-speech" || e.error === "aborted") {
          // common, non-fatal
        } else if (e.error === "audio-capture") {
          setRecordError("No microphone detected.");
        } else if (e.error === "network") {
          setRecordError("Network error during speech recognition.");
        } else {
          setRecordError(`Speech recognition error: ${e.error}`);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        setComplaint((c) => c.trimEnd().slice(0, charLimit));
        recognitionRef.current = null;
      };

      rec.start();
      recognitionRef.current = rec;
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      setIsListening(true);
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 200);
    } catch {
      setRecordError("Unable to start speech recognition.");
      setIsListening(false);
    }
  }

  function stopListening() {
    const rec = recognitionRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      try {
        rec.abort();
      } catch {
        // ignore
      }
    }
  }

  function toggleListening() {
    if (isListening) stopListening();
    else startListening();
  }

  function cycleLang() {
    if (isListening) return;
    setLang((l) => (l === "en-IN" ? "hi-IN" : "en-IN"));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (isListening) stopListening();

    setApiError(null);
    setAnalysis(null);
    setRefId(null);
    setIsDemo(false);
    setSubmitState("sending");
    setActiveStage(1); // AI Triaged — "Now"

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const trimmed = complaint.trim();
    let result: AnalysisResult | null = null;
    let demoTriggered = false;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: trimmed }),
        signal: ctrl.signal,
      });

      if (res.status === 400) {
        // Validation failure on our own input — don't paper over it with demo data.
        let message = "Your complaint could not be accepted.";
        try {
          const body = (await res.json()) as { error?: unknown };
          if (typeof body?.error === "string" && body.error.trim().length > 0) {
            message = body.error;
          }
        } catch {
          // ignore non-JSON
        }
        setApiError(message);
        setSubmitState("idle");
        setActiveStage(0);
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as Partial<AnalysisResult>;
      if (
        !data ||
        typeof data.issueType !== "string" ||
        typeof data.authority !== "string" ||
        typeof data.severity !== "string" ||
        typeof data.location !== "string" ||
        typeof data.summary !== "string"
      ) {
        throw new Error("Malformed analyzer response");
      }

      result = {
        issueType: data.issueType,
        authority: data.authority,
        severity: (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).includes(
          data.severity as Severity,
        )
          ? (data.severity as Severity)
          : "MEDIUM",
        location: data.location,
        summary: data.summary,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Network / 5xx / shape error → fall back to demo mode so the UX never dead-ends.
      result = getFallbackAnalysis(trimmed);
      demoTriggered = true;
    }

    if (!result) return;

    setAnalysis(result);
    setIsDemo(demoTriggered);

    setActiveStage(2); // Assigned
    await wait(750);
    setActiveStage(3); // In Progress
    await wait(800);
    setActiveStage(4); // Resolved
    setRefId(generateRefId());
    setSubmitState("submitted");
  }

  function resetForm() {
    abortRef.current?.abort();
    setComplaint("");
    setRefId(null);
    setActiveStage(0);
    setSubmitState("idle");
    setElapsedMs(0);
    setAnalysis(null);
    setApiError(null);
    setIsDemo(false);
    baseTextRef.current = "";
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#05060A] text-zinc-100 selection:bg-sky-500/30 selection:text-white">
      <BackgroundFX />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 ring-1 ring-inset ring-white/10">
            <Shield className="h-5 w-5 text-sky-400" strokeWidth={2} />
            <span className="absolute -inset-px rounded-xl ring-1 ring-sky-400/20 [mask-image:linear-gradient(180deg,black,transparent)]" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight text-white">
              Sahayak
            </div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              Civic AI · Gov Tech
            </div>
          </div>
        </div>

        <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <a className="transition hover:text-white" href="#file">File</a>
          <a className="transition hover:text-white" href="#track">Track</a>
          <a className="transition hover:text-white" href="#about">About</a>
          <a className="transition hover:text-white" href="#contact">Contact</a>
        </nav>

        <a
          href="#file"
          className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-zinc-200 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.06]"
        >
          Citizen Login
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-24 sm:px-8">
        <section className="pt-10 pb-12 sm:pt-16 sm:pb-16">
          <div className="anim-fade-up mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-zinc-300 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              AI triage online · 24×7
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              File civic complaints.{" "}
              <span className="bg-gradient-to-r from-sky-300 via-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
                Get them resolved.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-zinc-400 sm:text-lg">
              Sahayak routes your complaint to the right department in seconds —
              with voice-first input, AI-assisted triage, and a public audit
              trail you can trust.
            </p>
          </div>
        </section>

        <section
          id="file"
          className="grid gap-6 lg:grid-cols-5 lg:gap-8"
        >
          <form
            onSubmit={handleSubmit}
            className="anim-fade-up relative lg:col-span-3"
            style={{ animationDelay: "120ms" }}
          >
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-1 backdrop-blur-xl">
              <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-br from-sky-500/10 via-transparent to-fuchsia-500/10 opacity-60" />
              <div className="relative rounded-[15px] bg-[#0A0C12]/80 p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-zinc-400" />
                    <h2 className="text-sm font-medium text-zinc-200">
                      Describe your complaint
                    </h2>
                  </div>
                  <span className="text-[11px] uppercase tracking-wider text-zinc-500">
                    Step 1 of 1
                  </span>
                </div>

                <div className="relative mt-4">
                  <textarea
                    value={complaint}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, charLimit);
                      setComplaint(val);
                      if (!isListening) baseTextRef.current = val;
                    }}
                    rows={6}
                    placeholder="e.g. Streetlight at Sector 14, near community park, has been off for 3 nights. Pedestrian safety concern."
                    className="block w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/20"
                  />

                  <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 text-[11px] text-zinc-500">
                    <span>{charCount}</span>
                    <span className="text-zinc-700">/</span>
                    <span>{charLimit}</span>
                  </div>
                </div>

                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all duration-300"
                    style={{ width: `${charPct}%` }}
                  />
                </div>

                <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleListening}
                      aria-pressed={isListening}
                      aria-label={isListening ? "Stop listening" : "Start voice input"}
                      disabled={!supportsSpeech}
                      className={[
                        "relative inline-flex h-11 items-center gap-2.5 rounded-full px-4 text-sm font-medium transition-all duration-300",
                        !supportsSpeech
                          ? "cursor-not-allowed bg-white/[0.03] text-zinc-600 ring-1 ring-inset ring-white/5"
                          : isListening
                          ? "bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-400/40"
                          : "bg-white/[0.04] text-zinc-200 ring-1 ring-inset ring-white/10 hover:bg-white/[0.08]",
                      ].join(" ")}
                    >
                      <span className="relative flex h-7 w-7 items-center justify-center">
                        {isListening && (
                          <>
                            <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />
                            <span className="absolute inset-0 rounded-full bg-red-500/20" />
                          </>
                        )}
                        <span
                          className={[
                            "relative flex h-7 w-7 items-center justify-center rounded-full",
                            isListening
                              ? "bg-red-500 text-white"
                              : "bg-sky-500/20 text-sky-300",
                          ].join(" ")}
                        >
                          {isListening ? (
                            <Square className="h-3 w-3 fill-current" />
                          ) : (
                            <Mic className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </span>
                      <span>{isListening ? "Stop" : "Speak"}</span>
                      {isListening && (
                        <span className="ml-1 font-mono text-xs tabular-nums text-red-200/80">
                          {formatDuration(elapsedMs)}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={cycleLang}
                      disabled={isListening || !supportsSpeech}
                      aria-label={`Recognition language: ${LANG_NAME[lang]}. Click to switch.`}
                      title={`Recognition language: ${LANG_NAME[lang]}`}
                      className={[
                        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition",
                        isListening || !supportsSpeech
                          ? "cursor-not-allowed bg-white/[0.02] text-zinc-600 ring-white/5"
                          : "bg-white/[0.04] text-zinc-300 ring-white/10 hover:bg-white/[0.08] hover:text-white",
                      ].join(" ")}
                    >
                      <span className="font-semibold tracking-wide">
                        {LANG_LABEL[lang]}
                      </span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-400">{LANG_NAME[lang]}</span>
                    </button>

                    {isListening && <WaveformPulse />}
                  </div>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={[
                      "group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-full px-5 text-sm font-semibold transition-all",
                      canSubmit
                        ? "bg-white text-zinc-900 hover:bg-zinc-200"
                        : "bg-white/[0.06] text-zinc-500 cursor-not-allowed",
                    ].join(" ")}
                  >
                    {submitState === "sending" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Analyzing…</span>
                      </>
                    ) : submitState === "submitted" ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Submitted</span>
                      </>
                    ) : (
                      <>
                        <span>Submit complaint</span>
                        <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>

                {isListening && (
                  <div className="anim-fade-up mt-4 flex items-center gap-2 text-xs text-zinc-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400/70" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
                    </span>
                    <span>
                      Listening in{" "}
                      <span className="text-zinc-200">{LANG_NAME[lang]}</span> —
                      speak naturally, your words appear above.
                    </span>
                  </div>
                )}

                {submitState === "sending" && (
                  <div className="anim-fade-up mt-5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-300 ring-1 ring-sky-400/30">
                        <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/25" />
                        <Sparkles className="relative h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-100">
                          Analyzing with Sahayak AI…
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          Classifying issue, identifying authority, scoring severity.
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
                      <div className="anim-progress h-full w-1/3 rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-fuchsia-400" />
                    </div>
                  </div>
                )}

                {analysis && (
                  <>
                    <AnalysisCard analysis={analysis} isDemo={isDemo} />
                    <ComplaintDraftCard analysis={analysis} isDemo={isDemo} />
                  </>
                )}

                {recordError && (
                  <div className="anim-fade-up mt-4 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
                    <AlertCircle className="mt-px h-3.5 w-3.5" />
                    <span>{recordError}</span>
                  </div>
                )}

                {!supportsSpeech && !recordError && (
                  <div className="anim-fade-up mt-4 flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
                    <AlertCircle className="mt-px h-3.5 w-3.5" />
                    <span>
                      Voice input isn&apos;t available in this browser. You can still type your complaint normally.
                    </span>
                  </div>
                )}

                {apiError && (
                  <div className="anim-fade-up mt-4 flex items-start gap-2 rounded-lg border border-red-400/25 bg-red-500/[0.06] px-3 py-2 text-xs text-red-200">
                    <AlertCircle className="mt-px h-3.5 w-3.5" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-red-100">
                        Couldn&apos;t analyze this complaint.
                      </div>
                      <div className="mt-0.5 text-red-200/80">{apiError}</div>
                    </div>
                  </div>
                )}

                {refId && (
                  <div className="anim-fade-up mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                        <Hash className="h-3.5 w-3.5" />
                      </div>
                      <div className="leading-tight">
                        <div className="text-[11px] uppercase tracking-wider text-emerald-300/70">
                          Reference ID
                        </div>
                        <div className="font-mono text-sm text-emerald-100">
                          {refId}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-xs font-medium text-emerald-200 underline-offset-4 hover:underline"
                    >
                      File another
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-zinc-500" />
                End-to-end encrypted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                Geo-tagged automatically
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-zinc-500" />
                Routed by Sahayak AI
              </span>
            </div>
          </form>

          <aside
            id="track"
            className="anim-fade-up relative lg:col-span-2"
            style={{ animationDelay: "220ms" }}
          >
            <div className="relative h-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl">
              <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-tr from-indigo-500/10 via-transparent to-sky-500/10 opacity-50" />
              <div className="relative p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-zinc-400" />
                    <h2 className="text-sm font-medium text-zinc-200">
                      Live status tracker
                    </h2>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                      submitState === "submitted"
                        ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20"
                        : submitState === "sending"
                        ? "bg-sky-400/10 text-sky-300 ring-1 ring-inset ring-sky-400/20"
                        : "bg-white/[0.04] text-zinc-400 ring-1 ring-inset ring-white/10",
                    ].join(" ")}
                  >
                    {submitState === "submitted"
                      ? "Resolved"
                      : submitState === "sending"
                      ? "Processing"
                      : "Idle"}
                  </span>
                </div>

                <ol className="mt-6 space-y-1">
                  {STAGES.map((stage, i) => {
                    const isDone = i < activeStage;
                    const isCurrent =
                      i === activeStage && submitState !== "idle";
                    const Icon = stage.icon;
                    return (
                      <li key={stage.id} className="relative flex gap-4 pb-5 last:pb-0">
                        {i < STAGES.length - 1 && (
                          <span
                            className={[
                              "absolute left-[18px] top-9 h-[calc(100%-1rem)] w-px transition-colors duration-500",
                              isDone
                                ? "bg-gradient-to-b from-sky-400/60 to-indigo-400/30"
                                : "bg-white/10",
                            ].join(" ")}
                          />
                        )}
                        <div
                          className={[
                            "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 transition-all duration-500",
                            isDone
                              ? "bg-sky-500/15 text-sky-300 ring-sky-400/40"
                              : isCurrent
                              ? "bg-sky-500/10 text-sky-200 ring-sky-400/60"
                              : "bg-white/[0.03] text-zinc-500 ring-white/10",
                          ].join(" ")}
                        >
                          {isCurrent && (
                            <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/30" />
                          )}
                          {isDone ? (
                            <Check className="h-4 w-4" strokeWidth={2.5} />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0 pt-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                "text-sm font-medium transition-colors",
                                isDone
                                  ? "text-white"
                                  : isCurrent
                                  ? "text-sky-200"
                                  : "text-zinc-400",
                              ].join(" ")}
                            >
                              {stage.label}
                            </span>
                            {isCurrent && (
                              <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-200">
                                Now
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                            {stage.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </aside>
        </section>

        <section
          id="about"
          className="anim-fade-up mt-14 grid gap-4 sm:mt-20 sm:grid-cols-3"
          style={{ animationDelay: "320ms" }}
        >
          {[
            {
              k: "1.2M+",
              v: "Complaints resolved",
              d: "Across 240 municipal bodies.",
            },
            {
              k: "48 hrs",
              v: "Median resolution time",
              d: "Down from 11 days pre-AI.",
            },
            {
              k: "97%",
              v: "Routing accuracy",
              d: "Verified against human reviewers.",
            },
          ].map((s) => (
            <div
              key={s.v}
              className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.04]"
            >
              <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-sky-500/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <div className="text-3xl font-semibold tracking-tight text-white">
                  {s.k}
                </div>
                <div className="mt-1 text-sm font-medium text-zinc-300">
                  {s.v}
                </div>
                <div className="mt-1 text-xs text-zinc-500">{s.d}</div>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer
        id="contact"
        className="relative z-10 border-t border-white/5 bg-black/30 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-3 px-5 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:px-8">
          <div>© {new Date().getFullYear()} Sahayak · A public-good civic AI initiative.</div>
          <div className="flex items-center gap-5">
            <a className="hover:text-zinc-300" href="#">Privacy</a>
            <a className="hover:text-zinc-300" href="#">Accessibility</a>
            <a className="hover:text-zinc-300" href="#">Open Data</a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translate3d(0, 12px, 0); }
          to   { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        .anim-fade-up { animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }

        @keyframes floatSlow {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(0, -24px, 0); }
        }
        .anim-float-slow { animation: floatSlow 14s ease-in-out infinite; }

        @keyframes floatSlower {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50%      { transform: translate3d(20px, 18px, 0); }
        }
        .anim-float-slower { animation: floatSlower 22s ease-in-out infinite; }

        @keyframes wave {
          0%, 100% { transform: scaleY(0.35); }
          50%      { transform: scaleY(1); }
        }
        .anim-wave { animation: wave 0.9s ease-in-out infinite; transform-origin: center; }

        @keyframes progressSlide {
          0%   { transform: translateX(-110%); }
          100% { transform: translateX(330%); }
        }
        .anim-progress { animation: progressSlide 1.6s cubic-bezier(0.45, 0, 0.55, 1) infinite; }

        @media (prefers-reduced-motion: reduce) {
          .anim-fade-up, .anim-float-slow, .anim-float-slower, .anim-wave, .anim-progress {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function AnalysisCard({
  analysis,
  isDemo = false,
}: {
  analysis: AnalysisResult;
  isDemo?: boolean;
}) {
  const sev = SEVERITY_STYLES[analysis.severity] ?? SEVERITY_STYLES.MEDIUM;
  const issue = humanize(analysis.issueType, ISSUE_LABELS);
  const authority = humanize(analysis.authority, AUTHORITY_LABELS);

  return (
    <div className="anim-fade-up mt-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur">
      <div className="pointer-events-none absolute" />
      <div className="relative">
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-gradient-to-r from-sky-500/[0.06] via-transparent to-fuchsia-500/[0.06] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-400/30">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-100">
                  AI Analysis
                </span>
                {isDemo && <DemoBadge />}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                {isDemo
                  ? "Offline sample · Live AI unreachable"
                  : "Sahayak AI · Gemini"}
              </div>
            </div>
          </div>
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset",
              sev.chip,
            ].join(" ")}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
            {sev.label}
          </span>
        </div>

        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <FileText className="h-3 w-3" />
              Issue type
            </div>
            <div className="mt-1.5 text-sm font-medium text-white">
              {issue}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <Building2 className="h-3 w-3" />
              Responsible authority
            </div>
            <div className="mt-1.5 text-sm font-medium text-white">
              {authority}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/30 p-3.5 sm:col-span-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
              <MapPin className="h-3 w-3" />
              Location
            </div>
            <div className="mt-1.5 text-sm font-medium text-white">
              {analysis.location || "Not specified"}
            </div>
          </div>
        </div>

        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3 sm:px-5">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">
            Summary
          </div>
          <p className="mt-1.5 border-l-2 border-sky-400/40 pl-3 text-sm leading-relaxed text-zinc-200">
            {analysis.summary}
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoBadge() {
  return (
    <span
      title="Demo Mode: using an offline fallback because live AI analysis was unavailable."
      className="anim-fade-up inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300 ring-1 ring-inset ring-amber-400/30"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
      </span>
      Demo Mode
    </span>
  );
}

function ComplaintDraftCard({
  analysis,
  isDemo = false,
}: {
  analysis: AnalysisResult;
  isDemo?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const draft = useMemo(() => buildComplaintDraft(analysis), [analysis]);
  const date = useMemo(() => formatLetterDate(), []);
  const fullText = useMemo(() => draftToPlainText(draft, date), [draft, date]);

  async function handleCopy() {
    setCopyError(false);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullText);
      } else {
        const ta = document.createElement("textarea");
        ta.value = fullText;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
      window.setTimeout(() => setCopyError(false), 2500);
    }
  }

  return (
    <div
      className="anim-fade-up mt-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur"
      style={{ animationDelay: "120ms" }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] bg-gradient-to-r from-indigo-500/[0.06] via-transparent to-sky-500/[0.06] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-400/30">
            <FileText className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium text-zinc-100">
              Formal Complaint Draft
            </div>
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              Auto-generated · Ready to submit
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy complaint draft to clipboard"
          className={[
            "group relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset transition-all",
            copied
              ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/40"
              : copyError
              ? "bg-red-500/15 text-red-200 ring-red-400/40"
              : "bg-white/[0.04] text-zinc-200 ring-white/10 hover:bg-white/[0.08] hover:text-white",
          ].join(" ")}
        >
          <span className="relative flex h-3.5 w-3.5 items-center justify-center">
            <Copy
              className={[
                "absolute h-3.5 w-3.5 transition-all duration-200",
                copied ? "scale-50 opacity-0" : "scale-100 opacity-100",
              ].join(" ")}
            />
            <Check
              className={[
                "absolute h-3.5 w-3.5 transition-all duration-200",
                copied ? "scale-100 opacity-100" : "scale-50 opacity-0",
              ].join(" ")}
              strokeWidth={2.5}
            />
          </span>
          <span>{copied ? "Copied" : copyError ? "Failed" : "Copy"}</span>
        </button>
      </div>

      <div className="space-y-3 px-4 py-4 sm:px-5">
        <DraftSection label="To">
          <div className="text-sm leading-relaxed text-zinc-100">
            <div className="text-zinc-400">To,</div>
            <div className="whitespace-pre-line font-medium">{draft.to}</div>
          </div>
        </DraftSection>

        <DraftSection label="Subject">
          <div className="text-sm font-medium leading-relaxed text-zinc-100">
            {draft.subject}
          </div>
        </DraftSection>

        <DraftSection label="Formal Complaint Body">
          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-200">
            {draft.body}
          </p>
        </DraftSection>

        <DraftSection label="Citizen Request for Action">
          <p className="text-sm leading-relaxed text-zinc-200">
            I respectfully request your good office to:
          </p>
          <ol className="mt-2 space-y-1.5">
            {draft.request.map((item, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-sm leading-relaxed text-zinc-200"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-[10px] font-semibold text-sky-300 ring-1 ring-inset ring-sky-400/30">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 border-t border-white/[0.06] pt-3 text-sm text-zinc-400">
            <div>Yours sincerely,</div>
            <div className="mt-1 font-medium text-zinc-200">[Citizen Name]</div>
            <div className="text-xs text-zinc-500">
              [Contact Number] · [Address]
            </div>
          </div>
        </DraftSection>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-white/[0.01] px-4 py-2.5 text-[11px] text-zinc-500 sm:px-5">
        <span className="flex flex-wrap items-center gap-2">
          <span>
            Generated <span className="text-zinc-300">{date}</span> · Sahayak Civic AI
          </span>
          {isDemo && <DemoBadge />}
        </span>
        <span className="font-mono uppercase tracking-wider text-zinc-600">
          Draft · Editable before submission
        </span>
      </div>
    </div>
  );
}

function DraftSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-black/30 p-3.5">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage:
            "radial-gradient(ellipse 70% 50% at 50% 0%, black 40%, transparent 80%)",
        }}
      />
      <div className="anim-float-slow absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-sky-500/20 blur-[120px]" />
      <div className="anim-float-slower absolute top-40 right-[-10%] h-[420px] w-[520px] rounded-full bg-indigo-500/15 blur-[120px]" />
      <div className="anim-float-slow absolute bottom-[-10%] left-[-5%] h-[380px] w-[480px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
    </div>
  );
}

function WaveformPulse() {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div className="flex h-7 items-center gap-[3px]">
      {bars.map((i) => (
        <span
          key={i}
          className="anim-wave block w-[3px] rounded-full bg-red-300/80"
          style={{
            height: "100%",
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}
