import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { TeamUser } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/userContext";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewUser {
  name: string;
  email: string;
  password: string;
  role: "admin" | "staff";
}

export default function TeamPage() {
  const { t } = useI18n();
  const currentUser = useUser();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<NewUser>({
    name: "",
    email: "",
    password: "",
    role: "staff",
  });
  const users = useQuery({
    queryKey: ["team-users"],
    queryFn: () => apiGet<TeamUser[]>("/team/users"),
  });
  const createUser = useMutation({
    mutationFn: () => apiPost<TeamUser>("/team/users", form),
    onSuccess: async () => {
      toast.success(t("Team member added"));
      setForm({ name: "", email: "", password: "", role: "staff" });
      await queryClient.invalidateQueries({ queryKey: ["team-users"] });
    },
    onError: () => toast.error(t("Could not add this e-mail to the team")),
  });
  const updateUser = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { role?: string; active?: boolean } }) =>
      apiPatch<TeamUser>(`/team/users/${id}`, changes),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["team-users"] });
    },
    onError: () => toast.error(t("Could not update this team member")),
  });
  if (currentUser.role !== "admin") return <Navigate to="/agenda" replace />;

  return (
    <AppShell title={t("Team")} subtitle={t("Workspace: {name}", { name: currentUser.tenant_slug })}>
      <div className="mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="h-fit rounded-2xl border border-[#E5DCD0] bg-white p-6">
          <h2 className="font-heading text-xl font-semibold">{t("Add a teammate")}</h2>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              createUser.mutate();
            }}
          >
            <Field label={t("Name")} value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <Field label={t("E-mail")} type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
            <Field label={t("Temporary password (10+ characters)")} type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
            <div className="grid gap-1.5">
              <Label htmlFor="team-role">{t("Role")}</Label>
              <select
                id="team-role"
                className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm"
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as NewUser["role"] })}
              >
                <option value="staff">{t("Team member")}</option>
                <option value="admin">{t("Administrator")}</option>
              </select>
            </div>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? t("Adding…") : t("Add teammate")}
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border border-[#E5DCD0] bg-white p-6">
          <h2 className="font-heading text-xl font-semibold">{t("Workspace access")}</h2>
          {users.isError ? (
            <p className="mt-4 text-sm text-red-700">{t("Could not load team members.")}</p>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {(users.data ?? []).map((member) => (
                <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-stone-500">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={t("Role for {name}", { name: member.name })}
                      className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
                      value={member.role}
                      disabled={member.id === currentUser.id}
                      onChange={(event) => updateUser.mutate({ id: member.id, changes: { role: event.target.value } })}
                    >
                      <option value="staff">{t("Team")}</option>
                      <option value="admin">{t("Admin")}</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={member.id === currentUser.id}
                      onClick={() => updateUser.mutate({ id: member.id, changes: { active: !member.active } })}
                    >
                      {member.active ? t("Disable") : t("Enable")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
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
