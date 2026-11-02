"""Membuat data SIMULASI: Kopi Arabika Gayo Natural, Medium Roast, kemasan 200 g, lengkap dengan DATA AKTIVITAS
(pupuk, solar, listrik, LPG, kemasan, jarak) per proses. Emisi TIDAK ditulis di sini; dihitung di 2_buat_paspor.py
dari aktivitas x faktor emisi (data/faktor_emisi.csv). Semua angka buatan (seed tetap)."""
import numpy as np, pandas as pd
from datetime import date, timedelta
rng = np.random.default_rng(2026)
D = lambda x: x.isoformat()
NF, NH_PER_F, NH_PER_G = 36, 4, 4          # 36 kebun, 144 lot panen, 36 lot green
# ---- kebun ----
lokasi = {("Aceh Tengah","Bebesen"):(4.625,96.835),("Aceh Tengah","Pegasing"):(4.585,96.805),("Aceh Tengah","Atu Lintang"):(4.705,96.675),
          ("Aceh Tengah","Ketol"):(4.575,96.935),("Aceh Tengah","Kebayakan"):(4.645,96.885),("Bener Meriah","Bener Kelipah"):(4.755,96.905),
          ("Bener Meriah","Wih Pesam"):(4.775,96.755),("Bener Meriah","Permata"):(4.725,96.805)}
ks = list(lokasi)
nama = ["Ismail","Salmah","Rahmat","Zulkifli","Nurhayati","Hasballah","Anwar","Fatimah","Muksin","Darwis","Halimah","Sulaiman","Yusuf","Aminah","Jamaluddin",
        "Rukiah","Abdullah","Mariana","Khalid","Saidah","Fauzan","Ratna","Burhan","Syarifah","Idris","Nurlela","Mahdi","Zainab","Taufik","Rosnidar","Samsul",
        "Hidayah","Ridwan","Maisarah","Hamzah","Cut Nila"]
prak = ["Organik","Semi-organik","Konvensional"]
farms=[]
for i in range(NF):
    kab,desa = ks[i%8]; la,lo = lokasi[(kab,desa)]
    p = str(rng.choice(prak,p=[.25,.4,.35]))
    farms.append({"farm_id":f"KBN-{i+1:02d}","petani":("Bu " if i%2 else "Pak ")+nama[i],"kabupaten":kab,"desa":desa,
      "lat":round(la+float(rng.normal(0,.018)),4),"lon":round(lo+float(rng.normal(0,.018)),4),
      "ketinggian_mdpl":int(rng.integers(1200,1650)),"luas_ha":round(float(rng.uniform(.8,3.5)),1),
      "varietas":str(rng.choice(["Gayo 1","Gayo 2","Ateng Super","Bourbon"],p=[.35,.3,.25,.1])),"praktik_budidaya":p})
fdf=pd.DataFrame(farms)
rateN={"Organik":(.002,.006),"Semi-organik":(.008,.016),"Konvensional":(.016,.030)}   # kg N per kg ceri
# ---- lot panen: urut waktu, kebun bergilir ----
harv=[]; t=date(2025,10,18)
for i in range(NF*NH_PER_F):
    f=fdf.iloc[i%NF]; t=t+timedelta(days=int(rng.choice([0,1,1,1,2])))
    kg=round(float(rng.uniform(90,300)),0); jemur=int(rng.integers(14,23)); sel=t+timedelta(days=1)
    lo,hi=rateN[f.praktik_budidaya]
    harv.append({"harvest_id":f"PNN-{i+1:03d}","farm_id":f.farm_id,"tgl_panen":D(t),"berat_ceri_kg":kg,
      "ceri_merah_persen":round(float(np.clip(rng.normal(93,3),75,99)),1),"ceri_apung_persen":round(float(abs(rng.normal(2.5,1))),1),
      "tgl_mulai_jemur":D(sel),"lama_jemur_hari":jemur,"tgl_selesai_jemur":D(sel+timedelta(days=jemur)),
      "metode_jemur":str(rng.choice(["Para-para (raised bed)","Terpal/lantai jemur"],p=[.6,.4])),
      "kadar_air_kering_persen":round(float(np.clip(rng.normal(11.6,.5),10,12.4)),1),
      # data aktivitas
      "pupuk_n_kg":round(kg*float(rng.uniform(lo,hi)),2),"solar_angkut_liter":round(kg*float(rng.uniform(.008,.025)),2),
      "listrik_sortasi_kwh":round(kg*float(rng.uniform(.002,.008)),2)})
