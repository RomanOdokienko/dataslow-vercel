// analytics.js — DataSlow v0.3 (однострочный скрипт)
(function () {
  function getUTMs() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source") || localStorage.getItem("utm_source") || "",
      utm_medium: params.get("utm_medium") || localStorage.getItem("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || localStorage.getItem("utm_campaign") || ""
    };
  }

  function getSessionId() {
    let sid = localStorage.getItem("session_id");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("session_id", sid);
    }
    return sid;
  }

  function storeUTMs(utms) {
    Object.entries(utms).forEach(([k, v]) => {
      if (v) localStorage.setItem(k, v);
    });
  }

  function attachEmailTracking() {
    document.addEventListener("change", (e) => {
      const el = e.target;
      if (el?.type === "email" && el?.value?.includes("@")) {
        DataSlow.track({ email: el.value });
      }
    });
  }

  async function track({ email }) {
    const payload = {
      email,
      ...window.DataSlow.getContext()
    };
    if (email) localStorage.setItem("email", email);
    try {
      await fetch("/api/track-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      console.log("📤 Email tracked", payload);
    } catch (err) {
      console.warn("❌ Failed to track email", err);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    const utms = getUTMs();
    storeUTMs(utms);
    getSessionId();
    attachEmailTracking();
  });

  window.DataSlow = {
    getContext: () => ({
      session_id: localStorage.getItem("session_id") || "",
      utm_source: localStorage.getItem("utm_source") || "",
      utm_medium: localStorage.getItem("utm_medium") || "",
      utm_campaign: localStorage.getItem("utm_campaign") || "",
      email: localStorage.getItem("email") || ""
    }),
    track
  };
// --- Перехват fetch-запросов для /api/create-payment ---
(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (input, init = {}) {
    const url = input instanceof Request ? input.url : input;
    if (typeof url === 'string' && url.includes('/api/create-payment')) {
      const context = window.DataSlow?.getContext?.() || {};
      const headers = new Headers(
        (input instanceof Request ? input.headers : init.headers) || {}
      );
      headers.set('X-DS-Session-Id', context.session_id || '');
      headers.set('X-DS-Utm-Source', context.utm_source || '');
      headers.set('X-DS-Utm-Medium', context.utm_medium || '');
      headers.set('X-DS-Utm-Campaign', context.utm_campaign || '');
      headers.set('X-DS-Email', context.email || '');

      if (input instanceof Request) {
        input = new Request(input, { headers });
        console.log('🪄 Заголовки подставлены в Request:', Object.fromEntries(headers.entries()));
        return originalFetch(input);
      } else {
        init.headers = headers;
        console.log('🪄 Заголовки подставлены:', Object.fromEntries(headers.entries()));
      }
    }

    return originalFetch(input, init);
  };
})();
