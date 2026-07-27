import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-muted/20 px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <Image src="/logo-icon.png" alt="Indus Plus" width={72} height={72} priority />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Indus Plus Costing</h1>
          <p className="text-sm text-muted-foreground">
            Manage costing parameters shared across the team.
          </p>
        </div>
        <Button
          size="lg"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/parameters" />}
        >
          Open POC Parameters
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
