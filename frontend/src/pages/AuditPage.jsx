import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, ShieldCheck, XCircle } from "lucide-react";
import GlassCard from "../components/ui/GlassCard";
import { PageSkeleton } from "../components/ui/Skeleton";
import { AuditBadge } from "../components/ui/StatusBadge";
import { fm } from "../utils/format";

export default function AuditPage({
  data,
  loading,
  error,
  onlyReview,
  onToggleOnlyReview,
  onOpenBatch,
}) {
  const [search, setSearch] = useState("");

  const filteredBatches = useMemo(() => {
    if (!data?.batches) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.batches;
    return data.batches.filter((b) => b.fg_id.toLowerCase().includes(q));
  }, [data, search]);

  const filteredFindings = useMemo(() => {
    if (!data?.findings) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.findings;
    return data.findings.filter(
      (f) => f.fg_id.toLowerCase().includes(q) || f.aturan.toLowerCase().includes(q)
    );
  }, [data, search]);

  if (loading && !data) return <PageSkeleton />;
  if (error) {
    return (
      <GlassCard className="border-terracotta-500/40 bg-red-950/20">
        <p className="text-sm text-red-300">Gagal memuat audit: {error}</p>
      </GlassCard>
    );
  }
  if (!data) return null;

  const { summary, rules } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-stone-50">Audit Otomatis (8 Aturan R1–R8)</h1>
        <p className="mt-1 text-xs text-stone-400">
          Setiap batch diperiksa ulang dari data terkini. Temuan pada satu lot hulu ikut menandai
          seluruh batch turunannya.
        </p>
      </div>

      {/* 4 SUMMARY KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard hover>
          <div className="text-xs text-stone-400">Batch Lulus</div>
          <div className="mt-1 font-metric text-2xl font-bold text-emerald-400">
            {summary.pass_count} / {summary.total_batches}
          </div>
          <div className="mt-1 text-xs text-stone-400">{fm(summary.pass_rate_pct, 1)}% kepatuhan</div>
        </GlassCard>

        <GlassCard hover>
          <div className="text-xs text-stone-400">Perlu Ditinjau</div>
          <div className="mt-1 font-metric text-2xl font-bold text-terracotta-400">
            {summary.review_count}
          </div>
          <div className="mt-1 text-xs text-stone-400">batch memiliki ≥ 1 temuan</div>
        </GlassCard>

        <GlassCard hover>
          <div className="text-xs text-stone-400">Total Temuan</div>
          <div className="mt-1 font-metric text-2xl font-bold text-amber-300">
            {summary.total_findings}
          </div>
          <div className="mt-1 text-xs text-stone-400">pelanggaran aturan terdeteksi</div>
        </GlassCard>

        <GlassCard hover>
          <div className="text-xs text-stone-400">Aturan Paling Sering Gagal</div>
          <div className="mt-1 font-metric text-lg font-bold text-stone-100">
            {summary.most_failed_rule.code} ({summary.most_failed_rule.count} batch)
          </div>
          <div className="mt-1 line-clamp-1 text-xs text-stone-400" title={summary.most_failed_rule.aturan}>
            {summary.most_failed_rule.aturan}
          </div>
        </GlassCard>
      </div>

      {/* 8 RULES COMPLIANCE CARDS */}
      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
          <h2 className="text-base font-bold text-stone-100">Ringkasan Kepatuhan Aturan R1–R8</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rules.map((r) => {
            const pct = summary.total_batches ? (r.pass_count / summary.total_batches) * 100 : 100;
            return (
              <div
                key={r.code}
                className="rounded-xl border border-stone-800 bg-stone-950/60 p-3.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                    {r.code}
                  </span>
                  <span
                    className={`font-metric text-xs font-semibold ${
                      r.fail_count > 0 ? "text-red-300" : "text-emerald-300"
                    }`}
                  >
                    {r.fail_count} gagal
                  </span>
                </div>
                <p className="text-xs leading-snug text-stone-200 min-h-[34px]">{r.aturan}</p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>

      {/* BATCH MATRIX + FINDINGS */}
      <div className="grid gap-5 lg:grid-cols-12">
        <GlassCard className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-stone-100">
              Matriks Batch ({filteredBatches.length})
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-stone-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari batch..."
                  className="w-40 rounded-lg border border-stone-700 bg-stone-900 py-1.5 pl-8 pr-2.5 text-xs text-stone-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-stone-300">
                <input
                  type="checkbox"
                  checked={onlyReview}
                  onChange={(e) => onToggleOnlyReview(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-700 bg-stone-900 accent-amber-400"
                />
                Hanya yang perlu ditinjau
              </label>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto rounded-xl border border-stone-800/80">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-stone-950/95 text-[11px] uppercase text-stone-400">
                <tr>
                  <th className="px-3 py-2.5">Batch</th>
                  <th className="px-2 py-2.5">Status</th>
                  {rules.map((r) => (
                    <th key={r.code} className="px-1.5 py-2.5 text-center font-mono" title={r.aturan}>
                      {r.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {filteredBatches.map((b) => (
                  <tr key={b.fg_id} className="hover:bg-stone-900/60">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => onOpenBatch(b.fg_id)}
                        className="font-mono font-semibold text-amber-300 hover:underline"
                      >
                        {b.fg_id}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <AuditBadge status={b.status_audit} size="sm" />
                    </td>
                    {rules.map((r) => {
                      const pass = b.checks[r.code];
                      return (
                        <td key={r.code} className="px-1.5 py-2 text-center">
                          {pass ? (
                            <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-400/80" />
                          ) : (
                            <XCircle className="mx-auto h-3.5 w-3.5 text-terracotta-400" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-terracotta-400" />
              <h2 className="text-base font-bold text-stone-100">
                Rincian Temuan ({filteredFindings.length})
              </h2>
            </div>
          </div>

          <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
            {filteredFindings.length === 0 ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                Tidak ada temuan audit untuk filter saat ini.
              </div>
            ) : (
              filteredFindings.map((f, idx) => (
                <div
                  key={`${f.fg_id}-${f.code}-${idx}`}
                  className="rounded-xl border border-stone-800 bg-stone-950/60 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onOpenBatch(f.fg_id)}
                      className="font-mono font-bold text-amber-300 hover:underline"
                    >
                      {f.fg_id}
                    </button>
                    <span className="rounded bg-terracotta-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-red-300">
                      {f.code}
                    </span>
                  </div>
                  <div className="font-medium text-stone-200">{f.aturan}</div>
                  <div className="font-mono text-[11px] text-stone-400">{f.catatan}</div>
                </div>
              ))
            )}
          </div>
          <p className="text-[11px] text-stone-500">
            Sebagian temuan pada data simulasi sengaja disisipkan untuk mendemonstrasikan aturan
            audit otomatis.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
