"""Skema request Pydantic untuk API AgroTrace."""
from pydantic import BaseModel, Field


class SimulateRequest(BaseModel):
    pupuk_n_pct: float = Field(0.0, ge=0.0, le=100.0, description="Persentase pengurangan pupuk N (0-100%)")
    lpg_pct: float = Field(0.0, ge=0.0, le=50.0, description="Persentase penghematan LPG roasting (0-50%)")
    listrik_pct: float = Field(0.0, ge=0.0, le=100.0, description="Persentase listrik lebih bersih (0-100%)")
    kemasan_pct: float = Field(0.0, ge=0.0, le=50.0, description="Persentase pengurangan bahan kemasan (0-50%)")
