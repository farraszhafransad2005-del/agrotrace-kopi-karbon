"""Pengujian integrasi backend FastAPI AgroTrace menggunakan stdlib + uvicorn."""
from __future__ import annotations

import csv
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import pandas as pd

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agrotrace_lib import KELOMPOK, RENTANG_INTENSITAS, hitung_karbon  # noqa: E402

BASE_URL = "http://127.0.0.1:8099"


def request_json(
    path: str,
    method: str = "GET",
    body: dict | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict, dict]:
    req_headers = dict(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, dict(resp.headers), json.loads(raw)
    except urllib.error.HTTPError as err:
        raw = err.read().decode("utf-8")
        return err.code, dict(err.headers), json.loads(raw) if raw else {}


def request_raw(path: str) -> tuple[int, dict, bytes]:
    req = urllib.request.Request(f"{BASE_URL}{path}", method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.status, dict(resp.headers), resp.read()


def wait_for_server(timeout_s: float = 20.0) -> None:
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            code, _, _ = request_json("/api/health")
            if code == 200:
                return
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("Server uvicorn tidak siap sebelum batas waktu.")


def main() -> None:
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8099"],
        cwd=str(ROOT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        wait_for_server()

        # 1. /api/health + CORS check
        code, hdrs, health = request_json("/api/health", headers={"Origin": "http://localhost:5173"})
        assert code == 200, f"health code={code}"
        assert health["status"] == "ok"
        assert health["source_mode"] == "local", health
        assert health["total_batches"] == 229, health
        cors_val = hdrs.get("access-control-allow-origin") or hdrs.get("Access-Control-Allow-Origin")
        assert cors_val == "*", f"Unexpected CORS header: {hdrs}"
        print(f"[PASS] /api/health -> total={health['total_batches']}, valid={health['valid_batches']}, mode={health['source_mode']}, cors={cors_val}")

        # 2. /api/overview
        code, _, ov = request_json("/api/overview")
        assert code == 200
        assert len(ov["stages"]) == 6
        share_sum = sum(s["share_pct"] for s in ov["stages"])
        assert abs(share_sum - 100.0) < 0.2, f"share_sum={share_sum}"
        assert len(ov["sankey"]["nodes"]) == 9
        assert len(ov["sankey"]["links"]) == 8
        assert len(ov["farms"]) == 36, f"farms={len(ov['farms'])}"
        assert ov["kpi"]["total_batches"] == 229
        assert ov["kpi"]["audit_pass_count"] + ov["kpi"]["audit_review_count"] == 229
        print(
            f"[PASS] /api/overview -> valid={ov['kpi']['valid_batches_count']}/{ov['kpi']['total_batches']}, "
            f"total_em_ton={ov['kpi']['total_emission_ton']}, top_stage={ov['top_stage']['name']} ({ov['top_stage']['share_pct']}%), "
            f"farms={len(ov['farms'])}, monthly={len(ov['monthly'])}"
        )

        # 3. /api/batches (unfiltered + filtered)
        code, _, batches_all = request_json("/api/batches")
        assert code == 200
        assert batches_all["total"] == 229
        assert batches_all["filtered_count"] == 229
        assert len(batches_all["items"]) == 229

        tujuan_param = urllib.parse.quote("Toko Kopi Bogor")
        code, _, batches_filt = request_json(f"/api/batches?tujuan={tujuan_param}&status=Lulus")
        assert code == 200
        assert 0 < batches_filt["filtered_count"] < 229
        assert all(b["tujuan_distribusi"] == "Toko Kopi Bogor" and b["status_audit"] == "Lulus" for b in batches_filt["items"])
        print(f"[PASS] /api/batches -> unfiltered={batches_all['filtered_count']}, filtered(Toko Kopi Bogor + Lulus)={batches_filt['filtered_count']}")

        # 4. /api/batches/FG-GYO-2602-001 parity vs data/emisi_per_batch.csv
        code, _, detail = request_json("/api/batches/FG-GYO-2602-001")
        assert code == 200
        assert detail["fg_id"] == "FG-GYO-2602-001"
        assert detail["status_audit"] == "Lulus"
        assert len(detail["audit"]) == 8
        assert len(detail["karbon"]["waterfall"]) == 7

        emisi_df = pd.read_csv(ROOT_DIR / "data" / "emisi_per_batch.csv").set_index("fg_id")
        ref = emisi_df.loc["FG-GYO-2602-001"]
        assert abs(detail["karbon"]["total"] - float(ref["total_kgco2e"])) < 0.01
        assert abs(detail["karbon"]["per_kg"] - float(ref["kgco2e_per_kg_sangrai"])) < 0.01
        assert abs(detail["karbon"]["g_per_kemasan"] - float(ref["g_per_kemasan"])) < 0.2
        print(
            f"[PASS] /api/batches/FG-GYO-2602-001 -> total={detail['karbon']['total']}, "
            f"per_kg={detail['karbon']['per_kg']}, g_per_kemasan={detail['karbon']['g_per_kemasan']}, "
            f"audit={detail['status_audit']}"
        )

        # 5. /api/batches/INVALID-BATCH-999 -> 404
        code, _, err404 = request_json("/api/batches/INVALID-BATCH-999")
        assert code == 404, f"Expected 404, got {code}: {err404}"
        print("[PASS] /api/batches/INVALID-BATCH-999 -> 404")

        # 6. /api/carbon-analysis
        code, _, ca = request_json("/api/carbon-analysis")
        assert code == 200
        assert len(ca["components"]) == 12
        assert [s["praktik"] for s in ca["cultivation_by_practice"]["summary"]] == ["Organik", "Semi-organik", "Konvensional"]
        assert len(ca["top5_lowest"]) == 5
        assert len(ca["top5_highest"]) == 5
        print(
            f"[PASS] /api/carbon-analysis -> components={len(ca['components'])}, "
            f"top_comp={ca['components'][0]['key']} ({ca['components'][0]['kg_co2e']} kg)"
        )

        # 7. POST /api/simulate (baseline, scenario vs direct agrotrace_lib, and 422 validation)
        code, _, sim0 = request_json("/api/simulate", method="POST", body={"pupuk_n_pct": 0, "lpg_pct": 0, "listrik_pct": 0, "kemasan_pct": 0})
        assert code == 200
        assert abs(sim0["reduction_pct"]) < 1e-9
        assert abs(sim0["scenario_total_kg"] - sim0["baseline_total_kg"]) < 1e-6

        params = {"pupuk_n_pct": 50, "lpg_pct": 30, "listrik_pct": 100, "kemasan_pct": 25}
        code, _, sim1 = request_json("/api/simulate", method="POST", body=params)
        assert code == 200
        assert sim1["scenario_total_kg"] < sim1["baseline_total_kg"]

        # Direct verification against agrotrace_lib.hitung_karbon
        with (ROOT_DIR / "data" / "paspor.json").open("r", encoding="utf-8") as f:
            raw_paspor = json.load(f)
        fdf = pd.read_csv(ROOT_DIR / "data" / "faktor_emisi.csv")
        F = dict(zip(fdf["kode"], fdf["nilai"].astype(float)))
        lo, hi = RENTANG_INTENSITAS
        mult = (
            {k: 1.0 - params["pupuk_n_pct"] / 100.0 for k in KELOMPOK["Pupuk"]}
            | {"lpg_roasting": 1.0 - params["lpg_pct"] / 100.0}
            | {k: 1.0 - params["listrik_pct"] / 100.0 for k in KELOMPOK["Listrik"]}
            | {k: 1.0 - params["kemasan_pct"] / 100.0 for k in KELOMPOK["Kemasan"]}
        )
        direct_base = 0.0
        direct_sim = 0.0
        for doc in raw_paspor:
            k0 = hitung_karbon(doc, F)
            if k0["per_kg"] is not None and lo <= k0["per_kg"] <= hi:
                direct_base += k0["total"]
                direct_sim += hitung_karbon(doc, F, mult)["total"]
        assert abs(sim1["baseline_total_kg"] - round(direct_base, 2)) <= 0.02
        assert abs(sim1["scenario_total_kg"] - round(direct_sim, 2)) <= 0.02

        code, _, err422 = request_json("/api/simulate", method="POST", body={"lpg_pct": 99})
        assert code == 422, f"Expected 422, got {code}: {err422}"
        print(
            f"[PASS] /api/simulate -> baseline={sim1['baseline_total_kg']} kg, "
            f"scenario={sim1['scenario_total_kg']} kg ({sim1['reduction_pct']}%), out-of-range=422"
        )

        # 8. /api/audit & /api/audit?only_review=true
        code, _, aud_all = request_json("/api/audit")
        assert code == 200
        assert len(aud_all["rules"]) == 8
        assert aud_all["summary"]["pass_count"] + aud_all["summary"]["review_count"] == 229
        assert len(aud_all["batches"]) == 229

        code, _, aud_rev = request_json("/api/audit?only_review=true")
        assert code == 200
        assert len(aud_rev["batches"]) == aud_rev["summary"]["review_count"]
        assert all(b["status_audit"] != "Lulus" for b in aud_rev["batches"])
        print(
            f"[PASS] /api/audit -> pass={aud_all['summary']['pass_count']}, "
            f"review={aud_all['summary']['review_count']}, findings={aud_all['summary']['total_findings']}"
        )

        # 9. /api/methodology
        code, _, meth = request_json("/api/methodology")
        assert code == 200
        assert len(meth["emission_factors"]) == 8
        print(f"[PASS] /api/methodology -> emission_factors={len(meth['emission_factors'])}")

        # 10. CSV Downloads
        code, hdrs, em_bytes = request_raw("/api/download/emisi_per_batch.csv")
        assert code == 200
        assert "text/csv" in (hdrs.get("content-type") or hdrs.get("Content-Type") or "")
        em_rows = list(csv.reader(io.StringIO(em_bytes.decode("utf-8"))))
        assert len(em_rows) == 230, f"Expected header + 229 rows, got {len(em_rows)}"

        code, hdrs, fk_bytes = request_raw("/api/download/faktor_emisi.csv")
        assert code == 200
        assert "text/csv" in (hdrs.get("content-type") or hdrs.get("Content-Type") or "")
        fk_rows = list(csv.reader(io.StringIO(fk_bytes.decode("utf-8"))))
        assert len(fk_rows) == 9, f"Expected header + 8 rows, got {len(fk_rows)}"
        print(f"[PASS] /api/download/*.csv -> emisi_rows={len(em_rows) - 1}, faktor_rows={len(fk_rows) - 1}")

        print("ALL BACKEND TESTS PASSED")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)


if __name__ == "__main__":
    main()
