"""AgroTrace Carbon Passport - Kopi Arabika Gayo Natural (Kelompok 8 ASDA 2026).
Frontend Streamlit; backend MongoDB Atlas (db agrotrace_kopi: koleksi paspor, faktor_emisi). Tanpa mongo_uri -> data/ lokal (mode demo).
Karbon dan audit DIHITUNG ULANG dari data aktivitas saat halaman dimuat (agrotrace_lib.py), bukan membaca hasil lama."""
import io, json, os
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import qrcode
import streamlit as st
from agrotrace_lib import hitung_karbon, audit, TAHAP, KOMPONEN, TAHAP_KOMPONEN, LABEL, KELOMPOK, RENTANG_INTENSITAS

st.set_page_config(page_title="AgroTrace Kopi Gayo", page_icon="☕", layout="wide")
ESP, ROAST, RED, CREMA, LEAF, CREAM = "#2E1A0E", "#6F4E37", "#A4442A", "#C8A27A", "#5E7C4A", "#F6EEE1"
WT = ["#5E7C4A", "#9AAE6B", "#C8A27A", "#A4442A", "#6F4E37", "#2E1A0E"]      # warna 6 tahap
PLT = dict(paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)", font=dict(color=ESP, family="Segoe UI, sans-serif"), margin=dict(t=48, l=10, r=10, b=10))
st.markdown(f"""<style>
.stApp{{background:{CREAM}}} .block-container{{padding-top:3.6rem;max-width:1250px}}
h1,h2,h3,h4{{color:{ESP}}}
.hero{{background:linear-gradient(120deg,{ESP} 0%,{ROAST} 70%,{RED} 140%);color:#fff;padding:26px 30px;border-radius:18px;margin-bottom:6px}}
.hero h1{{color:#fff;margin:0;font-size:30px;letter-spacing:.2px}} .hero p{{margin:6px 0 10px;opacity:.9}}
.chip{{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);padding:3px 11px;border-radius:20px;font-size:12px;margin-right:6px}}
.kc{{background:#FFFBF4;border:1px solid #E5D6C0;border-radius:16px;padding:14px 16px;height:100%;border-top:5px solid {RED}}}
.kc b{{font-size:26px;color:{ESP};display:block;line-height:1.15}} .kc span{{font-size:12.5px;color:#7a6757}} .kc small{{display:block;color:#9a8672;font-size:11.5px;margin-top:2px}}
.card{{background:#FFFBF4;border:1px solid #E5D6C0;border-radius:16px;padding:16px 18px;margin-bottom:12px}}
.ok{{background:#DDEEDD;color:#3E7C4F;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px}}
.bad{{background:#F8DAD5;color:#C0392B;padding:4px 12px;border-radius:20px;font-weight:700;font-size:13px}}
.note{{background:#F3E4CC;border-left:5px solid {RED};padding:10px 14px;border-radius:8px;font-size:14px;margin:8px 0}}
.insight{{background:#EAF0E2;border-left:5px solid {LEAF};padding:10px 14px;border-radius:8px;font-size:14.5px;margin:8px 0}}
.steps{{display:flex;justify-content:space-between;margin:6px 0 2px}} .stp{{text-align:center;flex:1;font-size:12.5px;color:#7a6757;position:relative}}
.stp:not(:last-child):after{{content:"";position:absolute;top:21px;left:58%;width:84%;height:3px;background:{CREMA}}}
.dot{{width:42px;height:42px;border-radius:50%;margin:0 auto 4px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;position:relative;z-index:1}}
.dot.on{{outline:3px solid {ESP};outline-offset:2px}} .stp b{{display:block;color:{ESP};font-size:13px}}
button[data-baseweb="tab"]{{font-size:15px;padding:10px 16px}}
</style>""", unsafe_allow_html=True)

CATATAN = ("Nilai karbon adalah ESTIMASI = data aktivitas × faktor emisi (lihat tab Metodologi). Data aktivitas pada prototipe ini adalah simulasi, "
           "dan sebagian faktor emisi masih asumsi tim. Jangan dipakai sebagai klaim emisi produk nyata.")


def fm(v, d=1):
    if v is None or (isinstance(v, float) and pd.isna(v)): return "tidak tercatat"
    return f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


