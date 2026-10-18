import { Canvas, ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState } from 'react'
import * as THREE from 'three'
import type { BodyRegion } from './BodyMap'
import { REGION_META } from './BodyMap'

interface Props {
  selected: BodyRegion[]
  onToggle: (r: BodyRegion) => void
}

/* ── Colors ───────────────────────────────────────────────── */
const C_BASE = '#7B0D1E'
const C_HOV  = '#A0182A'
const C_SEL  = '#C8202F'
const C_EM   = '#3A0008'

/* ── Shared material props ────────────────────────────────── */
function mat(color: string, sel: boolean) {
  return {
    color,
    emissive:          sel ? C_EM : '#000000',
    emissiveIntensity: sel ? 0.5  : 0,
    roughness:         0.20,
    metalness:         0.00,
    clearcoat:         1.00,
    clearcoatRoughness:0.10,
  } as const
}

/* ── Simple clickable part ────────────────────────────────── */
function Part({
  region, selected, position, rotation, scale, onToggle, onHover, children,
}: {
  region:   BodyRegion
  selected: boolean
  position: [number,number,number]
  rotation?: [number,number,number]
  scale?:   [number,number,number]
  onToggle: (r: BodyRegion) => void
  onHover:  (r: BodyRegion | null) => void
  children: React.ReactNode
}) {
  const [hov, setHov] = useState(false)
  const color = selected ? C_SEL : hov ? C_HOV : C_BASE

  return (
    <mesh
      position={position}
      rotation={rotation as [number,number,number] | undefined}
      scale={scale}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onToggle(region) }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation(); setHov(true); onHover(region)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => { setHov(false); onHover(null); document.body.style.cursor = 'default' }}
    >
      {children}
      <meshPhysicalMaterial {...mat(color, selected)} />
    </mesh>
  )
}

/* ── Torso — detects front vs back via face normal ─────────── */
function Torso({
  front, back, selected, position, scale, onToggle, onHover, children,
}: {
  front:    BodyRegion
  back:     BodyRegion
  selected: BodyRegion[]
  position: [number,number,number]
  scale?:   [number,number,number]
  onToggle: (r: BodyRegion) => void
  onHover:  (r: BodyRegion | null) => void
  children: React.ReactNode
}) {
  const [hov, setHov] = useState<BodyRegion | null>(null)

  function pickRegion(e: ThreeEvent<MouseEvent | PointerEvent>): BodyRegion {
    if (!e.face) return front
    const nm  = new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld)
    const wn  = e.face.normal.clone().applyMatrix3(nm).normalize()
    return wn.z >= 0 ? front : back
  }

  const anyFrontSel = selected.includes(front)
  const anyBackSel  = selected.includes(back)
  const isSel = anyFrontSel || anyBackSel
  const color = isSel ? C_SEL : hov ? C_HOV : C_BASE

  return (
    <mesh
      position={position}
      scale={scale}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onToggle(pickRegion(e)) }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        const r = pickRegion(e); setHov(r); onHover(r)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => { setHov(null); onHover(null); document.body.style.cursor = 'default' }}
    >
      {children}
      <meshPhysicalMaterial {...mat(color, isSel)} />
    </mesh>
  )
}

