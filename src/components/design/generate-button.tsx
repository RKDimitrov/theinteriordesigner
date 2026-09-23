"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { DEV_TOOLS, FillSampleButton } from "@/components/dev/fill-sample-button";
import { Button } from "@/components/ui/button";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type DesignEvent, parseEvents } from "@/lib/design-events";
import { insertSampleDesignAction, resolveLayoutAction } from "@/server/actions/design";

type Progress = Extract<DesignEvent, { type: "progress" }>;

export function GenerateButton({ apartmentId, roomId, hasDesign }: { apartmentId: string; roomId: string; hasDesign: boolean }) {
  const t = useTranslations("Design");
  const router = useRouter();
  const pathname = usePathname();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [pending, startTransition] = useTransition();

  const finish = (version: number) => {
    toast.success(t("done", { version }));
    router.replace(pathname);
    router.refresh();
  };

  const generate = async () => {
    setRunning(true);
    setProgress(null);
    try {
      const res = await fetch("/api/design/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apartmentId, roomId }),
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
      toast.error("Connection lost. If the design finished, reload the page.");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  const label = (p: Progress): string => {
    switch (p.stage) {
      case "context":
        return t("stage_context");
      case "designing":
        return p.chars === undefined ? t("stage_designing") : t("stage_writing", { chars: p.chars });
      case "placing":
        return t("stage_placing");
      case "checking":
        return p.errors === undefined ? t("stage_validating") : t("stage_validated", { errors: p.errors, warnings: p.warnings ?? 0 });
      case "fixing":
        return t("stage_fixing", { attempt: p.attempt, max: (p.maxAttempts ?? 2) - 1 });
      case "generating":
        return t("stage_generating");
      case "writing":
        return t("stage_writing", { chars: p.chars ?? 0 });
      case "validating":
        return p.errors === undefined ? t("stage_validating") : t("stage_validated", { errors: p.errors, warnings: p.warnings ?? 0 });
      case "repairing":
        return t("stage_repairing", { attempt: p.attempt, max: (p.maxAttempts ?? 4) - 1 });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={generate} disabled={running || pending} data-testid="generate-design">
          {running ? t("generating") : hasDesign ? t("regenerate") : t("generate")}
        </Button>
        <FillSampleButton
          label={t("insertSample")}
          disabled={running || pending}
          onFill={(n) =>
            startTransition(async () => {
              const r = await insertSampleDesignAction({ apartmentId, roomId, preset: n });
              if (!r.ok) return void toast.error(r.error);
              finish(r.data.version);
            })
          }
        />
        {DEV_TOOLS && hasDesign && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-dashed"
            disabled={running || pending}
            data-testid="resolve-layout"
            onClick={() =>
              startTransition(async () => {
                const r = await resolveLayoutAction({ apartmentId, roomId });
                if (!r.ok) return void toast.error(r.error);
                finish(r.data.version);
              })
            }
          >
            {t("resolveLayout")}
          </Button>
        )}
      </div>
      {running && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite" data-testid="generate-progress">
          {progress ? label(progress) : t("stage_context")}
        </p>
      )}
      {!running && <p className="text-xs text-muted-foreground">{t("costNote")}</p>}
    </div>
  );
}
