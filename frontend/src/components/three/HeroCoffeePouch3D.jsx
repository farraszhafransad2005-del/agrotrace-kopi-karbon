import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Coffee, Leaf, Sparkles } from "lucide-react";
import WebGLErrorBoundary, { checkWebGLSupport } from "./WebGLErrorBoundary";
import { fm } from "../../utils/format";

function createLabelTexture(avgPerPack, totalBatches) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  // Base gradient label
  const bg = ctx.createLinearGradient(0, 0, 768, 1024);
  bg.addColorStop(0, "#1c130e");
  bg.addColorStop(0.55, "#261912");
  bg.addColorStop(1, "#121a16");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 768, 1024);

  // Outer amber & emerald border frame
  ctx.strokeStyle = "rgba(245, 158, 11, 0.72)";
  ctx.lineWidth = 6;
  ctx.strokeRect(28, 28, 712, 968);

  ctx.strokeStyle = "rgba(16, 185, 129, 0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 42, 684, 940);

  // Top badge
  ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
  ctx.fillRect(72, 74, 624, 52);
  ctx.fillStyle = "#34d399";
  ctx.font = "700 22px 'JetBrains Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("AGROTRACE · DIGITAL CARBON PASSPORT", 384, 108);

  // Main Coffee Title
  ctx.fillStyle = "#fef3c7";
  ctx.font = "800 68px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("GAYO NATURAL", 384, 240);

  ctx.fillStyle = "#f59e0b";
  ctx.font = "700 32px 'Plus Jakarta Sans', sans-serif";
  ctx.fillText("KOPI ARABIKA SINGLE ORIGIN", 384, 294);

  // Divider accent
  const lineGrad = ctx.createLinearGradient(120, 340, 648, 340);
  lineGrad.addColorStop(0, "transparent");
  lineGrad.addColorStop(0.5, "#f59e0b");
  lineGrad.addColorStop(1, "transparent");
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(120, 340);
  ctx.lineTo(648, 340);
  ctx.stroke();

  // Stylized coffee bean emblem
  ctx.save();
  ctx.translate(384, 462);
  ctx.rotate(-0.28);
  ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 82, 56, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-64, 0);
  ctx.bezierCurveTo(-20, -24, 20, 24, 64, 0);
  ctx.stroke();
  ctx.restore();

  // Roast specs
  ctx.fillStyle = "#d6d3d1";
  ctx.font = "600 28px 'Inter', sans-serif";
  ctx.fillText("MEDIUM ROAST  ·  WHOLE BEAN / 200 g", 384, 586);
  ctx.fillStyle = "#a8a29e";
  ctx.font = "500 22px 'Inter', sans-serif";
  ctx.fillText("Aceh Tengah & Bener Meriah · 1.200–1.650 mdpl", 384, 626);

  // Carbon Passport Metric Box
  ctx.fillStyle = "rgba(12, 10, 9, 0.72)";
  ctx.fillRect(88, 682, 592, 184);
  ctx.strokeStyle = "rgba(16, 185, 129, 0.55)";
  ctx.lineWidth = 3;
  ctx.strokeRect(88, 682, 592, 184);

  ctx.fillStyle = "#a7f3d0";
  ctx.font = "600 20px 'JetBrains Mono', monospace";
  ctx.fillText("ESTIMASI RATA-RATA JEJAK KARBON", 384, 728);

  ctx.fillStyle = "#10b981";
  ctx.font = "800 54px 'JetBrains Mono', monospace";
  const valText = avgPerPack ? `${fm(avgPerPack, 0)} g CO₂e` : "428 g CO₂e";
  ctx.fillText(valText, 384, 796);

  ctx.fillStyle = "#a8a29e";
  ctx.font = "500 20px 'Inter', sans-serif";
  ctx.fillText(`per kemasan 200 g · ${totalBatches || 229} batch terlacak`, 384, 840);

  // Footer
  ctx.fillStyle = "#78716c";
  ctx.font = "500 18px 'JetBrains Mono', monospace";
  ctx.fillText("CRADLE-TO-CUSTOMER · KELOMPOK 8 ASDA 2026", 384, 932);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createPouchGeometry() {
  const shape = new THREE.Shape();
  // Stand-up coffee pouch silhouette
  shape.moveTo(-0.92, -1.26);
  shape.lineTo(0.92, -1.26);
  shape.quadraticCurveTo(1.06, -1.22, 1.03, -0.82);
  shape.lineTo(0.96, 1.06);
  shape.quadraticCurveTo(0.94, 1.24, 0.78, 1.26);
  shape.lineTo(-0.78, 1.26);
  shape.quadraticCurveTo(-0.94, 1.24, -0.96, 1.06);
  shape.lineTo(-1.03, -0.82);
  shape.quadraticCurveTo(-1.06, -1.22, -0.92, -1.26);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.42,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.1,
  });
  geo.center();
  return geo;
}

