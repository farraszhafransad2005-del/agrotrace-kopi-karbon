"""Gabungkan tabel menjadi dokumen 'paspor' per batch barang jadi, hitung karbon (aktivitas x faktor) dan audit.
Keluaran: data/paspor.json (koleksi 'paspor'), data/emisi_per_batch.csv.  Logika ada di agrotrace_lib.py (dipakai juga oleh app.py)."""
import sys, os, json, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import pandas as pd
from agrotrace_lib import hitung_karbon, audit, TAHAP, KOMPONEN
L = lambda n: pd.read_csv(f"data/{n}.csv")
Fk, H, G, R, P = [L(x) for x in ["kebun", "lot_panen", "lot_green", "batch_roasting", "batch_barang_jadi"]]
F = dict(zip(L("faktor_emisi").kode, L("faktor_emisi").nilai))
clean = lambda d: {k: (None if (isinstance(v, float) and math.isnan(v)) else (v.item() if hasattr(v, "item") else v)) for k, v in d.items()}
out, rows = [], []
Gi = G.set_index("green_id")
for _, p in P.iterrows():
    g = Gi.loc[p.green_id].to_dict(); g["green_id"] = p.green_id
    rs = R[R.roast_id.isin(p.roast_ids.split("|"))]; hs = H[H.harvest_id.isin(g["harvest_ids"].split("|"))].merge(Fk, on="farm_id")
    doc = {**clean(p.to_dict()), "panen": [clean(r) for r in hs.to_dict("records")], "green": clean(g), "roasting": [clean(r) for r in rs.to_dict("records")]}
    k = hitung_karbon(doc, F); a = audit(doc, F)
    doc["karbon"] = {"tahap": [round(x, 3) for x in k["tahap"]], "total_kgco2e": round(k["total"], 3), "kgco2e_per_kg": round(k["per_kg"], 3),
                     "g_per_kemasan": round(k["g_per_kemasan"], 1), "komponen": {c: round(v, 3) for c, v in k["komponen"].items()}}
    doc["audit"] = a; doc["status_audit"] = "Lulus" if all(x["lulus"] for x in a) else "Perlu ditinjau"
    out.append(doc)
    rows.append({"fg_id": p.fg_id, "tgl_kemas": p.tgl_kemas, "jumlah_kemasan": p.jumlah_kemasan, **{f"emisi_{t}": round(v, 3) for t, v in zip(["panen", "pascapanen", "green", "roasting", "kemas", "distribusi"], k["tahap"])},
                 "total_kgco2e": round(k["total"], 3), "kgco2e_per_kg_sangrai": round(k["per_kg"], 3), "g_per_kemasan": round(k["g_per_kemasan"], 1), "status_audit": doc["status_audit"]})
json.dump(out, open("data/paspor.json", "w"), ensure_ascii=False, indent=1)
e = pd.DataFrame(rows); e.to_csv("data/emisi_per_batch.csv", index=False)
print(len(out), "paspor;", (e.status_audit != "Lulus").sum(), "perlu ditinjau")
print(e[["kgco2e_per_kg_sangrai", "g_per_kemasan"]].describe().round(2))
print(e[[c for c in e.columns if c.startswith("emisi_")]].sum().div(e.total_kgco2e.sum()).round(3))
print(e.tgl_kemas.min(), e.tgl_kemas.max(), e.groupby(e.tgl_kemas.str[:7]).size().to_dict())
