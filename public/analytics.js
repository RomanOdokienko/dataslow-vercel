// analytics.js — Встраиваемый JS-трекер с магией одной строки
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

  // --- Инициализация ---
  window.addEventListener("DOMContentLoaded", () => {
    const utms = getUTMs();
    storeUTMs(utms);
    getSessionId();
  });

  // --- Глобальный объект DataSlow ---
  window.DataSlow = {
    getContext: () => ({
      session_id: localStorage.getItem("session_id") || "",
      utm_source: localStorage.getItem("utm_source") || "",
      utm_medium: localStorage.getItem("utm_medium") || "",
      utm_campaign: localStorage.getItem("utm_campaign") || ""
    })
  };
})();
