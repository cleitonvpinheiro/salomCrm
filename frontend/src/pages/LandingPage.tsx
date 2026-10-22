import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  Scissors,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { fetchSessionUser } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import LanguageSwitcher from "@/components/shared/LanguageSwitcher";

function salesWhatsappUrl(message: string) {
  const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  return /^\d{10,15}$/.test(whatsappNumber)
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`
    : null;
}

function SalesCta({ className = "", message }: { className?: string; message: string }) {
  const whatsappUrl = salesWhatsappUrl(message);
  return (
    <a
      href={whatsappUrl ?? "#contato"}
      target={whatsappUrl ? "_blank" : undefined}
      rel={whatsappUrl ? "noopener noreferrer" : undefined}
      className={className}
    >
      {message}
      <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
    </a>
  );
}

const features = [
  {
    icon: UsersRound,
    title: "Clientes no centro",
    description:
      "Tenha contatos, histórico de visitas e anotações importantes em um só lugar.",
  },
  {
    icon: CalendarDays,
    title: "Agenda organizada",
    description:
      "Acompanhe os atendimentos e horários da equipe com uma visão clara do dia.",
  },
  {
    icon: Scissors,
    title: "Equipe alinhada",
    description:
      "Organize profissionais, serviços e acessos para cada pessoa da sua equipe.",
  },
];

export default function LandingPage() {
  const { t } = useI18n();
  const whatsappUrl = salesWhatsappUrl(t("Quero conhecer"));
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: fetchSessionUser,
    retry: false,
    staleTime: 60_000,
  });

  if (user) return <Navigate to="/app" replace />;

  return (
    <main className="overflow-hidden bg-[#FAF7F2] text-stone-900">
      <header className="relative z-10 border-b border-[#E7DFD5]/80 bg-[#FAF7F2]/95">
        <nav
          aria-label={t("Main navigation")}
          className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8"
        >
          <a href="#inicio" className="flex items-center gap-2.5" aria-label={t("Atelier, home")}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8F4E34]/10 text-[#8F4E34]">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-heading text-xl font-semibold leading-5">Atelier</span>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.22em] text-stone-500">
                {t("Gestão para salões")}
              </span>
            </span>
          </a>

          <div className="hidden items-center gap-8 text-sm text-stone-600 md:flex">
            <a className="transition-colors hover:text-[#8F4E34]" href="#beneficios">
              {t("Benefícios")}
            </a>
            <a className="transition-colors hover:text-[#8F4E34]" href="#recursos">
              {t("Recursos")}
            </a>
            <a className="transition-colors hover:text-[#8F4E34]" href="#contato">
              {t("Contato")}
            </a>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              to="/login"
              className="hidden text-sm font-medium text-stone-600 transition-colors hover:text-[#8F4E34] sm:inline-flex"
            >
              {t("Entrar")}
            </Link>
            <SalesCta message={t("Quero conhecer")} className="inline-flex items-center gap-2 rounded-full bg-[#8F4E34] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#713B27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F4E34]" />
          </div>
        </nav>
      </header>

      <section id="inicio" className="relative">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:py-24">
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#E7DFD5] bg-white/70 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8F4E34] sm:text-[11px]">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
              {t("Gestão leve para o dia a dia do salão")}
            </p>
            <h1 className="mt-6 max-w-2xl font-heading text-4xl font-medium leading-[1.12] tracking-[-0.035em] text-[#29211C] sm:text-5xl lg:text-[3.65rem]">
              {t("Seu salão merece uma gestão tão ")}
              <span className="italic text-[#8F4E34]">{t("incrível")}</span>
              {t(" quanto o atendimento.")}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
              {t("Clientes, agenda, equipe e serviços em um só lugar. Menos tempo organizando a operação — mais presença em cada atendimento.")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <SalesCta message={t("Quero conhecer")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#8F4E34] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(143,78,52,0.7)] transition hover:-translate-y-0.5 hover:bg-[#713B27] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F4E34]" />
              <a
                href="#recursos"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-stone-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8F4E34]"
              >
                {t("Conhecer os recursos")}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500 sm:text-sm">
              <span className="inline-flex items-center gap-2">
                <Check aria-hidden="true" className="h-4 w-4 text-[#477452]" />
                {t("Feito para a rotina de salões")}
              </span>
              <span className="inline-flex items-center gap-2">
                <Check aria-hidden="true" className="h-4 w-4 text-[#477452]" />
                {t("Acesso para toda a equipe")}
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#E9D7C4]/70 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 h-44 w-44 rounded-full bg-[#D8E0D3]/70 blur-3xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-[#E7DFD5] bg-white p-2 shadow-[0_24px_80px_-32px_rgba(65,46,33,0.35)]">
              <div className="relative min-h-[300px] overflow-hidden rounded-[1.3rem] sm:min-h-[410px]">
                <img
                  src="https://images.unsplash.com/photo-1626383137804-ff908d2753a2?crop=entropy&cs=srgb&fm=jpg&q=85"
                  alt={t("Ambiente acolhedor de um salão de beleza")}
                  className="absolute inset-0 h-full w-full object-cover"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-tr from-[#221C18]/45 via-transparent to-white/10" />
                <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/70 bg-[#FFFCF8]/95 p-4 shadow-xl backdrop-blur-sm sm:bottom-6 sm:left-6 sm:right-6 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500 sm:text-[10px]">
                        {t("Um dia mais organizado")}
                      </p>
                      <p className="mt-1 font-heading text-lg font-semibold text-stone-900 sm:text-xl">
                        {t("Tudo flui melhor.")}
                      </p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8F4E34]/10 text-[#8F4E34]">
                      <Heart aria-hidden="true" className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#E7DFD5] pt-4">
                    <div className="rounded-xl bg-[#F7F2EB] p-2.5 sm:p-3">
                      <UsersRound aria-hidden="true" className="h-4 w-4 text-[#8F4E34]" />
                      <p className="mt-2 text-[10px] font-medium text-stone-700 sm:text-xs">
                        {t("Clientes")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F7F2EB] p-2.5 sm:p-3">
                      <CalendarDays aria-hidden="true" className="h-4 w-4 text-[#8F4E34]" />
                      <p className="mt-2 text-[10px] font-medium text-stone-700 sm:text-xs">
                        {t("Agenda")}
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#F7F2EB] p-2.5 sm:p-3">
                      <Scissors aria-hidden="true" className="h-4 w-4 text-[#8F4E34]" />
                      <p className="mt-2 text-[10px] font-medium text-stone-700 sm:text-xs">
                        {t("Equipe")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -left-3 top-8 hidden items-center gap-2 rounded-full border border-[#E7DFD5] bg-white px-4 py-2.5 text-xs font-medium text-stone-700 shadow-lg sm:flex lg:-left-8">
              <Clock3 aria-hidden="true" className="h-4 w-4 text-[#8F4E34]" />
              {t("Mais tempo para cuidar")}
            </div>
          </div>
        </div>
      </section>

      <section id="beneficios" className="border-y border-[#E7DFD5] bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-3 md:gap-12 md:py-14">
          {[
            {
              eyebrow: "01 · Clareza",
              title: "Saiba o que acontece com cada cliente.",
              body: "Encontre informações e histórico sem depender de anotações espalhadas.",
            },
            {
              eyebrow: "02 · Ritmo",
              title: "Tenha a agenda do salão à vista.",
              body: "Acompanhe os compromissos e coordene o trabalho da equipe no mesmo lugar.",
            },
            {
              eyebrow: "03 · Cuidado",
              title: "Deixe a equipe na mesma página.",
              body: "Cada pessoa acessa o espaço do salão com seu próprio perfil e permissões.",
            },
          ].map((item) => (
            <article key={item.eyebrow} className="max-w-sm">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8F4E34]">
              {t(item.eyebrow)}
              </p>
              <h2 className="mt-3 font-heading text-xl font-semibold leading-snug text-stone-900">
                {t(item.title)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">{t(item.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="recursos" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8F4E34]">
            {t("O essencial, bem cuidado")}
          </p>
          <h2 className="mt-4 font-heading text-3xl font-medium tracking-tight text-stone-900 sm:text-4xl">
            {t("A operação do salão, mais simples.")}
          </h2>
          <p className="mt-4 text-base leading-7 text-stone-600">
            {t("Ferramentas para acompanhar o relacionamento com clientes e a rotina da equipe sem perder o toque pessoal.")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-2xl border border-[#E7DFD5] bg-white p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_-28px_rgba(65,46,33,0.4)] sm:p-7"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3ECE1] text-[#8F4E34]">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-xl font-semibold text-stone-900">{t(title)}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-500">{t(description)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#221C18] px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#8F4E34]/30 blur-3xl" />
          <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-[#B88358]/15 blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#D7A17E]">
              {t("Seu próximo passo")}
            </p>
            <h2 className="mt-4 font-heading text-3xl font-medium leading-tight text-[#FAF7F2] sm:text-4xl">
              {t("Mais organização para o salão. Mais espaço para crescer.")}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#D4C8BA] sm:text-base">
              {t("Conheça o Atelier e veja como ele pode fazer parte da rotina da sua equipe.")}
            </p>
            <SalesCta message={t("Quero conhecer")} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#FAF7F2] px-6 py-3 text-sm font-semibold text-[#713B27] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" />
            <Link
              to="/login"
              className="mt-4 block text-sm text-[#D4C8BA] underline-offset-4 transition hover:text-white hover:underline"
            >
              {t("Já tem acesso? Entrar na plataforma")}
            </Link>
          </div>
        </div>
      </section>

      <footer id="contato" className="border-t border-[#E7DFD5] bg-[#F5EFE6]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8F4E34]/10 text-[#8F4E34]">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="font-heading text-lg font-semibold text-stone-900">Atelier</p>
              <p className="text-xs text-stone-500">{t("Gestão para salões")}</p>
            </div>
          </div>
          <div className="max-w-md text-sm leading-6 text-stone-500">
            {whatsappUrl ? (
              <p>
                {t("Want to talk?")}{" "}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#8F4E34] underline-offset-4 hover:underline"
                >
                  {t("Talk to us on WhatsApp.")}
                </a>
              </p>
            ) : (
              <p>
                {t("We are preparing our sales support. Once WhatsApp is configured, you can request a product walkthrough here.")}
              </p>
            )}
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-[#8F4E34]"
          >
            {t("Acessar plataforma")}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
        <p className="border-t border-[#E7DFD5] px-5 py-4 text-center text-xs text-stone-400">
          © {new Date().getFullYear()} Atelier. {t("Made to care for every detail.")}
        </p>
      </footer>
    </main>
  );
}
