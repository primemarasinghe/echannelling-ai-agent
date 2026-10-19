import { useState, useRef, useEffect, useCallback } from 'react'
import type { BodyRegion, BodyFocus } from './BodyMap'
import { REGION_META } from './BodyMap'

interface Props {
  selected: BodyRegion[]
  onToggle: (r: BodyRegion) => void
  focus?: BodyFocus
  onHover?: (r: BodyRegion | null) => void
}

type RegionPolygon = { region: BodyRegion; points: string }

const FRONT: RegionPolygon[] = [
  { region: 'head-right',     points: '296,52 296,17 265,23 240,45 232,74 238,98 271,81 290,82 297,56' },
  { region: 'head-left',      points: '294,52 294,17 325,23 350,45 358,74 352,98 319,81 300,82 293,56' },
  { region: 'right-eye',      points: '304,89 321,78 336,85 338,107 321,118 301,92' },
  { region: 'left-eye',       points: '286,89 269,78 254,85 252,107 269,118 289,92' },
  { region: 'right-ear',      points: '340,112 353,91 366,95 361,127 345,136 341,113' },
  { region: 'left-ear',       points: '250,112 237,91 224,95 229,127 245,136 249,113' },
  { region: 'nose',           points: '281,127 289,98 309,128 283,128' },
  { region: 'mouth',          points: '266,161 275,134 295,127 314,135 323,159 292,174 263,164' },
  { region: 'neck',           points: '251,151 274,172 295,172 318,169 339,144 339,197 341,245 307,263 276,260 248,248 252,192 250,152' },
  { region: 'right-shoulder', points: '385,253 433,247 477,282 487,332 476,377 386,260' },
  { region: 'left-shoulder',  points: '205,253 157,247 113,282 103,332 114,377 204,260' },
  { region: 'chest-right',    points: '299,338 317,263 378,251 428,310 427,336 397,384 319,386 297,342' },
  { region: 'chest-left',     points: '291,338 273,263 212,251 162,310 163,336 193,384 271,386 293,342' },
  { region: 'abdomen',        points: '303,393 362,400 408,375 403,462 394,503 405,556 398,584 360,626 229,630 183,574 187,534 192,503 185,458 176,371 218,396 276,390 305,392' },
  { region: 'right-arm',      points: '434,337 474,381 491,429 493,469 523,531 533,668 540,691 498,702 481,640 454,594 436,513 432,457 425,398 432,343' },
  { region: 'left-arm',       points: '156,337 116,381 99,429 97,469 67,531 57,668 50,691 92,702 109,640 136,594 154,513 158,457 165,398 158,343' },
  { region: 'left-hand',      points: '64,696 -9,764 34,844 86,759' },
  { region: 'right-hand',     points: '517,692 572,756 536,842 490,739' },
  { region: 'right-hip',      points: '309,679 355,576 404,569 424,633 424,680 308,678' },
  { region: 'left-hip',       points: '281,679 235,576 186,569 166,633 166,680 282,678' },
  { region: 'bladder',        points: '260,631 331,628 296,726' },
  { region: 'right-leg',      points: '303,720 422,668 439,808 408,929 399,1009 415,1111 393,1212 375,1288 379,1326 387,1376 406,1409 377,1424 337,1424 321,1383 322,1335 319,1316 331,1289 335,1219 328,1167 316,1133 318,1093 330,1056 332,1042 314,981 315,936 315,891 304,820 301,767 304,718' },
  { region: 'left-leg',       points: '287,720 168,668 151,808 182,929 191,1009 175,1111 197,1212 215,1288 211,1326 203,1376 184,1409 213,1424 253,1424 269,1383 268,1335 271,1316 259,1289 255,1219 262,1167 274,1133 272,1093 260,1056 258,1042 276,981 275,936 275,891 286,820 289,767 286,718' },
  { region: 'right-knee',     points: '316,967 404,962 405,1025 333,1038 315,970' },
  { region: 'left-knee',      points: '274,967 186,962 185,1025 257,1038 275,970' },
  { region: 'right-toes',     points: '408,1417 336,1430 321,1407 394,1393 411,1417' },
  { region: 'left-toes',      points: '182,1417 254,1430 269,1407 196,1393 179,1417' },
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
  { region: 'left-hand',         points: '98,758 192,760 190,898 96,900' },
  { region: 'right-hand',        points: '408,758 502,760 504,898 410,900' },
  { region: 'right-hip',         points: '202,663 300,663 298,754 204,754' },
  { region: 'left-hip',          points: '300,663 398,663 396,754 302,754' },
  { region: 'right-leg',         points: '184,752 300,752 298,1435 182,1438' },
  { region: 'left-leg',          points: '300,752 416,752 420,1435 302,1438' },
]

