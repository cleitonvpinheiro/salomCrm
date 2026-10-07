import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { fetchSessionUser, login } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SALON_IMG =
  "https://images.unsplash.com/photo-1626383137804-ff908d2753a2?crop=entropy&cs=srgb&fm=jpg&q=85";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // All hooks run unconditionally; the redirect happens after them.
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchSessionUser,
    retry: false,
    staleTime: 60_000,
  });

  const loginMutation = useMutation({
    mutationFn: () => login(email.trim(), password),
    onSuccess: (u) => {
      toast.success(`Welcome back, ${u.name.split(" ")[0]}`);
      navigate("/", { replace: true });
    },
    onError: () => toast.error("Invalid e-mail or password"),
  });

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen bg-[#FAF7F2]">
      {/* visual half */}
      <div className="relative hidden lg:block lg:w-1/2">
        <img src={SALON_IMG} alt="Inside the Atelier salon" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#221C18]/90 via-[#221C18]/30 to-transparent" />
        <div className="absolute bottom-10 left-10 max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#E7DFD5]">
            Atelier · Since 2012
          </p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-white">
            Every head of hair has a story.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#E7DFD5]">
            Clients, stylists, services and the day's agenda — kept warm, kept together.
          </p>
        </div>
      </div>

      {/* form half */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8F4E34]/10 text-[#8F4E34]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading text-2xl font-semibold tracking-tight text-stone-900">Atelier</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">Salon CRM</p>
            </div>
          </div>

          <h2 className="mt-8 font-heading text-2xl font-semibold text-stone-900">
            Sign in to the workspace
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            Shared by the whole team — each member with their own account.
          </p>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim().length === 0 || password.length === 0) {
                toast.error("Fill in your e-mail and password");
                return;
              }
              loginMutation.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                data-testid="login-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@atelier.com"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                data-testid="login-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button
              type="submit"
              disabled={loginMutation.isPending}
              data-testid="login-submit-button"
            >
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div
            className="mt-8 rounded-xl border border-[#E7DFD5] bg-white p-3 text-xs leading-relaxed text-stone-500"
            data-testid="demo-credentials-hint"
          >
            <p className="font-medium text-stone-700">Demo accounts</p>
            <p className="mt-1 font-mono">admin@atelier.com · atelier123 (administrator)</p>
            <p className="font-mono">marina@atelier.com · atelier123 (team)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
