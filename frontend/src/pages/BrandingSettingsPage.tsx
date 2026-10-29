import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Palette, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/layout/AppShell";
import BrandMark from "@/components/shared/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiPut } from "@/lib/api";
import {
  contrastTextColor,
  salonThemeStyle,
  useSalonBranding,
  type SalonBrandingUpdate,
} from "@/lib/booking";
import { useI18n } from "@/lib/i18n";
import { useUser } from "@/lib/userContext";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read the logo file"));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(new Error("Could not read the logo file"));
    reader.readAsDataURL(file);
  });
}

function apiErrorMessage(error: unknown, fallback: string) {
  if (
    error instanceof ApiError &&
    typeof error.body === "object" &&
    error.body !== null &&
    "detail" in error.body &&
    typeof error.body.detail === "string"
  ) {
    return error.body.detail;
  }
  return fallback;
}

export default function BrandingSettingsPage() {
  const { t } = useI18n();
  const user = useUser();
  const queryClient = useQueryClient();
  const brandingQuery = useSalonBranding();
  const [form, setForm] = useState<SalonBrandingUpdate | null>(null);

  useEffect(() => {
    if (!brandingQuery.data) return;
    setForm({
      salon_name: brandingQuery.data.salon_name,
      logo_data: brandingQuery.data.logo_data,
      primary_color: brandingQuery.data.primary_color,
      accent_color: brandingQuery.data.accent_color,
    });
  }, [brandingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (updated: SalonBrandingUpdate) =>
      apiPut<SalonBrandingUpdate & { slug: string }>("/branding", updated),
    onSuccess: (saved) => {
      queryClient.setQueryData(["salon-branding"], saved);
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      queryClient.invalidateQueries({ queryKey: ["public-booking"] });
      toast.success(t("Salon appearance saved"));
    },
    onError: (error) =>
      toast.error(
        t(apiErrorMessage(error, "Could not save salon appearance"))
      ),
  });

  const selectLogo = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      toast.error(t("Choose a PNG, JPEG, or WebP image."));
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error(t("Logo files must be no larger than 2 MB."));
      return;
    }
    try {
      const logoData = await readLogo(file);
      setForm((current) => (current ? { ...current, logo_data: logoData } : current));
    } catch {
      toast.error(t("Could not read the logo file"));
    }
  };

  if (user.role !== "admin") {
    return (
      <AppShell title={t("Salon appearance")} subtitle={t("Administrator access required")}>
        <p className="p-8 text-sm text-stone-600">{t("Only salon administrators can change salon appearance.")}</p>
      </AppShell>
    );
  }

  return (
    <AppShell title={t("Salon appearance")} subtitle={t("Personalize the salon name, logo, and colors.")}>
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        {brandingQuery.isLoading && <p className="text-sm text-stone-500">{t("Loading…")}</p>}
        {brandingQuery.isError && (
          <div className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-800">
            {t("Could not load salon appearance.")}
            <Button className="ml-3" variant="outline" onClick={() => brandingQuery.refetch()}>
              {t("Retry")}
            </Button>
          </div>
        )}
        {form && brandingQuery.data && (
          <>
            <section className="space-y-5 rounded-2xl border border-[#E7DFD5] bg-white p-4 sm:p-6">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">{t("Salon name")}</span>
                <Input
                  className="h-11"
                  value={form.salon_name}
                  minLength={2}
                  maxLength={100}
                  required
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, salon_name: event.target.value } : current
                    )
                  }
                  data-testid="salon-brand-name"
                />
              </label>

              <div>
                <p className="text-sm font-medium">{t("Salon logo")}</p>
                <p className="mt-1 text-sm text-stone-500">{t("PNG, JPEG, or WebP · maximum 2 MB")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-[#E7DFD5] bg-[#FAF7F2] p-2">
                    <BrandMark
                      src={form.logo_data}
                      alt={form.salon_name}
                      className="max-h-full max-w-full rounded-xl object-contain"
                    />
                  </div>
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E7DFD5] px-4 text-sm font-medium text-stone-700 hover:bg-[#FAF7F2]">
                    <ImagePlus className="h-4 w-4" />
                    {t("Upload logo")}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => {
                        void selectLogo(event.target.files?.[0]);
                        event.currentTarget.value = "";
                      }}
                      data-testid="salon-logo-upload"
                    />
                  </label>
                  {form.logo_data && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setForm((current) =>
                          current ? { ...current, logo_data: null } : current
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("Remove logo")}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Palette className="h-4 w-4" /> {t("Primary color")}
                  </span>
                  <span className="flex h-11 items-center gap-3 rounded-lg border border-[#E7DFD5] px-3">
                    <input
                      className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                      type="color"
                      value={form.primary_color}
                      aria-label={t("Primary color")}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, primary_color: event.target.value.toUpperCase() } : current
                        )
                      }
                    />
                    <span className="font-mono text-sm">{form.primary_color}</span>
                  </span>
                </label>
                <label className="block space-y-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Palette className="h-4 w-4" /> {t("Accent color")}
                  </span>
                  <span className="flex h-11 items-center gap-3 rounded-lg border border-[#E7DFD5] px-3">
                    <input
                      className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                      type="color"
                      value={form.accent_color}
                      aria-label={t("Accent color")}
                      onChange={(event) =>
                        setForm((current) =>
                          current ? { ...current, accent_color: event.target.value.toUpperCase() } : current
                        )
                      }
                    />
                    <span className="font-mono text-sm">{form.accent_color}</span>
                  </span>
                </label>
              </div>
            </section>

            <section
              className="overflow-hidden rounded-2xl border border-[#E7DFD5] bg-white"
              style={salonThemeStyle(form)}
              data-testid="salon-brand-preview"
            >
              <div className="flex items-center gap-3 border-b border-[#E7DFD5] p-4">
                <BrandMark
                  src={form.logo_data}
                  alt={form.salon_name}
                  className="h-10 w-10 rounded-full object-contain"
                />
                <div>
                  <p className="font-heading text-lg font-semibold">{form.salon_name || t("Your salon")}</p>
                  <p className="text-xs text-stone-500">{t("Brand preview")}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 p-4">
                <Button type="button">{t("Primary button")}</Button>
                <span className="rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: form.accent_color, color: contrastTextColor(form.accent_color) }}>
                  {t("Accent color")}
                </span>
              </div>
            </section>

            <div className="flex justify-end">
              <Button
                disabled={
                  saveMutation.isPending ||
                  form.salon_name.trim().length < 2
                }
                data-testid="save-salon-branding"
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending ? t("Saving…") : t("Save appearance")}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
