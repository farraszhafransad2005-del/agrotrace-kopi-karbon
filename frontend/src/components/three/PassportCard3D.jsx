import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import QRCode from "qrcode";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { QrCode } from "lucide-react";
import WebGLErrorBoundary, { checkWebGLSupport } from "./WebGLErrorBoundary";
import { STAGE_COLORS, fm, fmtDate } from "../../utils/format";

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function drawFrontCanvas(batch, qrCanvas) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");

  // Dark espresso + holographic gradient
  const bg = ctx.createLinearGradient(0, 0, 1024, 640);
  bg.addColorStop(0, "#120d0a");
  bg.addColorStop(0.5, "#1f1611");
  bg.addColorStop(1, "#0f1c16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 640);

  // Subtle diagonal climate-tech grid beams
  ctx.strokeStyle = "rgba(245, 158, 11, 0.08)";
  ctx.lineWidth = 2;
  for (let x = -200; x < 1200; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 260, 640);
    ctx.stroke();
  }

  // Border frame
  ctx.strokeStyle = "rgba(212, 163, 115, 0.45)";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 984, 600);

  // Header
  ctx.fillStyle = "#34d399";
  ctx.font = "700 20px 'JetBrains Mono', monospace";
  ctx.fillText("AGROTRACE · DIGITAL CARBON PASSPORT", 54, 72);

  // Audit status pill
  const isPass = batch.status_audit === "Lulus";
  ctx.fillStyle = isPass ? "rgba(16, 185, 129, 0.2)" : "rgba(224, 90, 71, 0.25)";
  ctx.fillRect(54, 94, 240, 38);
  ctx.strokeStyle = isPass ? "#10b981" : "#e05a47";
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 94, 240, 38);
  ctx.fillStyle = isPass ? "#6ee7b7" : "#fca5a5";
  ctx.font = "700 18px 'Inter', sans-serif";
  ctx.fillText(`AUDIT: ${batch.status_audit.toUpperCase()}`, 74, 119);

  // Batch ID
  ctx.fillStyle = "#fef3c7";
  ctx.font = "800 44px 'JetBrains Mono', monospace";
  ctx.fillText(batch.fg_id, 54, 198);

  // Origin & product
  const kabs = batch.summary?.kabupaten_list?.join(" & ") || "Aceh Tengah";
  ctx.fillStyle = "#d6d3d1";
  ctx.font = "600 22px 'Inter', sans-serif";
  ctx.fillText(`Kopi Arabika Gayo Natural · Medium Roast`, 54, 240);
  ctx.fillStyle = "#a8a29e";
  ctx.font = "500 20px 'Inter', sans-serif";
  ctx.fillText(
    `Asal: ${kabs} (${batch.summary?.petani_count || 0} petani) · Cupping ${fm(batch.summary?.skor_cupping, 2)}`,
    54,
    274
  );

  // Highlight Carbon Metric Box
  ctx.fillStyle = "rgba(12, 10, 9, 0.72)";
  ctx.fillRect(54, 316, 560, 178);
  ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 316, 560, 178);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "600 18px 'JetBrains Mono', monospace";
  ctx.fillText("JEJAK KARBON PER KEMASAN (200 g)", 82, 358);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px 'JetBrains Mono', monospace";
  ctx.fillText(`${fm(batch.karbon?.g_per_kemasan, 0)} g CO₂e`, 82, 424);

  ctx.fillStyle = "#6ee7b7";
  ctx.font = "500 20px 'JetBrains Mono', monospace";
  ctx.fillText(
    `Intensitas: ${fm(batch.karbon?.per_kg, 2)} kg CO₂e/kg · Total batch ${fm(batch.karbon?.total, 1)} kg`,
    82,
    466
  );

  // Footer
  ctx.fillStyle = "#a8a29e";
  ctx.font = "500 18px 'Inter', sans-serif";
  ctx.fillText(
    `Kemas: ${fmtDate(batch.tgl_kemas)} · Tujuan: ${batch.tujuan_distribusi}`,
    54,
    562
  );

  // Right-side QR Pad
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(674, 112, 296, 350);
  if (qrCanvas) {
    ctx.drawImage(qrCanvas, 694, 132, 256, 256);
  }
  ctx.fillStyle = "#1c1917";
  ctx.font = "700 17px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("PINDAI PASPOR", 822, 424);
  ctx.font = "500 14px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#57534e";
  ctx.fillText(batch.fg_id, 822, 448);
  ctx.textAlign = "left";

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function drawBackCanvas(batch) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 640;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 1024, 640);
  bg.addColorStop(0, "#101713");
  bg.addColorStop(1, "#16100d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1024, 640);

  ctx.strokeStyle = "rgba(16, 185, 129, 0.4)";
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 984, 600);

  ctx.fillStyle = "#fbbf24";
  ctx.font = "700 22px 'JetBrains Mono', monospace";
  ctx.fillText(`RINCIAN 6 TAHAP · ${batch.fg_id}`, 54, 72);

  const stages = batch.karbon?.tahap || [];
  const maxStage = Math.max(...stages.map((s) => s.total_kg_co2e), 1);

  stages.forEach((st, idx) => {
    const y = 128 + idx * 72;
    ctx.fillStyle = "#e7e5e4";
    ctx.font = "600 21px 'Inter', sans-serif";
    ctx.fillText(`${idx + 1}. ${st.name}`, 54, y + 24);

    // Track
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(320, y + 4, 460, 26);

    // Fill bar
    const w = Math.max(8, (st.total_kg_co2e / maxStage) * 460);
    ctx.fillStyle = STAGE_COLORS[idx] || "#10b981";
    ctx.fillRect(320, y + 4, w, 26);

    ctx.fillStyle = "#f5f5f4";
    ctx.font = "600 20px 'JetBrains Mono', monospace";
    ctx.fillText(`${fm(st.total_kg_co2e, 2)} kg (${fm(st.share_pct, 0)}%)`, 800, y + 24);
  });

  ctx.fillStyle = "#a8a29e";
  ctx.font = "500 18px 'Inter', sans-serif";
  ctx.fillText(
    `Lot Green: ${batch.stages_data?.green?.green_id || "-"} · Batch Roasting: ${batch.summary?.roast_count || 0} · Kemasan: ${batch.jumlah_kemasan} pcs`,
    54,
    584
  );

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function CardMesh({ batch, flipped, resetSignal, frontTex, backTex }) {
  const cardRef = useRef(null);
  const controlsRef = useRef(null);

  const cardGeo = useMemo(() => {
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(3.52, 2.2, 0.14), {
      depth: 0.06,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.015,
      bevelThickness: 0.015,
    });
    geo.center();
    return geo;
  }, []);

  const faceGeo = useMemo(() => new THREE.PlaneGeometry(3.42, 2.12), []);

  useEffect(() => {
    return () => {
      cardGeo.dispose();
      faceGeo.dispose();
    };
  }, [cardGeo, faceGeo]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  }, [resetSignal]);

  useFrame((_, delta) => {
    if (!cardRef.current) return;
    const targetFlipY = flipped ? Math.PI : 0;
    cardRef.current.rotation.y = THREE.MathUtils.lerp(cardRef.current.rotation.y, targetFlipY, delta * 5.2);
  });

  return (
    <>
      <ambientLight intensity={0.85} color="#fff7ed" />
      <directionalLight position={[3, 4, 5]} intensity={1.7} color="#fde68a" />
      <directionalLight position={[-4, -2, 3]} intensity={1.1} color="#34d399" />

      <group ref={cardRef}>
        {/* Metallic Edge Card Body */}
        <mesh geometry={cardGeo}>
          <meshPhysicalMaterial
            color="#35251b"
            metalness={0.68}
            roughness={0.28}
            clearcoat={0.7}
            iridescence={0.35}
          />
        </mesh>

        {/* Front Face */}
        <mesh geometry={faceGeo} position={[0, 0, 0.047]}>
          <meshPhysicalMaterial
            map={frontTex}
            roughness={0.32}
            metalness={0.14}
            clearcoat={0.6}
            clearcoatRoughness={0.22}
          />
        </mesh>

        {/* Back Face */}
        <mesh geometry={faceGeo} position={[0, 0, -0.047]} rotation={[0, Math.PI, 0]}>
          <meshPhysicalMaterial
            map={backTex}
            roughness={0.35}
            metalness={0.14}
            clearcoat={0.55}
            clearcoatRoughness={0.25}
          />
        </mesh>
      </group>

      <OrbitControls
        ref={controlsRef}
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI / 1.45}
      />
    </>
  );
}

