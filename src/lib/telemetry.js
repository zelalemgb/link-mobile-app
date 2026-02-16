import { log } from "./logger";

export const trackEvent = (name, payload = {}) => {
  log("event", name, payload);
};

export const trackError = (err, context = {}) => {
  log("error", err?.message || err, context);
};
