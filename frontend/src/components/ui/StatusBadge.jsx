import React from "react";
import { CheckCircle2, AlertTriangle, ShieldAlert, Sparkles } from "lucide-react";

export function AuditBadge({ status, size = "md" }) {
  const isPass = status === "Lulus";
  const pad = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide border ${pad} ${
        isPass
          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/35"
          : "bg-terracotta-500/15 text-red-300 border-terracotta-500/40"
      }`}
    >
      {isPass ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
      {status}
    </span>
  );
}

export function IntensityBadge({ category }) {
  const styles = {
    Rendah: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
    Sedang: "bg-amber-500/15 text-amber-300 border-amber-500/35",
    Tinggi: "bg-rose-500/15 text-rose-300 border-rose-500/35",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        styles[category] || "bg-stone-700/40 text-stone-300 border-stone-600/40"
      }`}
    >
      <Sparkles className="h-3 w-3" />
      Intensitas {category}
    </span>
  );
}

export function FactorStatusBadge({ status }) {
  const s = String(status || "");
  if (s === "Bersumber") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
        <CheckCircle2 className="h-3 w-3" />
        Bersumber
      </span>
    );
  }
  if (s.toLowerCase().includes("cek ulang")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
        <AlertTriangle className="h-3 w-3" />
        {s}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-terracotta-500/35 bg-terracotta-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-300">
      <ShieldAlert className="h-3 w-3" />
      {s || "Asumsi"}
    </span>
  );
}