tg = lambda s: pd.to_datetime(s).strftime("%d %b %Y") if s else "-"


@st.cache_data(ttl=300, show_spinner="Memuat data paspor...")
def muat():
    uri = None
    try: uri = st.secrets["mongo_uri"]
    except Exception: uri = os.environ.get("MONGO_URI")
    fcsv = pd.read_csv("data/faktor_emisi.csv")
    if uri:
        from pymongo import MongoClient
        db = MongoClient(uri, serverSelectionTimeoutMS=8000)["agrotrace_kopi"]
        data = list(db["paspor"].find({}, {"_id": 0}))
        fk = list(db["faktor_emisi"].find({}, {"_id": 0}))
        return data, (pd.DataFrame(fk) if fk else fcsv), "MongoDB Atlas"
    with open("data/paspor.json", encoding="utf-8") as f:
        return json.load(f), fcsv, "berkas lokal data/ (mode demo, belum terhubung MongoDB)"


def hero(sub):
    st.markdown(f'<div class="hero"><h1>☕ AgroTrace Carbon Passport</h1><p>{sub}</p>'
                '<span class="chip">Kopi Arabika Gayo Natural</span><span class="chip">Medium Roast · 200 g</span>'
                '<span class="chip">Data simulasi</span></div>', unsafe_allow_html=True)


try:
    DATA, FDF, SUMBER = muat()
except Exception as e:
    hero("Telusuri kopi dari kebun sampai kemasan, lengkap dengan estimasi jejak karbon")
    st.error("Data gagal dimuat dari MongoDB. Periksa koneksi internet, isi mongo_uri di secrets, dan Network Access di Atlas, lalu muat ulang halaman.")
    st.caption(f"Detail teknis: {type(e).__name__}")
    st.stop()
if not DATA:
    st.error("Koleksi paspor kosong. Jalankan: python scripts/4_unggah_mongodb.py \"<connection string>\"")
    st.stop()
F = dict(zip(FDF["kode"], FDF["nilai"].astype(float)))


def olah(data, mult=None):
    rows = []
    for d in data:
        k = hitung_karbon(d, F, mult); d["_k"] = k
        rows.append({"fg_id": d["fg_id"], "tgl": pd.to_datetime(d["tgl_kemas"]), "kemasan": d["jumlah_kemasan"], "total": k["total"], "per_kg": k["per_kg"],
                     "g_kemasan": k["g_per_kemasan"], "tujuan": d["tujuan_distribusi"], "green": d["green"]["green_id"], "cupping": d["green"]["skor_cupping"],
                     **{f"t{i}": v for i, v in enumerate(k["tahap"])}})
    return pd.DataFrame(rows)


for d in DATA:
    d["audit"] = audit(d, F); d["status_audit"] = "Lulus" if all(a["lulus"] for a in d["audit"]) else "Perlu ditinjau"
S = olah(DATA).sort_values("fg_id").reset_index(drop=True)
S["status"] = [next(d["status_audit"] for d in DATA if d["fg_id"] == i) for i in S.fg_id]
S["kategori"] = pd.qcut(S["per_kg"], 3, labels=["Rendah", "Sedang", "Tinggi"]).astype(str)
LO, HI = RENTANG_INTENSITAS
S["valid"] = S.per_kg.between(LO, HI)
SV = S[S.valid].copy(); DV = [d for d in DATA if d["fg_id"] in set(SV.fg_id)]
POR = {d["fg_id"]: d for d in DATA}
hero("Telusuri kopi dari kebun sampai kemasan, lengkap dengan estimasi jejak karbon di setiap proses")
st.caption(f"Sumber data: {SUMBER}")


def kartu(col, nilai, label, sub=""):
    col.markdown(f'<div class="kc"><b>{nilai}</b><span>{label}</span><small>{sub}</small></div>', unsafe_allow_html=True)


def qr_png(fg_id):
    base = os.environ.get("BASE_URL", "")
    try: base = st.secrets.get("BASE_URL", base)
    except Exception: pass
    b = io.BytesIO(); qrcode.make(f"{base}?batch={fg_id}" if base else f"AGROTRACE|{fg_id}", box_size=6, border=2).save(b, format="PNG"); return b.getvalue()


