import { NextResponse } from "next/server";
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const ISSUE_TYPES = [
  "ROAD_AND_POTHOLES",
  "STREETLIGHT",
  "WATER_SUPPLY",
  "DRAINAGE_AND_SEWAGE",
  "GARBAGE_AND_SANITATION",
  "ELECTRICITY",
  "PUBLIC_TRANSPORT",
  "TRAFFIC_AND_PARKING",
  "ENCROACHMENT",
  "STRAY_ANIMALS",
  "PARKS_AND_PUBLIC_SPACES",
  "POLLUTION_AIR",
  "POLLUTION_NOISE",
  "POLLUTION_WATER",
  "PUBLIC_HEALTH",
  "LAW_AND_ORDER",
  "BUILDING_AND_CONSTRUCTION",
  "PROPERTY_TAX_AND_REVENUE",
  "EDUCATION",
  "OTHER",
] as const;

const AUTHORITIES = [
  "MUNICIPAL_CORPORATION",
  "PWD",
  "WATER_BOARD",
  "ELECTRICITY_DISCOM",
  "POLICE",
  "TRAFFIC_POLICE",
  "RTO",
  "POLLUTION_CONTROL_BOARD",
  "HEALTH_DEPARTMENT",
  "EDUCATION_DEPARTMENT",
  "DISTRICT_ADMINISTRATION",
  "GRAM_PANCHAYAT",
  "FIRE_DEPARTMENT",
  "FOREST_DEPARTMENT",
  "RAILWAYS",
  "OTHER",
] as const;

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

type IssueType = (typeof ISSUE_TYPES)[number];
type Authority = (typeof AUTHORITIES)[number];
type Severity = (typeof SEVERITIES)[number];

type AnalysisResult = {
  issueType: IssueType;
  authority: Authority;
  severity: Severity;
  location: string;
  summary: string;
};

const responseSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    issueType: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...ISSUE_TYPES],
      description: "Canonical category of the civic complaint.",
    },
    authority: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...AUTHORITIES],
      description: "Government body most likely responsible for resolution.",
    },
    severity: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...SEVERITIES],
      description:
        "Urgency. CRITICAL = imminent danger to life/safety. HIGH = serious disruption. MEDIUM = ongoing inconvenience. LOW = minor.",
    },
    location: {
      type: SchemaType.STRING,
      description:
        "Specific location extracted from the complaint (landmark, area, sector, road, city). Use 'Not specified' if absent.",
    },
    summary: {
      type: SchemaType.STRING,
      description:
        "One-sentence neutral English summary of the complaint suitable for a municipal ticket.",
    },
  },
  required: ["issueType", "authority", "severity", "location", "summary"],
};

