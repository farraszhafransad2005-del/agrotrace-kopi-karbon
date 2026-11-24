"""Layanan data dan kalkulasi untuk backend FastAPI AgroTrace Carbon Passport.
Memakai agrotrace_lib.py sebagai satu-satunya sumber kebenaran untuk rumus karbon dan 8 aturan audit."""
from __future__ import annotations

import copy
import json
import math
import os
import sys
import threading
import time
import tomllib
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agrotrace_lib import (  # noqa: E402
    KELOMPOK,
    KOMPONEN,
    LABEL,
    RENTANG_INTENSITAS,
    TAHAP,
    TAHAP_KOMPONEN,
    audit,
    hitung_karbon,
)
from backend.schemas import SimulateRequest  # noqa: E402

CATATAN = (
    "Nilai karbon adalah ESTIMASI = data aktivitas × faktor emisi (lihat tab Metodologi). "
    "Data aktivitas pada prototipe ini adalah simulasi, dan sebagian faktor emisi masih asumsi tim. "
    "Jangan dipakai sebagai klaim emisi produk nyata."
)


def _read_secret(key: str) -> str | None:
    """Baca konfigurasi dari .streamlit/secrets.toml atau environment variable."""
    secrets_path = ROOT_DIR / ".streamlit" / "secrets.toml"
    if secrets_path.is_file():
        try:
            with secrets_path.open("rb") as f:
                secrets = tomllib.load(f)
            if key in secrets and secrets[key]:
                return str(secrets[key])
            for k, v in secrets.items():
                if k.lower() == key.lower() and v:
                    return str(v)
        except Exception:
            pass
    return os.environ.get(key) or os.environ.get(key.upper()) or os.environ.get(key.lower())


def sanitize(obj: Any) -> Any:
    """Konversi rekursif nilai NaN/Inf, tipe NumPy/Pandas, dan tanggal agar aman diserialisasi JSON."""
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (int, str)):
        return obj
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    if isinstance(obj, (pd.Timestamp, datetime, date)):
        return obj.isoformat()
    if hasattr(obj, "item") and callable(obj.item):
        return sanitize(obj.item())
    if isinstance(obj, dict):
        return {str(k): sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize(v) for v in obj]
    try:
        if pd.isna(obj):
            return None
    except Exception:
        pass
    return obj


