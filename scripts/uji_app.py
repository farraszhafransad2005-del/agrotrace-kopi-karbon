import json, os, sys, mongomock, pymongo, pandas as pd
from streamlit.testing.v1 import AppTest
import streamlit as st
T = lambda: AppTest.from_file("../app.py", default_timeout=120).run()
at = T(); print("demo:", at.exception, [e.value for e in at.caption][:1])
for t in ["1. Panen & angkut","2. Pascapanen","3. Green bean","4. Roasting","5. Kemas","6. Distribusi"]:
    at.radio[0].set_value(t).run(); assert not at.exception, (t, at.exception)
ids = at.selectbox[0].options; at.selectbox[0].set_value(ids[40]).run(); print("batch", ids[40], at.exception)
for sl in at.slider: sl.set_value(sl.max if sl.max<=100 else 0)
at.run(); print("slider:", at.exception)
fake = mongomock.MongoClient(); db = fake["agrotrace_kopi"]
db["paspor"].insert_many(json.load(open("data/paspor.json"))); db["faktor_emisi"].insert_many(pd.read_csv("data/faktor_emisi.csv").to_dict("records"))
pymongo.MongoClient = lambda *a, **k: fake; os.environ["MONGO_URI"] = "mongodb://x"; st.cache_data.clear()
at = T(); print("mongo:", at.exception, [e.value for e in at.caption][:1])
# edit data aktivitas di "Atlas": audit dan karbon harus berubah
doc = db["paspor"].find_one({"fg_id": ids[0]}); db["paspor"].update_one({"fg_id": ids[0]}, {"$set": {"jumlah_kemasan": 99999}}); st.cache_data.clear()
at = T(); at.selectbox[0].set_value(ids[0]).run(); print("edit 99999 ->", [m.value for m in at.markdown if "Audit:" in m.value][:1])
pymongo.MongoClient = lambda *a, **k: (_ for _ in ()).throw(ConnectionError("x")); st.cache_data.clear()
at = T(); print("putus:", [e.value[:35] for e in at.error])
