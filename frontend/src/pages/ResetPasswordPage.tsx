import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api";
import { resetPassword } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

export default function ResetPasswordPage() {
  const { t } = useI18n();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const accountType = searchParams.get("type") === "platform" ? "platform" : "tenant";
  const loginUrl = accountType === "platform" ? "/platform/login" : "/login";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);

  const reset = useMutation({
    mutationFn: () => resetPassword(token, password),
  });
  const tokenError =
    reset.error instanceof ApiError && reset.error.status === 400
      ? t("This reset link is invalid or has expired. Request a new one.")
      : t("We couldn't reset your password. Please request a new link.");

  const invalidToken = token.length < 32;
  const completed = reset.isSuccess;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F2] px-5 py-12">
      <section className="w-full max-w-md rounded-2xl border border-[#E7DFD5] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-5 flex justify-end"><LanguageSwitcher /></div>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8F4E34]/10 text-[#8F4E34]">
            <Sparkles aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-heading text-2xl font-semibold text-stone-900">Atelier</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">
              {t("Choose a new password")}
            </p>
          </div>
        </div>

        {completed ? (
          <div className="mt-8" role="status">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EBF4EE] text-[#235937]">
              <Check aria-hidden="true" className="h-5 w-5" />
            </span>
            <h1 className="mt-5 font-heading text-2xl font-semibold text-stone-900">
              {t("Password updated")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {t("Your password has been changed. Sign in using the new password.")}
            </p>
          </div>
        ) : invalidToken ? (
          <div className="mt-8" role="alert">
            <h1 className="font-heading text-2xl font-semibold text-stone-900">
              {t("Reset link unavailable")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {t("This link is incomplete. Request a new password reset e-mail.")}
            </p>
          </div>
        ) : (
          <>
            <h1 className="mt-8 font-heading text-2xl font-semibold text-stone-900">
              {t("Set a new password")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {t("Use at least 10 characters. This link can only be used once.")}
            </p>
            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (password !== confirmPassword) {
                  setPasswordMismatch(true);
                  return;
                }
                setPasswordMismatch(false);
                reset.mutate();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="new-password">{t("New password")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="confirm-password">{t("Confirm new password")}</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={128}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
              {passwordMismatch ? (
                <p role="alert" className="text-sm text-red-700">
                  {t("The passwords do not match.")}
                </p>
              ) : null}
              {reset.isError ? (
                <p role="alert" className="text-sm text-red-700">
                  {tokenError}
                </p>
              ) : null}
              <Button type="submit" disabled={reset.isPending}>
                {reset.isPending ? t("Updating…") : t("Update password")}
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
