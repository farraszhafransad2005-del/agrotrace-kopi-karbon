const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

async function fetchJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.detail) {
        message = typeof errBody.detail === "string" ? errBody.detail : JSON.stringify(errBody.detail);
      }
    } catch {
      // ignore json parse failure
    }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function getHealth() {
  return fetchJson("/api/health");
}

export function refreshCache() {
  return fetchJson("/api/cache/refresh", { method: "POST" });
}

export function getOverview() {
  return fetchJson("/api/overview");
}

export function getBatches({ tujuan, status, search } = {}) {
  const params = new URLSearchParams();
  if (tujuan && tujuan !== "Semua") params.set("tujuan", tujuan);
  if (status && status !== "Semua") params.set("status", status);
  if (search && search.trim()) params.set("search", search.trim());
  const qs = params.toString();
  return fetchJson(`/api/batches${qs ? `?${qs}` : ""}`);
}

export function getBatchDetail(fgId) {
  return fetchJson(`/api/batches/${encodeURIComponent(fgId)}`);
}

export function getCarbonAnalysis() {
  return fetchJson("/api/carbon-analysis");
}

export function postSimulate(payload, signal) {
  return fetchJson("/api/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
    signal,
  });
}

export function getAudit(onlyReview = false) {
  return fetchJson(`/api/audit?only_review=${onlyReview ? "true" : "false"}`);
}

export function getMethodology() {
  return fetchJson("/api/methodology");
}

export const DOWNLOAD_URLS = {
  emisiPerBatch: `${API_BASE}/api/download/emisi_per_batch.csv`,
  faktorEmisi: `${API_BASE}/api/download/faktor_emisi.csv`,
};
