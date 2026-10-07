import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import ClientsDashboard from "@/pages/ClientsDashboard";
import StylistsPage from "@/pages/StylistsPage";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<ClientsDashboard />} />
        <Route path="/stylists" element={<StylistsPage />} />
      </Routes>
      <Toaster />
    </>
  );
}
