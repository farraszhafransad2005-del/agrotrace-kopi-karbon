import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal2,
  MapPin,
  QrCode,
  RotateCcw,
  Search,
} from "lucide-react";
import { getBatches, getBatchDetail } from "../api/client";
import GlassCard from "../components/ui/GlassCard";
import { SkeletonBlock } from "../components/ui/Skeleton";
import { AuditBadge, IntensityBadge } from "../components/ui/StatusBadge";
import EChartBox from "../components/charts/EChartBox";
import PassportCard3D from "../components/three/PassportCard3D";
import { STAGE_COLORS, fm, fmtDate } from "../utils/format";

export default function BatchExplorerPage({ selectedFgId, onSelectFgId }) {
  const [batchList, setBatchList] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [tujuanFilter, setTujuanFilter] = useState("Semua");
  const [statusFilter, setStatusFilter] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");

  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [error, setError] = useState(null);

  const [activeStage, setActiveStage] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const [qrDataUrl, setQrDataUrl] = useState("");
  const [show2dQr, setShow2dQr] = useState(true);
  const [copied, setCopied] = useState(false);

  // Load filterable batch list
  useEffect(() => {
    let active = true;
    getBatches({ tujuan: tujuanFilter, status: statusFilter, search: searchQuery })
      .then((res) => {
        if (!active) return;
        setBatchList(res.items || []);
        setDestinations(res.destinations || []);
        if (!selectedFgId && res.items?.length) {
          onSelectFgId(res.items[0].fg_id);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [tujuanFilter, statusFilter, searchQuery]);

  // Load selected batch detail
  useEffect(() => {
    if (!selectedFgId) return undefined;
    let active = true;
    setLoadingDetail(true);
    setError(null);

    getBatchDetail(selectedFgId)
      .then((res) => {
        if (!active) return;
        setDetail(res);
        setLoadingDetail(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setLoadingDetail(false);
      });
    return () => {
      active = false;
    };
  }, [selectedFgId]);

  // Generate 2D high-contrast QR PNG Data URL for easy mobile scanning & download
  useEffect(() => {
    if (!detail?.qr_payload) return undefined;
    let active = true;
    QRCode.toDataURL(detail.qr_payload, {
      width: 320,
      margin: 2,
      color: { dark: "#0c0a09", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [detail?.qr_payload]);

  const waterfallOption = useMemo(() => {
    if (!detail?.karbon?.waterfall) return null;
    const wf = detail.karbon.waterfall;
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params) => {
          const item = params.find((p) => p.seriesName === "Emisi");
          if (!item) return "";
          return `<div style="font-weight:600;">${item.name}</div>
                  <div style="font-family:'JetBrains Mono',monospace;color:#fbbf24;">${fm(item.value, 2)} kg CO₂e</div>`;
        },
      },
      grid: { top: 28, left: 52, right: 18, bottom: 38 },
      xAxis: {
        type: "category",
        data: wf.map((w) => w.label),
        axisLabel: { color: "#d6d3d1", fontSize: 11, interval: 0 },
        axisLine: { lineStyle: { color: "#3f332c" } },
      },
      yAxis: {
        type: "value",
        name: "kg CO₂e",
        nameTextStyle: { color: "#78716c", fontSize: 11 },
        axisLabel: { color: "#a8a29e", fontSize: 11 },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      series: [
        {
          name: "Base",
          type: "bar",
          stack: "waterfall",
          silent: true,
          itemStyle: { borderColor: "transparent", color: "transparent" },
          emphasis: { itemStyle: { borderColor: "transparent", color: "transparent" } },
          data: wf.map((w) => w.start),
        },
        {
          name: "Emisi",
          type: "bar",
          stack: "waterfall",
          barMaxWidth: 46,
          label: {
            show: true,
            position: "top",
            color: "#f5f5f4",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            formatter: (p) => fm(p.value, 1),
          },
          data: wf.map((w, idx) => ({
            value: w.value,
            itemStyle: {
              color: w.type === "total" ? "#F59E0B" : STAGE_COLORS[idx] || "#10B981",
              borderRadius: [6, 6, 0, 0],
            },
          })),
        },
      ],
    };
  }, [detail]);

  const handleCopyPayload = () => {
    if (!detail?.qr_payload) return;
    navigator.clipboard?.writeText(detail.qr_payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl || !detail) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `qr_${detail.fg_id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stages = detail?.karbon?.tahap || [];
  const stageObj = stages[activeStage];

  return (
    <div className="space-y-6">
      {/* FILTER BAR */}
      <GlassCard className="p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
              Pilih Kode Batch
            </label>
            <select
              value={selectedFgId || ""}
              onChange={(e) => onSelectFgId(e.target.value)}
              className="w-full rounded-xl border border-stone-700/80 bg-stone-900/90 px-3 py-2 font-mono text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
            >
              {!batchList.some((b) => b.fg_id === selectedFgId) && selectedFgId && (
                <option value={selectedFgId}>{selectedFgId}</option>
              )}
              {batchList.map((b) => (
                <option key={b.fg_id} value={b.fg_id}>
                  {b.fg_id} · {b.tujuan_distribusi} ({b.status_audit})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
              Cari ID / Lot / Tujuan
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mis. FG-GYO-2602"
                className="w-full rounded-xl border border-stone-700/80 bg-stone-900/90 py-2 pl-9 pr-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="md:col-span-3">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
              Tujuan Distribusi
            </label>
            <select
              value={tujuanFilter}
              onChange={(e) => setTujuanFilter(e.target.value)}
              className="w-full rounded-xl border border-stone-700/80 bg-stone-900/90 px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="Semua">Semua Tujuan</option>
              {destinations.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-stone-400">
              Status Audit
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-stone-700/80 bg-stone-900/90 px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="Semua">Semua ({batchList.length})</option>
              <option value="Lulus">Lulus</option>
              <option value="Perlu ditinjau">Perlu ditinjau</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {error && (
        <GlassCard className="border-terracotta-500/40 bg-red-950/20">
          <p className="text-sm text-red-300">Gagal memuat batch: {error}</p>
        </GlassCard>
      )}

      {loadingDetail && !detail ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <GlassCard className="lg:col-span-6">
            <SkeletonBlock className="h-72 w-full" />
          </GlassCard>
          <GlassCard className="lg:col-span-6 space-y-4">
            <SkeletonBlock className="h-8 w-56" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-28 w-full" />
          </GlassCard>
        </div>
      ) : (
        detail && (
          <>
            {/* PASSPORT 3D + SUMMARY + QR 2D */}
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Left: Interactive 3D Digital Passport Card */}
              <GlassCard className="lg:col-span-6 flex flex-col justify-between gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                      Paspor Karbon Digital 3D
                    </h2>
                    <p className="text-xs text-stone-400">
                      Putar bebas atau balik kartu untuk melihat ringkasan 6 tahap
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFlipped((f) => !f)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/20"
                    >
                      <FlipHorizontal2 className="h-3.5 w-3.5" />
                      {flipped ? "Sisi Depan" : "Balik Kartu"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFlipped(false);
                        setResetSignal((n) => n + 1);
                      }}
                      title="Reset posisi 3D"
                      className="inline-flex items-center gap-1 rounded-xl border border-stone-700 bg-stone-900/70 px-2.5 py-1.5 text-xs text-stone-300 hover:border-stone-500"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <PassportCard3D batch={detail} flipped={flipped} resetSignal={resetSignal} />
              </GlassCard>

              {/* Right: Summary & Scannable 2D QR Panel */}
              <GlassCard className="lg:col-span-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AuditBadge status={detail.status_audit} />
                    <IntensityBadge category={detail.kategori} />
                    {!detail.valid && (
                      <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                        Outlier intensitas
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="font-metric text-2xl font-extrabold text-stone-50">
                      {detail.fg_id}
                    </h1>
                    <p className="text-xs text-stone-400">{detail.produk}</p>
                  </div>

                  <p className="text-sm leading-relaxed text-stone-300">
                    Berisi <strong className="text-stone-100">{fm(detail.jumlah_kemasan, 0)} kemasan</strong>{" "}
                    (dikemas {fmtDate(detail.tgl_kemas)}), dipanen dari{" "}
                    <strong className="text-stone-100">{detail.summary.petani_count} petani</strong> di{" "}
                    {detail.summary.kabupaten_list.join(" & ")}, dijemur rata-rata{" "}
                    <strong className="text-stone-100">{fm(detail.summary.avg_lama_jemur_hari, 1)} hari</strong>,
                    lalu disangrai dalam {detail.summary.roast_count} batch roasting. Skor cupping green bean{" "}
                    <strong className="font-metric text-amber-300">
                      {fm(detail.summary.skor_cupping, 2)}
                    </strong>
                    .
                  </p>

                  {/* 3 Batch Carbon Metrics */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
                      <div className="text-[11px] text-stone-400">Emisi Batch</div>
                      <div className="mt-1 font-metric text-lg font-bold text-stone-100">
                        {fm(detail.karbon.total, 1)} kg
                      </div>
                      <div className="text-[10px] text-stone-500">CO₂e total</div>
                    </div>
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
                      <div className="text-[11px] text-emerald-300">Per Kemasan 200 g</div>
                      <div className="mt-1 font-metric text-lg font-bold text-emerald-300">
                        {fm(detail.karbon.g_per_kemasan, 0)} g
                      </div>
                      <div className="text-[10px] text-stone-400">CO₂e / pouch</div>
                    </div>
                    <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
                      <div className="text-[11px] text-stone-400">Intensitas</div>
                      <div className="mt-1 font-metric text-lg font-bold text-amber-300">
                        {fm(detail.karbon.per_kg, 2)}
                      </div>
                      <div className="text-[10px] text-stone-500">
                        rata² valid {fm(detail.summary.avg_valid_per_kg, 2)}
                      </div>
                    </div>
                  </div>

                  {detail.failed_rules?.length > 0 && (
                    <div className="rounded-xl border border-terracotta-500/40 bg-terracotta-500/10 p-3 text-xs text-red-200">
                      <div className="mb-1 flex items-center gap-1.5 font-semibold text-red-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Temuan Audit ({detail.failed_rules.length})
                      </div>
                      <ul className="space-y-0.5 text-red-200/90">
                        {detail.failed_rules.map((r) => (
                          <li key={r.code}>
                            <span className="font-mono font-bold">{r.code}:</span> {r.aturan} (
                            {r.catatan})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Scannable 2D QR & Download Bar */}
                <div className="rounded-xl border border-stone-800 bg-stone-950/70 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {show2dQr && qrDataUrl && (
                        <div className="shrink-0 rounded-lg bg-white p-1.5 shadow">
                          <img
                            src={qrDataUrl}
                            alt={`QR Passport ${detail.fg_id}`}
                            className="h-20 w-20 block"
                          />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-200">
                          <QrCode className="h-3.5 w-3.5 text-amber-400" />
                          QR Passport 2D (Siap Pindai Kamera HP)
                        </div>
                        <p className="mt-0.5 break-all font-mono text-[11px] text-stone-400">
                          {detail.qr_payload}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleDownloadQr}
                            disabled={!qrDataUrl}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/35 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download QR (PNG)
                          </button>
                          <button
                            type="button"
                            onClick={handleCopyPayload}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs text-stone-300 hover:border-stone-500"
                          >
                            {copied ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                                Tersalin
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Salin Kode
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShow2dQr((v) => !v)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1 text-xs text-stone-300 hover:border-stone-500"
                          >
                            {show2dQr ? (
                              <>
                                <EyeOff className="h-3.5 w-3.5" />
                                Sembunyikan 2D
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                Tampilkan 2D
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* 6-STAGE INTERACTIVE STEPPER */}
            <GlassCard className="p-5">
              <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {stages.map((st, idx) => {
                  const active = activeStage === idx;
                  return (
                    <button
                      key={st.index}
                      type="button"
                      onClick={() => setActiveStage(idx)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        active
                          ? "border-amber-400/70 bg-gradient-to-br from-amber-500/15 to-emerald-500/10 shadow-glow"
                          : "border-stone-800 bg-stone-950/50 hover:border-stone-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-stone-950"
                          style={{ backgroundColor: STAGE_COLORS[idx] }}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-metric text-[11px] text-stone-400">
                          {fm(st.share_pct, 0)}%
                        </span>
                      </div>
                      <div className="mt-2 text-xs font-semibold text-stone-100">{st.name}</div>
                      <div className="font-metric text-xs font-bold text-amber-300">
                        {fm(st.total_kg_co2e, 2)} kg
                      </div>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={`${detail.fg_id}-${activeStage}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="grid gap-5 lg:grid-cols-12"
                >
                  {/* Stage Activity Details */}
                  <div className="lg:col-span-8 rounded-xl border border-stone-800/90 bg-stone-950/55 p-4">
                    {activeStage === 0 && (
                      <div>
                        <h3 className="mb-3 text-sm font-bold text-stone-100">
                          Panen & Angkut: Asal Petani dan Kebun ({detail.stages_data.panen.length} Lot)
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {detail.stages_data.panen.map((h) => (
                            <div
                              key={h.harvest_id}
                              className="rounded-xl border border-stone-800 bg-stone-900/70 p-3 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-amber-300">
                                  {h.harvest_id} · {h.petani}
                                </span>
                                <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                  {h.praktik_budidaya}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-stone-400">
                                <MapPin className="h-3 w-3" />
                                {h.desa}, {h.kabupaten} · {h.ketinggian_mdpl} mdpl · {h.varietas}
                              </div>
                              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                                <div>
                                  <span className="block text-[10px] text-stone-500">Ceri</span>
                                  {fm(h.berat_ceri_kg, 0)} kg
                                </div>
                                <div>
                                  <span className="block text-[10px] text-stone-500">Pupuk N</span>
                                  {fm(h.pupuk_n_kg, 2)} kg
                                </div>
                                <div>
                                  <span className="block text-[10px] text-stone-500">Solar</span>
                                  {fm(h.solar_angkut_liter, 2)} L
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeStage === 1 && (
                      <div>
                        <h3 className="mb-2 text-sm font-bold text-stone-100">
                          Pascapanen: Penjemuran Natural
                        </h3>
                        <p className="mb-3 text-xs text-stone-400">
                          Penjemuran memakai sinar matahari tanpa bahan bakar; emisi tahap ini berasal
                          dari listrik sortasi & pengadukan.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-stone-800 text-[11px] uppercase text-stone-400">
                              <tr>
                                <th className="py-2 pr-3">Lot</th>
                                <th className="py-2 pr-3">Metode</th>
                                <th className="py-2 pr-3">Jemur</th>
                                <th className="py-2 pr-3">KA Kering</th>
                                <th className="py-2 pr-3">Apung</th>
                                <th className="py-2">Listrik</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-800/60">
                              {detail.stages_data.pascapanen.map((p) => (
                                <tr key={p.harvest_id} className="text-stone-200">
                                  <td className="py-2 pr-3 font-mono font-semibold text-amber-300">
                                    {p.harvest_id}
                                  </td>
                                  <td className="py-2 pr-3">{p.metode_jemur}</td>
                                  <td className="py-2 pr-3 font-mono">{p.lama_jemur_hari} hr</td>
                                  <td className="py-2 pr-3 font-mono">{fm(p.kadar_air_kering_persen, 1)}%</td>
                                  <td className="py-2 pr-3 font-mono">{fm(p.ceri_apung_persen, 1)}%</td>
                                  <td className="py-2 font-mono">{fm(p.listrik_sortasi_kwh, 2)} kWh</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activeStage === 2 && (
                      <div>
                        <h3 className="mb-3 text-sm font-bold text-stone-100">
                          Lot Green Bean: {detail.stages_data.green.green_id}
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {[
                            ["Tanggal hulling", fmtDate(detail.stages_data.green.tgl_hulling)],
                            ["Berat green bean", `${fm(detail.stages_data.green.berat_green_kg, 1)} kg`],
                            ["Rendemen", `${fm(detail.stages_data.green.rendemen_persen, 1)}%`],
                            ["Ukuran ayakan", detail.stages_data.green.ukuran_ayakan],
                            ["Cacat / 300 g", detail.stages_data.green.cacat_per_300g],
                            ["Kadar air", `${fm(detail.stages_data.green.kadar_air_green_persen, 1)}%`],
                            ["Skor cupping", fm(detail.stages_data.green.skor_cupping, 2)],
                            ["Listrik hulling", `${fm(detail.stages_data.green.listrik_hulling_kwh, 2)} kWh`],
                            ["Lama simpan", `${detail.stages_data.green.lama_simpan_hari} hari`],
                          ].map(([k, v]) => (
                            <div key={k} className="rounded-xl border border-stone-800 bg-stone-900/70 p-3">
                              <div className="text-[11px] text-stone-400">{k}</div>
                              <div className="mt-0.5 font-metric text-sm font-bold text-stone-100">
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeStage === 3 && (
                      <div>
                        <h3 className="mb-3 text-sm font-bold text-stone-100">
                          Roasting ({detail.stages_data.roasting.length} Batch ·{" "}
                          {fm(detail.karbon.kg_sangrai, 2)} kg Sangrai)
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-stone-800 text-[11px] uppercase text-stone-400">
                              <tr>
                                <th className="py-2 pr-3">Roast ID</th>
                                <th className="py-2 pr-3">Tanggal</th>
                                <th className="py-2 pr-3">Muatan</th>
                                <th className="py-2 pr-3">Suhu Charge/Drop</th>
                                <th className="py-2 pr-3">Susut</th>
                                <th className="py-2 pr-3">Sangrai</th>
                                <th className="py-2 pr-3">LPG</th>
                                <th className="py-2">Listrik</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-800/60">
                              {detail.stages_data.roasting.map((r) => (
                                <tr key={r.roast_id} className="text-stone-200">
                                  <td className="py-2 pr-3 font-mono font-semibold text-amber-300">
                                    {r.roast_id}
                                  </td>
                                  <td className="py-2 pr-3">{fmtDate(r.tgl_roasting)}</td>
                                  <td className="py-2 pr-3 font-mono">{fm(r.muatan_green_kg, 1)} kg</td>
                                  <td className="py-2 pr-3 font-mono">
                                    {r.suhu_charge_c}° / {r.suhu_drop_c}°C
                                  </td>
                                  <td className="py-2 pr-3 font-mono">{fm(r.susut_persen, 1)}%</td>
                                  <td className="py-2 pr-3 font-mono">{fm(r.berat_sangrai_kg, 2)} kg</td>
                                  <td className="py-2 pr-3 font-mono">{fm(r.lpg_kg, 2)} kg</td>
                                  <td className="py-2 font-mono">{fm(r.listrik_roasting_kwh, 2)} kWh</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {activeStage === 4 && (
                      <div>
                        <h3 className="mb-3 text-sm font-bold text-stone-100">
                          Pengemasan Barang Jadi
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {[
                            ["Kode Batch", detail.stages_data.kemas.fg_id],
                            ["Tanggal Kemas", fmtDate(detail.stages_data.kemas.tgl_kemas)],
                            ["Jumlah Kemasan 200 g", `${fm(detail.stages_data.kemas.jumlah_kemasan, 0)} pcs`],
                            ["Kedaluwarsa", fmtDate(detail.stages_data.kemas.tgl_kedaluwarsa)],
                            ["Film Kemasan", `${fm(detail.stages_data.kemas.film_kg, 3)} kg`],
                            ["Kardus", `${fm(detail.stages_data.kemas.kardus_kg, 3)} kg`],
                          ].map(([k, v]) => (
                            <div key={k} className="rounded-xl border border-stone-800 bg-stone-900/70 p-3">
                              <div className="text-[11px] text-stone-400">{k}</div>
                              <div className="mt-0.5 font-metric text-sm font-bold text-stone-100">
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeStage === 5 && (
                      <div>
                        <h3 className="mb-3 text-sm font-bold text-stone-100">Distribusi Truk</h3>
                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            ["Tujuan Distribusi", detail.stages_data.distribusi.tujuan_distribusi],
                            ["Tanggal Kirim", fmtDate(detail.stages_data.distribusi.tgl_kirim)],
                            ["Jarak Angkut", `${fm(detail.stages_data.distribusi.jarak_km, 0)} km`],
                          ].map(([k, v]) => (
                            <div key={k} className="rounded-xl border border-stone-800 bg-stone-900/70 p-3">
                              <div className="text-[11px] text-stone-400">{k}</div>
                              <div className="mt-0.5 font-metric text-sm font-bold text-stone-100">
                                {v}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stage Carbon Breakdown */}
                  <div className="lg:col-span-4 rounded-xl border border-stone-800/90 bg-stone-950/55 p-4 space-y-4">
                    <div>
                      <div className="text-xs text-stone-400">Emisi Tahap {activeStage + 1}</div>
                      <div className="mt-1 font-metric text-2xl font-bold text-amber-300">
                        {fm(stageObj?.total_kg_co2e, 2)} kg CO₂e
                      </div>
                      <div className="text-xs text-emerald-400">
                        {fm(stageObj?.share_pct, 1)}% dari total batch
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {stageObj?.components?.map((c) => {
                        const pct = stageObj.total_kg_co2e
                          ? (c.kg_co2e / stageObj.total_kg_co2e) * 100
                          : 0;
                        return (
                          <div key={c.key}>
                            <div className="flex justify-between text-xs">
                              <span className="text-stone-300">{c.label}</span>
                              <span className="font-metric text-stone-100">{fm(c.kg_co2e, 2)} kg</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-800">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(100, pct)}%`,
                                  backgroundColor: STAGE_COLORS[activeStage],
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {activeStage < 3 && (
                      <p className="rounded-lg border border-stone-800 bg-stone-900/60 p-2.5 text-[11px] leading-relaxed text-stone-400">
                        Emisi hulu (kebun, pascapanen, hulling) dialokasikan ke batch ini berdasarkan
                        massa green bean yang disangrai.
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </GlassCard>

            {/* WATERFALL CARBON ACCUMULATION */}
            <GlassCard>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-bold text-stone-100">
                  Akumulasi Karbon Sepanjang Rantai (kg CO₂e)
                </h2>
                <span className="font-mono text-xs text-amber-300">
                  Total: {fm(detail.karbon.total, 2)} kg CO₂e
                </span>
              </div>
              {waterfallOption && <EChartBox option={waterfallOption} className="h-80 w-full" />}
            </GlassCard>
          </>
        )
      )}
    </div>
  );
}
