import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSessionUser } from "@/lib/session";
import { UserContext } from "@/lib/userContext";
import BrandMark from "@/components/shared/BrandMark";

// Gate for the whole workspace: resolves the session cookie once, shares the user
// through context, and bounces to /login when there is no session.
export default function RequireAuth() {
  const { data: user, isPending } = useQuery({
    queryKey: ["me"],
    queryFn: fetchSessionUser,
    retry: false,
    staleTime: 60_000,
  });

  if (isPending) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <BrandMark className="h-10 w-10 animate-pulse rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <UserContext.Provider value={user}>
      <Outlet />
    </UserContext.Provider>
  );
}
