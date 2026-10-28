import posthog from "posthog-js";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// User-authorized replay visibility: only password fields are hidden.
// Production-only initialization prevents local testing from recording live database content.
if (process.env.NODE_ENV === "production" && token && host) {
  posthog.init(token, {
    api_host: host,
    defaults: "2026-01-30",
    autocapture: false,
    capture_pageview: 'history_change',
    capture_pageleave: true,
    capture_exceptions: false,
    capture_performance: false,
    enable_recording_console_log: false,
    disable_session_recording: false,
    disable_surveys: true,
    disable_conversations: true,
    person_profiles: "identified_only",
    loaded: client => { client.capture("portal_opened"); },
    persistence: "sessionStorage",
    ip: false,
    mask_personal_data_properties: true,
    before_send: (event) => {
      if (!event) return event;
      for (const properties of [event.properties, event.properties.$set, event.properties.$set_once]) {
        if (!properties || typeof properties !== "object") continue;
        for (const key of Object.keys(properties)) {
          if (/url|referrer/i.test(key) && typeof properties[key] === "string") {
            properties[key] = properties[key].split(/[?#]/)[0];
          }
        }
      }
      return event;
    },
    session_recording: {
      maskAllInputs: false,
      maskInputOptions: { password: true },
      maskTextSelector: null,
      maskAllElementAttributes: false,
      blockSelector: 'input[type="password"], input[autocomplete="current-password"], input[autocomplete="new-password"], input[name*="password" i], input[id*="password" i]',
      recordHeaders: false,
      recordBody: false,
      captureCanvas: { recordCanvas: false },
      captureJsonLd: false,
      maskCapturedNetworkRequestFn: () => null,
    },
  });
}
