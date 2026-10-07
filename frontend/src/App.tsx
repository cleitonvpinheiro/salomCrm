import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import RequireAuth from "@/components/auth/RequireAuth";
import Login from "@/pages/Login";
import ClientsDashboard from "@/pages/ClientsDashboard";
import AgendaPage from "@/pages/AgendaPage";
import StylistsPage from "@/pages/StylistsPage";
import ServicesPage from "@/pages/ServicesPage";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
// RequireAuth is a pathless layout route guarding the whole workspace.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<ClientsDashboard />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/stylists" element={<StylistsPage />} />
          <Route path="/servicos" element={<ServicesPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
