import React, { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Sliders, TrendingDown } from "lucide-react";
import { postSimulate } from "../api/client";
import GlassCard from "../components/ui/GlassCard";
import { PageSkeleton } from "../components/ui/Skeleton";
import EChartBox from "../components/charts/EChartBox";
import { STAGE_COLORS, STAGE_NAMES, fm } from "../utils/format";

const PRACTICE_COLORS = {
  Organik: "#10B981",
  "Semi-organik": "#D4A373",
  Konvensional: "#E05A47",
};

const DEFAULT_SLIDERS = {
  pupuk_n_pct: 0,
  lpg_pct: 0,
  listrik_pct: 0,
  kemasan_pct: 0,
};

export default function CarbonAnalysisPage({ data, loading, error, onOpenBatch }) {
  const [sliders, setSliders] = useState(DEFAULT_SLIDERS);
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  // Sync baseline simulation when data arrives
  useEffect(() => {
    if (data?.baseline_simulation && !simResult) {
      setSimResult(data.baseline_simulation);
    }
  }, [data, simResult]);

  // Debounced (150ms) real-time What-If simulation via POST /api/simulate
  const firstRender = useRef(true);
  useEffect(() => {
    if (!data) return undefined;
    if (firstRender.current) {
      firstRender.current = false;
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSimLoading(true);
      postSimulate(sliders, controller.signal)
        .then((res) => {
          setSimResult(res);
          setSimLoading(false);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setSimLoading(false);
          }
        });
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sliders, data]);

  // 1. Horizontal Bar: 12 components
  const compOption = useMemo(() => {
    if (!data?.components) return null;
    const sorted = [...data.components].sort((a, b) => a.kg_co2e - b.kg_co2e);
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const p = params[0];
          const item = sorted[p.dataIndex];
          return `<div style="font-weight:600;">${item.label}</div>
                  <div style="font-size:11px;color:#a8a29e;">Tahap: ${item.stage_name}</div>
                  <div style="font-family:'JetBrains Mono',monospace;color:#fbbf24;">${fm(item.kg_co2e, 1)} kg CO₂e (${fm(item.share_pct, 1)}%)</div>`;
        },
      },
      grid: { top: 12, left: 145, right: 24, bottom: 26 },
      xAxis: {
        type: "value",
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      yAxis: {
        type: "category",
        data: sorted.map((c) => c.label),
        axisLabel: { color: "#e7e5e4", fontSize: 11 },
        axisLine: { lineStyle: { color: "#3f332c" } },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 16,
          data: sorted.map((c) => ({
            value: c.kg_co2e,
            itemStyle: {
              color: STAGE_COLORS[c.stage_index] || "#10B981",
              borderRadius: [0, 5, 5, 0],
            },
          })),
        },
      ],
    };
  }, [data]);

  // 2. Histogram (25 bins) with shaded audit range
  const histOption = useMemo(() => {
    const bins = data?.intensity_distribution?.histogram;
    if (!bins?.length) return null;
    const [lo, hi] = data.rentang_intensitas || [1.5, 6.0];
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const p = params[0];
          const b = bins[p.dataIndex];
          return `<div style="font-weight:600;">${fm(b.x0, 2)} – ${fm(b.x1, 2)} kg CO₂e/kg</div>
                  <div style="font-family:'JetBrains Mono',monospace;color:#34d399;">${b.count} batch</div>`;
        },
      },
      grid: { top: 24, left: 42, right: 16, bottom: 38 },
      xAxis: {
        type: "category",
        data: bins.map((b) => fm((b.x0 + b.x1) / 2, 2)),
        axisLabel: { color: "#a8a29e", fontSize: 10, interval: 3 },
        axisLine: { lineStyle: { color: "#3f332c" } },
      },
      yAxis: {
        type: "value",
        name: "Batch",
        nameTextStyle: { color: "#78716c", fontSize: 10 },
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      series: [
        {
          type: "bar",
          barCategoryGap: "6%",
          data: bins.map((b) => b.count),
          itemStyle: {
            color: "#D4A373",
            borderRadius: [3, 3, 0, 0],
          },
          markArea: {
            silent: true,
            itemStyle: { color: "rgba(16, 185, 129, 0.08)" },
            label: {
              color: "#6ee7b7",
              fontSize: 10,
              position: "insideTopRight",
              formatter: `Rentang wajar ${fm(lo, 1)}–${fm(hi, 1)}`,
            },
            data: [[{ xAxis: 0 }, { xAxis: bins.length - 1 }]],
          },
        },
      ],
    };
  }, [data]);

  // 3. Boxplot per cultivation practice
  const boxplotOption = useMemo(() => {
    const summary = data?.cultivation_by_practice?.summary;
    if (!summary?.length) return null;
    return {
      tooltip: {
        trigger: "item",
        formatter: (p) => {
          const item = summary[p.dataIndex];
          if (!item) return "";
          return `<div style="font-weight:700;margin-bottom:4px;">${item.praktik} (${item.count} lot)</div>
                  <div style="font-family:'JetBrains Mono',monospace;font-size:11.5px;">
                    Max: ${fm(item.max, 3)}<br/>
                    Q3: ${fm(item.q3, 3)}<br/>
                    Median: <strong style="color:#fbbf24;">${fm(item.median, 3)}</strong><br/>
                    Q1: ${fm(item.q1, 3)}<br/>
                    Min: ${fm(item.min, 3)}
                  </div>`;
        },
      },
      grid: { top: 24, left: 52, right: 16, bottom: 32 },
      xAxis: {
        type: "category",
        data: summary.map((s) => s.praktik),
        axisLabel: { color: "#e7e5e4", fontSize: 12 },
        axisLine: { lineStyle: { color: "#3f332c" } },
      },
      yAxis: {
        type: "value",
        name: "kg CO₂e / kg ceri",
        nameTextStyle: { color: "#78716c", fontSize: 10 },
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      series: [
        {
          name: "Praktik Budidaya",
          type: "boxplot",
          boxWidth: ["25%", "48%"],
          data: summary.map((s) => ({
            value: [s.min, s.q1, s.median, s.q3, s.max],
            itemStyle: {
              color: `${PRACTICE_COLORS[s.praktik] || "#10B981"}33`,
              borderColor: PRACTICE_COLORS[s.praktik] || "#10B981",
              borderWidth: 2,
            },
          })),
        },
      ],
    };
  }, [data]);

  // 4. Scatter: Cupping score vs Carbon intensity grouped by tujuan
  const scatterOption = useMemo(() => {
    const pts = data?.cupping_vs_intensity;
    if (!pts?.length) return null;
    const byDest = {};
    pts.forEach((p) => {
      if (!byDest[p.tujuan]) byDest[p.tujuan] = [];
      byDest[p.tujuan].push(p);
    });
    const destNames = Object.keys(byDest).sort();
    return {
      tooltip: {
        trigger: "item",
        formatter: (p) => {
          const d = p.data.raw;
          return `<div style="font-weight:700;color:#fbbf24;">${d.fg_id}</div>
                  <div style="font-size:11px;color:#a8a29e;">${d.tujuan} · ${d.kemasan} kemasan</div>
                  <div style="font-family:'JetBrains Mono',monospace;font-size:11.5px;margin-top:3px;">
                    Cupping: ${fm(d.cupping, 2)}<br/>
                    Intensitas: ${fm(d.per_kg, 2)} kg CO₂e/kg
                  </div>`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#a8a29e", fontSize: 10.5 },
        itemWidth: 9,
        itemHeight: 9,
      },
      grid: { top: 20, left: 48, right: 16, bottom: 56 },
      xAxis: {
        type: "value",
        scale: true,
        name: "Skor Cupping",
        nameLocation: "middle",
        nameGap: 24,
        nameTextStyle: { color: "#78716c", fontSize: 10 },
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      yAxis: {
        type: "value",
        scale: true,
        name: "kg CO₂e / kg",
        nameTextStyle: { color: "#78716c", fontSize: 10 },
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      series: destNames.map((dest, idx) => ({
        name: dest,
        type: "scatter",
        symbolSize: 8,
        itemStyle: { color: STAGE_COLORS[idx % STAGE_COLORS.length], opacity: 0.85 },
        data: byDest[dest].map((d) => ({
          value: [d.cupping, d.per_kg],
          raw: d,
        })),
      })),
    };
  }, [data]);

  const scatterEvents = useMemo(
    () => ({
      click: (params) => {
        const fgId = params?.data?.raw?.fg_id;
        if (fgId && onOpenBatch) onOpenBatch(fgId);
      },
    }),
    [onOpenBatch]
  );

  // 5. Simulation Grouped Bar
  const simBarOption = useMemo(() => {
    const stages = simResult?.stages;
    if (!stages?.length) return null;
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const title = params[0]?.axisValue || "";
          const rows = params
            .map(
              (p) =>
                `<div style="display:flex;justify-content:space-between;gap:14px;font-size:11.5px;">
                  <span>${p.marker}${p.seriesName}</span>
                  <span style="font-family:'JetBrains Mono',monospace;">${fm(p.value, 1)} kg</span>
                </div>`
            )
            .join("");
          return `<div style="font-weight:600;margin-bottom:4px;">${title}</div>${rows}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#a8a29e", fontSize: 11 },
      },
      grid: { top: 20, left: 54, right: 16, bottom: 44 },
      xAxis: {
        type: "category",
        data: STAGE_NAMES,
        axisLabel: { color: "#d6d3d1", fontSize: 11, interval: 0 },
        axisLine: { lineStyle: { color: "#3f332c" } },
      },
      yAxis: {
        type: "value",
        name: "kg CO₂e",
        nameTextStyle: { color: "#78716c", fontSize: 10 },
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      series: [
        {
          name: "Dasar",
          type: "bar",
          barMaxWidth: 26,
          itemStyle: { color: "#D4A373", borderRadius: [5, 5, 0, 0] },
          data: stages.map((s) => s.baseline_kg),
        },
        {
          name: "Skenario",
          type: "bar",
          barMaxWidth: 26,
          itemStyle: { color: "#10B981", borderRadius: [5, 5, 0, 0] },
          data: stages.map((s) => s.scenario_kg),
        },
      ],
    };
  }, [simResult]);

  if (loading && !data) return <PageSkeleton />;
  if (error) {
    return (
      <GlassCard className="border-terracotta-500/40 bg-red-950/20">
        <p className="text-sm text-red-300">Gagal memuat analisis karbon: {error}</p>
      </GlassCard>
    );
  }
  if (!data) return null;

  const sliderConfigs = [
    {
      key: "pupuk_n_pct",
      label: "Pupuk N berkurang (%)",
      max: 100,
      hint: "Mengurangi emisi produksi & N₂O lahan",
    },
    {
      key: "lpg_pct",
      label: "LPG roasting lebih hemat (%)",
      max: 50,
      hint: "Optimasi burner & recovery panas roaster",
    },
    {
      key: "listrik_pct",
      label: "Listrik lebih bersih (%)",
      max: 100,
      hint: "Transisi panel surya / energi terbarukan",
    },
    {
      key: "kemasan_pct",
      label: "Bahan kemasan berkurang (%)",
      max: 50,
      hint: "Ringankan film laminasi & kardus",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-stone-50">Di mana emisi terbesar?</h1>
          <p className="text-xs text-stone-400">
            Menampilkan {data.valid_batches_count} batch valid; {data.excluded_batches_count} batch di
            luar rentang wajar {fm(data.rentang_intensitas[0], 1)}–{fm(data.rentang_intensitas[1], 1)}{" "}
            kg CO₂e/kg dikecualikan.
          </p>
        </div>
      </div>

      {/* 2x2 CHARTS */}
      <div className="grid gap-5 lg:grid-cols-2">
        <GlassCard>
          <h2 className="mb-2 text-base font-bold text-stone-100">
            Emisi per Sumber (12 Komponen, kg CO₂e)
          </h2>
          {compOption && <EChartBox option={compOption} className="h-80 w-full" />}
        </GlassCard>

        <GlassCard>
          <h2 className="mb-2 text-base font-bold text-stone-100">
            Sebaran Intensitas Karbon Antar Batch
          </h2>
          {histOption && <EChartBox option={histOption} className="h-80 w-full" />}
        </GlassCard>

        <GlassCard>
          <h2 className="mb-2 text-base font-bold text-stone-100">
            Emisi Budidaya per kg Ceri Menurut Praktik
          </h2>
          {boxplotOption && <EChartBox option={boxplotOption} className="h-80 w-full" />}
        </GlassCard>

        <GlassCard>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-100">
              Skor Cupping vs Intensitas Karbon
            </h2>
            <span className="text-[11px] text-stone-400">Klik titik untuk buka batch</span>
          </div>
          {scatterOption && (
            <EChartBox option={scatterOption} className="h-80 w-full" onEvents={scatterEvents} />
          )}
        </GlassCard>
      </div>

      {/* TOP 5 LOWEST & HIGHEST */}
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          {
            title: "5 Batch Intensitas Terendah",
            rows: data.top5_lowest,
            accent: "text-emerald-400",
          },
          {
            title: "5 Batch Intensitas Tertinggi",
            rows: data.top5_highest,
            accent: "text-terracotta-400",
          },
        ].map((grp) => (
          <GlassCard key={grp.title}>
            <h3 className="mb-3 text-sm font-bold text-stone-100">{grp.title}</h3>
            <div className="space-y-2">
              {grp.rows.map((r) => (
                <button
                  key={r.fg_id}
                  type="button"
                  onClick={() => onOpenBatch(r.fg_id)}
                  className="flex w-full items-center justify-between rounded-xl border border-stone-800/80 bg-stone-950/50 px-3.5 py-2.5 text-left transition hover:border-amber-500/40"
                >
                  <div>
                    <div className="font-mono text-xs font-bold text-amber-300">{r.fg_id}</div>
                    <div className="text-[11px] text-stone-400">
                      {r.tujuan_distribusi} · {r.jumlah_kemasan} kemasan
                    </div>
                  </div>
                  <div className="text-right font-metric">
                    <div className={`text-sm font-bold ${grp.accent}`}>{fm(r.per_kg, 2)} kg/kg</div>
                    <div className="text-[11px] text-stone-400">
                      {fm(r.g_per_kemasan, 0)} g / pouch
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* WHAT-IF SIMULATION LAB */}
      <GlassCard className="border-emerald-500/25 p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sliders className="h-4.5 w-4.5 text-emerald-400" />
              <h2 className="text-lg font-extrabold text-stone-50">
                Simulasi Pengurangan Emisi (What-If)
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-400">
              Geser parameter untuk menghitung ulang emisi lewat{" "}
              <code className="font-mono text-amber-300">POST /api/simulate</code> (debounce 150ms).
              Ini perhitungan skenario, bukan data pengukuran lapangan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSliders(DEFAULT_SLIDERS)}
              className="inline-flex items-center gap-1 rounded-xl border border-stone-700 bg-stone-900 px-3 py-1.5 text-xs text-stone-300 hover:border-stone-500"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() =>
                setSliders({ pupuk_n_pct: 50, lpg_pct: 25, listrik_pct: 80, kemasan_pct: 20 })
              }
              className="rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
            >
              Transisi Hijau
            </button>
            <button
              type="button"
              onClick={() =>
                setSliders({ pupuk_n_pct: 100, lpg_pct: 50, listrik_pct: 100, kemasan_pct: 50 })
              }
              className="rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
            >
              Maksimal
            </button>
          </div>
        </div>

        {/* 4 Sliders */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {sliderConfigs.map((cfg) => (
            <div
              key={cfg.key}
              className="rounded-xl border border-stone-800 bg-stone-950/60 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-200">{cfg.label}</label>
                <span className="font-metric text-sm font-bold text-amber-300">
                  {sliders[cfg.key]}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={cfg.max}
                step={5}
                value={sliders[cfg.key]}
                onChange={(e) =>
                  setSliders((prev) => ({ ...prev, [cfg.key]: Number(e.target.value) }))
                }
                className="roast-slider w-full"
              />
              <p className="text-[11px] text-stone-500">{cfg.hint}</p>
            </div>
          ))}
        </div>

        {/* 3 Live Metric Cards */}
        {simResult && (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-4">
              <div className="text-xs text-stone-400">Emisi Dasar</div>
              <div className="mt-1 font-metric text-2xl font-bold text-stone-200">
                {fm(simResult.baseline_total_ton, 2)} ton CO₂e
              </div>
              <div className="text-[11px] text-stone-500">
                {fm(simResult.baseline_total_kg, 0)} kg total
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-300">Emisi Skenario</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 font-metric text-xs font-bold text-emerald-300">
                  <TrendingDown className="h-3 w-3" />
                  {fm(simResult.reduction_pct, 1)}%
                </span>
              </div>
              <div className="mt-1 font-metric text-2xl font-bold text-emerald-300">
                {fm(simResult.scenario_total_ton, 2)} ton CO₂e
              </div>
              <div className="text-[11px] text-emerald-200/70">
                {simLoading ? "Menghitung ulang..." : `Hemat ${fm(simResult.reduction_kg, 0)} kg CO₂e`}
              </div>
            </div>

            <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-4">
              <div className="text-xs text-stone-400">Per Kemasan 200 g (Skenario)</div>
              <div className="mt-1 font-metric text-2xl font-bold text-amber-300">
                {fm(simResult.scenario_g_per_package, 0)} g CO₂e
              </div>
              <div className="text-[11px] text-stone-500">
                Dasar: {fm(simResult.baseline_g_per_package, 0)} g CO₂e
              </div>
            </div>
          </div>
        )}

        {/* Grouped Bar Comparison */}
        {simBarOption && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-bold text-stone-200">
              Emisi per Tahap: Dasar vs Skenario (kg CO₂e)
            </h3>
            <EChartBox option={simBarOption} className="h-72 w-full" />
          </div>
        )}
      </GlassCard>
    </div>
  );
}