tab_b, tab_t, tab_k, tab_a, tab_m = st.tabs(["🏠 Beranda", "🔎 Telusuri Batch", "🌍 Analisis Karbon", "✅ Audit", "📖 Metodologi"])

# =============================================================== BERANDA
with tab_b:
    c = st.columns(6)
    kartu(c[0], len(S), "Batch barang jadi", f"{S.green.nunique()} lot green bean")
    kartu(c[1], fm(S.kemasan.sum(), 0), "Kemasan 200 g", f"{fm(S.kemasan.sum() * 0.2 / 1000, 1)} ton kopi")
    kartu(c[2], f"{fm(SV.total.sum() / 1000, 1)} t", "Estimasi emisi total", f"CO2e, {len(SV)} batch valid")
    kartu(c[3], f"{fm(SV.g_kemasan.mean(), 0)} g", "CO2e per kemasan", "rata-rata batch")
    kartu(c[4], fm(SV.per_kg.mean(), 2), "kg CO2e / kg sangrai", "rata-rata batch")
    kartu(c[5], f"{(S.status == 'Lulus').mean() * 100:.0f}%", "Batch lulus audit", f"{(S.status != 'Lulus').sum()} perlu ditinjau")
    st.write("")
    tot = [SV[f"t{i}"].sum() for i in range(6)]; top = max(range(6), key=lambda i: tot[i])
    if len(S) > len(SV):
        st.caption(f"{len(S) - len(SV)} batch dikecualikan dari agregat karbon karena intensitasnya di luar rentang wajar {LO:g}-{HI:g} kg CO2e/kg (kemungkinan salah input; lihat tab Audit).")
    st.markdown(f'<div class="insight"><b>Temuan utama:</b> tahap <b>{TAHAP[top]}</b> menyumbang <b>{tot[top] / sum(tot) * 100:.0f}%</b> dari estimasi emisi seluruh batch. '
                f'Upaya pengurangan paling berdampak sebaiknya dimulai dari tahap ini (coba simulasinya di tab Analisis Karbon).</div>', unsafe_allow_html=True)
    a, b = st.columns([1, 1.25])
    with a:
        f = go.Figure(go.Pie(labels=TAHAP, values=tot, hole=.55, marker=dict(colors=WT), sort=False, textinfo="percent", hovertemplate="%{label}: %{value:,.0f} kg CO2e<extra></extra>"))
        f.update_layout(title="Kontribusi emisi per tahap", legend=dict(orientation="h", y=-.05), **PLT); st.plotly_chart(f)
    with b:
        cher = sum({h["harvest_id"]: h["berat_ceri_kg"] for d in DATA for h in d["panen"]}.values())
        gl = {d["green"]["green_id"]: d["green"]["berat_green_kg"] for d in DATA}; rr = {r["roast_id"]: r for d in DATA for r in d["roasting"]}
        green = sum(gl.values()); used = sum(r["muatan_green_kg"] for r in rr.values()); out = sum(r["berat_sangrai_kg"] for r in rr.values())
        packed = min(out, S.kemasan.sum() * 0.2)
        lab = ["Ceri panen", "Green bean", "Susut pengolahan", "Disangrai", "Stok green tersisa", "Kopi sangrai", "Susut roasting", "Dikemas", "Belum dikemas"]
        src = [0, 0, 1, 1, 3, 3, 5, 5]; dst = [1, 2, 3, 4, 5, 6, 7, 8]
        val = [green, max(cher - green, 0), used, max(green - used, 0), out, max(used - out, 0), packed, max(out - packed, 0)]
        f = go.Figure(go.Sankey(node=dict(label=lab, pad=16, thickness=16, color=[LEAF, "#9AAE6B", "#B9A68E", ROAST, CREMA, RED, "#B9A68E", ESP, CREMA]),
                                link=dict(source=src, target=dst, value=val, color="rgba(111,78,55,.22)")))
        f.update_layout(title="Aliran massa: dari ceri sampai kemasan (kg)", **PLT); st.plotly_chart(f)
    a, b = st.columns([1.25, 1])
    with a:
        SV["bulan"] = SV.tgl.dt.strftime("%Y-%m"); m = SV.groupby("bulan")[[f"t{i}" for i in range(6)]].sum().reset_index()
        f = go.Figure([go.Bar(x=m.bulan, y=m[f"t{i}"], name=TAHAP[i], marker_color=WT[i]) for i in range(6)])
        f.update_layout(barmode="stack", title="Emisi per bulan kemas (kg CO2e)", legend=dict(orientation="h", y=-.2), **PLT); st.plotly_chart(f)
    with b:
        fr = {}
        for d in DATA:
            for h in d["panen"]:
                e = (h.get("pupuk_n_kg") or 0) * (F["N_PRODUKSI"] + F["N_LAPANGAN"]) + (h.get("solar_angkut_liter") or 0) * F["SOLAR"]
                fr[h["harvest_id"]] = dict(farm=h["farm_id"], petani=h["petani"], desa=h["desa"], lat=h["lat"], lon=h["lon"], praktik=h["praktik_budidaya"], ceri=h["berat_ceri_kg"], e=e)
        L = pd.DataFrame(fr.values()).groupby(["farm", "petani", "desa", "lat", "lon", "praktik"], as_index=False).sum(numeric_only=True)
        L["kg_per_kg_ceri"] = L.e / L.ceri
        try:
            f = px.scatter_map(L, lat="lat", lon="lon", size="ceri", color="kg_per_kg_ceri", hover_name="petani", hover_data={"desa": True, "praktik": True, "lat": False, "lon": False, "ceri": ":.0f", "kg_per_kg_ceri": ":.2f"},
                               color_continuous_scale=[[0, LEAF], [.5, CREMA], [1, RED]], zoom=8.3, size_max=22, map_style="open-street-map")
            f.update_layout(title="Kebun asal (warna = kg CO2e budidaya per kg ceri)", coloraxis_colorbar=dict(title="kgCO2e/kg"), **{**PLT, "margin": dict(t=48, l=0, r=0, b=0)}); st.plotly_chart(f)
        except Exception:
            st.map(L, latitude="lat", longitude="lon")
        st.caption("Koordinat perkiraan tingkat desa (simulasi), bukan lokasi kebun sebenarnya.")
    st.markdown(f'<div class="note">{CATATAN}</div>', unsafe_allow_html=True)