function PouchScene({ avgPerPackage, totalBatches }) {
  const groupRef = useRef(null);
  const particlesRef = useRef(null);

  const pouchGeo = useMemo(() => createPouchGeometry(), []);
  const sealGeo = useMemo(() => new THREE.BoxGeometry(1.94, 0.16, 0.14), []);
  const valveOuterGeo = useMemo(() => new THREE.CylinderGeometry(0.11, 0.11, 0.04, 24), []);
  const valveInnerGeo = useMemo(() => new THREE.CylinderGeometry(0.055, 0.055, 0.05, 16), []);
  const labelGeo = useMemo(() => new THREE.PlaneGeometry(1.66, 2.18), []);

  const labelTex = useMemo(
    () => createLabelTexture(avgPerPackage, totalBatches),
    [avgPerPackage, totalBatches]
  );

  const particlesGeo = useMemo(() => {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 1.9 + ((i * 37) % 100) / 70;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (((i * 53) % 100) / 100 - 0.5) * 3.1;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      pouchGeo.dispose();
      sealGeo.dispose();
      valveOuterGeo.dispose();
      valveInnerGeo.dispose();
      labelGeo.dispose();
      particlesGeo.dispose();
    };
  }, [pouchGeo, sealGeo, valveOuterGeo, valveInnerGeo, labelGeo, particlesGeo]);

  useEffect(() => {
    return () => {
      labelTex.dispose();
    };
  }, [labelTex]);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      const targetX = THREE.MathUtils.clamp(-state.pointer.y * 0.18, -0.22, 0.22);
      const targetY = THREE.MathUtils.clamp(state.pointer.x * 0.24, -0.32, 0.32);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, delta * 3.2);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, -targetY * 0.25, delta * 3.2);
      groupRef.current.position.y = Math.sin(t * 1.4) * 0.06;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 0.14;
    }
  });

  return (
    <>
      <ambientLight intensity={0.75} color="#fff7ed" />
      <directionalLight position={[4, 5, 5]} intensity={1.9} color="#fde68a" />
      <directionalLight position={[-4, 2, -4]} intensity={1.25} color="#34d399" />
      <pointLight position={[0, -3, 3]} intensity={0.8} color="#f59e0b" />

      <group ref={groupRef}>
        {/* Main Matte Espresso Coffee Pouch */}
        <mesh geometry={pouchGeo}>
          <meshPhysicalMaterial
            color="#1c120d"
            roughness={0.58}
            metalness={0.14}
            clearcoat={0.22}
            clearcoatRoughness={0.45}
          />
        </mesh>

        {/* Top Heat-Seal Foil Strip */}
        <mesh geometry={sealGeo} position={[0, 1.24, 0]}>
          <meshStandardMaterial color="#362419" roughness={0.35} metalness={0.55} />
        </mesh>

        {/* Degassing Valve (front upper right) */}
        <mesh geometry={valveOuterGeo} position={[0.48, 0.88, 0.31]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#b4834b" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh geometry={valveInnerGeo} position={[0.48, 0.88, 0.315]} rotation={[Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color="#0c0a09" roughness={0.6} />
        </mesh>

        {/* Dynamic Front Label */}
        <mesh geometry={labelGeo} position={[0, -0.04, 0.316]}>
          <meshPhysicalMaterial
            map={labelTex}
            roughness={0.38}
            metalness={0.15}
            clearcoat={0.45}
            clearcoatRoughness={0.3}
          />
        </mesh>

        {/* Back Accent Plate */}
        <mesh geometry={labelGeo} position={[0, -0.04, -0.316]} rotation={[0, Math.PI, 0]}>
          <meshStandardMaterial color="#18110d" roughness={0.6} metalness={0.15} />
        </mesh>
      </group>

      {/* Ambient Roastery & Carbon Particles */}
      <points ref={particlesRef} geometry={particlesGeo}>
        <pointsMaterial size={0.045} color="#fbbf24" transparent opacity={0.55} sizeAttenuation />
      </points>

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.9}
        minPolarAngle={Math.PI / 3.1}
        maxPolarAngle={Math.PI / 1.7}
      />
    </>
  );
}

function HeroFallback({ avgPerPackage, totalBatches }) {
  return (
    <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-2xl border border-amber-500/25 bg-gradient-to-br from-espresso-850 to-espresso-950 p-6 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/35">
        <Coffee className="h-7 w-7 text-amber-400" />
      </div>
      <p className="text-xs font-mono uppercase tracking-widest text-emerald-400">
        Gayo Arabika Natural · 200 g
      </p>
      <h3 className="mt-1 text-xl font-bold text-stone-100">Carbon Passport 200g</h3>
      <p className="mt-2 font-metric text-2xl font-bold text-emerald-400">
        {avgPerPackage ? `${fm(avgPerPackage, 0)} g CO₂e` : "-"}
      </p>
      <p className="mt-1 text-xs text-stone-400">{totalBatches || 229} batch terlacak</p>
    </div>
  );
}

export default function HeroCoffeePouch3D({ avgPerPackage, totalBatches }) {
  const [webglReady] = useState(() => checkWebGLSupport());

  if (!webglReady) {
    return <HeroFallback avgPerPackage={avgPerPackage} totalBatches={totalBatches} />;
  }

  return (
    <WebGLErrorBoundary fallback={<HeroFallback avgPerPackage={avgPerPackage} totalBatches={totalBatches} />}>
      <div className="relative h-[320px] sm:h-[360px] w-full overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-stone-900/50 via-espresso-900/40 to-espresso-950/70">
        <Canvas dpr={[1, 2]} camera={{ position: [0, 0.15, 4.3], fov: 38 }} gl={{ antialias: true, alpha: true }}>
          <PouchScene avgPerPackage={avgPerPackage} totalBatches={totalBatches} />
        </Canvas>
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-stone-400">
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-950/80 px-2.5 py-1 border border-stone-800">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Seret untuk memutar kemasan 3D
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-stone-950/80 px-2.5 py-1 border border-stone-800 text-emerald-300">
            <Leaf className="h-3 w-3" />
            Prosedural WebGL
          </span>
        </div>
      </div>
    </WebGLErrorBoundary>
  );
}
