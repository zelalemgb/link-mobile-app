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
