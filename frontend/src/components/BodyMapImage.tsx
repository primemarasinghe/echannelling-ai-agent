import { useState, useRef, useEffect, useCallback } from 'react'
import type { BodyRegion, BodyFocus } from './BodyMap'
import { REGION_META } from './BodyMap'

interface Props {
  selected: BodyRegion[]
  onToggle: (r: BodyRegion) => void
  focus?: BodyFocus
}

type RegionPolygon = { region: BodyRegion; points: string }

const FRONT: RegionPolygon[] = [
  { region: 'head-right', points: '228,52 300,52 300,238 248,230 208,205 190,152 195,95' },
  { region: 'head-left',  points: '300,52 372,52 405,95 410,152 392,205 352,230 300,238' },
  { region: 'neck',             points: '268,226 332,226 336,278 264,278' },
  { region: 'right-shoulder',   points: '106,270 196,270 193,382 108,382' },
  { region: 'left-shoulder',    points: '404,270 494,270 492,382 407,382' },
  { region: 'chest-right',      points: '196,270 302,270 300,516 198,516' },
  { region: 'chest-left',       points: '298,270 404,270 402,516 298,516' },
  { region: 'abdomen',          points: '202,512 398,512 392,666 208,666' },
  { region: 'right-arm',        points: '108,378 194,378 191,762 106,762' },
  { region: 'left-arm',         points: '406,378 492,378 494,762 409,762' },
  { region: 'right-hand',       points: '98,758 192,760 190,898 96,900' },
  { region: 'left-hand',        points: '408,758 502,760 504,898 410,900' },
  { region: 'right-hip',        points: '202,663 300,663 298,754 204,754' },
  { region: 'left-hip',         points: '300,663 398,663 396,754 302,754' },
  { region: 'right-leg',        points: '184,752 300,752 298,1435 182,1438' },
  { region: 'left-leg',         points: '300,752 416,752 420,1435 302,1438' },
]

const BACK: RegionPolygon[] = [
  { region: 'head-right', points: '228,52 300,52 300,238 248,230 208,205 190,152 195,95' },
  { region: 'head-left',  points: '300,52 372,52 405,95 410,152 392,205 352,230 300,238' },
  { region: 'neck',              points: '268,226 332,226 336,278 264,278' },
  { region: 'right-shoulder',    points: '106,270 196,270 193,382 108,382' },
  { region: 'left-shoulder',     points: '404,270 494,270 492,382 407,382' },
  { region: 'upper-back-right',  points: '196,270 302,270 300,564 198,564' },
  { region: 'upper-back-left',   points: '298,270 404,270 402,564 300,564' },
  { region: 'lower-back',        points: '208,560 392,560 386,668 214,668' },
  { region: 'right-arm',         points: '108,378 194,378 191,762 106,762' },
  { region: 'left-arm',          points: '406,378 492,378 494,762 409,762' },
  { region: 'right-hand',        points: '98,758 192,760 190,898 96,900' },
  { region: 'left-hand',         points: '408,758 502,760 504,898 410,900' },
  { region: 'right-hip',         points: '202,663 300,663 298,754 204,754' },
  { region: 'left-hip',          points: '300,663 398,663 396,754 302,754' },
  { region: 'right-leg',         points: '184,752 300,752 298,1435 182,1438' },
  { region: 'left-leg',          points: '300,752 416,752 420,1435 302,1438' },
]

const DEBUG_COLORS: Partial<Record<BodyRegion, string>> = {
  'head-right': '#ff4444', 'head-left': '#ff6677', 'neck': '#ff8800',
  'right-shoulder': '#aa44ff', 'left-shoulder': '#ff44cc',
  'chest-right': '#ffcc00', 'chest-left': '#ffe066',
  'abdomen': '#88ff00',
  'upper-back-right': '#00ffcc', 'upper-back-left': '#00eebb',
  'lower-back': '#00aaff',
  'right-arm': '#6644ff', 'left-arm': '#cc44ff',
  'right-hand': '#ff8844', 'left-hand': '#ff66aa',
  'right-hip': '#44ccff', 'left-hip': '#44ffee',
  'right-leg': '#55ddff', 'left-leg': '#88ffcc',
}

function centroid(points: string): [number, number] {
  const pts = points.split(' ').map(p => p.split(',').map(Number))
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ]
}

const MIN_ZOOM = 0.5, MAX_ZOOM = 4, STEP = 0.5
const FRONT_OFFSET = -20   // px shift right to align front image body

