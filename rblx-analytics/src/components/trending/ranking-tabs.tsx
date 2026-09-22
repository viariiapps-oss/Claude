"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function RankingTabs({ initial, tabs }: { initial: string; tabs: { value: string; label: string; content: ReactNode }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Tabs defaultValue={initial} onValueChange={(v) => router.replace(`${pathname}?tab=${v}`, { scroll: false })}>
      <TabsList aria-label="Rankings">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
