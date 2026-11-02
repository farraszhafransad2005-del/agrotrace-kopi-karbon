"""Logika bersama (dipakai app.py dan scripts/2_buat_paspor.py): hitung karbon per proses + aturan audit.
Satu sumber kebenaran: mengubah faktor emisi atau data aktivitas langsung mengubah hasil di dashboard."""
import math
from datetime import date

KOMPONEN = ["pupuk_produksi", "pupuk_n2o", "solar_angkut", "listrik_panen", "listrik_hulling", "listrik_gudang",
            "lpg_roasting", "listrik_roasting", "kemasan_film", "kemasan_kardus", "listrik_kemas", "distribusi"]
TAHAP = ["Panen & angkut", "Pascapanen", "Green bean", "Roasting", "Kemas", "Distribusi"]
TAHAP_KOMPONEN = {0: ["pupuk_produksi", "pupuk_n2o", "solar_angkut"], 1: ["listrik_panen"], 2: ["listrik_hulling", "listrik_gudang"],
                  3: ["lpg_roasting", "listrik_roasting"], 4: ["kemasan_film", "kemasan_kardus", "listrik_kemas"], 5: ["distribusi"]}
LABEL = {"pupuk_produksi": "Pupuk: produksi", "pupuk_n2o": "Pupuk: N2O di lahan", "solar_angkut": "Solar angkut ceri",
         "listrik_panen": "Listrik pascapanen", "listrik_hulling": "Listrik hulling/sortasi", "listrik_gudang": "Listrik gudang",
         "lpg_roasting": "LPG roasting", "listrik_roasting": "Listrik roasting", "kemasan_film": "Film kemasan",
         "kemasan_kardus": "Kardus", "listrik_kemas": "Listrik pengemasan", "distribusi": "Distribusi truk"}
KELOMPOK = {"Pupuk": ["pupuk_produksi", "pupuk_n2o"], "Solar": ["solar_angkut"],
            "Listrik": ["listrik_panen", "listrik_hulling", "listrik_gudang", "listrik_roasting", "listrik_kemas"],
            "LPG": ["lpg_roasting"], "Kemasan": ["kemasan_film", "kemasan_kardus"], "Distribusi": ["distribusi"]}
RENTANG_INTENSITAS = (1.5, 6.0)  # kg CO2e per kg kopi sangrai: batas kewajaran (asumsi tim)


def _nol(v):
    return 0.0 if v is None or (isinstance(v, float) and math.isnan(v)) else float(v)


def _kosong(v):
    return v is None or (isinstance(v, float) and math.isnan(v))


def hitung_karbon(p, F, mult=None):
    """p: dokumen paspor. F: {kode: nilai faktor}. mult: pengali per komponen (untuk skenario what-if)."""
    m = {k: 1.0 for k in KOMPONEN}
    if mult:
        m.update(mult)
    g, rs, hs = p["green"], p["roasting"], p["panen"]
    kosong = []
    for h in hs:
        for c in ["pupuk_n_kg", "solar_angkut_liter", "listrik_sortasi_kwh"]:
            if _kosong(h.get(c)):
                kosong.append(f"{h['harvest_id']}.{c}")
    for c in ["listrik_hulling_kwh", "listrik_gudang_kwh"]:
        if _kosong(g.get(c)):
            kosong.append(f"{g['green_id']}.{c}")
    for r in rs:
        for c in ["lpg_kg", "listrik_roasting_kwh"]:
            if _kosong(r.get(c)):
                kosong.append(f"{r['roast_id']}.{c}")
    for c in ["film_kg", "kardus_kg", "listrik_kemas_kwh", "jarak_km"]:
        if _kosong(p.get(c)):
            kosong.append(f"{p['fg_id']}.{c}")
    gk = max(_nol(g["berat_green_kg"]), 1e-9)
    hulu = {k: 0.0 for k in KOMPONEN}
    hulu["pupuk_produksi"] = sum(_nol(h.get("pupuk_n_kg")) * F["N_PRODUKSI"] for h in hs) * m["pupuk_produksi"]
    hulu["pupuk_n2o"] = sum(_nol(h.get("pupuk_n_kg")) * F["N_LAPANGAN"] for h in hs) * m["pupuk_n2o"]
    hulu["solar_angkut"] = sum(_nol(h.get("solar_angkut_liter")) * F["SOLAR"] for h in hs) * m["solar_angkut"]
    hulu["listrik_panen"] = sum(_nol(h.get("listrik_sortasi_kwh")) * F["LISTRIK"] for h in hs) * m["listrik_panen"]
    hulu["listrik_hulling"] = _nol(g.get("listrik_hulling_kwh")) * F["LISTRIK"] * m["listrik_hulling"]
    hulu["listrik_gudang"] = _nol(g.get("listrik_gudang_kwh")) * F["LISTRIK"] * m["listrik_gudang"]
    per_kg_green = {k: v / gk for k, v in hulu.items()}  # alokasi massa: kg CO2e per kg green bean
    kom = {k: 0.0 for k in KOMPONEN}
    for r in rs:
        c = _nol(r["muatan_green_kg"])
        for k in ["pupuk_produksi", "pupuk_n2o", "solar_angkut", "listrik_panen", "listrik_hulling", "listrik_gudang"]:
            kom[k] += c * per_kg_green[k]
        kom["lpg_roasting"] += _nol(r.get("lpg_kg")) * F["LPG"] * m["lpg_roasting"]
        kom["listrik_roasting"] += _nol(r.get("listrik_roasting_kwh")) * F["LISTRIK"] * m["listrik_roasting"]
    kom["kemasan_film"] = _nol(p.get("film_kg")) * F["FILM"] * m["kemasan_film"]
    kom["kemasan_kardus"] = _nol(p.get("kardus_kg")) * F["KARDUS"] * m["kemasan_kardus"]
    kom["listrik_kemas"] = _nol(p.get("listrik_kemas_kwh")) * F["LISTRIK"] * m["listrik_kemas"]
    berat_kirim_t = (p["jumlah_kemasan"] * 0.2 + _nol(p.get("film_kg")) + _nol(p.get("kardus_kg"))) / 1000
    kom["distribusi"] = berat_kirim_t * _nol(p.get("jarak_km")) * F["TRUK"] * m["distribusi"]
    tahap = [sum(kom[k] for k in TAHAP_KOMPONEN[i]) for i in range(6)]
    total = sum(tahap)
    kg_sangrai = sum(_nol(r["berat_sangrai_kg"]) for r in rs)
    return {"komponen": kom, "tahap": tahap, "total": total, "kg_sangrai": kg_sangrai,
            "per_kg": total / kg_sangrai if kg_sangrai else None,
            "g_per_kemasan": total / p["jumlah_kemasan"] * 1000 if p["jumlah_kemasan"] else None, "kosong": kosong}


