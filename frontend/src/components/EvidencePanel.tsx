import * as Tabs from "@radix-ui/react-tabs";

// ── Icons ──────────────────────────────────────────────────────────────────────
const BookIcon   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
const DbIcon     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;
const ChartIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
const AlertIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const CheckIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const MinusIcon  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const SearchIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;

const MODE_LABEL: Record<string, string> = {
  knowledge_base:  "Answered from policy documents",
  structured_data: "Answered from booking database",
  mixed:           "Combined policy + database lookup",
  from_context:    "Recalled from conversation context",
  no_source:       "No retrieval ran for this reply",
};

interface Source   { doc_id: string; title: string; snippet: string; score: number; }
interface ToolCall { name: string; input: Record<string, unknown>; output_summary?: string; }
interface Msg      { sources?: Source[]; tool_calls?: ToolCall[]; latency_ms?: number; mode?: string; grounded?: boolean; }

const CloseIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

function NoneState({ msg }: { msg: string }) {
  return <div className="none-state"><AlertIcon />{msg}</div>;
}

export default function EvidencePanel({ msg, onClose }: { msg: Msg | null; onClose?: () => void }) {
  /* ── Idle state ── */
  if (!msg) {
    return (
      <aside className="evidence">
        <div className="evidence-header">
          <div className="evidence-title-row">
            <div className="evidence-icon"><SearchIcon /></div>
            <div className="evidence-title-text">
              <h3>Where answers come from</h3>
              <p>Select any reply to inspect its sources</p>
            </div>
            {onClose && (
              <button className="ev-close-btn" onClick={onClose} aria-label="Close evidence panel">
                <CloseIcon />
              </button>
            )}
          </div>
        </div>
        <div className="ev-body" style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"48px 24px", textAlign:"center" }}>
          <div className="evidence-empty-icon"><SearchIcon /></div>
          <h4 style={{ fontSize:13.5, fontWeight:700, color:"var(--ink-2)", marginBottom:6 }}>No message selected</h4>
          <p style={{ fontSize:12, color:"var(--ink-3)", lineHeight:1.55, maxWidth:220 }}>
            Click any assistant reply to see the policy passages and database queries that produced it.
          </p>
          <div className="notice" style={{ marginTop:24, textAlign:"left" }}>
            <div className="notice-icon"><AlertIcon /></div>
            <span>Not connected to live SLT systems. All data is generated mock data.</span>
          </div>
        </div>
      </aside>
    );
  }

  const { sources = [], tool_calls = [], latency_ms = 0, mode = "no_source", grounded = false } = msg;

  return (
    <aside className="evidence">
      <Tabs.Root defaultValue="sources" style={{ display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden" }}>

        {/* ── Fixed header + tab bar ── */}
        <div className="evidence-header">
          <div className="evidence-title-row">
            <div className="evidence-icon"><BookIcon /></div>
            <div className="evidence-title-text">
              <h3>Evidence for this reply</h3>
              <p>{MODE_LABEL[mode] ?? "Unknown source"}</p>
            </div>
            {onClose && (
              <button className="ev-close-btn" onClick={onClose} aria-label="Close evidence panel">
                <CloseIcon />
              </button>
            )}
          </div>

          <Tabs.List className="ev-tabs-list">
            <Tabs.Trigger value="sources"  className="ev-tab">
              <BookIcon />
              Sources
              <span className="ev-tab-count">{sources.length}</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="database" className="ev-tab">
              <DbIcon />
              Database
              <span className="ev-tab-count">{tool_calls.length}</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="metrics"  className="ev-tab">
              <ChartIcon />
              Metrics
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        {/* ── Sources ── */}
        <Tabs.Content value="sources" className="ev-body">
          <div className={`grounded-badge ${grounded ? "yes" : "no"}`}>
            {grounded ? <CheckIcon /> : <MinusIcon />}
            {grounded ? "Every claim traces to a source below" : "No retrieval ran for this reply"}
          </div>

          {sources.length === 0
            ? <NoneState msg="No knowledge base lookup ran." />
            : sources.map((s, i) => (
              <div className="card" key={i}>
                <div className="card-head">
                  <span className="name">{s.title}</span>
                  <div className="score-wrap">
                    <span className="score-val">{(s.score * 100).toFixed(0)}%</span>
                    <div className="score-bar">
                      <div className="score-fill" style={{ width: `${(s.score * 100).toFixed(0)}%` }} />
                    </div>
                  </div>
                </div>
                <div className="snippet">{s.snippet}</div>
                <div className="docid mono">{s.doc_id}</div>
              </div>
            ))
          }
        </Tabs.Content>

        {/* ── Database ── */}
        <Tabs.Content value="database" className="ev-body">
          {tool_calls.length === 0
            ? <NoneState msg="No database queries ran for this reply." />
            : tool_calls.map((t, i) => (
              <div className="card tool" key={i}>
                <div className="card-head">
                  <span className="name mono">{t.name}</span>
                </div>
                <pre className="mono">{JSON.stringify(t.input, null, 2)}</pre>
                {t.output_summary && <div className="result">{t.output_summary}</div>}
              </div>
            ))
          }
        </Tabs.Content>

        {/* ── Metrics ── */}
        <Tabs.Content value="metrics" className="ev-body">
          <div className={`grounded-badge ${grounded ? "yes" : "no"}`}>
            {grounded ? <CheckIcon /> : <MinusIcon />}
            {grounded ? "Grounded — sources verified" : "Ungrounded — no retrieval"}
          </div>

          <div className="telemetry">
            <div className="tel-card accent">
              <div className="tel-label">Response time</div>
              <div className="tel-val">{(latency_ms / 1000).toFixed(2)}<span className="tel-unit">s</span></div>
            </div>
            <div className="tel-card">
              <div className="tel-label">Answer source</div>
              <div className="tel-badge">{mode.replace(/_/g, " ")}</div>
            </div>
            <div className="tel-card">
              <div className="tel-label">Policy passages</div>
              <div className="tel-val">{sources.length}</div>
            </div>
            <div className="tel-card">
              <div className="tel-label">DB queries</div>
              <div className="tel-val">{tool_calls.length}</div>
            </div>
          </div>

          <div className="notice" style={{ marginTop: 20 }}>
            <div className="notice-icon"><AlertIcon /></div>
            <span>Not connected to live SLT or eChannelling systems. All data is generated mock data.</span>
          </div>
        </Tabs.Content>

      </Tabs.Root>
    </aside>
  );
}
