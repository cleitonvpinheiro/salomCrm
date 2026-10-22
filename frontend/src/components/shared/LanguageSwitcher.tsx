import { useI18n, type Locale } from "@/lib/i18n";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className={`inline-flex items-center gap-2 text-sm ${className}`}>
      <span className="sr-only">{t("Language")}</span>
      <select
        aria-label={t("Language")}
        data-testid="language-selector"
        className="h-9 rounded-lg border border-[#E7DFD5] bg-white px-2 text-sm text-stone-700"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