def audit(p, F):
    g, rs, hs = p["green"], p["roasting"], p["panen"]
    out = []
    add = lambda r, ok, m: out.append({"aturan": r, "lulus": bool(ok), "catatan": m})
    add("Kadar air green bean <= 12,5%", g["kadar_air_green_persen"] <= 12.5, f"{g['green_id']}: {g['kadar_air_green_persen']}%")
    bad = [r for r in rs if not 10 <= r["susut_persen"] <= 20]
    add("Susut roasting 10-20%", not bad, "semua batch wajar" if not bad else "; ".join(f"{r['roast_id']}: {r['susut_persen']}%" for r in bad))
    kg = sum(r["berat_sangrai_kg"] for r in rs); pack = p["jumlah_kemasan"] * 0.2
    add("Neraca massa: berat kemasan <= berat sangrai", pack <= kg + 1e-6, f"kemasan {pack:.1f} kg vs sangrai {kg:.1f} kg")
    miss = [c for c in ["ceri_merah_persen", "ceri_apung_persen", "kadar_air_kering_persen", "lama_jemur_hari"] if any(_kosong(h.get(c)) for h in hs)]
    add("Data lot panen lengkap", not miss, "lengkap" if not miss else "kosong: " + ", ".join(miss))
    d = date.fromisoformat
    ok = all(d(a) <= d(b) for a, b in [(max(h["tgl_selesai_jemur"] for h in hs), g["tgl_hulling"]), (g["tgl_hulling"], min(r["tgl_roasting"] for r in rs)),
             (max(r["tgl_roasting"] for r in rs), p["tgl_kemas"]), (p["tgl_kemas"], p["tgl_kirim"]), (p["tgl_kemas"], p["tgl_kedaluwarsa"])])
    add("Urutan tanggal logis (panen > jemur > hulling > roasting > kemas > kirim)", ok, "berurutan" if ok else "ada tanggal yang mendahului tahap sebelumnya")
    add("Rendemen ceri ke green bean 15-25%", 15 <= g["rendemen_persen"] <= 25, f"{g['rendemen_persen']}%")
    k = hitung_karbon(p, F)
    add("Data aktivitas karbon lengkap", not k["kosong"], "lengkap" if not k["kosong"] else "kosong: " + ", ".join(k["kosong"][:4]))
    lo, hi = RENTANG_INTENSITAS
    iv = k["per_kg"]
    add(f"Intensitas karbon wajar ({lo:g}-{hi:g} kg CO2e/kg sangrai)", iv is not None and lo <= iv <= hi, "-" if iv is None else f"{iv:.2f} kg CO2e/kg")
    return out
