import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowUpRight, Building2, Check, KeyRound, Plus, Search, ShieldOff, Store } from "lucide-react";
import { changePlatformPassword, platformLogout } from "@/lib/session";
import type { Tenant } from "@/lib/types";
import { ApiError, apiGet, apiPatch, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

interface CreateTenantPayload {
  name: string;
  slug: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}

function isDefaultTenant(tenant: Tenant): boolean {
  return (
    tenant.is_default ??
    tenant.slug.toLowerCase() ===
      (import.meta.env.VITE_DEFAULT_TENANT_SLUG ?? "").trim().toLowerCase()
  );
}

export default function PlatformPage() {
  const { t, formatDate: formatLocaleDate } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusTarget, setStatusTarget] = useState<Tenant | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordMismatch, setPasswordMismatch] = useState(false);
  const [form, setForm] = useState<CreateTenantPayload>({
    name: "",
    slug: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  });
  const tenants = useQuery({
    queryKey: ["platform-tenants"],
    queryFn: () => apiGet<Tenant[]>("/platform/tenants"),
  });
  const filteredTenants = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tenants.data ?? []).filter(
      (tenant) =>
        !term ||
        tenant.name.toLowerCase().includes(term) ||
        tenant.slug.toLowerCase().includes(term)
    );
  }, [search, tenants.data]);
  const createTenant = useMutation({
    mutationFn: () => apiPost<Tenant>("/platform/tenants", form),
    onSuccess: async (tenant) => {
      toast.success(t(`Created workspace {name}. Share the admin credentials securely.`, { name: tenant.name }));
      setForm({ name: "", slug: "", admin_name: "", admin_email: "", admin_password: "" });
      await queryClient.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
    onError: () => toast.error(t("Could not create the workspace. Check that its slug and e-mail are unused.")),
  });
  const updateTenantStatus = useMutation({
    mutationFn: ({ tenant, active }: { tenant: Tenant; active: boolean }) =>
      apiPatch<Tenant>(`/platform/tenants/${tenant.id}`, { active }),
    onSuccess: async (tenant) => {
      toast.success(t("{name} {status}.", { name: tenant.name, status: t(tenant.active ? "activated" : "deactivated") }));
      setStatusTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["platform-tenants"]       });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError && error.status === 404
          ? t("This workspace no longer exists. Refresh the list.")
          : t("Could not update this workspace.")
      ),
  });
  const changePassword = useMutation({
    mutationFn: () => changePlatformPassword(currentPassword, newPassword),
    onSuccess: async () => {
      toast.success(t("Password updated. Other platform sessions have been signed out."));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPasswordMismatch(false);
      setChangePasswordOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["platform-me"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        toast.error(t("The current password is incorrect."));
      } else if (error instanceof ApiError && error.status === 404) {
        toast.error(
          t("Password change is not available on this API instance. Restart the backend and try again.")
        );
      } else {
        toast.error(t("Could not update the password. Please try again."));
      }
    },
  });
  const signOut = async () => {
    try {
      await platformLogout();
      navigate("/login", { replace: true });
    } catch {
      toast.error(t("Could not sign out. Please try again."));
    }
  };
  const set = (key: keyof CreateTenantPayload, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <main className="min-h-screen bg-[#FAF7F2] px-5 py-10 text-stone-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-stone-500">{t("Platform owner")}</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold">{t("Platform overview")}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              variant="outline"
              data-testid="open-change-platform-password"
              onClick={() => setChangePasswordOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              {t("Change password")}
            </Button>
            <Button onClick={() => setShowCreate((visible) => !visible)}>
              <Plus className="h-4 w-4" />
              {t(showCreate ? "Close form" : "New workspace")}
            </Button>
            <LanguageSwitcher />
            <Button variant="outline" onClick={signOut}>{t("Sign out")}</Button>
          </div>
        </header>

        <section aria-label={t("Workspace summary")} className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            label={t("Total workspaces")}
            value={tenants.data?.length ?? 0}
            icon={<Building2 className="h-5 w-5" />}
          />
          <SummaryCard
            label={t("Active")}
            value={tenants.data?.filter((tenant) => tenant.active).length ?? 0}
            icon={<Check className="h-5 w-5" />}
            tone="green"
          />
          <SummaryCard
            label={t("Inactive")}
            value={tenants.data?.filter((tenant) => !tenant.active).length ?? 0}
            icon={<ShieldOff className="h-5 w-5" />}
            tone="muted"
          />
        </section>

        {showCreate ? (
          <section className="mt-6 rounded-2xl border border-[#E5DCD0] bg-white p-6">
            <h2 className="font-heading text-xl font-semibold">{t("Create a workspace")}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {t("Create the salon and its first administrator. The administrator can add teammates after signing in.")}
            </p>
            <form
              className="mt-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                createTenant.mutate();
              }}
            >
              <Field label={t("Workspace name")} value={form.name} onChange={(value) => set("name", value)} />
              <Field label={t("Workspace slug")} value={form.slug} onChange={(value) => set("slug", value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
              <Field label={t("Administrator name")} value={form.admin_name} onChange={(value) => set("admin_name", value)} />
              <Field label={t("Administrator e-mail")} type="email" value={form.admin_email} onChange={(value) => set("admin_email", value)} />
              <Field label={t("Temporary password (10+ characters)")} type="password" value={form.admin_password} onChange={(value) => set("admin_password", value)} />
              <div className="flex items-end">
                <Button disabled={createTenant.isPending} type="submit">
                  {t(createTenant.isPending ? "Creating…" : "Create workspace")}
                </Button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="mt-6 rounded-2xl border border-[#E5DCD0] bg-white p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8F4E34]">
                {t("Workspace directory")}
              </p>
              <h2 className="mt-1 font-heading text-2xl font-semibold">{t("Salons")}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {t("Open a salon sign-in or manage its access.")}
              </p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                aria-label={t("Search salons")}
                placeholder={t("Search by salon or workspace")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {tenants.isPending ? (
            <p className="mt-6 text-sm text-stone-500">{t("Loading salons…")}</p>
          ) : tenants.isError ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{t("Could not load salons.")}</p>
              <Button variant="outline" className="mt-3" onClick={() => tenants.refetch()}>
                {t("Try again")}
              </Button>
            </div>
          ) : filteredTenants.length ? (
            <ul className="mt-5 divide-y divide-stone-100">
              {filteredTenants.map((tenant) => (
                <li
                  key={tenant.id}
                  data-testid={`platform-tenant-${tenant.slug}`}
                  className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#F3ECE1] text-[#8F4E34]">
                      <Store aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-stone-900">{tenant.name}</h3>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            tenant.active
                              ? "bg-[#EBF4EE] text-[#235937]"
                              : "bg-stone-100 text-stone-600"
                          }`}
                        >
                          {t(tenant.active ? "Active" : "Inactive")}
                        </span>
                        {isDefaultTenant(tenant) ? (
                          <span className="rounded-full bg-[#F3ECE1] px-2.5 py-0.5 text-[11px] font-medium text-[#713B27]">
                            {t("Default workspace")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-stone-500">{tenant.slug}</p>
                      <p className="mt-1 text-xs text-stone-400">
                        {t("Created {date}", { date: formatLocaleDate(new Date(tenant.created_at)) })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {tenant.active ? (
                      <Link
                        to={`/login?tenant=${encodeURIComponent(tenant.slug)}`}
                        aria-label={t("Open {name} sign in", { name: tenant.name })}
                        data-testid={`open-tenant-${tenant.slug}`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#E7DFD5] bg-white px-2.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-[#F3ECE1] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#B88358]/50"
                      >
                        {t("Open salon")}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <Button variant="outline" disabled title={t("Activate this workspace to open it")}>
                        {t("Open salon")}
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    )}
                    {isDefaultTenant(tenant) ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`toggle-tenant-${tenant.slug}`}
                        onClick={() => setStatusTarget(tenant)}
                      >
                        {t(tenant.active ? "Deactivate" : "Activate")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-[#E5DCD0] p-8 text-center text-sm text-stone-500">
              {t(search ? "No salons match your search." : "No salons have been created yet.")}
            </p>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={statusTarget !== null}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
        title={t("{action} {name}?", { action: t(statusTarget?.active ? "Deactivate" : "Activate"), name: statusTarget?.name ?? t("salon") })}
        description={
          statusTarget?.active
            ? t("People in this salon will no longer be able to sign in until it is activated again. Its data will be retained.")
            : t("People in this salon will be able to sign in again.")
        }
        confirmLabel={t(statusTarget?.active ? "Deactivate salon" : "Activate salon")}
        pending={updateTenantStatus.isPending}
        onConfirm={() => {
          if (statusTarget) {
            updateTenantStatus.mutate({
              tenant: statusTarget,
              active: !statusTarget.active,
            });
          }
        }}
        confirmTestId="confirm-tenant-status"
      />
      <Dialog
        open={changePasswordOpen}
        onOpenChange={(open) => {
          setChangePasswordOpen(open);
          if (!open) {
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            setPasswordMismatch(false);
            changePassword.reset();
          }
        }}
      >
        <DialogContent data-testid="change-platform-password-dialog">
          <DialogHeader>
            <DialogTitle>{t("Change master password")}</DialogTitle>
            <DialogDescription>
              {t("Enter your current password and choose a new one with at least 10 characters. Other master sessions will be signed out.")}
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (newPassword !== confirmNewPassword) {
                setPasswordMismatch(true);
                return;
              }
              setPasswordMismatch(false);
              changePassword.mutate();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="current-platform-password">{t("Current password")}</Label>
              <Input
                id="current-platform-password"
                data-testid="current-platform-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-platform-password">{t("New password")}</Label>
              <Input
                id="new-platform-password"
                data-testid="new-platform-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="confirm-platform-password">{t("Confirm new password")}</Label>
              <Input
                id="confirm-platform-password"
                data-testid="confirm-platform-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
              />
            </div>
            {passwordMismatch ? (
              <p role="alert" className="text-sm text-red-700">
                {t("The new passwords do not match.")}
              </p>
            ) : null}
            {changePassword.isError &&
            !(
              changePassword.error instanceof ApiError &&
              (changePassword.error.status === 401 || changePassword.error.status === 404)
            ) ? (
              <p role="alert" className="text-sm text-red-700">
                {t("Could not update the password. Please try again.")}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setChangePasswordOpen(false)}
              >
                {t("Cancel")}
              </Button>
              <Button
                type="submit"
                disabled={changePassword.isPending}
                data-testid="save-platform-password"
              >
                {t(changePassword.isPending ? "Updating…" : "Update password")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "default" | "green" | "muted";
}) {
  const toneClass =
    tone === "green"
      ? "bg-[#EBF4EE] text-[#235937]"
      : tone === "muted"
        ? "bg-stone-100 text-stone-500"
        : "bg-[#F3ECE1] text-[#8F4E34]";
  return (
    <article className="rounded-2xl border border-[#E5DCD0] bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}>
          {icon}
        </span>
      </div>
      <p className="mt-3 font-heading text-3xl font-semibold text-stone-900">{value}</p>
    </article>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} required onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
