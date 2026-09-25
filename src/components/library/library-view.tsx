"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { MarginNote } from "@/components/atelier/sidebar";
import { AddTile, TapedCard } from "@/components/atelier/sheet-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { LibraryData, LibraryPiece, PieceGroup } from "@/server/library";

const GROUP_FILTERS = ["seating", "tables", "storage", "lighting", "textiles"] as const satisfies readonly PieceGroup[];
type Filter = (typeof GROUP_FILTERS)[number] | "mine" | "renter";

const eur = (n: number) => new Intl.NumberFormat("en", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Striped placeholder tinted with the piece colour, until there are product photos. */
function Placeholder({ hex, label, className }: { hex: string | null; label: string; className?: string }) {
  return (
    <div
      className={cn("flex items-end px-3 py-2.5 font-mono text-[11px] leading-[1.3] font-medium text-[#5a4f45]", className)}
      style={{
        backgroundColor: "#e8dcc6",
        backgroundImage: `repeating-linear-gradient(135deg, rgba(43,38,34,.07) 0 6px, transparent 6px 12px)${hex ? `, linear-gradient(${hex}55, ${hex}55)` : ""}`,
      }}
    >
      <span className="bg-card/80 px-1.5 py-0.5 uppercase">{label}</span>
    </div>
  );
}

export function LibraryView({ data }: { data: LibraryData }) {
  const t = useTranslations("Library");
  const [filters, setFilters] = useState<ReadonlySet<Filter>>(new Set());

  const toggle = (f: Filter) =>
    setFilters((cur) => {
      const next = new Set(cur);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  const groups = GROUP_FILTERS.filter((g) => filters.has(g));
  const pieces = data.pieces
    .filter((p) => groups.length === 0 || groups.includes(p.group as (typeof GROUP_FILTERS)[number]))
    .filter((p) => !filters.has("mine") || p.mine)
    .filter((p) => !filters.has("renter") || p.renterFriendly)
    .sort((a, b) => Number(b.mine) - Number(a.mine));

  const chip = (on: boolean) =>
    cn(
      "border border-foreground px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.06em] uppercase transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      on ? "bg-foreground text-background" : "hover:bg-secondary"
    );

  return (
    <Tabs defaultValue="furniture">
      <TabsList variant="folder">
        <TabsTrigger value="furniture">{t("furniture")}</TabsTrigger>
        <TabsTrigger value="materials">{t("materials")}</TabsTrigger>
      </TabsList>

      <TabsContent value="furniture" className="pt-2">
        <div role="group" aria-label={t("filters")} className="mb-6 flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={filters.size === 0} onClick={() => setFilters(new Set())} className={chip(filters.size === 0)}>
            {t("all")}
          </button>
          {([...GROUP_FILTERS, "mine", "renter"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filters.has(f)} onClick={() => toggle(f)} className={chip(filters.has(f))}>
              {t(`filter_${f}`)}
            </button>
          ))}
          <span className="eyebrow ml-auto">{t("count", { count: pieces.length })}</span>
        </div>

        {data.pieces.length === 0 && <MarginNote>{t("empty")}</MarginNote>}
        <ul className="sheet-grid [grid-template-columns:repeat(auto-fill,minmax(min(240px,100%),1fr))]">
          {pieces.map((p) => (
            <PieceCard key={p.key} piece={p} />
          ))}
          {data.addOwnHref && (
            <li>
              <AddTile href={data.addOwnHref} className="h-full">
                {t("addOwn")}
              </AddTile>
            </li>
          )}
        </ul>
      </TabsContent>

      <TabsContent value="materials" className="pt-2">
        {data.materials.length === 0 ? (
          <MarginNote>{t("emptyMaterials")}</MarginNote>
        ) : (
          <ul className="sheet-grid [grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr))]">
            {data.materials.map((m) => (
              <TapedCard as="li" key={m.key}>
                <div className="relative h-[150px] border-b border-border" style={{ background: m.hex }}>
                  <span className="absolute top-2.5 right-2.5 border border-foreground bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase">
                    {m.kind === "surface" ? t(`surface_${m.tag}`) : t(`role_${m.tag}`)}
                  </span>
                </div>
                <div className="px-3.5 pt-3 pb-3.5">
                  <h3 className="font-heading text-2xl leading-[1.1]">{m.name}</h3>
                  <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">
                    {m.hex.toUpperCase()} · {m.detail}
                  </p>
                  <Link href={m.href} className="mt-2 inline-block font-mono text-[11.5px] underline underline-offset-3 hover:text-primary">
                    {m.where} <span aria-hidden>→</span>
                  </Link>
                </div>
              </TapedCard>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}

function PieceCard({ piece: p }: { piece: LibraryPiece }) {
  const t = useTranslations("Library");
  const tc = useTranslations("FurnitureCategory");
  const kindLabel = p.kind.type === "light" ? t("light") : p.kind.type === "furniture" ? tc(p.kind.category) : t(`textile_${p.kind.textile}`);
  return (
    <TapedCard as="li">
      <Placeholder hex={p.colorHex} label={kindLabel} className="h-[170px] border-b border-line" />
      <div className="flex flex-1 flex-col px-3.5 pt-3 pb-3.5">
        <h3 className="font-heading text-2xl leading-[1.1]">{p.name}</h3>
        <p className="mt-1 mb-2.5 font-mono text-[11.5px] text-muted-foreground">
          {p.dims ? t("dims", { w: p.dims.w, d: p.dims.d, h: p.dims.h ?? 0 }) : kindLabel}
          {p.tier && ` · ${t(`tier_${p.tier}`)}`}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {p.mine ? (
            <span className="flex items-center gap-2">
              <Badge variant="olive">{t("mine")}</Badge>
              <span className="font-mono text-[13px] text-muted-foreground">{t("owned")}</span>
            </span>
          ) : (
            <span className="font-mono text-[15px] font-medium tabular-nums">{p.price ? `${eur(p.price.min)}–${eur(p.price.max)}` : "—"}</span>
          )}
          <Link href={p.href} className="font-mono text-[11.5px] underline underline-offset-3 hover:text-primary">
            {p.where} <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </TapedCard>
  );
}