const DEBUG_COLORS: Partial<Record<BodyRegion, string>> = {
  'head-right': '#ff4444', 'head-left': '#ff6677',
  'right-eye': '#00e5ff', 'left-eye': '#00cfff',
  'nose': '#ff9dce', 'mouth': '#ff6eb4',
  'right-ear': '#c8ff80', 'left-ear': '#b0ff60',
  'neck': '#ff8800',
  'right-shoulder': '#aa44ff', 'left-shoulder': '#ff44cc',
  'chest-right': '#ffcc00', 'chest-left': '#ffe066',
  'abdomen': '#88ff00',
  'upper-back-right': '#00ffcc', 'upper-back-left': '#00eebb',
  'lower-back': '#00aaff',
  'right-arm': '#6644ff', 'left-arm': '#cc44ff',
  'right-hand': '#ff8844', 'left-hand': '#ff66aa',
  'right-hip': '#44ccff', 'left-hip': '#44ffee',
  'bladder': '#c084fc',
  'right-leg': '#55ddff', 'left-leg': '#88ffcc',
  'right-knee': '#fb923c', 'left-knee': '#fba474',
  'right-toes': '#f472b6', 'left-toes': '#f9a8d4',
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

export default function BodyMapImage({ selected, onToggle, focus, onHover }: Props) {
  const [view,      setView]      = useState<'front' | 'back'>('front')
  const [hovReg,    setHovReg]    = useState<BodyRegion | null>(null)
  const [flashRegs, setFlashRegs] = useState<Set<BodyRegion>>(new Set())
  const [debug,     setDebug]     = useState(false)
  const [cursor,    setCursor]    = useState<{ x: number; y: number } | null>(null)
  const [zoom,      setZoom]      = useState(1)
  const [offset,    setOffset]    = useState({ x: 0, y: 0 })
  const [focusAnim, setFocusAnim] = useState(false)

  // ── Draw tool state ──────────────────────────────────────
  const [drawMode,   setDrawMode]   = useState(false)
  const [drawPts,    setDrawPts]    = useState<{x:number;y:number}[]>([])
  const [drawDone,   setDrawDone]   = useState(false)
  const [drawName,   setDrawName]   = useState<string>('')
  const [drawMirror, setDrawMirror] = useState(false)
  const [copied,     setCopied]     = useState<'main'|'mirror'|null>(null)

  const CENTERLINE = 295
  const ptsStr = (pts:{x:number;y:number}[]) => pts.map(p=>`${p.x},${p.y}`).join(' ')
  const mirrorPt = (p:{x:number;y:number}) => ({ x: CENTERLINE*2 - p.x, y: p.y })
  const mirrorName = (n:string) => n.includes('right') ? n.replace('right','left') : n.includes('left') ? n.replace('left','right') : n+'-mirror'

  function resetDraw() {
    setDrawPts([]); setDrawDone(false)
    setDrawName(''); setDrawMirror(false); setCopied(null)
  }
  function toggleDrawMode() {
    setDrawMode(d => { if (d) resetDraw(); return !d })
  }
  function finishDraw() { if (drawPts.length >= 3) setDrawDone(true) }
  function copyToClipboard(pts:{x:number;y:number}[], which:'main'|'mirror') {
    navigator.clipboard.writeText(ptsStr(pts))
    setCopied(which); setTimeout(()=>setCopied(null), 1800)
  }

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

        <button className={`bmi-dbg-btn${drawMode ? ' active' : ''}`} onClick={toggleDrawMode}
          style={drawMode ? {background:'#fef3c7',borderColor:'#f59e0b',color:'#b45309'} : {}}>
          {drawMode ? '✕ Stop Drawing' : '✏ Draw Region'}
        </button>
      </div>

      {/* ── Label bar — debug coords only ───────────────── */}
      {debug && (
        <div className="bmi-label-bar">
          {cursor
            ? <span className="bmi-coord">x: {cursor.x} · y: {cursor.y}</span>
            : <span className="bmi-placeholder">Hover to read SVG coords</span>}
        </div>
      )}

      {/* ── Draw panel ───────────────────────────────────── */}
      {drawMode && (
        <div className="bmi-draw-panel">
          {!drawDone ? (
            <div className="bmi-draw-collecting">
              <span className="bmi-draw-hint">
                {drawPts.length === 0 ? '👆 Click on the body to place points'
                  : drawPts.length < 3 ? `${drawPts.length} point${drawPts.length>1?'s':''} — need at least 3`
                  : `${drawPts.length} points placed`}
              </span>
              <div className="bmi-draw-btns">
                {drawPts.length > 0 && (
                  <button className="bmi-draw-btn" onClick={()=>setDrawPts(p=>p.slice(0,-1))}>↩ Undo</button>
                )}
                {drawPts.length >= 3 && (
                  <button className="bmi-draw-btn done" onClick={finishDraw}>✓ Done</button>
                )}
                {drawPts.length > 0 && (
                  <button className="bmi-draw-btn danger" onClick={resetDraw}>✕ Clear</button>
                )}
              </div>
            </div>
          ) : (
            <div className="bmi-draw-result">
              {/* Region name selector */}
              <select className="bmi-draw-select" value={drawName}
                onChange={e=>setDrawName(e.target.value)}>
                <option value="">— Name this region —</option>
                {REGION_META.map(r=><option key={r.id} value={r.id}>{r.label} ({r.id})</option>)}
              </select>

              {/* Main coords */}
              <div className="bmi-draw-output">
                <div className="bmi-draw-out-label">
                  <span className="bmi-draw-out-name">{drawName||'region'}</span>
                  <span className="bmi-draw-out-view">{view}</span>
                  <span className="bmi-draw-out-pts">{drawPts.length} pts</span>
                </div>
                <code className="bmi-draw-code">{ptsStr(drawPts)}</code>
                <button className={`bmi-draw-copy${copied==='main'?' copied':''}`}
                  onClick={()=>copyToClipboard(drawPts,'main')}>
                  {copied==='main' ? '✓ Copied!' : 'Copy'}
                </button>
              </div>

              {/* Mirror toggle */}
              <label className="bmi-draw-mirror-toggle">
                <input type="checkbox" checked={drawMirror} onChange={e=>setDrawMirror(e.target.checked)}/>
                Mirror across x={CENTERLINE}
              </label>

              {/* Mirrored coords */}
              {drawMirror && (
                <div className="bmi-draw-output mirror">
                  <div className="bmi-draw-out-label">
                    <span className="bmi-draw-out-name">{drawName ? mirrorName(drawName) : 'mirrored'}</span>
                    <span className="bmi-draw-out-view">{view}</span>
                    <span className="bmi-draw-out-pts">{drawPts.length} pts</span>
                  </div>
                  <code className="bmi-draw-code">{ptsStr(drawPts.map(mirrorPt))}</code>
                  <button className={`bmi-draw-copy${copied==='mirror'?' copied':''}`}
                    onClick={()=>copyToClipboard(drawPts.map(mirrorPt),'mirror')}>
                    {copied==='mirror' ? '✓ Copied!' : 'Copy Mirror'}
                  </button>
                </div>
              )}

              <button className="bmi-draw-btn" onClick={resetDraw}>↩ Draw another</button>
            </div>
          )}
        </div>
      )}

      {/* ── Stage ────────────────────────────────────────── */}
      <div
        className="bmi-stage"
        ref={stageRef}
        style={{
          cursor: drawMode ? 'crosshair' : zoom > 1 ? 'grab' : 'default',
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
            onMouseMove={e => { if (debug || drawMode) setCursor(toSvgCoords(e)) }}
            onMouseLeave={() => { if (debug || drawMode) setCursor(null) }}
            onClick={drawMode && !drawDone ? e => {
              if (isDragged.current) return
              const pt = toSvgCoords(e)
              setDrawPts(prev => [...prev, pt])
            } : undefined}
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
                      debug                  ? `${dbgColor}44` :
                      flashRegs.has(region)  ? 'rgba(200,32,47,0.22)' : 'rgba(0,0,0,0.001)'
                    }
                    stroke={
                      debug                  ? dbgColor :
                      flashRegs.has(region)  ? 'rgba(200,32,47,0.60)' : 'none'
                    }
                    strokeWidth={debug ? 1.5 : 1.5}
                    pointerEvents="all"
                    style={{ cursor: 'pointer', transition: 'fill 0.55s ease, stroke 0.55s ease' }}
                    onClick={() => {
                      if (debug || drawMode || isDragged.current) return
                      onToggle(region)
                      setFlashRegs(prev => new Set([...prev, region]))
                      setTimeout(() => setFlashRegs(prev => {
                        const n = new Set(prev); n.delete(region); return n
                      }), 550)
                    }}
                    onMouseEnter={() => { setHovReg(region); onHover?.(region) }}
                    onMouseLeave={() => { setHovReg(null);  onHover?.(null)   }}
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

            {/* ── Draw tool visualization ────────────────────── */}
            {drawMode && drawPts.length > 0 && (() => {
              const ptsForSvg = drawPts.map(p => `${p.x},${p.y}`).join(' ')
              const mirPts    = drawPts.map(mirrorPt)
              const mirForSvg = mirPts.map(p => `${p.x},${p.y}`).join(' ')
              return (
                <g pointerEvents="none">
                  {/* Polygon fill preview */}
                  {drawPts.length >= 3 && (
                    <polygon points={ptsForSvg}
                      fill="rgba(234,179,8,0.18)" stroke="rgba(234,179,8,0.9)"
                      strokeWidth="1.5" strokeDasharray="5 3" />
                  )}
                  {/* Mirror polygon preview */}
                  {drawMirror && drawPts.length >= 3 && (
                    <polygon points={mirForSvg}
                      fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.7)"
                      strokeWidth="1.5" strokeDasharray="4 4" />
                  )}
                  {/* Centerline when mirror on */}
                  {drawMirror && (
                    <line x1={CENTERLINE} y1={0} x2={CENTERLINE} y2={1500}
                      stroke="rgba(59,130,246,0.3)" strokeWidth="1" strokeDasharray="6 4" />
                  )}
                  {/* Connecting line back to first */}
                  {drawPts.length >= 2 && (
                    <line x1={drawPts[drawPts.length-1].x} y1={drawPts[drawPts.length-1].y}
                          x2={drawPts[0].x} y2={drawPts[0].y}
                          stroke="rgba(234,179,8,0.4)" strokeWidth="1" strokeDasharray="3 3" />
                  )}
                  {/* Dots + numbers */}
                  {drawPts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r={6}
                        fill={i === 0 ? 'rgba(34,197,94,0.9)' : 'rgba(234,179,8,0.9)'}
                        stroke="white" strokeWidth="1.5" />
                      <text x={p.x+9} y={p.y-6} fill="white" fontSize="11" fontWeight="700"
                        stroke="black" strokeWidth="2.5" paintOrder="stroke"
                        textAnchor="start" dominantBaseline="middle">
                        {i+1}
                      </text>
                    </g>
                  ))}
                  {/* Live cursor crosshair in draw mode */}
                  {cursor && !drawDone && (
                    <>
                      <line x1={cursor.x} y1={0} x2={cursor.x} y2={1500}
                        stroke="rgba(234,179,8,0.3)" strokeWidth="1" />
                      <line x1={0} y1={cursor.y} x2={600} y2={cursor.y}
                        stroke="rgba(234,179,8,0.3)" strokeWidth="1" />
                      <circle cx={cursor.x} cy={cursor.y} r={4}
                        fill="rgba(234,179,8,0.7)" stroke="white" strokeWidth="1" />
                    </>
                  )}
                </g>
              )
            })()}
            {/* Crosshair when draw mode active but no points yet */}
            {drawMode && drawPts.length === 0 && cursor && !drawDone && (
              <g pointerEvents="none">
                <line x1={cursor.x} y1={0} x2={cursor.x} y2={1500}
                  stroke="rgba(234,179,8,0.4)" strokeWidth="1" />
                <line x1={0} y1={cursor.y} x2={600} y2={cursor.y}
                  stroke="rgba(234,179,8,0.4)" strokeWidth="1" />
                <circle cx={cursor.x} cy={cursor.y} r={4}
                  fill="rgba(234,179,8,0.8)" stroke="white" strokeWidth="1" />
              </g>
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