# =============================================================== TELUSURI
with tab_t:
    ids = list(S.fg_id); awal = st.query_params.get("batch", ids[0])
    l, r_ = st.columns([2, 1])
    kode = l.selectbox("Pilih atau ketik kode batch (contoh: FG-GYO-2602-001)", ids, index=ids.index(awal) if awal in ids else 0)
    tuj = r_.selectbox("Saring tujuan distribusi (opsional)", ["Semua"] + sorted(S.tujuan.unique()))
    if tuj != "Semua":
        daftar = S[S.tujuan == tuj].fg_id.tolist()
        st.caption(f"{len(daftar)} batch menuju {tuj}: " + ", ".join(daftar[:8]) + (" ..." if len(daftar) > 8 else ""))
    P = POR[kode]; K = P["_k"]; g = P["green"]; rs = P["roasting"]; hs = P["panen"]; ok = P["status_audit"] == "Lulus"
    row = S[S.fg_id == kode].iloc[0]
    a, b = st.columns([4, 1])
    with a:
        st.markdown(f'<span class="{"ok" if ok else "bad"}">Audit: {P["status_audit"]}</span> &nbsp; <span class="chip" style="background:{CREMA};color:{ESP};border:0">Intensitas karbon: {row.kategori}</span>', unsafe_allow_html=True)
        st.subheader(P["fg_id"]); st.caption(P["produk"])
        petani = sorted({h["petani"] for h in hs}); jm = sum(h["lama_jemur_hari"] for h in hs) / len(hs)
        st.markdown(f"Batch ini berisi **{P['jumlah_kemasan']:,} kemasan**, dikemas {tg(P['tgl_kemas'])}. Kopinya dipanen dari **{len(petani)} petani** di "
                    f"{' dan '.join(sorted({h['kabupaten'] for h in hs}))}, dijemur rata-rata {jm:.1f} hari, lalu disangrai pada {len(rs)} batch roasting. "
                    f"Skor cupping green bean **{g['skor_cupping']}**.")
        m = st.columns(3)
        kartu(m[0], f"{fm(K['total'], 1)} kg", "Estimasi emisi batch", "CO2e")
        kartu(m[1], f"{fm(K['g_per_kemasan'], 0)} g", "CO2e per kemasan 200 g", "")
        kartu(m[2], fm(K["per_kg"], 2), "kg CO2e per kg sangrai", f"rata-rata batch valid {fm(SV.per_kg.mean(), 2)}")
        gagal = [x for x in P["audit"] if not x["lulus"]]
        if gagal:
            st.markdown('<div class="note"><b>Temuan audit:</b> ' + "; ".join(f"{x['aturan']} ({x['catatan']})" for x in gagal) + "</div>", unsafe_allow_html=True)
    with b:
        png = qr_png(P["fg_id"]); st.image(png, caption="QR Passport", width=150)
        st.download_button("Unduh QR", png, f"qr_{P['fg_id']}.png", "image/png")
    pilih = st.radio("Tahap", [f"{i + 1}. {t}" for i, t in enumerate(TAHAP)], horizontal=True, label_visibility="collapsed")
    i = int(pilih.split(".")[0]) - 1
    st.markdown('<div class="steps">' + "".join(
        f'<div class="stp"><div class="dot{" on" if j == i else ""}" style="background:{WT[j]}">{j + 1}</div><b>{TAHAP[j]}</b>{fm(K["tahap"][j], 1)} kg CO2e</div>' for j in range(6)) + "</div>", unsafe_allow_html=True)
    cols = st.columns([2.2, 1])
    with cols[0]:
        if i == 0:
            st.markdown("##### Panen & angkut: asal petani dan kebun")
            st.dataframe(pd.DataFrame(hs)[["harvest_id", "petani", "desa", "praktik_budidaya", "varietas", "ketinggian_mdpl", "tgl_panen", "berat_ceri_kg", "ceri_merah_persen", "pupuk_n_kg", "solar_angkut_liter"]], hide_index=True)
        elif i == 1:
            st.markdown("##### Pascapanen: penjemuran natural")
            st.dataframe(pd.DataFrame(hs)[["harvest_id", "metode_jemur", "tgl_mulai_jemur", "tgl_selesai_jemur", "lama_jemur_hari", "kadar_air_kering_persen", "ceri_apung_persen", "listrik_sortasi_kwh"]], hide_index=True)
            st.caption("Penjemuran memakai sinar matahari sehingga tidak ada bahan bakar; emisi tahap ini hanya dari listrik sortasi/pengadukan.")
        elif i == 2:
            st.markdown(f"##### Green bean: {g['green_id']}")
            c3 = st.columns(3)
            for n_, (lb, v) in enumerate([("Tanggal hulling", tg(g["tgl_hulling"])), ("Berat green bean", f"{fm(g['berat_green_kg'])} kg"), ("Rendemen dari ceri", f"{fm(g['rendemen_persen'])}%"),
                                          ("Ukuran ayakan", g["ukuran_ayakan"]), ("Cacat per 300 g", g["cacat_per_300g"]), ("Kadar air", f"{fm(g['kadar_air_green_persen'])}%"),
                                          ("Skor cupping", g["skor_cupping"]), ("Listrik hulling", f"{fm(g['listrik_hulling_kwh'])} kWh"), ("Lama simpan", f"{g['lama_simpan_hari']} hari")]):
                c3[n_ % 3].metric(lb, v)
        elif i == 3:
            st.markdown(f"##### Roasting: {len(rs)} batch, {fm(K['kg_sangrai'])} kg kopi sangrai")
            st.dataframe(pd.DataFrame(rs)[["roast_id", "tgl_roasting", "muatan_green_kg", "suhu_charge_c", "suhu_drop_c", "durasi_menit", "susut_persen", "berat_sangrai_kg", "lpg_kg", "listrik_roasting_kwh"]], hide_index=True)
        elif i == 4:
            st.markdown("##### Kemas: barang jadi")
            c3 = st.columns(3)
            for n_, (lb, v) in enumerate([("Kode batch", P["fg_id"]), ("Tanggal kemas", tg(P["tgl_kemas"])), ("Jumlah kemasan 200 g", f"{P['jumlah_kemasan']:,}"),
                                          ("Kedaluwarsa", tg(P["tgl_kedaluwarsa"])), ("Film kemasan", f"{fm(P['film_kg'], 2)} kg"), ("Kardus", f"{fm(P['kardus_kg'], 2)} kg")]):
                c3[n_ % 3].metric(lb, v)
        else:
            st.markdown("##### Distribusi")
            c3 = st.columns(3)
            c3[0].metric("Tujuan", P["tujuan_distribusi"]); c3[1].metric("Tanggal kirim", tg(P["tgl_kirim"])); c3[2].metric("Jarak angkut", f"{fm(P['jarak_km'], 0)} km")
    with cols[1]:
        kk = TAHAP_KOMPONEN[i]; det = pd.DataFrame({"Sumber emisi": [LABEL[x] for x in kk], "kg CO2e": [round(K["komponen"][x], 2) for x in kk]})
        st.markdown(f"##### Karbon tahap {i + 1}"); st.metric("Emisi tahap ini", f"{fm(K['tahap'][i], 2)} kg CO2e", f"{K['tahap'][i] / K['total'] * 100:.0f}% dari total batch", delta_color="off")
        st.dataframe(det, hide_index=True)
        if i < 3: st.caption("Emisi hulu (kebun, pascapanen, hulling) dialokasikan ke batch ini berdasarkan massa green bean yang disangrai.")
    f = go.Figure(go.Waterfall(x=TAHAP + ["Total"], y=K["tahap"] + [0], measure=["relative"] * 6 + ["total"], connector=dict(line=dict(color=CREMA)),
                               increasing=dict(marker=dict(color=RED)), totals=dict(marker=dict(color=ESP)), text=[fm(v, 1) for v in K["tahap"]] + [fm(K["total"], 1)], textposition="outside"))
    f.update_layout(title="Akumulasi karbon sepanjang rantai (kg CO2e)", showlegend=False, height=340, **PLT); st.plotly_chart(f)
    st.markdown(f'<div class="note">{CATATAN}</div>', unsafe_allow_html=True)

