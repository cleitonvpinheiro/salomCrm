import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPlatformUser } from "@/lib/session";

export default function RequirePlatform() {
  const { data, isPending } = useQuery({
    queryKey: ["platform-me"],
    queryFn: fetchPlatformUser,
    retry: false,
  });
  if (isPending) return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  if (!data) return <Navigate to="/platform/login" replace />;
  return <Outlet />;
}