class AgroTraceService:
    """Mengelola cache data paspor, perhitungan ulang karbon, audit, dan ekspor CSV."""

    def __init__(self, ttl_seconds: int = 300) -> None:
        self.ttl_seconds = ttl_seconds
        self._lock = threading.RLock()
        self._loaded_at: float = 0.0
        self._cached_at_iso: str = ""
        self._state: dict[str, Any] | None = None

    def _load_local(self) -> tuple[list[dict[str, Any]], pd.DataFrame]:
        fcsv = pd.read_csv(DATA_DIR / "faktor_emisi.csv")
        with (DATA_DIR / "paspor.json").open("r", encoding="utf-8") as f:
            raw_data = json.load(f)
        return raw_data, fcsv

    def _load_from_source(self) -> tuple[list[dict[str, Any]], pd.DataFrame, str, str]:
        fcsv = pd.read_csv(DATA_DIR / "faktor_emisi.csv")
        uri = _read_secret("mongo_uri")
        if uri:
            try:
                from pymongo import MongoClient

                client = MongoClient(uri, serverSelectionTimeoutMS=5000)
                db = client["agrotrace_kopi"]
                data = list(db["paspor"].find({}, {"_id": 0}))
                fk = list(db["faktor_emisi"].find({}, {"_id": 0}))
                if data:
                    fdf = pd.DataFrame(fk) if fk else fcsv
                    return data, fdf, "mongodb", "MongoDB Atlas"
                raw_data, local_fcsv = self._load_local()
                return (
                    raw_data,
                    local_fcsv,
                    "local_fallback",
                    "berkas lokal data/ (koleksi paspor MongoDB kosong)",
                )
            except Exception as exc:
                raw_data, local_fcsv = self._load_local()
                return (
                    raw_data,
                    local_fcsv,
                    "local_fallback",
                    f"berkas lokal data/ (fallback otomatis: {type(exc).__name__})",
                )
        raw_data, local_fcsv = self._load_local()
        return (
            raw_data,
            local_fcsv,
            "local",
            "berkas lokal data/ (mode demo, belum terhubung MongoDB)",
        )

    def _build_state(self) -> dict[str, Any]:
        raw_data, fdf, source_mode, source_label = self._load_from_source()
        data = copy.deepcopy(raw_data)
        F = dict(zip(fdf["kode"], fdf["nilai"].astype(float)))

        for d in data:
            d["audit"] = audit(d, F)
            d["status_audit"] = "Lulus" if all(a["lulus"] for a in d["audit"]) else "Perlu ditinjau"

        rows = []
        for d in data:
            k = hitung_karbon(d, F)
            d["_k"] = k
            rows.append(
                {
                    "fg_id": d["fg_id"],
                    "tgl": pd.to_datetime(d["tgl_kemas"]),
                    "kemasan": int(d["jumlah_kemasan"]),
                    "total": k["total"],
                    "per_kg": k["per_kg"],
                    "g_kemasan": k["g_per_kemasan"],
                    "tujuan": d["tujuan_distribusi"],
                    "green": d["green"]["green_id"],
                    "cupping": d["green"]["skor_cupping"],
                    **{f"t{i}": v for i, v in enumerate(k["tahap"])},
                }
            )

        S = pd.DataFrame(rows).sort_values("fg_id").reset_index(drop=True)
        status_map = {d["fg_id"]: d["status_audit"] for d in data}
        S["status"] = S["fg_id"].map(status_map)

        try:
            S["kategori"] = pd.qcut(S["per_kg"], 3, labels=["Rendah", "Sedang", "Tinggi"]).astype(str)
        except Exception:
            S["kategori"] = "Sedang"

        lo, hi = RENTANG_INTENSITAS
        S["valid"] = S["per_kg"].between(lo, hi)
        SV = S[S["valid"]].copy()
        valid_ids = set(SV["fg_id"])
        DV = [d for d in data if d["fg_id"] in valid_ids]
        POR = {d["fg_id"]: d for d in data}

        return {
            "data": data,
            "fdf": fdf,
            "F": F,
            "S": S,
            "SV": SV,
            "DV": DV,
            "POR": POR,
            "source_mode": source_mode,
            "source_label": source_label,
        }

    def _ensure_state(self, force_refresh: bool = False) -> dict[str, Any]:
        with self._lock:
            now = time.monotonic()
            if (
                force_refresh
                or self._state is None
                or (now - self._loaded_at) >= self.ttl_seconds
            ):
                self._state = self._build_state()
                self._loaded_at = now
                self._cached_at_iso = datetime.now(timezone.utc).isoformat()
            return self._state

    def refresh(self) -> dict[str, Any]:
        self._ensure_state(force_refresh=True)
        return self.get_health()

    def get_health(self) -> dict[str, Any]:
        st = self._ensure_state()
        return sanitize(
            {
                "status": "ok",
                "source_mode": st["source_mode"],
                "source_label": st["source_label"],
                "total_batches": len(st["S"]),
                "valid_batches": len(st["SV"]),
                "cached_at": self._cached_at_iso,
            }
        )

    def get_overview(self) -> dict[str, Any]:
        st = self._ensure_state()
        data, S, SV, F = st["data"], st["S"], st["SV"], st["F"]
        lo, hi = RENTANG_INTENSITAS

        tot = [float(SV[f"t{i}"].sum()) for i in range(6)]
        tot_sum = sum(tot) or 1.0
        stages = [
            {
                "index": i,
                "name": TAHAP[i],
                "total_kg_co2e": round(tot[i], 3),
                "share_pct": round(tot[i] / tot_sum * 100.0, 2),
            }
            for i in range(6)
        ]
        top_stage = max(stages, key=lambda x: x["total_kg_co2e"])

        # Agregasi bulanan berdasarkan tgl_kemas untuk batch valid
        sv_m = SV.copy()
        sv_m["bulan"] = sv_m["tgl"].dt.strftime("%Y-%m")
        m_df = sv_m.groupby("bulan", sort=True)[[f"t{i}" for i in range(6)]].sum().reset_index()
        monthly = []
        for _, row in m_df.iterrows():
            st_vals = [round(float(row[f"t{i}"]), 3) for i in range(6)]
            monthly.append(
                {
                    "bulan": row["bulan"],
                    "total_kg_co2e": round(sum(st_vals), 3),
                    "stages": st_vals,
                    **{f"t{i}": st_vals[i] for i in range(6)},
                }
            )

        # Aliran massa Sankey (sama persis dengan app.py)
        cher = sum({h["harvest_id"]: h["berat_ceri_kg"] for d in data for h in d["panen"]}.values())
        gl = {d["green"]["green_id"]: d["green"]["berat_green_kg"] for d in data}
        rr = {r["roast_id"]: r for d in data for r in d["roasting"]}
        green = sum(gl.values())
        used = sum(r["muatan_green_kg"] for r in rr.values())
        out = sum(r["berat_sangrai_kg"] for r in rr.values())
        packed = min(out, float(S["kemasan"].sum()) * 0.2)
        lab = [
            "Ceri panen",
            "Green bean",
            "Susut pengolahan",
            "Disangrai",
            "Stok green tersisa",
            "Kopi sangrai",
            "Susut roasting",
            "Dikemas",
            "Belum dikemas",
        ]
        src = [0, 0, 1, 1, 3, 3, 5, 5]
        dst = [1, 2, 3, 4, 5, 6, 7, 8]
        val = [
            green,
            max(cher - green, 0.0),
            used,
            max(green - used, 0.0),
            out,
            max(used - out, 0.0),
            packed,
            max(out - packed, 0.0),
        ]
        sankey = {
            "nodes": [{"id": idx, "name": name} for idx, name in enumerate(lab)],
            "links": [
                {
                    "source": s,
                    "target": t,
                    "source_name": lab[s],
                    "target_name": lab[t],
                    "value": round(float(v), 2),
                }
                for s, t, v in zip(src, dst, val)
            ],
            "totals": {
                "ceri_kg": round(float(cher), 2),
                "green_kg": round(float(green), 2),
                "disangrai_kg": round(float(used), 2),
                "kopi_sangrai_kg": round(float(out), 2),
                "dikemas_kg": round(float(packed), 2),
            },
        }

        # Agregasi kebun asal (deduplikasi harvest_id)
        fr: dict[str, dict[str, Any]] = {}
        for d in data:
            for h in d["panen"]:
                e = (h.get("pupuk_n_kg") or 0.0) * (F["N_PRODUKSI"] + F["N_LAPANGAN"]) + (
                    h.get("solar_angkut_liter") or 0.0
                ) * F["SOLAR"]
                fr[h["harvest_id"]] = {
                    "farm_id": h["farm_id"],
                    "petani": h["petani"],
                    "desa": h["desa"],
                    "kabupaten": h["kabupaten"],
                    "lat": h["lat"],
                    "lon": h["lon"],
                    "praktik_budidaya": h["praktik_budidaya"],
                    "berat_ceri_kg": h["berat_ceri_kg"],
                    "emisi_budidaya_kg": e,
                }
        ldf = (
            pd.DataFrame(fr.values())
            .groupby(["farm_id", "petani", "desa", "kabupaten", "lat", "lon", "praktik_budidaya"], as_index=False)
            .sum(numeric_only=True)
        )
        ldf["kg_co2e_per_kg_ceri"] = ldf["emisi_budidaya_kg"] / ldf["berat_ceri_kg"]
        farms = [
            {
                "farm_id": r["farm_id"],
                "petani": r["petani"],
                "desa": r["desa"],
                "kabupaten": r["kabupaten"],
                "lat": round(float(r["lat"]), 4),
                "lon": round(float(r["lon"]), 4),
                "praktik_budidaya": r["praktik_budidaya"],
                "berat_ceri_kg": round(float(r["berat_ceri_kg"]), 1),
                "emisi_budidaya_kg": round(float(r["emisi_budidaya_kg"]), 3),
                "kg_co2e_per_kg_ceri": round(float(r["kg_co2e_per_kg_ceri"]), 4),
            }
            for _, r in ldf.sort_values("farm_id").iterrows()
        ]

        total_batches = int(len(S))
        pass_count = int((S["status"] == "Lulus").sum())
        review_count = int((S["status"] != "Lulus").sum())
        total_packages = int(S["kemasan"].sum())
        total_em_kg = float(SV["total"].sum())

        return sanitize(
            {
                "source_mode": st["source_mode"],
                "source_label": st["source_label"],
                "catatan": CATATAN,
                "rentang_intensitas": [lo, hi],
                "kpi": {
                    "total_batches": total_batches,
                    "unique_green_lots": int(S["green"].nunique()),
                    "total_packages": total_packages,
                    "total_coffee_ton": round(total_packages * 0.2 / 1000.0, 3),
                    "valid_batches_count": int(len(SV)),
                    "excluded_batches_count": int(len(S) - len(SV)),
                    "total_emission_kg": round(total_em_kg, 2),
                    "total_emission_ton": round(total_em_kg / 1000.0, 3),
                    "avg_g_per_package": round(float(SV["g_kemasan"].mean()), 1) if len(SV) else 0.0,
                    "avg_kg_co2e_per_kg_roast": round(float(SV["per_kg"].mean()), 3) if len(SV) else 0.0,
                    "audit_pass_count": pass_count,
                    "audit_review_count": review_count,
                    "audit_pass_rate_pct": round(pass_count / total_batches * 100.0, 1) if total_batches else 0.0,
                },
                "stages": stages,
                "top_stage": top_stage,
                "monthly": monthly,
                "sankey": sankey,
                "farms": farms,
            }
        )

    def get_batches(
        self,
        tujuan: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        st = self._ensure_state()
        S, POR = st["S"], st["POR"]
        destinations = sorted(S["tujuan"].unique().tolist())

        filtered = S
        if tujuan and tujuan != "Semua":
            filtered = filtered[filtered["tujuan"] == tujuan]
        if status and status != "Semua":
            filtered = filtered[filtered["status"] == status]
        if search and search.strip():
            q = search.strip().lower()
            mask = (
                filtered["fg_id"].str.lower().str.contains(q, regex=False)
                | filtered["green"].str.lower().str.contains(q, regex=False)
                | filtered["tujuan"].str.lower().str.contains(q, regex=False)
            )
            filtered = filtered[mask]

        items = []
        for _, row in filtered.iterrows():
            doc = POR[row["fg_id"]]
            items.append(
                {
                    "fg_id": row["fg_id"],
                    "produk": doc["produk"],
                    "tgl_kemas": doc["tgl_kemas"],
                    "tgl_kirim": doc["tgl_kirim"],
                    "tujuan_distribusi": row["tujuan"],
                    "jumlah_kemasan": int(row["kemasan"]),
                    "green_id": row["green"],
                    "skor_cupping": float(row["cupping"]),
                    "total_kg_co2e": round(float(row["total"]), 3),
                    "per_kg": round(float(row["per_kg"]), 3) if row["per_kg"] is not None else None,
                    "g_per_kemasan": round(float(row["g_kemasan"]), 1) if row["g_kemasan"] is not None else None,
                    "kategori": row["kategori"],
                    "status_audit": row["status"],
                    "valid": bool(row["valid"]),
                }
            )

        return sanitize(
            {
                "total": int(len(S)),
                "filtered_count": len(items),
                "destinations": destinations,
                "items": items,
            }
        )

    def get_batch_detail(self, fg_id: str) -> dict[str, Any] | None:
        st = self._ensure_state()
        POR, S, SV = st["POR"], st["S"], st["SV"]
        P = POR.get(fg_id)
        if P is None:
            return None

        K = P["_k"]
        g = P["green"]
        rs = P["roasting"]
        hs = P["panen"]
        row = S[S["fg_id"] == fg_id].iloc[0]

        base = _read_secret("BASE_URL") or ""
        qr_payload = f"{base}?batch={fg_id}" if base else f"AGROTRACE|{fg_id}"

        petani_list = sorted({h["petani"] for h in hs})
        kabupaten_list = sorted({h["kabupaten"] for h in hs})
        jemur_vals = [h["lama_jemur_hari"] for h in hs if h.get("lama_jemur_hari") is not None]
        avg_lama_jemur = sum(jemur_vals) / len(jemur_vals) if jemur_vals else None

        total_kg = K["total"] or 0.0
        tahap_detail = []
        waterfall = []
        running = 0.0
        for i in range(6):
            t_val = float(K["tahap"][i])
            comps = [
                {
                    "key": c,
                    "label": LABEL[c],
                    "kg_co2e": round(float(K["komponen"][c]), 3),
                }
                for c in TAHAP_KOMPONEN[i]
            ]
            tahap_detail.append(
                {
                    "index": i,
                    "name": TAHAP[i],
                    "total_kg_co2e": round(t_val, 3),
                    "share_pct": round(t_val / total_kg * 100.0, 2) if total_kg else 0.0,
                    "components": comps,
                }
            )
            start = running
            running += t_val
            waterfall.append(
                {
                    "type": "relative",
                    "label": TAHAP[i],
                    "value": round(t_val, 3),
                    "start": round(start, 3),
                    "end": round(running, 3),
                }
            )
        waterfall.append(
            {
                "type": "total",
                "label": "Total",
                "value": round(float(total_kg), 3),
                "start": 0.0,
                "end": round(float(total_kg), 3),
            }
        )

        pascapanen_rows = [
            {
                "harvest_id": h.get("harvest_id"),
                "metode_jemur": h.get("metode_jemur"),
                "tgl_mulai_jemur": h.get("tgl_mulai_jemur"),
                "tgl_selesai_jemur": h.get("tgl_selesai_jemur"),
                "lama_jemur_hari": h.get("lama_jemur_hari"),
                "kadar_air_kering_persen": h.get("kadar_air_kering_persen"),
                "ceri_apung_persen": h.get("ceri_apung_persen"),
                "listrik_sortasi_kwh": h.get("listrik_sortasi_kwh"),
            }
            for h in hs
        ]

        audit_list = [
            {
                "code": f"R{idx + 1}",
                "aturan": item["aturan"],
                "lulus": bool(item["lulus"]),
                "catatan": item["catatan"],
            }
            for idx, item in enumerate(P["audit"])
        ]
        failed_rules = [item for item in audit_list if not item["lulus"]]

        return sanitize(
            {
                "fg_id": P["fg_id"],
                "produk": P["produk"],
                "tgl_kemas": P["tgl_kemas"],
                "tgl_kedaluwarsa": P["tgl_kedaluwarsa"],
                "tgl_kirim": P["tgl_kirim"],
                "jumlah_kemasan": int(P["jumlah_kemasan"]),
                "tujuan_distribusi": P["tujuan_distribusi"],
                "jarak_km": P.get("jarak_km"),
                "qr_payload": qr_payload,
                "kategori": row["kategori"],
                "valid": bool(row["valid"]),
                "status_audit": P["status_audit"],
                "summary": {
                    "petani_list": petani_list,
                    "petani_count": len(petani_list),
                    "kabupaten_list": kabupaten_list,
                    "avg_lama_jemur_hari": round(avg_lama_jemur, 1) if avg_lama_jemur is not None else None,
                    "roast_count": len(rs),
                    "skor_cupping": g["skor_cupping"],
                    "avg_valid_per_kg": round(float(SV["per_kg"].mean()), 3) if len(SV) else None,
                },
                "karbon": {
                    "total": round(float(K["total"]), 3),
                    "kg_sangrai": round(float(K["kg_sangrai"]), 3),
                    "per_kg": round(float(K["per_kg"]), 3) if K["per_kg"] is not None else None,
                    "g_per_kemasan": round(float(K["g_per_kemasan"]), 1) if K["g_per_kemasan"] is not None else None,
                    "kosong": K["kosong"],
                    "komponen": {k: round(float(v), 3) for k, v in K["komponen"].items()},
                    "tahap": tahap_detail,
                    "waterfall": waterfall,
                },
                "stages_data": {
                    "panen": hs,
                    "pascapanen": pascapanen_rows,
                    "green": g,
                    "roasting": rs,
                    "kemas": {
                        "fg_id": P["fg_id"],
                        "produk": P["produk"],
                        "tgl_kemas": P["tgl_kemas"],
                        "jumlah_kemasan": P["jumlah_kemasan"],
                        "tgl_kedaluwarsa": P["tgl_kedaluwarsa"],
                        "film_kg": P.get("film_kg"),
                        "kardus_kg": P.get("kardus_kg"),
                        "listrik_kemas_kwh": P.get("listrik_kemas_kwh"),
                    },
                    "distribusi": {
                        "tujuan_distribusi": P["tujuan_distribusi"],
                        "tgl_kirim": P["tgl_kirim"],
                        "jarak_km": P.get("jarak_km"),
                    },
                },
                "audit": audit_list,
                "failed_rules": failed_rules,
                "catatan": CATATAN,
            }
        )

    def get_carbon_analysis(self) -> dict[str, Any]:
        st = self._ensure_state()
        S, SV, DV, F = st["S"], st["SV"], st["DV"], st["F"]
        lo, hi = RENTANG_INTENSITAS

        total_valid_kg = sum(d["_k"]["total"] for d in DV) or 1.0
        components = []
        for k in KOMPONEN:
            val = sum(d["_k"]["komponen"][k] for d in DV)
            stage_idx = next(t for t, v in TAHAP_KOMPONEN.items() if k in v)
            components.append(
                {
                    "key": k,
                    "label": LABEL[k],
                    "stage_index": stage_idx,
                    "stage_name": TAHAP[stage_idx],
                    "kg_co2e": round(float(val), 3),
                    "share_pct": round(float(val) / total_valid_kg * 100.0, 2),
                }
            )
        components.sort(key=lambda x: x["kg_co2e"], reverse=True)

        # Distribusi intensitas & histogram (25 bins)
        vals = SV["per_kg"].dropna().to_numpy()
        histogram = []
        if len(vals) > 0:
            counts, edges = np.histogram(vals, bins=25)
            for idx in range(len(counts)):
                histogram.append(
                    {
                        "x0": round(float(edges[idx]), 3),
                        "x1": round(float(edges[idx + 1]), 3),
                        "label": f"{edges[idx]:.2f}–{edges[idx + 1]:.2f}",
                        "count": int(counts[idx]),
                    }
                )
        intensity_items = [
            {
                "fg_id": r["fg_id"],
                "per_kg": round(float(r["per_kg"]), 4),
                "g_kemasan": round(float(r["g_kemasan"]), 2),
            }
            for _, r in SV.iterrows()
        ]

        # Emisi budidaya per kg ceri berdasarkan praktik
        unique_harvests = {x["harvest_id"]: x for d in DV for x in d["panen"]}.values()
        practice_points = []
        for h in unique_harvests:
            intens = (
                (h.get("pupuk_n_kg") or 0.0) * (F["N_PRODUKSI"] + F["N_LAPANGAN"])
                + (h.get("solar_angkut_liter") or 0.0) * F["SOLAR"]
            ) / h["berat_ceri_kg"]
            practice_points.append(
                {
                    "harvest_id": h["harvest_id"],
                    "farm_id": h["farm_id"],
                    "petani": h["petani"],
                    "praktik": h["praktik_budidaya"],
                    "intensitas": round(float(intens), 4),
                }
            )
        pr_df = pd.DataFrame(practice_points)
        practice_summary = []
        for praktik in ["Organik", "Semi-organik", "Konvensional"]:
            sub = pr_df[pr_df["praktik"] == praktik]["intensitas"] if len(pr_df) else pd.Series(dtype=float)
            if len(sub):
                practice_summary.append(
                    {
                        "praktik": praktik,
                        "count": int(len(sub)),
                        "min": round(float(sub.min()), 4),
                        "q1": round(float(sub.quantile(0.25)), 4),
                        "median": round(float(sub.median()), 4),
                        "q3": round(float(sub.quantile(0.75)), 4),
                        "max": round(float(sub.max()), 4),
                        "mean": round(float(sub.mean()), 4),
                    }
                )
            else:
                practice_summary.append(
                    {"praktik": praktik, "count": 0, "min": 0.0, "q1": 0.0, "median": 0.0, "q3": 0.0, "max": 0.0, "mean": 0.0}
                )

        cupping_vs_intensity = [
            {
                "fg_id": r["fg_id"],
                "cupping": float(r["cupping"]),
                "per_kg": round(float(r["per_kg"]), 4),
                "tujuan": r["tujuan"],
                "kemasan": int(r["kemasan"]),
            }
            for _, r in SV.iterrows()
        ]

        def _top_rows(df: pd.DataFrame) -> list[dict[str, Any]]:
            return [
                {
                    "fg_id": r["fg_id"],
                    "tujuan_distribusi": r["tujuan"],
                    "jumlah_kemasan": int(r["kemasan"]),
                    "per_kg": round(float(r["per_kg"]), 2),
                    "g_per_kemasan": round(float(r["g_kemasan"]), 2),
                }
                for _, r in df.iterrows()
            ]

        return sanitize(
            {
                "valid_batches_count": int(len(SV)),
                "excluded_batches_count": int(len(S) - len(SV)),
                "rentang_intensitas": [lo, hi],
                "components": components,
                "intensity_distribution": {
                    "items": intensity_items,
                    "histogram": histogram,
                },
                "cultivation_by_practice": {
                    "summary": practice_summary,
                    "points": practice_points,
                },
                "cupping_vs_intensity": cupping_vs_intensity,
                "top5_lowest": _top_rows(SV.nsmallest(5, "per_kg")),
                "top5_highest": _top_rows(SV.nlargest(5, "per_kg")),
                "baseline_simulation": self.simulate(SimulateRequest()),
            }
        )

    def simulate(self, req: SimulateRequest) -> dict[str, Any]:
        st = self._ensure_state()
        DV, SV, F = st["DV"], st["SV"], st["F"]

        mult = (
            {k: 1.0 - req.pupuk_n_pct / 100.0 for k in KELOMPOK["Pupuk"]}
            | {"lpg_roasting": 1.0 - req.lpg_pct / 100.0}
            | {k: 1.0 - req.listrik_pct / 100.0 for k in KELOMPOK["Listrik"]}
            | {k: 1.0 - req.kemasan_pct / 100.0 for k in KELOMPOK["Kemasan"]}
        )

        sim_results = [hitung_karbon(d, F, mult) for d in DV]
        base_total = sum(d["_k"]["total"] for d in DV)
        sim_total = sum(r["total"] for r in sim_results)
        total_packages = float(SV["kemasan"].sum()) or 1.0

        reduction_kg = base_total - sim_total
        reduction_pct = ((sim_total - base_total) / base_total * 100.0) if base_total else 0.0

        stages = []
        for i in range(6):
            tb = sum(d["_k"]["tahap"][i] for d in DV)
            ts = sum(r["tahap"][i] for r in sim_results)
            stages.append(
                {
                    "index": i,
                    "name": TAHAP[i],
                    "baseline_kg": round(float(tb), 2),
                    "scenario_kg": round(float(ts), 2),
                    "delta_kg": round(float(ts - tb), 2),
                }
            )

        return sanitize(
            {
                "params": req.model_dump(),
                "baseline_total_kg": round(float(base_total), 2),
                "baseline_total_ton": round(float(base_total) / 1000.0, 3),
                "scenario_total_kg": round(float(sim_total), 2),
                "scenario_total_ton": round(float(sim_total) / 1000.0, 3),
                "reduction_kg": round(float(reduction_kg), 2),
                "reduction_pct": round(float(reduction_pct), 2),
                "baseline_g_per_package": round(float(base_total) / total_packages * 1000.0, 1),
                "scenario_g_per_package": round(float(sim_total) / total_packages * 1000.0, 1),
                "stages": stages,
            }
        )

    def get_audit(self, only_review: bool = False) -> dict[str, Any]:
        st = self._ensure_state()
        data = sorted(st["data"], key=lambda x: x["fg_id"])
        total_batches = len(data)
        pass_count = sum(1 for d in data if d["status_audit"] == "Lulus")
        review_count = total_batches - pass_count

        aturan_titles = [x["aturan"] for x in data[0]["audit"]] if data else []
        rules = []
        for idx, title in enumerate(aturan_titles):
            fail_cnt = sum(1 for d in data if not d["audit"][idx]["lulus"])
            rules.append(
                {
                    "code": f"R{idx + 1}",
                    "aturan": title,
                    "fail_count": fail_cnt,
                    "pass_count": total_batches - fail_cnt,
                }
            )

        total_findings = sum(r["fail_count"] for r in rules)
        most_failed = max(rules, key=lambda r: r["fail_count"]) if rules else {"code": "-", "aturan": "-", "fail_count": 0}

        batches = []
        findings = []
        for d in data:
            checks = {f"R{idx + 1}": bool(x["lulus"]) for idx, x in enumerate(d["audit"])}
            for idx, x in enumerate(d["audit"]):
                if not x["lulus"]:
                    findings.append(
                        {
                            "fg_id": d["fg_id"],
                            "code": f"R{idx + 1}",
                            "aturan": x["aturan"],
                            "catatan": x["catatan"],
                        }
                    )
            if only_review and d["status_audit"] == "Lulus":
                continue
            batches.append(
                {
                    "fg_id": d["fg_id"],
                    "status_audit": d["status_audit"],
                    "checks": checks,
                }
            )

        return sanitize(
            {
                "summary": {
                    "total_batches": total_batches,
                    "pass_count": pass_count,
                    "review_count": review_count,
                    "pass_rate_pct": round(pass_count / total_batches * 100.0, 1) if total_batches else 0.0,
                    "total_findings": total_findings,
                    "most_failed_rule": {
                        "code": most_failed["code"],
                        "aturan": most_failed["aturan"],
                        "count": most_failed["fail_count"],
                    },
                },
                "rules": rules,
                "batches": batches,
                "findings": findings,
            }
        )

    def get_methodology(self) -> dict[str, Any]:
        st = self._ensure_state()
        fdf = st["fdf"]
        lo, hi = RENTANG_INTENSITAS
        return sanitize(
            {
                "system_boundary": {
                    "scope": "Cradle-to-customer (dari budidaya di kebun sampai barang jadi tiba di tujuan).",
                    "included": [
                        "Produksi dan aplikasi pupuk N sintetis di lahan",
                        "Solar pengangkutan ceri kopi",
                        "Listrik sortasi pascapanen (penjemuran memakai sinar matahari)",
                        "Listrik hulling dan penyimpanan gudang green bean",
                        "LPG dan listrik proses roasting",
                        "Film kemasan, kardus pengiriman, dan listrik pengemasan",
                        "Distribusi truk dari roastery ke tujuan pengiriman",
                    ],
                    "excluded": [
                        "Penyerapan karbon pohon kopi dan pohon naungan",
                        "Perubahan tata guna lahan",
                        "Penyeduhan dan konsumsi akhir",
                        "Pembuangan kemasan pascakonsumsi",
                    ],
                },
                "formula": "emisi = data aktivitas × faktor emisi (contoh: LPG roasting 0,72 kg × 2,987 kg CO2e/kg = 2,15 kg CO2e).",
                "mass_allocation": (
                    "Emisi hulu satu lot green bean (kebun, pascapanen, hulling, gudang) dibagi rata per kg green bean, "
                    "lalu dibebankan ke tiap batch roasting sesuai jumlah green bean yang disangrai. "
                    "Emisi roasting, kemasan, dan distribusi dibebankan langsung ke batch yang melakukannya "
                    "sehingga stok green bean yang belum disangrai tidak ikut dibebankan."
                ),
                "auto_recalculation": (
                    "Backend menghitung ulang karbon dan 8 aturan audit langsung lewat agrotrace_lib.py "
                    "setiap data dimuat dari MongoDB Atlas atau berkas lokal data/."
                ),
                "rentang_intensitas": [lo, hi],
                "catatan": CATATAN,
                "limitations": [
                    "Data aktivitas (pupuk, solar, listrik, LPG, kemasan, jarak) adalah simulasi, bukan hasil pencatatan lapangan.",
                    "Beberapa faktor emisi masih berstatus Asumsi sehingga hasil merupakan estimasi dengan ketidakpastian yang belum dihitung.",
                    "Sistem ini menunjukkan ketertelusuran dan transparansi data, bukan sertifikasi karbon resmi dan bukan klaim anti-manipulasi.",
                ],
                "emission_factors": fdf.to_dict("records"),
                "downloads": {
                    "emisi_per_batch": "/api/download/emisi_per_batch.csv",
                    "faktor_emisi": "/api/download/faktor_emisi.csv",
                },
            }
        )

    def get_emisi_csv_bytes(self) -> bytes:
        st = self._ensure_state()
        S = st["S"]
        e = pd.DataFrame(
            {
                "Batch": S["fg_id"],
                "Kemasan": S["kemasan"],
                **{TAHAP[i]: S[f"t{i}"].round(2) for i in range(6)},
                "Total kg CO2e": S["total"].round(2),
                "kg CO2e per kg sangrai": S["per_kg"].round(3),
                "g CO2e per kemasan": S["g_kemasan"].round(1),
            }
        )
        return e.to_csv(index=False).encode("utf-8")

    def get_faktor_csv_bytes(self) -> bytes:
        st = self._ensure_state()
        return st["fdf"].to_csv(index=False).encode("utf-8")


service = AgroTraceService(ttl_seconds=300)