# =============================================================== ANALISIS KARBON
with tab_k:
    st.subheader("Di mana emisi terbesar?")
    st.caption(f"Grafik di tab ini memakai {len(SV)} batch valid; {len(S) - len(SV)} batch di luar rentang wajar dikecualikan (lihat tab Audit).")
    kom = pd.DataFrame({"komponen": [LABEL[k] for k in KOMPONEN], "kg": [sum(d["_k"]["komponen"][k] for d in DV) for k in KOMPONEN], "tahap": [TAHAP[next(t for t, v in TAHAP_KOMPONEN.items() if k in v)] for k in KOMPONEN]}).sort_values("kg")
    a, b = st.columns(2)
    with a:
        f = px.bar(kom, x="kg", y="komponen", color="tahap", orientation="h", color_discrete_sequence=WT, category_orders={"tahap": TAHAP}, title="Emisi per sumber (seluruh batch, kg CO2e)")
        f.update_layout(legend=dict(orientation="h", y=-.15), **PLT); st.plotly_chart(f)
    with b:
        f = px.histogram(SV, x="per_kg", nbins=25, color_discrete_sequence=[ROAST], title="Sebaran intensitas karbon antar batch", labels={"per_kg": "kg CO2e / kg sangrai"})
        f.add_vrect(x0=RENTANG_INTENSITAS[0], x1=RENTANG_INTENSITAS[1], fillcolor=LEAF, opacity=.08, line_width=0, annotation_text="rentang wajar audit")
        f.update_layout(**PLT); st.plotly_chart(f)
    a, b = st.columns(2)
    with a:
        pr = pd.DataFrame([dict(praktik=h["praktik_budidaya"], intensitas=((h.get("pupuk_n_kg") or 0) * (F["N_PRODUKSI"] + F["N_LAPANGAN"]) + (h.get("solar_angkut_liter") or 0) * F["SOLAR"]) / h["berat_ceri_kg"])
                           for d in DV for h in {x["harvest_id"]: x for x in d["panen"]}.values()])
        f = px.box(pr, x="praktik", y="intensitas", color="praktik", color_discrete_sequence=[LEAF, CREMA, RED], category_orders={"praktik": ["Organik", "Semi-organik", "Konvensional"]},
                   title="Emisi budidaya per kg ceri menurut praktik")
        f.update_layout(showlegend=False, **PLT); st.plotly_chart(f)
    with b:
        f = px.scatter(SV, x="cupping", y="per_kg", color="tujuan", hover_name="fg_id", title="Skor cupping vs intensitas karbon", color_discrete_sequence=WT + [CREMA, LEAF])
        f.update_layout(xaxis_title="skor cupping green bean", yaxis_title="kg CO2e / kg sangrai", legend=dict(orientation="h", y=-.25), **PLT); st.plotly_chart(f)
    a, b = st.columns(2)
    cols_t = ["fg_id", "tujuan", "kemasan", "per_kg", "g_kemasan"]; ren = {"fg_id": "Batch", "tujuan": "Tujuan", "kemasan": "Kemasan", "per_kg": "kgCO2e/kg", "g_kemasan": "g CO2e/kemasan"}
    a.markdown("##### 5 batch intensitas terendah"); a.dataframe(SV.nsmallest(5, "per_kg")[cols_t].rename(columns=ren).round(2), hide_index=True)
    b.markdown("##### 5 batch intensitas tertinggi"); b.dataframe(SV.nlargest(5, "per_kg")[cols_t].rename(columns=ren).round(2), hide_index=True)
    st.divider()
    st.subheader("Simulasi pengurangan emisi (what-if)")
    st.caption("Geser pengaturan untuk melihat dampak perubahan praktik terhadap total emisi seluruh batch. Ini perhitungan skenario, bukan data hasil pengukuran.")
    s = st.columns(4)
    pp = s[0].slider("Pupuk N berkurang (%)", 0, 100, 0); pl = s[1].slider("LPG roasting lebih hemat (%)", 0, 50, 0)
    pe = s[2].slider("Listrik lebih bersih (%)", 0, 100, 0, help="Mis. memakai panel surya atau energi terbarukan"); pk = s[3].slider("Bahan kemasan berkurang (%)", 0, 50, 0)
    mult = {k: 1 - pp / 100 for k in KELOMPOK["Pupuk"]} | {"lpg_roasting": 1 - pl / 100} | {k: 1 - pe / 100 for k in KELOMPOK["Listrik"]} | {k: 1 - pk / 100 for k in KELOMPOK["Kemasan"]}
    base = sum(d["_k"]["total"] for d in DV); sim = sum(hitung_karbon(d, F, mult)["total"] for d in DV)
    x = st.columns(3); x[0].metric("Emisi dasar", f"{fm(base / 1000, 2)} ton CO2e"); x[1].metric("Emisi skenario", f"{fm(sim / 1000, 2)} ton CO2e", f"{(sim - base) / base * 100:.1f}%", delta_color="inverse")
    x[2].metric("Per kemasan (skenario)", f"{fm(sim / SV.kemasan.sum() * 1000, 0)} g CO2e")
    tb = [sum(d["_k"]["tahap"][t] for d in DV) for t in range(6)]; ts = [sum(hitung_karbon(d, F, mult)["tahap"][t] for d in DV) for t in range(6)]
    f = go.Figure([go.Bar(x=TAHAP, y=tb, name="Dasar", marker_color=CREMA), go.Bar(x=TAHAP, y=ts, name="Skenario", marker_color=LEAF)])
    f.update_layout(barmode="group", title="Emisi per tahap: dasar vs skenario (kg CO2e)", legend=dict(orientation="h", y=-.15), **PLT); st.plotly_chart(f)

