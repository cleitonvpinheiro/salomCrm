import { createContext, useContext } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
}

export const UserContext = createContext<SessionUser | null>(null);

export function useUser(): SessionUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside <RequireAuth>");
  return user;
}
