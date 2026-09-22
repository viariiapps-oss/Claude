"use client";

import { Loader2, LogIn, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { addGameAction, loginAction, refreshGameAction, removeGameAction, runTierAction, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

function useResultToast(state: ActionResult | null) {
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  useResultToast(state && !state.ok ? state : null);
  return (
    <form action={action} className="space-y-3">
      <div>
        <Label htmlFor="password">Admin password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={200} />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : <LogIn />} Sign in
      </Button>
      {state && !state.ok && <p role="alert" className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}

export function AddGameForm() {
  const [state, action, pending] = useActionState(addGameAction, null);
  useResultToast(state);
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <Input name="game" placeholder="Place ID or roblox.com/games/… URL" aria-label="Game to add" required maxLength={300} className="h-10" />
      <Button type="submit" disabled={pending} className="shrink-0">
        {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add game
      </Button>
    </form>
  );
}

export function TierButtons() {
  const [pending, start] = useTransition();
  const run = (tier: "realtime" | "hourly" | "daily") =>
    start(async () => {
      const toastId = toast.loading(`Running ${tier} refresh…`);
      const r = await runTierAction(tier).catch((e: Error) => ({ ok: false, message: e.message }));
      if (r.ok) toast.success(r.message, { id: toastId });
      else toast.error(r.message, { id: toastId });
    });
  return (
    <div className="flex flex-wrap gap-2">
      {(["realtime", "hourly", "daily"] as const).map((t) => (
        <Button key={t} variant="secondary" size="sm" disabled={pending} onClick={() => run(t)}>
          <RefreshCw className={pending ? "animate-spin" : ""} /> Force {t}
        </Button>
      ))}
    </div>
  );
}

export function GameRowActions({ universeId, name }: { universeId: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Refresh ${name}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await refreshGameAction(universeId);
            if (r.ok) toast.success(`${name}: ${r.message}`);
            else toast.error(`${name}: ${r.message}`);
          })
        }
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${name}`}
        disabled={pending}
        onClick={() => {
          if (!confirm(`Stop tracking “${name}” and delete its stored history?`)) return;
          start(async () => {
            const r = await removeGameAction(universeId);
            if (r.ok) toast.success(r.message);
            else toast.error(r.message);
          });
        }}
      >
        <Trash2 className="text-danger" />
      </Button>
    </div>
  );
}