# =============================================================== AUDIT
with tab_a:
    st.subheader("Audit otomatis")
    st.caption("Setiap batch diperiksa dengan 8 aturan, dihitung ulang dari data terkini. Temuan pada satu lot (mis. lot green bean) ikut menandai semua batch dari lot itu.")
    aturan = [x["aturan"] for x in DATA[0]["audit"]]
    c = st.columns(4)
    kartu(c[0], f"{(S.status == 'Lulus').sum()} / {len(S)}", "Batch lulus"); kartu(c[1], (S.status != "Lulus").sum(), "Perlu ditinjau")
    fail = pd.Series({a: sum(not x["lulus"] for d in DATA for x in d["audit"] if x["aturan"] == a) for a in aturan}); kartu(c[2], int(fail.sum()), "Total temuan")
    kartu(c[3], fail.idxmax()[:26] + "…", "Aturan paling sering gagal", f"{fail.max()} batch")
    st.write("")
    hanya = st.toggle("Tampilkan hanya batch yang perlu ditinjau", value=True)
    tabel = pd.DataFrame([{"Batch": d["fg_id"], "Status": d["status_audit"], **{f"R{j + 1}": ("✓" if x["lulus"] else "✗") for j, x in enumerate(d["audit"])}} for d in DATA])
    if hanya: tabel = tabel[tabel.Status != "Lulus"]
    st.dataframe(tabel.sort_values("Batch"), hide_index=True, column_config={f"R{j + 1}": st.column_config.TextColumn(f"R{j + 1}", help=t) for j, t in enumerate(aturan)})
    for j, t in enumerate(aturan): st.write(f"**R{j + 1}.** {t}")
    st.markdown("##### Rincian temuan")
    tem = pd.DataFrame([{"Batch": d["fg_id"], "Aturan": x["aturan"], "Catatan": x["catatan"]} for d in DATA for x in d["audit"] if not x["lulus"]])
    st.dataframe(tem, hide_index=True) if len(tem) else st.success("Tidak ada temuan.")
    st.caption("Sebagian temuan pada data simulasi sengaja disisipkan untuk menunjukkan cara kerja audit.")

