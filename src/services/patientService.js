import { api } from "../lib/api";

/**
 * Fetch the active visit for the authenticated patient
 */
export const getActiveVisit = async () => {
    try {
        const response = await api.get("/mobile/patient/active-visit");
        return response;
    } catch (error) {
        console.error("Failed to fetch active visit:", error);
        throw error;
    }
};

/**
 * Fetch dashboard statistics for the authenticated patient
 */
export const getPatientStats = async () => {
    try {
        const response = await api.get("/mobile/patient/stats");
        return response;
    } catch (error) {
        console.error("Failed to fetch patient stats:", error);
        throw error;
    }
};

/**
 * Fetch visit history for the authenticated patient
 */
export const getVisitHistory = async (limit = 10) => {
    try {
        const response = await api.get(`/mobile/patient/visit-history?limit=${limit}`);
        return response;
    } catch (error) {
        console.error("Failed to fetch visit history:", error);
        throw error;
    }
};

/**
 * Fetch complete visit details
 */
export const getVisitDetails = async (visitId) => {
    try {
        const response = await api.get(`/patients/visits/${visitId}/detail`);
        return response;
    } catch (error) {
        console.error("Failed to fetch visit details:", error);
        throw error;
    }
};

// ── Appointments ──────────────────────────────────────────────────────────

export const getFacilities = async () => {
    try {
        const response = await api.get("/patient-portal/facilities");
        return response;
    } catch (error) {
        console.error("Failed to fetch facilities:", error);
        throw error;
    }
};

export const getAppointments = async () => {
    try {
        const response = await api.get("/patient-portal/appointments");
        return response;
    } catch (error) {
        console.error("Failed to fetch appointments:", error);
        throw error;
    }
};

export const createAppointment = async (data) => {
    try {
        const response = await api.post("/patient-portal/appointments", data);
        return response;
    } catch (error) {
        console.error("Failed to create appointment:", error);
        throw error;
    }
};

// ── Consent Management ───────────────────────────────────────────────────

export const grantConsent = async (data) => {
    try {
        const response = await api.post("/patient-portal/consents/grant", data);
        return response;
    } catch (error) {
        console.error("Failed to grant consent:", error);
        throw error;
    }
};

export const revokeConsent = async (data) => {
    try {
        const response = await api.post("/patient-portal/consents/revoke", data);
        return response;
    } catch (error) {
        console.error("Failed to revoke consent:", error);
        throw error;
    }
};

export const getConsentHistory = async (facilityId, consentType) => {
    try {
        let path = "/patient-portal/consents/history";
        const params = [];
        if (facilityId) params.push(`facilityId=${facilityId}`);
        if (consentType) params.push(`consentType=${consentType}`);
        if (params.length) path += `?${params.join("&")}`;
        const response = await api.get(path);
        return response;
    } catch (error) {
        console.error("Failed to fetch consent history:", error);
        throw error;
    }
};

// ── Health Records / Documents ───────────────────────────────────────────

export const getDocuments = async () => {
    try {
        const response = await api.get("/patient-portal/documents");
        return response;
    } catch (error) {
        console.error("Failed to fetch documents:", error);
        throw error;
    }
};

export const uploadDocument = async (formData) => {
    try {
        const response = await api.post("/patient-portal/documents", formData);
        return response;
    } catch (error) {
        console.error("Failed to upload document:", error);
        throw error;
    }
};

export const deleteDocument = async (documentId) => {
    try {
        const response = await api.delete(`/patient-portal/documents/${documentId}`);
        return response;
    } catch (error) {
        console.error("Failed to delete document:", error);
        throw error;
    }
};
