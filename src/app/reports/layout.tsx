import Image from "next/image";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeColorToggle } from "@/components/theme-color-toggle";

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b bg-background/80 px-3 sm:px-6 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="rounded-md" />
            <Separator orientation="vertical" className="h-5" />
            <Image src="/logo-icon.png" alt="" width={22} height={22} className="hidden sm:block" />
            <span className="text-sm font-medium text-muted-foreground">Reports & Analytics Hub</span>
          </div>
          <ThemeColorToggle />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-muted/20 p-3 sm:p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
