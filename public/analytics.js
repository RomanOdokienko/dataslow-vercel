export default async function handler(req, res) {
  console.log("📩 Webhook payload:", JSON.stringify(req.body, null, 2));

  // ... твоя логика
}

// analytics.js — DataSlow v0.2 MVP Edition
(function () {
  // --- Сбор UTM и session_id ---
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
    Object.entries(utms).forEach(([key, value]) => {
      if (value) localStorage.setItem(key, value);
    });
  }

  // --- Авто-трекинг email из формы ---
  function attachEmailTracking() {
    document.addEventListener("change", (e) => {
      const el = e.target;
      if (el?.type === "email" && el?.value?.includes("@")) {
        DataSlow.track({ email: el.value });
      }
    });
  }

  // --- Отправка данных на backend ---
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

  // --- Инициализация ---
  window.addEventListener("DOMContentLoaded", () => {
    const utms = getUTMs();
    storeUTMs(utms);
    getSessionId();
    attachEmailTracking();
  });

  // --- Глобальный объект DataSlow ---
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
