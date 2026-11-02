# AgroTrace Carbon Passport — Kopi Arabika Gayo Natural (Kelompok 8 ASDA 2026)
Produk tunggal: Kopi Arabika Gayo Natural, Medium Roast, 200 g. Rantai: kebun → lot panen → pascapanen (jemur natural) → lot green bean → batch roasting → batch barang jadi → distribusi.
Setiap proses mencatat **data aktivitas** (pupuk N, solar, listrik, LPG, kemasan, jarak). Emisi = aktivitas × faktor emisi, dihitung ulang tiap dashboard dimuat.

## Berkas penting
- `app.py` dashboard Streamlit · `agrotrace_lib.py` logika karbon dan audit (WAJIB ikut diunggah ke GitHub, dipakai app.py)
- `data/faktor_emisi.csv` faktor emisi beserta sumber dan status (Bersumber / Asumsi)
- `data/*.csv` tabel aktivitas per proses · `data/paspor.json` dokumen gabungan per batch · `data/emisi_per_batch.csv` hasil hitung
- `scripts/1_buat_data.py` pembuat data SIMULASI · `2_buat_paspor.py` gabung + hitung karbon + audit · `4_unggah_mongodb.py` unggah ke Atlas · `uji_app.py` uji otomatis

## Menjalankan
```
pip install -r requirements.txt
python scripts/2_buat_paspor.py                  # hanya bila data/faktor diubah
python scripts/4_unggah_mongodb.py "<connection string>"
streamlit run app.py                             # secrets: .streamlit/secrets.toml berisi mongo_uri
```
## Mengganti dengan data nyata
Isi CSV di `data/` dengan kolom yang sama (jangan jalankan `1_buat_data.py`), perbarui `faktor_emisi.csv` (ganti nilai berstatus Asumsi dengan sumber terukur), lalu jalankan skrip 2 dan 4.

## Batasan
Data aktivitas simulasi; faktor berstatus Asumsi belum diverifikasi; estimasi, bukan sertifikasi karbon; ketertelusuran ≠ jaminan anti-manipulasi.
