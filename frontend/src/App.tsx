import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import UserDashboard from "./pages/UserDashboard";
import HomePage from "./pages/HomePage";
import SymptomChecker from "./pages/SymptomChecker";
import ErrorBoundary from "./components/ErrorBoundary";

type AppView = "home" | "chat" | "login" | "symptoms" | "reset-password";

export default function App() {
  const { user, loading, logout } = useAuth();

  const resetToken = new URLSearchParams(window.location.search).get("reset_token");
  const [view, setView]           = useState<AppView>(resetToken ? "reset-password" : "home");
  const [returnTo, setReturnTo]   = useState<AppView>("home");
  const [prevView, setPrevView]   = useState<AppView>("home");
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();

  // After login, navigate to where the user was trying to go
  useEffect(() => {
    if (user && view === "login") {
      setView(returnTo === "login" ? "home" : returnTo);
      setReturnTo("home");
    }
  }, [user]); // eslint-disable-line

  // If logged out while on chat/symptoms → back to home
  useEffect(() => {
    if (!user && (view === "chat" || view === "symptoms")) setView("home");
  }, [user]); // eslint-disable-line

  if (loading) return (
    <div className="auth-loading">
      <div className="auth-loading-spinner" />
    </div>
  );

  if (user?.role === "admin")  return <AdminDashboard />;
  if (user?.role === "doctor") return <DoctorDashboard />;

  function requireAuth(dest: AppView) {
    if (user) setView(dest);
    else { setReturnTo(dest); setView("login"); }
  }

  if (view === "reset-password") return (
    <ResetPasswordPage token={resetToken!} onDone={() => {
      window.history.replaceState({}, "", "/");
      setView("login");
    }} />
  );

  if (view === "login") return (
    <LoginPage onBack={() => { setView("home"); setReturnTo("home"); }} />
  );

  // When navigating symptoms → chat (via "Book this specialist"), keep SymptomChecker
  // mounted behind display:none so its step/results state survives the round-trip.
  const keepSymptomsMounted = user && (view === "symptoms" || (view === "chat" && prevView === "symptoms"));

  if (keepSymptomsMounted) return (
    <>
      <div style={view !== "symptoms" ? { display: "none" } : undefined}>
        <ErrorBoundary>
          <SymptomChecker
            onBack={() => { setPrevView("home"); setView("home"); }}
            onBookSpecialist={(specialist) => {
              setChatPrefill(`I'd like to book an appointment with a ${specialist}`);
              setPrevView("symptoms");
              setView("chat");
            }}
          />
        </ErrorBoundary>
      </div>
      {view === "chat" && (
        <ErrorBoundary>
          <UserDashboard
            onHome={() => { setPrevView("home"); setView("home"); }}
            onBack={() => { setView("symptoms"); setPrevView("home"); setChatPrefill(undefined); }}
            onSymptomChecker={() => requireAuth("symptoms")}
            initialMessage={chatPrefill}
            onMessageSent={() => setChatPrefill(undefined)}
          />
        </ErrorBoundary>
      )}
    </>
  );

  if (view === "chat" && user) return (
    <ErrorBoundary>
      <UserDashboard
        onHome={() => { setPrevView("home"); setView("home"); }}
        onSymptomChecker={() => requireAuth("symptoms")}
        initialMessage={chatPrefill}
        onMessageSent={() => setChatPrefill(undefined)}
      />
    </ErrorBoundary>
  );

  return (
    <HomePage
      user={user}
      onOpenChat={() => requireAuth("chat")}
      onOpenSymptomChecker={() => requireAuth("symptoms")}
      onLogin={() => { setReturnTo("home"); setView("login"); }}
      onLogout={logout}
    />
  );
}
