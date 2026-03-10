import { api } from "../lib/api";

export const requestLinkAgentInteraction = async (
  {
    surface,
    intent,
    payload = {},
    conversation = [],
    locale,
    safeMode = true,
  },
  { includeAuth = true } = {}
) => {
  const endpoint = includeAuth
    ? "/ai/link-agent/interaction"
    : "/ai/link-agent/interaction-public";

  return api.post(
    endpoint,
    {
      surface,
      intent,
      payload,
      conversation,
      locale,
      safeMode,
    },
    includeAuth ? undefined : { auth: false }
  );
};

export const requestPatientSymptomAssessment = async ({
  message,
  conversation = [],
  locale = "am",
  includeAuth = true,
}) => {
  return requestLinkAgentInteraction(
    {
      surface: "patient",
      intent: "symptom_assessment",
      payload: { message },
      conversation,
      locale,
      safeMode: true,
    },
    { includeAuth }
  );
};