function CardFallback({ batch }) {
  return (
    <div className="flex h-[280px] flex-col justify-between rounded-2xl border border-amber-500/25 bg-gradient-to-br from-espresso-850 to-espresso-950 p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-emerald-400">DIGITAL CARBON PASSPORT</span>
        <QrCode className="h-5 w-5 text-amber-400" />
      </div>
      <div>
        <div className="font-metric text-2xl font-bold text-amber-200">{batch.fg_id}</div>
        <div className="mt-1 text-sm text-stone-400">{batch.tujuan_distribusi}</div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs text-stone-400">Jejak per 200 g</div>
          <div className="font-metric text-2xl font-bold text-emerald-400">
            {fm(batch.karbon?.g_per_kemasan, 0)} g CO₂e
          </div>
        </div>
        <div className="font-mono text-xs text-stone-400">{batch.status_audit}</div>
      </div>
    </div>
  );
}

export default function PassportCard3D({ batch, flipped = false, resetSignal = 0 }) {
  const [webglReady] = useState(() => checkWebGLSupport());
  const [frontTex, setFrontTex] = useState(null);
  const [backTex, setBackTex] = useState(null);

  useEffect(() => {
    if (!batch || !webglReady) return undefined;
    let active = true;
    let createdFront = null;
    let createdBack = null;

    const qrCanvas = document.createElement("canvas");
    QRCode.toCanvas(qrCanvas, batch.qr_payload || `AGROTRACE|${batch.fg_id}`, {
      width: 256,
      margin: 1,
      color: { dark: "#0c0a09", light: "#ffffff" },
    })
      .then(() => {
        if (!active) return;
        createdFront = drawFrontCanvas(batch, qrCanvas);
        createdBack = drawBackCanvas(batch);
        setFrontTex((prev) => {
          if (prev) prev.dispose();
          return createdFront;
        });
        setBackTex((prev) => {
          if (prev) prev.dispose();
          return createdBack;
        });
      })
      .catch(() => {
        if (!active) return;
        createdFront = drawFrontCanvas(batch, null);
        createdBack = drawBackCanvas(batch);
        setFrontTex(createdFront);
        setBackTex(createdBack);
      });

    return () => {
      active = false;
      if (createdFront) createdFront.dispose();
      if (createdBack) createdBack.dispose();
    };
  }, [batch, webglReady]);

  if (!webglReady || !frontTex || !backTex) {
    return <CardFallback batch={batch} />;
  }

  return (
    <WebGLErrorBoundary fallback={<CardFallback batch={batch} />}>
      <div className="relative h-[290px] sm:h-[320px] w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-stone-900/60 via-espresso-900/40 to-emerald-950/20">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 4.3], fov: 36 }} gl={{ antialias: true, alpha: true }}>
          <CardMesh
            batch={batch}
            flipped={flipped}
            resetSignal={resetSignal}
            frontTex={frontTex}
            backTex={backTex}
          />
        </Canvas>
        <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex justify-between text-[11px] text-stone-400">
          <span className="rounded-full bg-stone-950/75 px-2.5 py-0.5 border border-stone-800">
            Seret untuk memutar kartu 3D
          </span>
          <span className="rounded-full bg-stone-950/75 px-2.5 py-0.5 border border-stone-800 text-amber-300">
            {flipped ? "Sisi Belakang: 6 Tahap" : "Sisi Depan: QR & Skor"}
          </span>
        </div>
      </div>
    </WebGLErrorBoundary>
  );
}
