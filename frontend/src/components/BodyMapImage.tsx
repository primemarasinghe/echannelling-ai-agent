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
  { region: 'head-right',       points: '292,101 290,13 323,25 343,44 353,67 349,104 342,133 318,116 291,103' },
  { region: 'head-left',        points: '298,101 300,13 267,25 247,44 237,67 241,104 248,133 272,116 299,103' },
  { region: 'neck',             points: '311,124 328,191 417,242 295,275 167,247 251,197 274,119 311,119' },
  { region: 'right-shoulder',   points: '102,372 89,325 120,260 163,241 197,255 210,280 104,369' },
  { region: 'left-shoulder',    points: '488,372 501,325 470,260 427,241 393,255 380,280 486,369' },
  { region: 'upper-back-right', points: '174,253 206,274 161,328 161,397 189,484 290,500 295,279 210,272' },
  { region: 'upper-back-left',  points: '416,253 384,274 429,328 429,397 401,484 300,500 295,279 380,272' },
  { region: 'lower-back',   points: '191,489 184,520 174,556 175,578 220,559 292,645 358,563 406,587 406,547 399,524 400,488 293,502 191,489' },
  { region: 'right-arm',   points: '159,326 159,401 141,486 141,523 130,580 110,621 93,660 87,695 42,687 55,640 55,591 56,545 62,505 87,459 88,412 101,372 159,322' },
  { region: 'left-arm',    points: '431,326 431,401 449,486 449,523 460,580 480,621 497,660 503,695 548,687 535,640 535,591 534,545 528,505 503,459 502,412 489,372 431,322' },
  { region: 'right-hand',  points: '44,677 87,688 98,734 106,809 81,837 54,845 26,829 9,754 47,680' },
  { region: 'left-hand',   points: '546,677 503,688 492,734 484,809 509,837 536,845 564,829 581,754 543,680' },
  { region: 'right-hip',   points: '190,753 167,681 164,623 183,571 218,564 263,608 281,645 289,683 292,717 268,734 234,753 193,755' },
  { region: 'left-hip',    points: '400,753 423,681 426,623 407,571 372,564 327,608 309,645 301,683 298,717 322,734 356,753 397,755' },
  { region: 'right-leg',   points: '146,758 189,758 284,733 286,801 275,882 271,1013 262,1044 262,1072 268,1100 268,1134 262,1170 255,1216 252,1266 252,1298 260,1316 269,1335 261,1365 263,1396 266,1420 240,1429 204,1418 172,1412 166,1405 185,1390 205,1361 200,1347 206,1327 204,1295 184,1214 170,1160 160,1112 173,1058 185,1000 175,930 160,889 148,778 147,763' },
  { region: 'left-leg',    points: '444,758 401,758 306,733 304,801 315,882 319,1013 328,1044 328,1072 322,1100 322,1134 328,1170 335,1216 338,1266 338,1298 330,1316 321,1335 329,1365 327,1396 324,1420 350,1429 386,1418 418,1412 424,1405 405,1390 385,1361 390,1347 384,1327 386,1295 406,1214 420,1160 430,1112 417,1058 405,1000 415,930 430,889 442,778 443,763' },
  { region: 'right-knee',  points: '262,1057 180,1036 182,981 272,983 264,1055' },
  { region: 'left-knee',   points: '328,1057 410,1036 408,981 318,983 326,1055' },
  { region: 'right-toes',  points: '211,1418 224,1378 254,1376 267,1414 246,1436 211,1421' },
  { region: 'left-toes',   points: '379,1418 366,1378 336,1376 323,1414 344,1436 379,1421' },
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
  const devMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('draw')

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

        {devMode && (
          <button className={`bmi-dbg-btn${drawMode ? ' active' : ''}`} onClick={toggleDrawMode}
            style={drawMode ? {background:'#fef3c7',borderColor:'#f59e0b',color:'#b45309'} : {}}>
            {drawMode ? '✕ Stop Drawing' : '✏ Draw Region'}
          </button>
        )}
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
