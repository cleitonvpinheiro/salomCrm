import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail } from "lucide-react";
import { ApiError } from "@/lib/api";
import { requestPasswordReset } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const accountType = searchParams.get("type") === "platform" ? "platform" : "tenant";
  const [tenantSlug, setTenantSlug] = useState(
    searchParams.get("tenant") ?? import.meta.env.VITE_DEFAULT_TENANT_SLUG ?? ""
  );
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestReset = useMutation({
    mutationFn: () =>
      requestPasswordReset({
        email: email.trim(),
        account_type: accountType,
        ...(accountType === "tenant" ? { tenant_slug: tenantSlug.trim() } : {}),
      }),
    onSuccess: () => setSubmitted(true),
  });

  const loginUrl = accountType === "platform" ? "/platform/login" : "/login";
  const errorMessage =
    requestReset.error instanceof ApiError && requestReset.error.status === 503
      ? t("Password recovery email is not configured yet. Please contact the platform administrator.")
      : t("We couldn't send the recovery email. Please try again later.");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[#E7DFD5] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex justify-end"><LanguageSwitcher /></div>
        <div className="flex justify-center">
          <img
            src="/atelier-logo.png"
            alt={t("Atelier — A operação do salão, mais simples.")}
            className="h-36 w-36 object-contain"
          />
        </div>

        {submitted ? (
          <div className="mt-8" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF4EE] text-[#235937]">
              <Mail aria-hidden="true" className="h-5 w-5" />
            </span>
            <h1 className="mt-5 font-heading text-2xl font-semibold text-stone-900">
              {t("Check your e-mail")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {t("If an active account matches these details, we sent a password reset link. The link is valid for 30 minutes.")}
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-8 font-heading text-2xl font-semibold text-stone-900">
              {t("Forgot your password?")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {t("Enter your account e-mail")}{accountType === "tenant" ? t(" and workspace") : ""}{t(". If the account exists, we’ll send a secure reset link.")}
            </p>

            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                requestReset.mutate();
              }}
            >
              {accountType === "tenant" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="recovery-tenant">{t("Company workspace")}</Label>
                  <Input
                    id="recovery-tenant"
                    autoComplete="organization"
                    required
                    value={tenantSlug}
                    onChange={(event) => setTenantSlug(event.target.value)}
                  />
                </div>
              ) : null}
              <div className="grid gap-1.5">
                <Label htmlFor="recovery-email">{t("E-mail")}</Label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {requestReset.isError ? (
                <p role="alert" className="text-sm text-red-700">
                  {errorMessage}
                </p>
              ) : null}
              <Button type="submit" disabled={requestReset.isPending}>
                {requestReset.isPending ? t("Sending…") : t("Send reset link")}
              </Button>
            </form>
          </>
        )}

        <Link
          to={loginUrl}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#8F4E34] hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {t("Back to sign in")}
        </Link>
      </section>
    </main>
  );
}
