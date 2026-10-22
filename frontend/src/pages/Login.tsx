import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api";
import {
  fetchPlatformUser,
  fetchSessionUser,
  login,
  logout,
  platformLogin,
} from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

const SALON_IMG =
  "https://images.unsplash.com/photo-1626383137804-ff908d2753a2?crop=entropy&cs=srgb&fm=jpg&q=85";

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isPlatformLogin = location.pathname === "/platform/login";
  const [tenantSlug, setTenantSlug] = useState(
    searchParams.get("tenant") ??
      import.meta.env.VITE_DEFAULT_TENANT_SLUG ??
      "atelier"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // All hooks run unconditionally; the redirect happens after them.
  const { data: user } = useQuery({
    queryKey: isPlatformLogin ? ["platform-me"] : ["me"],
    queryFn: isPlatformLogin ? fetchPlatformUser : fetchSessionUser,
    retry: false,
    staleTime: 60_000,
  });
  const tenantSession = user && "tenant_slug" in user ? user : null;
  const hasMatchingSession = isPlatformLogin
    ? Boolean(user && !tenantSession)
    : tenantSession?.tenant_slug === tenantSlug.trim().toLowerCase();

  const loginMutation = useMutation({
    mutationFn: () =>
      isPlatformLogin
        ? platformLogin(email.trim(), password)
        : login(tenantSlug.trim(), email.trim(), password),
    onSuccess: (u) => {
      toast.success(t("Welcome back, {name}", { name: u.name.split(" ")[0] }));
      navigate(isPlatformLogin ? "/platform" : "/app", { replace: true });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 503
          ? t("Platform owner is not configured. Set PLATFORM_OWNER_EMAIL and PLATFORM_OWNER_PASSWORD.")
          : t("Invalid e-mail or password")
      ),
  });

  if (hasMatchingSession) {
    return <Navigate to={isPlatformLogin ? "/platform" : "/app"} replace />;
  }

  return (
    <div className="flex min-h-screen bg-[#FAF7F2]">
      {/* visual half */}
      <div className="relative hidden lg:block lg:w-1/2">
        <img src={SALON_IMG} alt={t("Inside the Atelier salon")} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#221C18]/90 via-[#221C18]/30 to-transparent" />
        <div className="absolute bottom-10 left-10 max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#E7DFD5]">
            {t("Atelier · Since 2012")}
          </p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight text-white">
            {t("Every head of hair has a story.")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#E7DFD5]">
            {t("Clients, stylists, services and the day's agenda — kept warm, kept together.")}
          </p>
        </div>
      </div>

      {/* form half */}
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
        <div className="mb-5 flex justify-end"><LanguageSwitcher /></div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8F4E34]/10 text-[#8F4E34]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="font-heading text-2xl font-semibold tracking-tight text-stone-900">Atelier</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">              {t("Salon CRM")}</p>
            </div>
          </div>

          <h2 className="mt-8 font-heading text-2xl font-semibold text-stone-900">
            {t(isPlatformLogin ? "Platform administrator access" : "Sign in to your workspace")}
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            {tenantSession && !isPlatformLogin && !hasMatchingSession
              ? t("You are signed in to {workspace}. Sign out before opening another workspace.", { workspace: String(tenantSession.tenant_slug) })
              : isPlatformLogin
                ? t("Restricted area for managing customer workspaces.")
                : t("Shared by the whole team — each member with their own account.")}
          </p>

          {tenantSession && !isPlatformLogin && !hasMatchingSession ? (
            <Button
              className="mt-6 w-full"
              onClick={async () => {
                try {
                  await logout();
                  window.location.reload();
                } catch {
                  toast.error(t("Could not sign out of the current workspace"));
                }
              }}
            >
              {t("Sign out and switch workspace")}
            </Button>
          ) : (
            <form
              className="mt-6 grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (
                  (!isPlatformLogin && tenantSlug.trim().length === 0) ||
                  email.trim().length === 0 ||
                  password.length === 0
                ) {
                  toast.error(
                    isPlatformLogin
                      ? t("Fill in your e-mail and password")
                      : t("Fill in the tenant, e-mail and password")
                  );
                  return;
                }
                loginMutation.mutate();
              }}
            >
              {!isPlatformLogin ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="login-tenant">{t("Company workspace")}</Label>
                  <Input
                    id="login-tenant"
                    autoComplete="organization"
                    data-testid="login-tenant-input"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    placeholder={t("your-company")}
                  />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="login-email">{t("E-mail")}</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  data-testid="login-email-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("you@atelier.com")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="login-password">{t("Password")}</Label>
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
                {loginMutation.isPending ? t("Signing in…") : t("Sign in")}
              </Button>
            </form>
          )}

          {!tenantSession || isPlatformLogin ? (
            <Link
              to={`/forgot-password?type=${isPlatformLogin ? "platform" : "tenant"}${isPlatformLogin ? "" : `&tenant=${encodeURIComponent(tenantSlug.trim())}`}`}
              className="mt-4 inline-flex min-h-10 items-center text-sm text-stone-600 underline-offset-4 hover:text-[#8F4E34] hover:underline"
            >
              {t("Forgot your password?")}
            </Link>
          ) : null}

          <Link
            to={isPlatformLogin ? "/login" : "/platform/login"}
            className="mt-2 flex min-h-10 items-center text-sm font-medium text-[#8F4E34] underline-offset-4 hover:underline"
          >
            {isPlatformLogin
              ? t("Back to company workspace sign in")
              : t("Platform administrator sign in")}
          </Link>

          {!isPlatformLogin && import.meta.env.DEV ? (
            <div
              className="mt-8 rounded-xl border border-[#E7DFD5] bg-white p-3 text-xs leading-relaxed text-stone-500"
              data-testid="demo-credentials-hint"
            >
              <p className="font-medium text-stone-700">{t("Demo accounts")}</p>
              <p className="mt-1 font-mono">admin@atelier.com · atelier123 ({t("Administrator")})</p>
              <p className="font-mono">marina@atelier.com · atelier123 ({t("Team")})</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
