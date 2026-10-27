import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import RequireAuth from "@/components/auth/RequireAuth";
import RequirePlatform from "@/components/auth/RequirePlatform";

const Login = lazy(() => import("@/pages/Login"));
const ClientsDashboard = lazy(() => import("@/pages/ClientsDashboard"));
const AgendaPage = lazy(() => import("@/pages/AgendaPage"));
const StylistsPage = lazy(() => import("@/pages/StylistsPage"));
const ServicesPage = lazy(() => import("@/pages/ServicesPage"));
const TeamPage = lazy(() => import("@/pages/TeamPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const PlatformPage = lazy(() => import("@/pages/PlatformPage"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));

const pageFallback = (
  <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
    Carregando...
  </div>
);

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
// RequireAuth is a pathless layout route guarding the whole workspace.
export default function App() {
  return (
    <>
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/platform/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route element={<RequirePlatform />}>
            <Route path="/platform" element={<PlatformPage />} />
          </Route>
          <Route element={<RequireAuth />}>
            <Route path="/app" element={<ClientsDashboard />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/stylists" element={<StylistsPage />} />
            <Route path="/servicos" element={<ServicesPage />} />
            <Route path="/team" element={<TeamPage />} />
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster />
    </>
  );
}
