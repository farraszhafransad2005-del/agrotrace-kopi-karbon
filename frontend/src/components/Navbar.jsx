import React from "react";
import { motion } from "framer-motion";
import {
  Coffee,
  Home,
  SearchCheck,
  BarChart3,
  ShieldCheck,
  BookOpen,
  RefreshCw,
  Database,
} from "lucide-react";

const TABS = [
  { id: "overview", label: "Beranda", icon: Home },
  { id: "batch", label: "Telusuri Batch", icon: SearchCheck },
  { id: "carbon", label: "Analisis Karbon", icon: BarChart3 },
  { id: "audit", label: "Audit", icon: ShieldCheck },
  { id: "methodology", label: "Metodologi", icon: BookOpen },
];

export default function Navbar({
  activeTab,
  onSelectTab,
  health,
  refreshing,
  onRefresh,
}) {
  const isMongo = health?.source_mode === "mongodb";

  return (
    <header className="sticky top-3 z-50 mx-auto max-w-7xl px-4 sm:px-6">
      <div className="glass-nav flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-2.5 shadow-2xl">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onSelectTab("overview")}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-emerald-500/20 border border-amber-500/35 shadow-glow">
            <Coffee className="h-4.5 w-4.5 text-amber-400 transition-transform duration-200 group-hover:rotate-12" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight text-stone-100">
              <span>AgroTrace</span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                CO₂e
              </span>
            </div>
            <p className="text-[11px] text-stone-400">Gayo Arabika Natural · 200g</p>
          </div>
        </button>

        {/* Navigation Pills */}
        <nav className="flex flex-wrap items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                  active ? "text-stone-950 font-semibold" : "text-stone-300 hover:text-stone-100"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="active-nav-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400"
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Source indicator + Refresh */}
        <div className="flex items-center gap-2">
          <div
            title={health?.source_label || "Memuat status sumber data"}
            className={`hidden md:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              isMongo
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-200"
            }`}
          >
            <Database className="h-3 w-3" />
            <span>{isMongo ? "MongoDB Atlas" : "Demo Lokal (data/)"}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Hitung ulang data & refresh cache"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-stone-700/70 bg-stone-900/70 text-stone-300 transition hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
