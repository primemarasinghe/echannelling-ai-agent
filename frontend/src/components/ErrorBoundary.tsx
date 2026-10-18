import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", gap: 16,
          fontFamily: "Inter, sans-serif", padding: 32, textAlign: "center",
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111" }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: "#888", maxWidth: 400, lineHeight: 1.6 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: "9px 22px", borderRadius: 8, border: "none",
              background: "#003087", color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