export default function BodyMapImage({ selected, onToggle, focus }: Props) {
  const [view,      setView]      = useState<'front' | 'back'>('front')
  const [hovReg,    setHovReg]    = useState<BodyRegion | null>(null)
  const [debug,     setDebug]     = useState(false)
  const [cursor,    setCursor]    = useState<{ x: number; y: number } | null>(null)
  const [zoom,      setZoom]      = useState(1)
  const [offset,    setOffset]    = useState({ x: 0, y: 0 })
  const [focusAnim, setFocusAnim] = useState(false)

  const stageRef      = useRef<HTMLDivElement>(null)
  const imgRef        = useRef<HTMLImageElement>(null)
  const pendingFocus  = useRef<BodyFocus | null>(null)
  const dragging      = useRef(false)
  const isDragged     = useRef(false)
  const lastMouse     = useRef({ x: 0, y: 0 })
  const zoomRef       = useRef(zoom)
  zoomRef.current     = zoom

  const polygons = view === 'front' ? FRONT : BACK
  const imgSrc   = view === 'front' ? '/body/front.png' : '/body/back.png'
  const viewBox  = view === 'front' ? `${FRONT_OFFSET} 0 600 1500` : '0 0 600 1500'
  const meta     = hovReg ? REGION_META.find(m => m.id === hovReg) : null

  // ── Clamp pan so content stays within stage ─────────────
  const clampOffset = useCallback((x: number, y: number, z: number) => {
    const stage = stageRef.current
    if (!stage) return { x, y }
    const { width, height } = stage.getBoundingClientRect()
    return {
      x: Math.max(-(width  * (z - 1)) / 2, Math.min((width  * (z - 1)) / 2, x)),
      y: Math.max(-height * (z - 1),        Math.min(height / 2,              y)),
    }
  }, [])

  // ── Apply a focus target (zoom + pan to body area) ───────
  const applyFocus = useCallback((f: BodyFocus) => {
    const stage = stageRef.current
    const img   = imgRef.current
    if (!stage || !img) return

    const stageH = stage.clientHeight || 500
    const imgH   = img.clientHeight   || 500
    if (!stageH || !imgH) return

    const z  = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, f.zoom))
    const oy = stageH / 2 - (f.cy * imgH / 1500) * z

    setFocusAnim(true)
    setZoom(z)
    setOffset(prev => clampOffset(prev.x, oy, z))
    setTimeout(() => setFocusAnim(false), 750)
    pendingFocus.current = null
  }, [clampOffset])

  // ── When focus prop changes: queue it ────────────────────
  useEffect(() => {
    if (!focus) return
    pendingFocus.current = focus
    if (focus.view !== view) {
      setView(focus.view)   // image remount → onLoad will fire applyFocus
    }
    // If view already matches, onLoad won't re-fire — apply directly after tick
    else {
      requestAnimationFrame(() => applyFocus(focus))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.view, focus?.zoom, focus?.cy])

  // ── Reset scroll when entering/leaving 100% ──────────────
  useEffect(() => {
    if (zoom !== 1 && stageRef.current) stageRef.current.scrollTop = 0
  }, [zoom])

  // ── Non-passive wheel zoom ────────────────────────────────
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // At 100% let the browser scroll naturally
      if (zoomRef.current === 1) return
      e.preventDefault()
      const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current + (e.deltaY < 0 ? STEP : -STEP)))
      setZoom(nz)
      if (nz <= 1) setOffset({ x: 0, y: 0 })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  function switchView(v: 'front' | 'back') {
    setView(v); setZoom(1); setOffset({ x: 0, y: 0 })
  }
  function zoomIn()  { setZoom(z => Math.min(MAX_ZOOM, z + STEP)) }
  function zoomOut() {
    setZoom(z => {
      const nz = Math.max(MIN_ZOOM, z - STEP)
      if (nz <= 1) setOffset({ x: 0, y: 0 })
      return nz
    })
  }
  function resetZoom() { setZoom(1); setOffset({ x: 0, y: 0 }) }

  // ── Drag to pan ──────────────────────────────────────────
  function onStageDown(e: React.MouseEvent) {
    dragging.current = true; isDragged.current = false
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  function onStageMove(e: React.MouseEvent) {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) isDragged.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
    if (isDragged.current && zoom > 1)
      setOffset(o => clampOffset(o.x + dx, o.y + dy, zoomRef.current))
  }
  function onStageUp() { dragging.current = false }

  // ── SVG debug coord reader ───────────────────────────────
  function toSvgCoords(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget
    const pt  = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: Math.round(sp.x), y: Math.round(sp.y) }
  }

  const transitionStyle = dragging.current
    ? 'none'
    : focusAnim
    ? 'transform 0.72s cubic-bezier(0.25,0.46,0.45,0.94)'
    : 'transform 0.18s ease'

  return (
    <div className="bmi-wrap">

      {/* ── Toolbar ───────────────────────────────────────── */}
      <div className="bmi-toolbar">
        <div className="bmi-view-toggle">
          <button className={view === 'front' ? 'active' : ''} onClick={() => switchView('front')}>
            <span className="bmi-view-icon">◉</span> Front
          </button>
          <button className={view === 'back'  ? 'active' : ''} onClick={() => switchView('back')}>
            <span className="bmi-view-icon">◎</span> Back
          </button>
        </div>

        <div className="bmi-zoom">
          <button className="bmi-zoom-btn" onClick={zoomOut} disabled={zoom <= MIN_ZOOM}>−</button>
          <span className="bmi-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="bmi-zoom-btn" onClick={zoomIn}  disabled={zoom >= MAX_ZOOM}>+</button>
          {zoom > 1 && <button className="bmi-zoom-reset" onClick={resetZoom}>↺</button>}
        </div>

        <button className={`bmi-dbg-btn${debug ? ' active' : ''}`} onClick={() => setDebug(d => !d)}>
          {debug ? '✕ Hide' : '⊙ Regions'}
        </button>
      </div>

      {/* ── Label bar ────────────────────────────────────── */}
      <div className="bmi-label-bar">
        {debug && cursor
          ? <span className="bmi-coord">x: {cursor.x} · y: {cursor.y}</span>
          : meta
          ? <span className="bmi-region-name"><span className="bmi-dot" />{meta.label}<span className="bmi-si"> · {meta.si}</span></span>
          : <span className="bmi-placeholder">Hover over a body region</span>}
      </div>

      {/* ── Stage ────────────────────────────────────────── */}
      <div
        className="bmi-stage"
        ref={stageRef}
        style={{
          cursor: zoom > 1 ? 'grab' : 'default',
          overflowY: zoom === 1 ? 'auto' : 'hidden',
          overflowX: 'hidden',
        }}
        onMouseDown={onStageDown}
        onMouseMove={onStageMove}
        onMouseUp={onStageUp}
        onMouseLeave={onStageUp}
      >
        <div
          key={view}
          className="bmi-inner"
          style={{
            transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            transformOrigin: 'top center',
            transition: transitionStyle,
          }}
        >
          <img
            ref={imgRef}
            src={imgSrc}
            alt={view}
            className="bmi-img"
            draggable={false}
            onLoad={() => {
              // After image loads, apply any pending focus (e.g. after view switch)
              if (pendingFocus.current) applyFocus(pendingFocus.current)
            }}
          />

          <svg
            className="bmi-svg"
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
            onMouseMove={debug ? e => setCursor(toSvgCoords(e)) : undefined}
            onMouseLeave={debug ? () => setCursor(null) : undefined}
          >
            {polygons.map(({ region, points }) => {
              const isSel = selected.includes(region)
              const isHov = hovReg === region
              const dbgColor = DEBUG_COLORS[region] ?? '#ffffff'
              const [cx, cy] = centroid(points)
              return (
                <g key={`${view}-${region}`}>
                  <polygon
                    points={points}
                    fill={
                      debug  ? `${dbgColor}44` :
                      isSel  ? 'rgba(200,32,47,0.18)' :
                      isHov  ? 'rgba(200,32,47,0.07)' : 'rgba(0,0,0,0.001)'
                    }
                    stroke={
                      debug          ? dbgColor :
                      isSel          ? 'rgba(200,32,47,0.65)' :
                      isHov          ? 'rgba(200,32,47,0.35)' : 'none'
                    }
                    strokeWidth={debug ? 1.5 : isSel ? 2 : 1.5}
                    pointerEvents="all"
                    style={{ cursor: 'pointer' }}
                    onClick={() => !debug && !isDragged.current && onToggle(region)}
                    onMouseEnter={() => setHovReg(region)}
                    onMouseLeave={() => setHovReg(null)}
                  />
                  {debug && (
                    <text
                      x={cx} y={cy} fill="white" fontSize="14" fontWeight="700"
                      textAnchor="middle" dominantBaseline="middle"
                      stroke="black" strokeWidth="3" paintOrder="stroke"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {region}
                    </text>
                  )}
                </g>
              )
            })}

            {debug && cursor && (
              <>
                <line x1={cursor.x} y1={0} x2={cursor.x} y2={1500}
                  stroke="rgba(255,200,0,0.5)" strokeWidth="1" pointerEvents="none" />
                <line x1={0} y1={cursor.y} x2={600} y2={cursor.y}
                  stroke="rgba(255,200,0,0.5)" strokeWidth="1" pointerEvents="none" />
              </>
            )}
          </svg>
        </div>
      </div>

      <div className="bmi-foot">
        {debug ? '⚡ Calibration — hover to read SVG coordinates'
          : zoom > 1 ? 'Drag to pan · scroll to zoom'
          : 'Click a region to select · scroll to zoom'}
      </div>
    </div>
  )
}
