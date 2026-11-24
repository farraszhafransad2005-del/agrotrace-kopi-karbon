import React, { useMemo } from "react";
import {
  ArrowRight,
  Flame,
  Package,
  Scale,
  ShieldCheck,
  Sprout,
  Layers,
  Info,
} from "lucide-react";
import GlassCard from "../components/ui/GlassCard";
import { PageSkeleton } from "../components/ui/Skeleton";
import EChartBox from "../components/charts/EChartBox";
import GayoFarmMap from "../components/charts/GayoFarmMap";
import HeroCoffeePouch3D from "../components/three/HeroCoffeePouch3D";
import { STAGE_COLORS, fm, fmtMonth } from "../utils/format";

export default function OverviewPage({ data, loading, error, onNavigate }) {
  const donutOption = useMemo(() => {
    if (!data?.stages) return null;
    return {
      tooltip: {
        trigger: "item",
        formatter: (p) =>
          `<div style="font-weight:600;margin-bottom:2px;">${p.name}</div>
           <div style="font-family:'JetBrains Mono',monospace;">${fm(p.value, 1)} kg CO₂e (${fm(p.percent, 1)}%)</div>`,
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#a8a29e", fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          name: "Tahap",
          type: "pie",
          radius: ["48%", "74%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: "#14100e", borderWidth: 2 },
          label: {
            show: true,
            color: "#e7e5e4",
            fontSize: 11,
            formatter: "{d}%",
          },
          data: data.stages.map((s, idx) => ({
            name: s.name,
            value: s.total_kg_co2e,
            itemStyle: { color: STAGE_COLORS[idx] },
          })),
        },
      ],
    };
  }, [data]);

  const sankeyOption = useMemo(() => {
    if (!data?.sankey) return null;
    const nodeColors = [
      "#10B981",
      "#84CC16",
      "#78716C",
      "#D4A373",
      "#57534E",
      "#E05A47",
      "#78716C",
      "#F59E0B",
      "#57534E",
    ];
    return {
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        formatter: (p) => {
          if (p.dataType === "edge") {
            return `<div style="font-weight:600;">${p.data.source_name} → ${p.data.target_name}</div>
                    <div style="font-family:'JetBrains Mono',monospace;color:#fbbf24;">${fm(p.data.value, 1)} kg</div>`;
          }
          return `<div style="font-weight:600;">${p.name}</div>`;
        },
      },
      series: [
        {
          type: "sankey",
          left: 8,
          right: 110,
          top: 14,
          bottom: 14,
          nodeWidth: 14,
          nodeGap: 14,
          draggable: false,
          emphasis: { focus: "adjacency" },
          lineStyle: { color: "gradient", curveness: 0.45, opacity: 0.35 },
          label: {
            color: "#e7e5e4",
            fontSize: 11,
            fontFamily: "Inter, sans-serif",
          },
          data: data.sankey.nodes.map((n, idx) => ({
            name: n.name,
            itemStyle: { color: nodeColors[idx] || "#a8a29e", borderWidth: 0 },
          })),
          links: data.sankey.links.map((l) => ({
            source: l.source_name,
            target: l.target_name,
            value: l.value,
            source_name: l.source_name,
            target_name: l.target_name,
          })),
        },
      ],
    };
  }, [data]);

  const monthlyOption = useMemo(() => {
    if (!data?.monthly || !data?.stages) return null;
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const title = params[0]?.axisValue || "";
          const lines = params
            .map(
              (p) =>
                `<div style="display:flex;justify-content:space-between;gap:14px;font-size:11.5px;">
                  <span>${p.marker}${p.seriesName}</span>
                  <span style="font-family:'JetBrains Mono',monospace;">${fm(p.value, 1)} kg</span>
                </div>`
            )
            .join("");
          return `<div style="font-weight:600;margin-bottom:4px;">${title}</div>${lines}`;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { color: "#a8a29e", fontSize: 11 },
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: { top: 18, left: 48, right: 14, bottom: 52 },
      xAxis: {
        type: "category",
        data: data.monthly.map((m) => fmtMonth(m.bulan)),
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        axisLine: { lineStyle: { color: "#3f332c" } },
      },
      yAxis: {
        type: "value",
        name: "kg CO₂e",
        nameTextStyle: { color: "#78716c", fontSize: 10 },
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      series: data.stages.map((st, idx) => ({
        name: st.name,
        type: "bar",
        stack: "total",
        barMaxWidth: 34,
        itemStyle: {
          color: STAGE_COLORS[idx],
          borderRadius: idx === 5 ? [4, 4, 0, 0] : [0, 0, 0, 0],
        },
        data: data.monthly.map((m) => m[`t${idx}`]),
      })),
    };
  }, [data]);

  if (loading && !data) return <PageSkeleton />;

  if (error) {
    return (
      <GlassCard className="border-terracotta-500/40 bg-red-950/20">
        <h3 className="text-lg font-bold text-red-300">Gagal memuat ringkasan data</h3>
        <p className="mt-1 text-sm text-stone-300">{error}</p>
      </GlassCard>
    );
  }

  if (!data) return null;

  const { kpi, top_stage: topStage } = data;
  const kpiCards = [
    {
      label: "Batch barang jadi",
      value: fm(kpi.total_batches, 0),
      sub: `${kpi.unique_green_lots} lot green bean`,
      icon: Layers,
      accent: "text-amber-400",
    },
    {
      label: "Kemasan 200 g",
      value: fm(kpi.total_packages, 0),
      sub: `${fm(kpi.total_coffee_ton, 1)} ton kopi`,
      icon: Package,
      accent: "text-crema",
    },
    {
      label: "Estimasi emisi total",
      value: `${fm(kpi.total_emission_ton, 1)} t`,
      sub: `CO₂e, ${kpi.valid_batches_count} batch valid`,
      icon: Flame,
      accent: "text-terracotta-500",
    },
    {
      label: "CO₂e per kemasan",
      value: `${fm(kpi.avg_g_per_package, 0)} g`,
      sub: "rata-rata batch valid",
      icon: Sprout,
      accent: "text-emerald-400",
    },
    {
      label: "kg CO₂e / kg sangrai",
      value: fm(kpi.avg_kg_co2e_per_kg_roast, 2),
      sub: "rata-rata intensitas",
      icon: Scale,
      accent: "text-amber-400",
    },
    {
      label: "Batch lulus audit",
      value: `${fm(kpi.audit_pass_rate_pct, 0)}%`,
      sub: `${kpi.audit_review_count} perlu ditinjau`,
      icon: ShieldCheck,
      accent: "text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* HERO BENTO */}
      <GlassCard className="relative overflow-hidden border-amber-500/20 p-6 sm:p-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                Kopi Arabika Gayo Natural
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                Medium Roast · 200 g
              </span>
              <span className="rounded-full border border-stone-700 bg-stone-800/70 px-3 py-1 text-xs text-stone-300">
                Data Simulasi
              </span>
            </div>

            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-stone-50 sm:text-4xl lg:text-[42px] lg:leading-[1.12]">
                AgroTrace{" "}
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
                  Carbon Passport
                </span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-300 sm:text-base">
                Ketertelusuran rantai pasok kopi dari kebun di dataran tinggi Gayo hingga kemasan
                siap kirim, dihitung ulang langsung dari data aktivitas dan faktor emisi lewat{" "}
                <code className="rounded bg-stone-800/90 px-1.5 py-0.5 font-mono text-xs text-amber-300">
                  agrotrace_lib.py
                </code>
                .
              </p>
            </div>

            {/* Insight Hotspot Banner */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs font-mono uppercase tracking-wider text-emerald-300">
                Temuan Utama Emisi
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">
                Tahap <strong className="text-amber-300">{topStage.name}</strong> menyumbang{" "}
                <strong className="font-metric text-emerald-300">{fm(topStage.share_pct, 0)}%</strong>{" "}
                ({fm(topStage.total_kg_co2e, 0)} kg CO₂e) dari estimasi emisi seluruh batch valid.
                Uji skenario pengurangan di halaman Analisis Karbon.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate("batch")}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-5 py-2.5 text-sm font-bold text-stone-950 shadow-glow transition hover:brightness-110"
              >
                Telusuri Paspor Batch
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("carbon")}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-700 bg-stone-900/70 px-5 py-2.5 text-sm font-semibold text-stone-200 transition hover:border-amber-500/40 hover:text-amber-200"
              >
                Simulasi What-If
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <HeroCoffeePouch3D
              avgPerPackage={kpi.avg_g_per_package}
              totalBatches={kpi.total_batches}
            />
          </div>
        </div>
      </GlassCard>

      {/* 6 KPI BENTO CARDS */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpiCards.map((item, idx) => {
          const Icon = item.icon;
          return (
            <GlassCard key={item.label} hover delay={idx * 0.04} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-400">{item.label}</span>
                <Icon className={`h-4 w-4 ${item.accent}`} />
              </div>
              <div className="mt-2 font-metric text-2xl font-bold tracking-tight text-stone-50">
                {item.value}
              </div>
              <div className="mt-1 text-[11.5px] text-stone-400">{item.sub}</div>
            </GlassCard>
          );
        })}
      </div>

      {kpi.excluded_batches_count > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-2.5 text-xs text-stone-300">
          <Info className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            {kpi.excluded_batches_count} batch dikecualikan dari agregat karbon karena intensitasnya di
            luar rentang wajar {fm(data.rentang_intensitas[0], 1)}–{fm(data.rentang_intensitas[1], 1)} kg
            CO₂e/kg (kemungkinan salah input; lihat halaman Audit).
          </span>
        </div>
      )}

      {/* 2x2 BENTO VISUALIZATIONS */}
      <div className="grid gap-5 lg:grid-cols-12">
        <GlassCard className="lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-100">Kontribusi Emisi per Tahap</h2>
            <span className="font-mono text-xs text-stone-400">6 tahap</span>
          </div>
          {donutOption && <EChartBox option={donutOption} className="h-80 w-full" />}
        </GlassCard>

        <GlassCard className="lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-100">
              Aliran Massa: Ceri Panen → Kemasan (kg)
            </h2>
            <span className="font-mono text-xs text-stone-400">
              {fm(data.sankey.totals.ceri_kg, 0)} kg ceri → {fm(data.sankey.totals.dikemas_kg, 0)} kg dikemas
            </span>
          </div>
          {sankeyOption && <EChartBox option={sankeyOption} className="h-80 w-full" />}
        </GlassCard>

        <GlassCard className="lg:col-span-7">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-100">
              Emisi per Bulan Kemas (kg CO₂e)
            </h2>
            <span className="font-mono text-xs text-stone-400">{data.monthly.length} bulan</span>
          </div>
          {monthlyOption && <EChartBox option={monthlyOption} className="h-80 w-full" />}
        </GlassCard>

        <GlassCard className="lg:col-span-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-stone-100">
              Peta Kebun Asal ({data.farms.length} Kebun)
            </h2>
            <span className="font-mono text-xs text-stone-400">Aceh Tengah & Bener Meriah</span>
          </div>
          <GayoFarmMap farms={data.farms} className="h-[296px] w-full" />
          <p className="mt-2 text-[11px] text-stone-500">
            Koordinat perkiraan tingkat desa (simulasi), bukan lokasi GPS kebun sebenarnya.
          </p>
        </GlassCard>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border border-stone-800 bg-stone-900/50 px-4 py-3 text-xs leading-relaxed text-stone-400">
        {data.catatan}
      </div>
    </div>
  );
}
