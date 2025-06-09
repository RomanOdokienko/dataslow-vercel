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
    try {
      await fetch("https://dataslow-vercel.vercel.app/api/track-email", {
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
      utm_campaign: localStorage.getItem("utm_campaign") || ""
    }),
    track
  };
})();
