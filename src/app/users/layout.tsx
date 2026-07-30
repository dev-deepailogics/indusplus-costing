import Image from "next/image";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background/80 px-6 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
          <SidebarTrigger className="rounded-md" />
          <Separator orientation="vertical" className="h-5" />
          <Image src="/logo-icon.png" alt="" width={22} height={22} className="hidden sm:block" />
          <span className="text-sm font-medium text-muted-foreground">Manage Users</span>
        </header>
        <main className="flex-1 overflow-auto bg-muted/20 p-6 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
