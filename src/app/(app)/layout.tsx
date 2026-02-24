import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const displayName = user.email?.split("@")[0] ?? "";

  return (
    <TooltipProvider>
      <div className="h-screen w-full bg-[#0a0a0a] flex">
        <Sidebar userEmail={user.email ?? ""} displayName={displayName} />

        {/* Main content — offset by sidebar width on desktop */}
        <div className="flex-1 flex flex-col min-h-0 lg:pl-16">
          <div className="flex-1 flex flex-col min-h-0 lg:p-[5px] gap-[5px]">

            {/* Floating header */}
            <header className="flex h-[50px] shrink-0 items-center px-4 lg:px-5 bg-card lg:rounded-[6px] border-b border-border lg:border-0"
              style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.3)" }}>
              {/* Spacer for mobile hamburger */}
              <div className="w-10 lg:hidden" />
              <div className="flex-1" />
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </header>

            {/* Floating content area */}
            <main className="flex-1 min-h-0 overflow-auto bg-[#11141e] lg:rounded-[6px]"
              style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.3)" }}>
              <div className="p-4 lg:p-6">
                {children}
              </div>
            </main>

          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
