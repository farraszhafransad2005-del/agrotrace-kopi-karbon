import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { fm } from "../../utils/format";

function interpolateColor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  // 0 -> #10B981 (emerald), 0.5 -> #F59E0B (amber), 1 -> #E05A47 (terracotta)
  const stops = [
    [16, 185, 129],
    [245, 158, 11],
    [224, 90, 71],
  ];
  const segment = clamped < 0.5 ? 0 : 1;
  const localT = clamped < 0.5 ? clamped * 2 : (clamped - 0.5) * 2;
  const c0 = stops[segment];
  const c1 = stops[segment + 1];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * localT);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * localT);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function GayoFarmMap({ farms = [], className = "h-80 w-full" }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !farms.length) return;

    const map = L.map(el, {
      center: [4.67, 96.82],
      zoom: 10,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      subdomains: "abcd",
      maxZoom: 18,
    }).addTo(map);

    const intensVals = farms.map((f) => f.kg_co2e_per_kg_ceri);
    const minI = Math.min(...intensVals);
    const maxI = Math.max(...intensVals);
    const spanI = maxI - minI || 1;

    const ceriVals = farms.map((f) => f.berat_ceri_kg);
    const minC = Math.min(...ceriVals);
    const maxC = Math.max(...ceriVals);
    const spanC = maxC - minC || 1;

    const bounds = [];

    farms.forEach((f) => {
      const normI = (f.kg_co2e_per_kg_ceri - minI) / spanI;
      const normC = (f.berat_ceri_kg - minC) / spanC;
      const color = interpolateColor(normI);
      const radius = 6 + normC * 8;

      const marker = L.circleMarker([f.lat, f.lon], {
        radius,
        color: "#0c0a09",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.85,
      }).addTo(map);

      const html = `
        <div style="min-width:190px;line-height:1.45;">
          <div style="font-weight:700;color:#fbbf24;font-size:13px;">${f.petani}</div>
          <div style="font-size:11px;color:#a8a29e;margin-bottom:6px;">${f.farm_id} · ${f.desa}, ${f.kabupaten}</div>
          <div style="display:flex;justify-content:space-between;font-size:12px;">
            <span style="color:#a8a29e;">Praktik:</span>
            <span style="font-weight:600;">${f.praktik_budidaya}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;">
            <span style="color:#a8a29e;">Panen ceri:</span>
            <span style="font-family:'JetBrains Mono',monospace;">${fm(f.berat_ceri_kg, 0)} kg</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:12px;">
            <span style="color:#a8a29e;">Intensitas:</span>
            <span style="font-family:'JetBrains Mono',monospace;color:${color};font-weight:700;">${fm(f.kg_co2e_per_kg_ceri, 3)} kg CO₂e/kg</span>
          </div>
        </div>
      `;
      marker.bindTooltip(html, { direction: "top", opacity: 0.96 });
      marker.bindPopup(html);
      bounds.push([f.lat, f.lon]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 11 });
    }

    return () => {
      map.remove();
    };
  }, [farms]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-800/90">
      <div ref={containerRef} className={className} />
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-stone-700/60 bg-stone-950/85 px-3 py-2 text-[11px] text-stone-300 backdrop-blur-md">
        <div className="mb-1 font-semibold text-stone-200">kg CO₂e / kg ceri</div>
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">Rendah</span>
          <div className="h-2 w-20 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-terracotta-500" />
          <span className="text-red-400">Tinggi</span>
        </div>
      </div>
    </div>
  );
}
