import React from "react";
import { BookOpen, CheckCircle2, Download, FileSpreadsheet, MinusCircle, ShieldAlert } from "lucide-react";
import { DOWNLOAD_URLS } from "../api/client";
import GlassCard from "../components/ui/GlassCard";
import { PageSkeleton } from "../components/ui/Skeleton";
import { FactorStatusBadge } from "../components/ui/StatusBadge";

export default function MethodologyPage({ data, loading, error }) {
  if (loading && !data) return <PageSkeleton />;
  if (error) {
    return (
      <GlassCard className="border-terracotta-500/40 bg-red-950/20">
        <p className="text-sm text-red-300">Gagal memuat metodologi: {error}</p>
      </GlassCard>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-50">Metodologi & Faktor Emisi</h1>
          <p className="mt-1 text-xs text-stone-400">
            Transparansi rumus, batas sistem, alokasi massa, dan sumber faktor emisi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <a
            href={DOWNLOAD_URLS.emisiPerBatch}
            download="emisi_per_batch.csv"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-4 py-2 text-xs font-bold text-stone-950 shadow-glow transition hover:brightness-110"
          >
            <Download className="h-4 w-4" />
            Unduh emisi_per_batch.csv
          </a>
          <a
            href={DOWNLOAD_URLS.faktorEmisi}
            download="faktor_emisi.csv"
            className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900 px-4 py-2 text-xs font-semibold text-stone-200 transition hover:border-amber-500/40"
          >
            <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            Unduh faktor_emisi.csv
          </a>
        </div>
      </div>

      {/* SYSTEM BOUNDARY + FORMULA + ALLOCATION */}
      <div className="grid gap-5 lg:grid-cols-12">
        <GlassCard className="lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4.5 w-4.5 text-amber-400" />
            <h2 className="text-base font-bold text-stone-100">Batas Sistem (Cradle-to-Customer)</h2>
          </div>
          <p className="text-xs leading-relaxed text-stone-300">{data.system_boundary.scope}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
              <div className="mb-2 text-xs font-bold text-emerald-300">Termasuk dalam Perhitungan</div>
              <ul className="space-y-1.5 text-xs text-stone-300">
                {data.system_boundary.included.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3.5">
              <div className="mb-2 text-xs font-bold text-stone-300">Tidak Termasuk</div>
              <ul className="space-y-1.5 text-xs text-stone-400">
                {data.system_boundary.excluded.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <MinusCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-6 space-y-4">
          <h2 className="text-base font-bold text-stone-100">Rumus & Alokasi Massa</h2>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300">Rumus Dasar</div>
            <p className="mt-1 text-xs leading-relaxed text-stone-200">{data.formula}</p>
          </div>

          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3.5 space-y-1.5">
            <div className="text-xs font-bold text-stone-200">Alokasi Massa Hulu</div>
            <p className="text-xs leading-relaxed text-stone-300">{data.mass_allocation}</p>
          </div>

          <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3.5 space-y-1.5">
            <div className="text-xs font-bold text-emerald-300">Hitung Ulang Otomatis</div>
            <p className="text-xs leading-relaxed text-stone-300">{data.auto_recalculation}</p>
          </div>
        </GlassCard>
      </div>

      {/* EMISSION FACTORS TABLE */}
      <GlassCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-stone-100">
            Faktor Emisi yang Dipakai ({data.emission_factors.length})
          </h2>
          <span className="text-xs text-stone-400">
            Sumber: <code className="font-mono text-amber-300">data/faktor_emisi.csv</code>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-800 text-[11px] uppercase text-stone-400">
              <tr>
                <th className="py-2.5 pr-3">Kode</th>
                <th className="py-2.5 pr-3">Faktor Emisi</th>
                <th className="py-2.5 pr-3">Nilai</th>
                <th className="py-2.5 pr-3">Satuan</th>
                <th className="py-2.5 pr-3">Status</th>
                <th className="py-2.5">Sumber / Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/70">
              {data.emission_factors.map((f) => (
                <tr key={f.kode} className="hover:bg-stone-900/40">
                  <td className="py-3 pr-3 font-mono font-bold text-amber-300">{f.kode}</td>
                  <td className="py-3 pr-3 font-medium text-stone-100">{f.nama}</td>
                  <td className="py-3 pr-3 font-metric font-bold text-emerald-300">{f.nilai}</td>
                  <td className="py-3 pr-3 font-mono text-stone-400">{f.satuan}</td>
                  <td className="py-3 pr-3">
                    <FactorStatusBadge status={f.status} />
                  </td>
                  <td className="py-3 max-w-md text-stone-400 leading-relaxed">{f.sumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* LIMITATIONS */}
      <GlassCard className="border-terracotta-500/30 bg-terracotta-500/5">
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-300">
          <ShieldAlert className="h-4 w-4 text-terracotta-400" />
          Keterbatasan yang Perlu Dicatat
        </div>
        <ul className="space-y-1.5 text-xs text-stone-300">
          {data.limitations.map((lim) => (
            <li key={lim}>• {lim}</li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
