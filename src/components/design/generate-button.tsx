"use client";

import { useTranslations } from "next-intl";
import { createContext, type ReactNode, use, useState, useTransition } from "react";
import { toast } from "sonner";
import { DEV_TOOLS, FillSampleButton } from "@/components/dev/fill-sample-button";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type DesignEvent, parseEvents } from "@/lib/design-events";
import { cn } from "@/lib/utils";
import { insertSampleDesignAction, resolveLayoutAction } from "@/server/actions/design";

type Progress = Extract<DesignEvent, { type: "progress" }>;

interface GenerateState {
  apartmentId: string;
  roomId: string;
  hasDesign: boolean;
  running: boolean;
  pending: boolean;
  progress: Progress | null;
  generate: (extra?: GenerateExtra) => Promise<void>;
  runAction: (fn: () => Promise<{ ok: true; data: { version: number } } | { ok: false; error: string }>) => void;
}

/** Planner extras: a change request and whether to keep hand-placed pieces. */
export interface GenerateExtra {
  note?: string;
  keepPlaced?: boolean;
}

const GenerateContext = createContext<GenerateState | null>(null);

export function useGenerate(): GenerateState {
  const ctx = use(GenerateContext);
  if (!ctx) throw new Error("GenerateButton needs a GenerateProvider");
  return ctx;
}

/** Holds the generation stream so the button and the progress panel can live apart. */
export function GenerateProvider({
  apartmentId,
  roomId,
  hasDesign,
  onDone,
  children,
}: {
  apartmentId: string;
  roomId: string;
  hasDesign: boolean;
  /** Replaces the default "reload this page" when a version is saved. */
  onDone?: (version: number) => void;
  children: ReactNode;
}) {
  const t = useTranslations("Design");
  const router = useRouter();
  const pathname = usePathname();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();

  const finish = (version: number) => {
    toast.success(t("done", { version }));
    if (onDone) return onDone(version);
    router.replace(pathname);
    router.refresh();
  };

  const generate = async (extra?: GenerateExtra) => {
    setRunning(true);
    setProgress(null);
    try {
      const res = await fetch("/api/design/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apartmentId, roomId, ...extra }),
      });
      if (!res.ok || !res.body) {
        const body: unknown = await res.json().catch(() => null);
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : `HTTP ${res.status}`;
        toast.error(message);
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const { events, rest } = parseEvents(buffer + value);
        buffer = rest;
        for (const e of events) {
          if (e.type === "progress") setProgress(e);
          else if (e.type === "done") finish(e.version);
          else toast.error(e.message);
        }
      }
    } catch {
      toast.error(t("connectionLost"));
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const runAction: GenerateState["runAction"] = (fn) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      finish(r.data.version);
    });

  return (
    <GenerateContext value={{ apartmentId, roomId, hasDesign, running, pending, progress, generate, runAction }}>{children}</GenerateContext>
  );
}

/** Primary action, plus the dev-only sample and re-solve buttons. */
export function GenerateButton() {
  const t = useTranslations("Design");
  const { apartmentId, roomId, hasDesign, running, pending, generate, runAction } = useGenerate();
  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <FillSampleButton
        label={t("insertSample")}
        disabled={running || pending}
        onFill={(n) => runAction(() => insertSampleDesignAction({ apartmentId, roomId, preset: n }))}
      />
      {DEV_TOOLS && hasDesign && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          disabled={running || pending}
          data-testid="resolve-layout"
          onClick={() => runAction(() => resolveLayoutAction({ apartmentId, roomId }))}
        >
          {t("resolveLayout")}
        </Button>
      )}
      <Button type="button" onClick={() => void generate()} disabled={running || pending} data-testid="generate-design">
        {running ? t("generating") : hasDesign ? t("regenerate") : t("generate")} <span aria-hidden>✦</span>
      </Button>
    </div>
  );
}

/** Stages in display order; the v1 stage names map onto them. */
const STAGES = ["context", "designing", "placing", "checking", "fixing"] as const;
type Stage = (typeof STAGES)[number];
const STAGE_OF: Record<Progress["stage"], Stage> = {
  context: "context",
  designing: "designing",
  generating: "designing",
  writing: "designing",
  placing: "placing",
  checking: "checking",
  validating: "checking",
  fixing: "fixing",
  repairing: "fixing",
};

/** Progress panel while generating; otherwise the cost note. */
export function GenerateProgress({ compact = false }: { compact?: boolean } = {}) {
  const t = useTranslations("Design");
  const { running, progress } = useGenerate();

  if (!running) return compact ? null : <p className="mb-6 max-w-prose text-[12.5px] text-muted-foreground">{t("costNote")}</p>;

  const current = STAGE_OF[progress?.stage ?? "context"];
  const at = STAGES.indexOf(current);

  const label = (p: Progress | null, stage: Stage): string => {
    if (!p || STAGE_OF[p.stage] !== stage) return t(`stageShort_${stage}`);
    switch (p.stage) {
      case "context":
        return t("stage_context");
      case "designing":
        return p.chars === undefined ? t("stage_designing") : t("stage_writing", { chars: p.chars });
      case "generating":
        return t("stage_generating");
      case "writing":
        return t("stage_writing", { chars: p.chars ?? 0 });
      case "placing":
        return t("stage_placing");
      case "checking":
      case "validating":
        return p.errors === undefined ? t("stage_validating") : t("stage_validated", { errors: p.errors, warnings: p.warnings ?? 0 });
      case "fixing":
        return t("stage_fixing", { attempt: p.attempt, max: (p.maxAttempts ?? 2) - 1 });
      case "repairing":
        return t("stage_repairing", { attempt: p.attempt, max: (p.maxAttempts ?? 4) - 1 });
    }
  };

  return (
    <section data-testid="generate-progress" role="status" aria-live="polite" className={cn("border-[1.5px] border-foreground bg-card px-4 py-3.5", compact ? "" : "mb-7")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-heading text-[26px] leading-none font-normal">{t("progressTitle")}</h2>
        <span className="eyebrow">{t("progressCost")}</span>
      </div>
      <div className="relative mt-2.5 mb-1.5 h-2 overflow-hidden border border-foreground">
        <span
          className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,var(--clay)_0_6px,#e0a078_6px_12px)] transition-[width] duration-500"
          style={{ width: `${Math.round(((at + 0.5) / STAGES.length) * 100)}%` }}
        />
      </div>
      <ol className="font-mono text-xs leading-[1.9]">
        {STAGES.map((s, i) => (
          <li key={s} className={cn(i < at ? "text-olive" : i === at ? "text-foreground" : "text-muted-foreground")}>
            <span aria-hidden>{i < at ? "✓ " : i === at ? "→ " : ""}</span>
            {label(progress, s)}
          </li>
        ))}
      </ol>
    </section>
  );
}
