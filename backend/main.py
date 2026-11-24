"""FastAPI REST API untuk AgroTrace Carbon Passport — Kopi Arabika Gayo Natural."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from backend.data_service import service
from backend.schemas import SimulateRequest

app = FastAPI(
    title="AgroTrace Carbon Passport API",
    description="REST API untuk ketertelusuran kopi dan perhitungan karbon dinamis berbasis agrotrace_lib.py",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return service.get_health()


@app.post("/api/cache/refresh")
def refresh_cache() -> dict:
    return service.refresh()


@app.get("/api/overview")
def overview() -> dict:
    return service.get_overview()


@app.get("/api/batches")
def list_batches(
    tujuan: str | None = Query(default=None, description="Filter tujuan distribusi"),
    status: str | None = Query(default=None, description="Filter status audit (Lulus / Perlu ditinjau)"),
    search: str | None = Query(default=None, description="Kata kunci pencarian fg_id / green_id / tujuan"),
) -> dict:
    return service.get_batches(tujuan=tujuan, status=status, search=search)


@app.get("/api/batches/{fg_id}")
def get_batch(fg_id: str) -> dict:
    detail = service.get_batch_detail(fg_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Batch '{fg_id}' tidak ditemukan")
    return detail


@app.get("/api/carbon-analysis")
def carbon_analysis() -> dict:
    return service.get_carbon_analysis()


@app.post("/api/simulate")
def simulate(req: SimulateRequest) -> dict:
    return service.simulate(req)


@app.get("/api/audit")
def audit_summary(
    only_review: bool = Query(default=False, description="Tampilkan hanya batch dengan status Perlu ditinjau"),
) -> dict:
    return service.get_audit(only_review=only_review)


@app.get("/api/methodology")
def methodology() -> dict:
    return service.get_methodology()


@app.get("/api/download/emisi_per_batch.csv")
def download_emisi_csv() -> Response:
    csv_bytes = service.get_emisi_csv_bytes()
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="emisi_per_batch.csv"'},
    )


@app.get("/api/download/faktor_emisi.csv")
def download_faktor_csv() -> Response:
    csv_bytes = service.get_faktor_csv_bytes()
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="faktor_emisi.csv"'},
    )