# =============================================================== METODOLOGI
with tab_m:
    st.subheader("Cara kerja perhitungan karbon")
    st.markdown("""
**Batas sistem:** dari budidaya di kebun sampai barang jadi tiba di tujuan (*cradle-to-customer*). **Tidak termasuk:** penyerapan karbon pohon kopi dan naungan, perubahan tata guna lahan, penyeduhan dan konsumsi, serta pembuangan kemasan.

**Rumus:** emisi = data aktivitas × faktor emisi. Contoh: LPG roasting 0,72 kg × 2,987 kg CO2e/kg = 2,15 kg CO2e.

**Alokasi:** emisi hulu satu lot green bean (kebun, pascapanen, hulling, gudang) dibagi rata per kg green bean, lalu dibebankan ke tiap batch roasting sesuai jumlah green bean yang disangrai. Emisi roasting, kemasan, dan distribusi dibebankan langsung ke batch yang melakukannya. Dengan cara ini stok green bean yang belum disangrai tidak ikut dibebankan.

**Hitung ulang otomatis:** dashboard menghitung ulang karbon dan audit setiap dimuat, jadi mengubah data aktivitas di MongoDB atau faktor emisi di `data/faktor_emisi.csv` langsung mengubah hasilnya.
""")
    st.markdown("##### Faktor emisi yang dipakai")
    st.dataframe(FDF.rename(columns={"kode": "Kode", "nama": "Faktor", "satuan": "Satuan", "nilai": "Nilai", "sumber": "Sumber", "status": "Status"}), hide_index=True)
    st.markdown("""
**Status faktor:** *Bersumber* berarti nilai berasal dari sumber yang tercantum. *Asumsi* berarti belum diverifikasi dan harus diganti dengan nilai dari sumber terukur sebelum angka dipakai di laporan akhir.

##### Keterbatasan yang harus disebut
- Data aktivitas (pupuk, solar, listrik, LPG, kemasan, jarak) adalah **simulasi**, bukan hasil pencatatan lapangan.
- Beberapa faktor emisi masih **asumsi** (lihat tabel). Hasil adalah estimasi dengan ketidakpastian yang belum dihitung.
- Ini bukan sertifikasi karbon dan bukan klaim anti-manipulasi; sistem ini menunjukkan ketertelusuran dan transparansi data.
""")
    e = pd.DataFrame({"Batch": S.fg_id, "Kemasan": S.kemasan, **{TAHAP[i]: S[f"t{i}"].round(2) for i in range(6)}, "Total kg CO2e": S.total.round(2), "kg CO2e per kg sangrai": S.per_kg.round(3), "g CO2e per kemasan": S.g_kemasan.round(1)})
    z = st.columns(2)
    z[0].download_button("Unduh emisi per batch (CSV)", e.to_csv(index=False).encode(), "emisi_per_batch.csv", "text/csv")
    z[1].download_button("Unduh faktor emisi (CSV)", FDF.to_csv(index=False).encode(), "faktor_emisi.csv", "text/csv")
