import { Platform } from "react-native";
import { API_BASE_URL } from "./env";
import { error as logError } from "./logger";
import { getAuthToken } from "./auth";

const isWeb = Platform.OS === "web";
const DEFAULT_TIMEOUT_MS = 15000;

// ── Web mock data — Abebe Metaferia Alemey @ Zelalem Hospital ────────────
// Returns realistic clinical data without hitting the real API (blocked by CORS on web).
const WEB_MOCK_RESPONSES = {
  "/auth/profile": {
    id: "demo-patient-abebe-001",
    role: "patient",
    full_name: "Abebe Metaferia Alemey",
    first_name: "Abebe",
    last_name: "Alemey",
    email: "abebe.metaferia@linkhc.org",
    phone: "+251911000001",
    facility_id: "demo-facility-zelalem-001",
    facility_name: "Zelalem Hospital",
  },
  "/mobile/patient/active-visit": {
    patient: {
      id: "demo-patient-abebe-001",
      full_name: "Abebe Metaferia Alemey",
      first_name: "Abebe",
      last_name: "Alemey",
      date_of_birth: "1985-06-20",
      sex: "male",
      phone: "+251911000001",
      village: "Kirkos",
      kebele: "Kebele 03",
      woreda: "Kirkos",
    },
    activeVisit: {
      id: "demo-triage-visit-001",
      facility_id: "demo-facility-zelalem-001",
      facility_name: "Zelalem Hospital",
      visit_date: new Date().toISOString(),
      visit_type: "outpatient",
      status: "at_pharmacy",
      current_journey_stage: "at_pharmacy",
      chief_complaint: "Fever, difficulty breathing",
      priority: "urgent",
      provider: "Dr. Kebede",
      notes: "Diagnosed with acute bronchitis. Prescribed amoxicillin 500mg TID x7 days + paracetamol PRN. Lab CBC normal, CRP mildly elevated. SpO2 improved to 97% post-nebulization.",
      vitals: {
        bp_systolic: 128,
        bp_diastolic: 82,
        heart_rate: 88,
        temperature: 37.2,
        weight_kg: 54,
        height_cm: 161,
        spo2_pct: 97,
        respiratory_rate: 18,
      },
      orders: {
        lab: [
          { id: "lo-001", test_name: "Complete Blood Count (CBC)", status: "completed", payment_status: "paid" },
          { id: "lo-002", test_name: "C-Reactive Protein (CRP)", status: "completed", payment_status: "paid" },
        ],
        imaging: [],
        medication: [
          { id: "mo-001", medication_name: "Amoxicillin 500mg", status: "dispensing", payment_status: "paid" },
          { id: "mo-002", medication_name: "Paracetamol 500mg", status: "dispensing", payment_status: "paid" },
        ],
      },
      journey_timeline: [
        { stage: "registered", arrived_at: new Date(Date.now() - 180 * 60000).toISOString(), completed_at: new Date(Date.now() - 170 * 60000).toISOString(), wait_time_minutes: 5, notes: "Patient registered at reception" },
        { stage: "at_triage", arrived_at: new Date(Date.now() - 170 * 60000).toISOString(), completed_at: new Date(Date.now() - 155 * 60000).toISOString(), wait_time_minutes: 10, notes: "Triage complete — urgent priority assigned" },
        { stage: "vitals_taken", arrived_at: new Date(Date.now() - 155 * 60000).toISOString(), completed_at: new Date(Date.now() - 145 * 60000).toISOString(), wait_time_minutes: 5, notes: "Vitals recorded: temp 38.4°C, SpO2 93%, BP 138/88" },
        { stage: "with_doctor", arrived_at: new Date(Date.now() - 145 * 60000).toISOString(), completed_at: new Date(Date.now() - 110 * 60000).toISOString(), wait_time_minutes: 20, notes: "Consultation with Dr. Kebede — acute bronchitis diagnosed" },
        { stage: "at_lab", arrived_at: new Date(Date.now() - 110 * 60000).toISOString(), completed_at: new Date(Date.now() - 60 * 60000).toISOString(), wait_time_minutes: 30, notes: "CBC and CRP tests completed — results normal/mild elevation" },
        { stage: "at_pharmacy", arrived_at: new Date(Date.now() - 15 * 60000).toISOString(), completed_at: null, wait_time_minutes: null, notes: "Awaiting medication dispensing — amoxicillin + paracetamol" },
      ],
    },
  },
  "/mobile/patient/stats": {
    totalVisits: 4,
    activeTasks: 2,
    visitsToday: 1,
  },
  "/mobile/patient/visit-history": {
    visits: [
      {
        id: "demo-triage-visit-001",
        facility_name: "Zelalem Hospital",
        date: new Date().toISOString(),
        status: "at_pharmacy",
        diagnosis: "Acute bronchitis — prescribed amoxicillin + paracetamol",
        provider: "Dr. Kebede",
        chief_complaint: "Fever, difficulty breathing",
        priority: "urgent",
      },
      {
        id: "v-hist-001",
        facility_name: "Zelalem Hospital",
        date: "2026-02-20T10:00:00Z",
        status: "completed",
        diagnosis: "Upper respiratory infection",
        provider: "Dr. Kebede",
        chief_complaint: "Persistent cough for 5 days",
        priority: "routine",
      },
      {
        id: "v-hist-002",
        facility_name: "Zelalem Hospital",
        date: "2025-12-05T14:30:00Z",
        status: "completed",
        diagnosis: "Routine check-up — all normal",
        provider: "Dr. Abebe",
        chief_complaint: "Annual physical",
        priority: "routine",
      },
    ],
  },
  "/mobile/patient/records": {
    records: [
      {
        id: "synced-visit-demo-001",
        source: "link_visit",
        synced: true,
        document_type: "visit_summary",
        record_kind: "visit_summary",
        document_date: "2026-03-10",
        provider_name: "Dr. Kebede",
        description: "Fever and cough. Diagnosis: Acute bronchitis. Outcome: referred.",
        tags: ["synced", "visit"],
        visit_id: "demo-triage-visit-001",
        visit_status: "at_pharmacy",
        file_url: null,
      },
      {
        id: "synced-rx-demo-001",
        source: "link_visit",
        synced: true,
        document_type: "prescription",
        record_kind: "prescription",
        document_date: "2026-03-10",
        provider_name: "Dr. Kebede",
        description: "Amoxicillin 500mg, Dose 500mg, TID, for 7 days (dispensed)",
        tags: ["synced", "prescription", "dispensed"],
        visit_id: "demo-triage-visit-001",
        visit_status: "at_pharmacy",
        file_url: null,
      },
      {
        id: "synced-lab-demo-001",
        source: "link_visit",
        synced: true,
        document_type: "lab_result",
        record_kind: "lab_result",
        document_date: "2026-03-10",
        provider_name: "Dr. Kebede",
        description: "Complete Blood Count (CBC): Mild leukocytosis",
        tags: ["synced", "lab", "completed"],
        visit_id: "demo-triage-visit-001",
        visit_status: "at_pharmacy",
        file_url: null,
      },
      {
        id: "synced-referral-demo-001",
        source: "link_visit",
        synced: true,
        document_type: "referral_summary",
        record_kind: "referral_summary",
        document_date: "2026-03-10",
        provider_name: "Dr. Kebede",
        description: "Referral summary to Zelalem Hospital (urgent) Reason: Persistent respiratory distress.",
        tags: ["synced", "referral", "urgent"],
        visit_id: "demo-triage-visit-001",
        visit_status: "at_pharmacy",
        file_url: null,
      },
    ],
    counts: {
      visitSummaries: 1,
      prescriptions: 1,
      labResults: 1,
      referralSummaries: 1,
    },
  },

  // ── HEW: Patient Search & Caseload (Zelalem Hospital) ──────────────────
  // All patients registered at Zelalem Hospital, accessible to HEW Birtukan
  "/patients/search": {
    patients: [
      { id: "demo-patient-abebe-001", full_name: "Abebe Metaferia Alemey", first_name: "Abebe", last_name: "Alemey", phone: "+251911000001", date_of_birth: "1985-06-20", sex: "male", kebele: "Kebele 03", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
      { id: "p-tigist-001", full_name: "Tigist Alemu", first_name: "Tigist", last_name: "Alemu", phone: "+251911100010", date_of_birth: "1992-01-12", sex: "female", kebele: "Kebele 05", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
      { id: "p-almaz-001", full_name: "Almaz Bekele", first_name: "Almaz", last_name: "Bekele", phone: "+251911100001", date_of_birth: "1990-03-15", sex: "female", kebele: "Kebele 05", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
      { id: "p-dawit-001", full_name: "Dawit Haile", first_name: "Dawit", last_name: "Haile", phone: "+251911100002", date_of_birth: "1988-07-22", sex: "male", kebele: "Kebele 03", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
      { id: "p-fatuma-001", full_name: "Fatuma Ahmed", first_name: "Fatuma", last_name: "Ahmed", phone: "+251911100003", date_of_birth: "1995-11-08", sex: "female", kebele: "Kebele 01", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
      { id: "p-solomon-001", full_name: "Solomon Gebre", first_name: "Solomon", last_name: "Gebre", phone: "+251911100004", date_of_birth: "1978-09-30", sex: "male", kebele: "Kebele 02", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
      { id: "p-meron-001", full_name: "Meron Tadesse", first_name: "Meron", last_name: "Tadesse", phone: "+251911100005", date_of_birth: "1998-04-25", sex: "female", kebele: "Kebele 04", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
      { id: "p-yonas-001", full_name: "Yonas Kebede", first_name: "Yonas", last_name: "Kebede", phone: "+251911100006", date_of_birth: "1983-12-03", sex: "male", kebele: "Kebele 06", woreda: "Kirkos", facility_id: "demo-facility-zelalem-001", facility_name: "Zelalem Hospital" },
    ],
  },
  // Facility patients endpoint — returns all patients when no search query
  "/hew/facility-patients": {
    patients: [
      { id: "demo-patient-abebe-001", full_name: "Abebe Metaferia Alemey", first_name: "Abebe", last_name: "Alemey", phone: "+251911000001", date_of_birth: "1985-06-20", sex: "male", kebele: "Kebele 03", woreda: "Kirkos" },
      { id: "p-tigist-001", full_name: "Tigist Alemu", first_name: "Tigist", last_name: "Alemu", phone: "+251911100010", date_of_birth: "1992-01-12", sex: "female", kebele: "Kebele 05", woreda: "Kirkos" },
      { id: "p-almaz-001", full_name: "Almaz Bekele", first_name: "Almaz", last_name: "Bekele", phone: "+251911100001", date_of_birth: "1990-03-15", sex: "female", kebele: "Kebele 05", woreda: "Kirkos" },
      { id: "p-dawit-001", full_name: "Dawit Haile", first_name: "Dawit", last_name: "Haile", phone: "+251911100002", date_of_birth: "1988-07-22", sex: "male", kebele: "Kebele 03", woreda: "Kirkos" },
      { id: "p-fatuma-001", full_name: "Fatuma Ahmed", first_name: "Fatuma", last_name: "Ahmed", phone: "+251911100003", date_of_birth: "1995-11-08", sex: "female", kebele: "Kebele 01", woreda: "Kirkos" },
      { id: "p-solomon-001", full_name: "Solomon Gebre", first_name: "Solomon", last_name: "Gebre", phone: "+251911100004", date_of_birth: "1978-09-30", sex: "male", kebele: "Kebele 02", woreda: "Kirkos" },
      { id: "p-meron-001", full_name: "Meron Tadesse", first_name: "Meron", last_name: "Tadesse", phone: "+251911100005", date_of_birth: "1998-04-25", sex: "female", kebele: "Kebele 04", woreda: "Kirkos" },
      { id: "p-yonas-001", full_name: "Yonas Kebede", first_name: "Yonas", last_name: "Kebede", phone: "+251911100006", date_of_birth: "1983-12-03", sex: "male", kebele: "Kebele 06", woreda: "Kirkos" },
    ],
  },
  "/hew/caseload": {
    patients: [
      { id: "p-almaz-001", full_name: "Almaz Bekele", phone: "+251911100001", follow_up_due: "2026-03-04", status: "overdue" },
      { id: "p-tigist-001", full_name: "Tigist Alemu", phone: "+251911100010", follow_up_due: "2026-03-06", status: "due" },
      { id: "p-dawit-001", full_name: "Dawit Haile", phone: "+251911100002", follow_up_due: "2026-03-07", status: "due" },
      { id: "p-solomon-001", full_name: "Solomon Gebre", phone: "+251911100004", follow_up_due: "2026-03-03", status: "overdue" },
      { id: "p-meron-001", full_name: "Meron Tadesse", phone: "+251911100005", follow_up_due: "2026-03-10", status: "due" },
    ],
  },

  // ── Patient Portal: Facilities ──────────────────────────────────────────
  "/patient-portal/facilities": {
    facilities: [
      { id: "demo-facility-zelalem-001", name: "Zelalem Hospital", phone_number: "+251911222333", address: "Kirkos, Addis Ababa", facility_type: "hospital", operating_hours: "Mon-Sat 7AM-8PM", accepts_walk_ins: true, verified: true },
      { id: "fac-addis-001", name: "Addis Clinic", phone_number: "+251911333444", address: "Bole, Addis Ababa", facility_type: "clinic", operating_hours: "Mon-Fri 8AM-6PM", accepts_walk_ins: true, verified: true },
      { id: "fac-central-001", name: "Central Health Center", phone_number: "+251911444555", address: "Arada, Addis Ababa", facility_type: "health_center", operating_hours: "Mon-Fri 8AM-5PM", accepts_walk_ins: false, verified: true },
    ],
  },
  "/facilities/public": {
    facilities: [
      {
        id: "demo-facility-zelalem-001",
        name: "Zelalem Hospital",
        phone_number: "+251911222333",
        address: "Kirkos, Addis Ababa",
        location: "Kirkos",
        facility_type: "hospital",
        operating_hours: "Mon-Sat 7AM-8PM",
        accepts_walk_ins: true,
        verified: true,
        workspace: {
          workspaceType: "clinic",
          setupMode: "recommended",
          teamMode: "small_team",
          enabledModules: ["core", "patient_portal", "appointments"],
        },
      },
      {
        id: "fac-addis-001",
        name: "Addis Clinic",
        phone_number: "+251911333444",
        address: "Bole, Addis Ababa",
        location: "Bole",
        facility_type: "clinic",
        operating_hours: "Mon-Fri 8AM-6PM",
        accepts_walk_ins: true,
        verified: true,
        workspace: {
          workspaceType: "provider",
          setupMode: "recommended",
          teamMode: "solo",
          enabledModules: ["core", "patient_portal"],
        },
      },
      {
        id: "fac-central-001",
        name: "Central Health Center",
        phone_number: "+251911444555",
        address: "Arada, Addis Ababa",
        location: "Arada",
        facility_type: "health_center",
        operating_hours: "Mon-Fri 8AM-5PM",
        accepts_walk_ins: false,
        verified: true,
        workspace: {
          workspaceType: "clinic",
          setupMode: "recommended",
          teamMode: "small_team",
          enabledModules: ["core", "patient_portal"],
        },
      },
    ],
    total: 3,
  },

  // ── Patient Portal: Appointments ────────────────────────────────────────
  "/patient-portal/appointments": {
    appointments: [
      {
        id: "apt-001",
        facility_id: "demo-facility-zelalem-001",
        requested_date: "2026-03-15",
        requested_time_slot: "morning",
        reason: "Follow-up consultation for respiratory symptoms",
        status: "confirmed",
        created_at: "2026-03-05T10:00:00Z",
        facilities: { name: "Zelalem Hospital", phone_number: "+251911222333" },
      },
      {
        id: "apt-002",
        facility_id: "fac-addis-001",
        requested_date: "2026-03-20",
        requested_time_slot: "afternoon",
        reason: "Lab test review",
        status: "pending",
        created_at: "2026-03-04T14:00:00Z",
        facilities: { name: "Addis Clinic", phone_number: "+251911333444" },
      },
    ],
  },

  // ── Patient Portal: Consent ─────────────────────────────────────────────
  "/patient-portal/consents/grant": { success: true, created: true, consentId: "consent-new-001" },
  "/patient-portal/consents/revoke": { success: true, revoked: true },
  "/patient-portal/consents/history": {
    history: [
      { id: "hist-001", consentId: "consent-001", facilityId: "demo-facility-zelalem-001", facilityName: "Zelalem Hospital", consentType: "records_access", action: "grant", reason: null, createdAt: "2026-01-15T10:00:00Z", metadata: { comprehensionLanguage: "en", providerTargetType: "facility_care_team" } },
      { id: "hist-002", consentId: "consent-002", facilityId: "fac-addis-001", facilityName: "Addis Clinic", consentType: "records_access", action: "grant", reason: null, createdAt: "2026-02-01T09:30:00Z", metadata: { comprehensionLanguage: "am", providerTargetType: "facility_care_team" } },
    ],
  },

  // ── Patient Portal: Documents ───────────────────────────────────────────
  "/patient-portal/documents": {
    documents: [
      { id: "doc-001", document_type: "prescription", provider_name: "Dr. Abebe", document_date: "2026-02-20", description: "Antibiotic prescription for respiratory infection", tags: ["infection", "fever"], file_url: "https://example.com/doc-001.pdf", uploaded_at: "2026-02-21T10:00:00Z" },
      { id: "doc-002", document_type: "lab_result", provider_name: "Lab Technician", document_date: "2026-02-15", description: "Complete blood count results", tags: ["blood", "lab"], file_url: "https://example.com/doc-002.pdf", uploaded_at: "2026-02-16T14:00:00Z" },
      { id: "doc-003", document_type: "vaccination", provider_name: "Health Officer", document_date: "2025-12-10", description: "COVID-19 booster vaccination record", tags: ["vaccination", "covid"], file_url: "https://example.com/doc-003.pdf", uploaded_at: "2025-12-11T09:00:00Z" },
    ],
  },
  "/ai/link-agent/interaction": {
    success: true,
    agent: {
      model: "link_agent_v1",
      surface: "patient",
      intent: "symptom_assessment",
      status: "generated",
      safeMode: true,
      source: "local_ai",
    },
    message: "Link Agent generated symptom guidance.",
    content: {
      response: "እባክዎን ብዙ ውሃ ይጠጡ፣ እና ምልክቶቹ ከባድ ከሆኑ ወደ ቅርብ ክሊኒክ ይሂዱ።",
      urgency: "clinic_soon",
      nextSteps: ["Hydrate well", "Seek care if symptoms worsen"],
      safetyNotes: ["This guidance does not replace clinician assessment."],
    },
  },
  "/ai/link-agent/interaction-public": {
    success: true,
    agent: {
      model: "link_agent_v1",
      surface: "patient",
      intent: "symptom_assessment",
      status: "generated",
      safeMode: true,
      source: "local_ai",
    },
    message: "Link Agent generated symptom guidance.",
    content: {
      response: "እባክዎን ብዙ ውሃ ይጠጡ፣ እና ምልክቶቹ ከባድ ከሆኑ ወደ ቅርብ ክሊኒክ ይሂዱ።",
      urgency: "clinic_soon",
      nextSteps: ["Hydrate well", "Seek care if symptoms worsen"],
      safetyNotes: ["This guidance does not replace clinician assessment."],
    },
  },
};

/**
 * On web, intercept API calls and return mock data to avoid CORS failures.
 */
const webMockRequest = (path) => {
  // Strip query params for matching
  const cleanPath = path.split("?")[0];
  const mock = WEB_MOCK_RESPONSES[cleanPath];
  if (mock) {
    console.log(`[API-Web-Mock] ${path} → returning stub data`);
    return Promise.resolve(JSON.parse(JSON.stringify(mock)));
  }
  // For unknown paths, return an empty object so screens don't crash
  console.warn(`[API-Web-Mock] No mock for ${path} — returning empty object`);
  return Promise.resolve({});
};

const withTimeout = (promise, timeoutMs) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return Promise.race([
    promise(controller.signal),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeoutMs)
    ),
  ]).finally(() => clearTimeout(timeoutId));
};

const buildUrl = (path) => {
  if (path.startsWith("http")) return path;
  const base = API_BASE_URL.endsWith("/api")
    ? API_BASE_URL
    : `${API_BASE_URL.replace(/\/$/, "")}/api`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
};

// ── In-flight request deduplication ──────────────────────────────────────
// Prevents duplicate GET requests from firing simultaneously.
const inFlightRequests = new Map();

const deduplicatedGet = async (path, options) => {
  const token = options?.auth !== false ? await getAuthToken() : null;
  const cacheKey = `${path}:${token ? 'auth' : 'noauth'}`;

  const existing = inFlightRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const promise = retryable(() => request(path, { ...options }))
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, promise);
  return promise;
};

const request = async (path, { method = "GET", body, headers, auth = true } = {}) => {
  const url = buildUrl(path);
  const token = auth ? await getAuthToken() : null;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await withTimeout(
      (signal) => fetch(url, { ...options, signal }),
      DEFAULT_TIMEOUT_MS
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const message =
        payload?.message ||
        payload?.error ||
        `Request failed (${response.status})`;
      const requestError = new Error(message);
      requestError.status = response.status;
      requestError.code = payload?.code || null;
      requestError.payload = payload;
      throw requestError;
    }

    if (response.status === 204) return null;
    return response.json();
  } catch (err) {
    logError("API request failed", method, url, err?.message || err);
    throw err;
  }
};

const retryable = async (fn, attempts = 2) => {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const api = isWeb
  ? {
      // On web, all calls return mock data (no CORS issues)
      get: (path) => webMockRequest(path),
      post: (path) => webMockRequest(path),
      put: (path) => webMockRequest(path),
      patch: (path) => webMockRequest(path),
      delete: (path) => webMockRequest(path),
    }
  : {
      get: (path, options) => deduplicatedGet(path, options),
      post: (path, body, options) =>
        request(path, { ...options, method: "POST", body }),
      put: (path, body, options) =>
        request(path, { ...options, method: "PUT", body }),
      patch: (path, body, options) =>
        request(path, { ...options, method: "PATCH", body }),
      delete: (path, options) =>
        request(path, { ...options, method: "DELETE" }),
    };
