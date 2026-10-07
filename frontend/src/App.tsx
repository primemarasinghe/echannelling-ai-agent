import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import LoginPage from "./pages/LoginPage";
import UserDashboard from "./pages/UserDashboard";
import HomePage from "./pages/HomePage";
import ErrorBoundary from "./components/ErrorBoundary";

type AppView = "home" | "chat" | "login";

export default function App() {
  const { user, loading, logout } = useAuth();
  const [view, setView]           = useState<AppView>("home");
  const [returnTo, setReturnTo]   = useState<AppView>("home");

  // After login, navigate to where the user was trying to go
  useEffect(() => {
    if (user && view === "login") {
      setView(returnTo === "login" ? "home" : returnTo);
      setReturnTo("home");
    }
  }, [user]); // eslint-disable-line

  // If logged out while on chat → back to home
  useEffect(() => {
    if (!user && view === "chat") setView("home");
  }, [user]); // eslint-disable-line

  if (loading) return (
    <div className="auth-loading">
      <div className="auth-loading-spinner" />
    </div>
  );

  // Role-specific dashboards (bypass home routing)
  if (user?.role === "admin")  return <AdminDashboard />;
  if (user?.role === "doctor") return <DoctorDashboard />;

  function requireAuth(dest: AppView) {
    if (user) setView(dest);
    else { setReturnTo(dest); setView("login"); }
  }

  if (view === "login") return (
    <LoginPage onBack={() => { setView("home"); setReturnTo("home"); }} />
  );

  if (view === "chat" && user) return (
    <ErrorBoundary>
      <UserDashboard onHome={() => setView("home")} />
    </ErrorBoundary>
  );

  return (
    <HomePage
      user={user}
      onOpenChat={() => requireAuth("chat")}
      onLogin={() => { setReturnTo("home"); setView("login"); }}
      onLogout={logout}
    />
  );
}