const SYSTEM_INSTRUCTION = `You are Sahayak Civic-AI, an analyst that triages citizen complaints filed against Indian municipal and state authorities. You receive a single complaint in Hindi, English, or Hinglish (often colloquial, often with spelling errors, often code-switched) and produce a structured triage record.

Your job:
1) Identify the underlying civic issue, ignoring filler, emotional language, and personal opinions.
2) Choose the single most likely responsible authority in the Indian governance context.
3) Assign an urgency level using the rubric below.
4) Extract a concrete location (landmark, area, sector, ward, road, city) verbatim if possible; otherwise "Not specified".
5) Write a one-sentence neutral English summary suitable for a government ticket.

Authority mapping reference (use the closest match):
- ROAD_AND_POTHOLES, ENCROACHMENT, building/road repair, footpath -> PWD or MUNICIPAL_CORPORATION (use PWD for highways/major roads, MUNICIPAL_CORPORATION for city streets).
- STREETLIGHT, GARBAGE_AND_SANITATION, DRAINAGE_AND_SEWAGE, PARKS_AND_PUBLIC_SPACES, STRAY_ANIMALS, PROPERTY_TAX_AND_REVENUE -> MUNICIPAL_CORPORATION (or GRAM_PANCHAYAT for rural).
- WATER_SUPPLY (leak, no water, contamination) -> WATER_BOARD (e.g. Delhi Jal Board, BWSSB) or MUNICIPAL_CORPORATION if no separate utility.
- ELECTRICITY (power cut, sparking wires, transformer issues) -> ELECTRICITY_DISCOM (BSES, Tata Power, MSEDCL, etc.).
- PUBLIC_TRANSPORT (bus, metro, auto fares) -> RTO or DISTRICT_ADMINISTRATION; for railways -> RAILWAYS.
- TRAFFIC_AND_PARKING, illegal parking, signal failure -> TRAFFIC_POLICE.
- LAW_AND_ORDER, theft, harassment, public nuisance -> POLICE.
- POLLUTION_AIR / POLLUTION_NOISE / POLLUTION_WATER -> POLLUTION_CONTROL_BOARD (CPCB/SPCB).
- PUBLIC_HEALTH (dengue, sanitation outbreak, hospital issues) -> HEALTH_DEPARTMENT.
- EDUCATION -> EDUCATION_DEPARTMENT.
- Fire incidents -> FIRE_DEPARTMENT.
- Forest/wildlife -> FOREST_DEPARTMENT.
- Anything genuinely unclear -> OTHER.

Severity rubric:
- CRITICAL: imminent risk to life or large groups (live wires, collapsed structures, sewage flooding into homes, gas leak, fire, contaminated drinking water supply, accidents).
- HIGH: serious safety hazard or service outage affecting many (pothole on busy road, prolonged blackout, large garbage pile-up near school/hospital, water main burst).
- MEDIUM: ongoing inconvenience for a neighbourhood (streetlight off for days, irregular garbage pickup, intermittent water).
- LOW: minor or aesthetic (faded zebra crossing, single overflowing bin, stray litter).

Strict rules:
- Output ONLY the JSON object matching the provided schema. No prose, no markdown, no code fences, no leading or trailing text.
- All enum values must be one of the allowed constants exactly as written.
- The 'summary' field must be in English even if the complaint is in Hindi/Hinglish.
- If the complaint is empty, gibberish, or not a civic issue, return issueType "OTHER", authority "OTHER", severity "LOW", location "Not specified", and a summary explaining it could not be classified.
- Never invent details that the complaint does not state. If the location is unclear, write "Not specified".`;

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function serverError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function isValidAnalysis(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.issueType === "string" &&
    (ISSUE_TYPES as readonly string[]).includes(v.issueType) &&
    typeof v.authority === "string" &&
    (AUTHORITIES as readonly string[]).includes(v.authority) &&
    typeof v.severity === "string" &&
    (SEVERITIES as readonly string[]).includes(v.severity) &&
    typeof v.location === "string" &&
    typeof v.summary === "string" &&
    v.summary.length > 0
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return serverError(
      "Server misconfiguration: GEMINI_API_KEY is not set.",
      500,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Request body must be valid JSON.");
  }

  if (!body || typeof body !== "object") {
    return badRequest("Request body must be a JSON object.");
  }

  const complaintRaw = (body as { complaint?: unknown }).complaint;
  if (typeof complaintRaw !== "string") {
    return badRequest("'complaint' is required and must be a string.");
  }

  const complaint = complaintRaw.trim();
  if (complaint.length < 4) {
    return badRequest("'complaint' is too short to analyze.");
  }
  if (complaint.length > 4000) {
    return badRequest("'complaint' exceeds the 4000 character limit.");
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.2,
        topP: 0.9,
        maxOutputTokens: 1024,
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: `CITIZEN COMPLAINT:\n"""\n${complaint}\n"""` }],
        },
      ],
    });

    const text = result.response.text();
    if (!text) {
      throw new HttpError(502, "Gemini returned an empty response.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new HttpError(
        502,
        "Gemini returned a response that was not valid JSON.",
      );
    }

    if (!isValidAnalysis(parsed)) {
      throw new HttpError(
        502,
        "Gemini response did not match the expected schema.",
      );
    }

    return NextResponse.json(parsed, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return serverError(err.message, err.status);
    }
    const message =
      err instanceof Error ? err.message : "Unknown error during analysis.";
    console.error("[analyze] Gemini call failed:", message);
    return serverError("Failed to analyze complaint.", 502);
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method Not Allowed. Use POST with a JSON body." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
