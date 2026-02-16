/**
 * Map backend journey stages to mobile UI journey steps
 */

const STAGE_LABELS = {
    registered: "Registration",
    at_triage: "Triage",
    vitals_taken: "Vitals Capture",
    with_doctor: "Consultation",
    at_lab: "Lab / Diagnostic",
    at_imaging: "Imaging",
    at_pharmacy: "Pharmacy",
    paying_consultation: "Payment",
    paying_diagnosis: "Payment",
    paying_pharmacy: "Payment",
    completed: "Completed",
};

const STAGE_ORDER = [
    "registered",
    "at_triage",
    "vitals_taken",
    "with_doctor",
    "at_lab",
    "at_imaging",
    "at_pharmacy",
    "completed",
];

/**
 * Convert backend visit data to mobile journey steps
 * @param {Object} visit - Visit object from backend
 * @returns {Array} Array of journey steps for mobile UI
 */
export const mapVisitToJourneySteps = (visit) => {
    if (!visit) return [];

    // Fallback to status if current_journey_stage is missing
    const currentStage = visit.current_journey_stage || visit.status || "registered";

    // Since we don't have journey_stages history, we interpret progress based on order
    const currentStageIndex = STAGE_ORDER.indexOf(currentStage);
    const steps = [];
    let stepId = 1;

    // Build steps based on standard order
    STAGE_ORDER.forEach((stage, index) => {
        let status = "pending";
        let time = "--";

        if (index < currentStageIndex) {
            status = "completed";
        } else if (index === currentStageIndex) {
            status = "active";
            time = "In Progress";
        }

        // Add step if it's a valid stage we want to show
        steps.push({
            id: stepId++,
            label: STAGE_LABELS[stage] || stage,
            time,
            status,
            stage,
        });
    });

    return steps;
};

/**
 * Get current journey stage label
 * @param {string} stage - Backend stage identifier
 * @returns {string} User-friendly stage label
 */
export const getStageLabel = (stage) => {
    return STAGE_LABELS[stage] || stage;
};

/**
 * Format visit data for mobile display
 * @param {Object} visit - Visit object from backend
 * @returns {Object} Formatted visit data
 */
export const formatVisitForDisplay = (visit) => {
    // Map backend status to frontend journey stage (normalized)
    const rawStatus = visit.current_journey_stage || visit.status || "registered";
    const STATUS_MAP = {
        'registered': 'registered',
        'triage': 'at_triage',
        'at_triage': 'at_triage',
        'vitals_taken': 'vitals_taken',
        'doctor': 'with_doctor',
        'with_doctor': 'with_doctor',
        'lab': 'at_lab',
        'at_lab': 'at_lab',
        'procedure': 'at_imaging', // map procedure/imaging to 'at_imaging'
        'imaging': 'at_imaging',
        'at_imaging': 'at_imaging',
        'pharmacy': 'at_pharmacy',
        'at_pharmacy': 'at_pharmacy',
        'paying_consultation': 'with_doctor', // payment usually happens after/during these stages
        'paying_diagnosis': 'at_lab',
        'paying_pharmacy': 'at_pharmacy',
        'completed': 'completed'
    };

    // Get the normalized stage based on our map, or fallback to raw if not found
    const currentStage = STATUS_MAP[rawStatus] || rawStatus;

    // Create a modified visit object with the normalized stage to pass to mapVisitToJourneySteps
    // This ensures expectations in that function are met
    const visitWithNormalizedStage = {
        ...visit,
        current_journey_stage: currentStage
    };

    return {
        id: visit.id,
        visitDate: visit.visit_date,
        reason: visit.reason,
        provider: visit.provider || "Staff",
        currentStage: getStageLabel(currentStage),
        currentStageRaw: currentStage,
        urgency: visit.triage_urgency,
        journeySteps: mapVisitToJourneySteps(visitWithNormalizedStage),
    };
};

/**
 * Get summary of visit orders
 * @param {Object} orders - Orders object from visit
 * @returns {Object} Order summary
 */
export const getOrdersSummary = (orders) => {
    if (!orders) return { total: 0, pending: 0, completed: 0 };

    const allOrders = [
        ...(orders.lab || []),
        ...(orders.imaging || []),
        ...(orders.medication || []),
    ];

    return {
        total: allOrders.length,
        pending: allOrders.filter((o) => o.payment_status === "unpaid").length,
        completed: allOrders.filter((o) => o.payment_status === "paid").length,
    };
};
