import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeColorToggle } from "@/components/theme-color-toggle";

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur-sm">
          <SidebarTrigger className="rounded-md" />
          <ThemeColorToggle />
        </header>
        <main className="flex-1 overflow-auto bg-muted/20 p-3 sm:p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