hdf=pd.DataFrame(harv)
# ---- lot green: gabungan 4 lot panen berurutan (kebun berbeda) ----
green=[]; roast=[]; fg=[]; rn=0; fn=0
LIMIT=date(2026,9,25)
dest=[("Toko Kopi Bogor",2250),("Kafe Kampus IPB",2250),("Distributor Jakarta",2150),("Toko Daring (kurir)",1900),("Kedai Medan",650),("Kafe Banda Aceh",450)]
for g in range(NF):
    ids=hdf.iloc[g*NH_PER_G:(g+1)*NH_PER_G]; yld=float(rng.uniform(.185,.215)); ck=float(ids.berat_ceri_kg.sum())
    kg=round(ck*yld,1); hull=date.fromisoformat(ids.tgl_selesai_jemur.max())+timedelta(days=int(rng.integers(10,20)))
    nr=40; simpan=int(rng.integers(30,160)); r0=hull+timedelta(days=simpan)
    lat=(LIMIT-timedelta(days=nr//2+2)); r0=min(r0,lat); simpan=(r0-hull).days
    green.append({"green_id":f"GRN-{g+1:02d}","harvest_ids":"|".join(ids.harvest_id),"tgl_hulling":D(hull),"berat_green_kg":kg,
      "rendemen_persen":round(kg/ck*100,1),"ukuran_ayakan":str(rng.choice(["Screen 17","Screen 18"])),"cacat_per_300g":int(rng.integers(3,14)),
      "kadar_air_green_persen":round(float(np.clip(rng.normal(11.4,.4),10,12.4)),1),"skor_cupping":round(float(rng.normal(84.2,1.1)),2),
      "gudang":"Gudang Green Bean Takengon","lama_simpan_hari":simpan,
      "listrik_hulling_kwh":round(kg*float(rng.uniform(.04,.07)),2),"listrik_gudang_kwh":round(kg*float(rng.uniform(.006,.016)),2)})
    avail=kg*.92; rids=[]
    for j in range(nr):
        ch=round(float(rng.uniform(10,14)),1)
        if ch>avail: break
        avail-=ch; rn+=1; loss=float(np.clip(rng.normal(14.5,1.2),11,18))
        roast.append({"roast_id":f"RST-{rn:03d}","green_id":f"GRN-{g+1:02d}","tgl_roasting":D(r0+timedelta(days=j//2)),"mesin":"Roaster drum 15 kg",
          "level":"Medium","muatan_green_kg":ch,"suhu_charge_c":int(rng.integers(195,206)),"suhu_drop_c":int(rng.integers(208,218)),
          "durasi_menit":round(float(rng.normal(12.5,.8)),1),"susut_persen":round(loss,1),"berat_sangrai_kg":round(ch*(1-loss/100),2),
          "lpg_kg":round(ch*float(rng.uniform(.05,.07)),2),"listrik_roasting_kwh":round(ch*float(rng.uniform(.08,.14)),2)}); rids.append(rn)
    i=0
    while i<len(rids):
        k=int(rng.integers(1,min(3,len(rids)-i)+1)); grp=rids[i:i+k]; i+=k; fn+=1
        rr=[roast[x-1] for x in grp]; kgout=sum(x["berat_sangrai_kg"] for x in rr)
        bags=int(kgout*1000/200*rng.uniform(.96,.99)); pack=date.fromisoformat(rr[-1]["tgl_roasting"])+timedelta(days=int(rng.integers(2,6)))
        dst,km=dest[int(rng.choice(len(dest),p=[.22,.22,.2,.16,.1,.1]))]
        fg.append({"fg_id":f"FG-GYO-{pack:%y%m}-{fn:03d}","roast_ids":"|".join(f"RST-{x:03d}" for x in grp),"green_id":f"GRN-{g+1:02d}",
          "produk":"Kopi Arabika Gayo Natural - Medium Roast - 200 g","tgl_kemas":D(pack),"jumlah_kemasan":bags,
          "tgl_kedaluwarsa":D(pack+timedelta(days=270)),"tujuan_distribusi":dst,"tgl_kirim":D(pack+timedelta(days=int(rng.integers(3,10)))),
          "jarak_km":int(km*rng.uniform(.97,1.05)),"film_kg":round(bags*float(rng.uniform(.010,.014)),3),
          "kardus_kg":round(bags*float(rng.uniform(.018,.026)),3),"listrik_kemas_kwh":round(bags*float(rng.uniform(.004,.008)),2)})
gdf=pd.DataFrame(green); rdf=pd.DataFrame(roast); fgdf=pd.DataFrame(fg)
# ---- anomali sengaja (agar audit punya sesuatu untuk ditemukan) ----
for i in rng.choice(len(gdf),2,replace=False): gdf.loc[i,"kadar_air_green_persen"]=round(float(rng.uniform(12.8,13.6)),1)
for i in rng.choice(len(rdf),4,replace=False):
    l=round(float(rng.uniform(21,24)),1); rdf.loc[i,["susut_persen","berat_sangrai_kg"]]=[l,round(rdf.loc[i,"muatan_green_kg"]*(1-l/100),2)]
for i in rng.choice(len(fgdf),2,replace=False): fgdf.loc[i,"jarak_km"]=int(fgdf.loc[i,"jarak_km"]*100)   # salah ketik satuan/jarak
for i in rng.choice(len(hdf),2,replace=False): hdf.loc[i,"ceri_merah_persen"]=np.nan
for i in rng.choice(len(hdf),2,replace=False): hdf.loc[i,"pupuk_n_kg"]=np.nan
for i in rng.choice(len(fgdf),3,replace=False): fgdf.loc[i,"jumlah_kemasan"]=int(fgdf.loc[i,"jumlah_kemasan"]*1.25)
for i in rng.choice(len(rdf),2,replace=False):
    gi=rdf.loc[i,"green_id"]; h=date.fromisoformat(gdf.set_index("green_id").loc[gi,"tgl_hulling"]); rdf.loc[i,"tgl_roasting"]=D(h-timedelta(days=3))
for n,df in [("kebun",fdf),("lot_panen",hdf),("lot_green",gdf),("batch_roasting",rdf),("batch_barang_jadi",fgdf)]: df.to_csv(f"data/{n}.csv",index=False)
print({n:len(x) for n,x in [("kebun",fdf),("panen",hdf),("green",gdf),("roast",rdf),("fg",fgdf)]}, "kemas terakhir:",fgdf.tgl_kirim.max())
