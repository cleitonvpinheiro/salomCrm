import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";

interface AppShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

// Warm editorial shell: espresso sidebar + parchment top bar over a grain-washed scroll area.
export default function AppShell({ title, subtitle, actions, children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 overflow-y-auto bg-grain" data-testid="main-scroll-region">
          {children}
        </main>
      </div>
    </div>
  );
}
