import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { apiGet } from "@/lib/api";

export interface HoursWindow {
  start: string | null;
  end: string | null;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type WeeklyHours = Record<Weekday, HoursWindow>;

export interface BookingStylist {
  id: string;
  name: string;
  title: string;
  color: string;
}

export interface BookingService {
  id: string;
  name: string;
  duration_min: number;
  price: number;
}

export interface BookingSettings {
  enabled: boolean;
  salon_hours: WeeklyHours;
  stylist_hours: Record<string, WeeklyHours>;
}

export interface BookingSettingsResponse extends BookingSettings {
  salon_name: string;
  slug: string;
  stylists: BookingStylist[];
}

export interface SalonBranding {
  salon_name: string;
  slug: string;
  logo_data: string | null;
  primary_color: string;
  accent_color: string;
}

export interface SalonBrandingUpdate {
  salon_name: string;
  logo_data: string | null;
  primary_color: string;
  accent_color: string;
}

export type SalonThemeStyle = CSSProperties & {
  "--primary": string;
  "--primary-foreground": string;
  "--accent-foreground": string;
  "--ring": string;
  "--sidebar-primary": string;
  "--sidebar-primary-foreground": string;
  "--brand-primary": string;
  "--brand-accent": string;
};

export function contrastTextColor(hex: string): string {
  const normalized = /^#[\da-f]{6}$/i.test(hex) ? hex.slice(1) : "8F4E34";
  const channels = [0, 2, 4].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16) / 255
  );
  const luminance = channels
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    )
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  return luminance > 0.179 ? "#1C1917" : "#FFFFFF";
}

export function salonThemeStyle(
  branding: Pick<SalonBranding, "primary_color" | "accent_color">
): SalonThemeStyle {
  return {
    "--primary": branding.primary_color,
    "--primary-foreground": contrastTextColor(branding.primary_color),
    "--accent-foreground": branding.primary_color,
    "--ring": branding.accent_color,
    "--sidebar-primary": branding.accent_color,
    "--sidebar-primary-foreground": contrastTextColor(branding.accent_color),
    "--brand-primary": branding.primary_color,
    "--brand-accent": branding.accent_color,
  };
}

export function useSalonBranding() {
  return useQuery({
    queryKey: ["salon-branding"],
    queryFn: () => apiGet<SalonBranding>("/branding"),
    retry: false,
    staleTime: 60_000,
  });
}

export interface PublicBookingInfo {
  salon_name: string;
  slug: string;
  logo_data: string | null;
  primary_color: string;
  accent_color: string;
  services: BookingService[];
  stylists: BookingStylist[];
}

export interface PublicAvailabilitySlot {
  time: string;
  stylist_id: string;
}

export interface PublicBookingConfirmation {
  salon_name: string;
  service_name: string;
  stylist_name: string;
  date: string;
  time: string;
}