/* ── Main component ───────────────────────────────────────── */
export default function Body3D({ selected, onToggle }: Props) {
  const [hovReg, setHovReg] = useState<BodyRegion | null>(null)

  const sel = (r: BodyRegion) => selected.includes(r)
  const meta = hovReg ? REGION_META.find(m => m.id === hovReg) : null

  return (
    <div className="b3d-root">
      {/* Tooltip */}
      <div className="b3d-tip" style={{ opacity: meta ? 1 : 0 }}>
        {meta ? `${meta.label}  ·  ${meta.si}` : '—'}
      </div>

      <Canvas
        camera={{ position: [0, 0.15, 3.2], fov: 36 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* ── Lights ── */}
        <ambientLight intensity={0.30} />
        <directionalLight position={[-2.5, 4, 4.5]} intensity={1.5} />
        <pointLight      position={[3, 2.5, 2]}     intensity={0.55} />
        <pointLight      position={[-1, -1.5, 3]}    intensity={0.18} />

        {/* ── Controls ── */}
        <OrbitControls
          enablePan={false}
          minDistance={2.0}
          maxDistance={7.0}
          target={[0, 0.15, 0]}
          enableDamping
          dampingFactor={0.08}
        />

        {/* ════════════ HEAD ════════════ */}
        <Part region="head" selected={sel('head')} position={[0, 0.82, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <sphereGeometry args={[0.145, 32, 32]} />
        </Part>

        {/* ════════════ NECK ════════════ */}
        <Part region="neck" selected={sel('neck')} position={[0, 0.63, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.055, 0.09, 6, 16]} />
        </Part>

        {/* ════════════ TORSO — upper (chest / upper-back) ════════════ */}
        <Torso front="chest" back="upper-back" selected={selected}
          position={[0, 0.38, 0]} scale={[1.52, 1, 0.72]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.168, 0.24, 6, 20]} />
        </Torso>

        {/* ════════════ TORSO — mid (abdomen / lower-back) ════════════ */}
        <Torso front="abdomen" back="lower-back" selected={selected}
          position={[0, 0.11, 0]} scale={[1.32, 1, 0.68]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.145, 0.20, 6, 20]} />
        </Torso>

        {/* ════════════ TORSO — pelvis (abdomen / lower-back) ════════ */}
        <Torso front="abdomen" back="lower-back" selected={selected}
          position={[0, -0.09, 0]} scale={[1.22, 1, 0.62]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.125, 0.10, 6, 16]} />
        </Torso>

        {/* ════════════ LEFT SHOULDER ════════════ */}
        <Part region="left-arm" selected={sel('left-arm')} position={[-0.28, 0.52, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <sphereGeometry args={[0.092, 20, 20]} />
        </Part>

        {/* ════════════ RIGHT SHOULDER ════════════ */}
        <Part region="right-arm" selected={sel('right-arm')} position={[0.28, 0.52, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <sphereGeometry args={[0.092, 20, 20]} />
        </Part>

        {/* ════════════ LEFT UPPER ARM ════════════ */}
        <Part region="left-arm" selected={sel('left-arm')}
          position={[-0.32, 0.31, 0]} rotation={[0, 0, 0.32]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.068, 0.24, 6, 14]} />
        </Part>

        {/* ════════════ RIGHT UPPER ARM ════════════ */}
        <Part region="right-arm" selected={sel('right-arm')}
          position={[0.32, 0.31, 0]} rotation={[0, 0, -0.32]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.068, 0.24, 6, 14]} />
        </Part>

        {/* ════════════ LEFT FOREARM ════════════ */}
        <Part region="left-arm" selected={sel('left-arm')}
          position={[-0.39, 0.02, 0.01]} rotation={[0, 0, 0.10]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.053, 0.22, 6, 14]} />
        </Part>

        {/* ════════════ RIGHT FOREARM ════════════ */}
        <Part region="right-arm" selected={sel('right-arm')}
          position={[0.39, 0.02, 0.01]} rotation={[0, 0, -0.10]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.053, 0.22, 6, 14]} />
        </Part>

        {/* ════════════ LEFT HAND ════════════ */}
        <Part region="left-hand" selected={sel('left-hand')}
          position={[-0.43, -0.18, 0.01]}
          onToggle={onToggle} onHover={setHovReg}>
          <sphereGeometry args={[0.058, 16, 16]} />
        </Part>

        {/* ════════════ RIGHT HAND ════════════ */}
        <Part region="right-hand" selected={sel('right-hand')}
          position={[0.43, -0.18, 0.01]}
          onToggle={onToggle} onHover={setHovReg}>
          <sphereGeometry args={[0.058, 16, 16]} />
        </Part>

        {/* ════════════ LEFT THIGH ════════════ */}
        <Part region="left-leg" selected={sel('left-leg')}
          position={[-0.11, -0.37, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.090, 0.28, 6, 16]} />
        </Part>

        {/* ════════════ RIGHT THIGH ════════════ */}
        <Part region="right-leg" selected={sel('right-leg')}
          position={[0.11, -0.37, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.090, 0.28, 6, 16]} />
        </Part>

        {/* ════════════ LEFT CALF ════════════ */}
        <Part region="left-leg" selected={sel('left-leg')}
          position={[-0.10, -0.70, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.068, 0.27, 6, 14]} />
        </Part>

        {/* ════════════ RIGHT CALF ════════════ */}
        <Part region="right-leg" selected={sel('right-leg')}
          position={[0.10, -0.70, 0]}
          onToggle={onToggle} onHover={setHovReg}>
          <capsuleGeometry args={[0.068, 0.27, 6, 14]} />
        </Part>

        {/* ════════════ LEFT FOOT ════════════ */}
        <Part region="left-leg" selected={sel('left-leg')}
          position={[-0.10, -0.87, 0.07]}
          onToggle={onToggle} onHover={setHovReg}>
          <boxGeometry args={[0.10, 0.05, 0.22]} />
        </Part>

        {/* ════════════ RIGHT FOOT ════════════ */}
        <Part region="right-leg" selected={sel('right-leg')}
          position={[0.10, -0.87, 0.07]}
          onToggle={onToggle} onHover={setHovReg}>
          <boxGeometry args={[0.10, 0.05, 0.22]} />
        </Part>
      </Canvas>

      <div className="b3d-hint">Drag to rotate · Click to select</div>
    </div>
  )
}
