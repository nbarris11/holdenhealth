/* Anonymous replay with password fields hidden for the production public website. */
(function () {
  'use strict';
  if (!['holden.health', 'www.holden.health'].includes(window.location.hostname)) return;
  if (window.parent !== window || new URLSearchParams(window.location.search).has('holden-editor')) return;
  if (window.posthog || document.querySelector('script[data-holden-posthog-sdk]')) return;
  var sdk = document.createElement('script');
  sdk.async = true;
  sdk.src = 'https://us-assets.i.posthog.com/static/array.js';
  sdk.setAttribute('data-holden-posthog-sdk', 'true');
  sdk.onload = function () {
    if (!window.posthog) return;
    window.posthog.init("phc_yn24gppjuRNwzPTdoKhEYeQtd6TTpsq8SXqfmphPcEiZ", {
      api_host: 'https://us.i.posthog.com',
      defaults: '2026-01-30',
      autocapture: false,
      capture_pageview: 'history_change',
      capture_pageleave: true,
      capture_exceptions: false,
      capture_performance: false,
      enable_recording_console_log: false,
      disable_session_recording: false,
      disable_surveys: true,
      disable_conversations: true,
      person_profiles: 'never',
      persistence: 'sessionStorage',
      ip: false,
      mask_personal_data_properties: true,
      property_denylist: ['$set', '$set_once'],
      before_send: function (event) {
        if (!event) return event;
        Object.keys(event.properties).forEach(function (key) {
          if (/url|referrer/i.test(key) && typeof event.properties[key] === 'string') {
            event.properties[key] = event.properties[key].split(/[?#]/)[0];
          }
        });
        return event;
      },
      loaded: function (client) { client.capture('website_opened', { site: 'public' }); },
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
        maskCapturedNetworkRequestFn: function () { return null; }
      }
    });
  };
  document.head.appendChild(sdk);
}());
