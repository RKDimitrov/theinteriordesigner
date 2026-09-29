import type { FixtureKind } from "@/domain/room/fixtures";
import type { WindowTreatment } from "@/domain/schemas/room";
import type { ModelVariant } from "./assets";

/*
 * Real models for kitchen and bathroom fixtures, lights, switches and window
 * treatments (asset pipeline; most are Sketchfab CC-BY, credited on /credits).
 * `turn` rotates a model so its front faces +z, measured from orthographic
 * renders of each model (phase B2 spec).
 */

/** Models a fixture can use; the first is the default, the user can pick another. */
export const FIXTURE_MODELS: Readonly<Record<Exclude<FixtureKind, "kitchen_run">, readonly [ModelVariant, ...ModelVariant[]]>> = {
  fridge: [{ id: "fridge_grey_glowbox" }, { id: "kitchen_fridge_mora" }],
  wc: [{ id: "toilet_hippostance" }],
  basin: [{ id: "vanity_blendffnike" }, { id: "basin_stand_renviro" }],
  shower: [{ id: "shower_enclosure_binhnham" }],
  bathtub: [{ id: "bathtub_3ddominator" }, { id: "bathtub_igrium" }],
  pendant: [{ id: "modern_ceiling_lamp_01" }, { id: "hanging_industrial_lamp" }],
  chandelier: [{ id: "chandelier_02" }, { id: "lantern_chandelier_01" }],
};

/** Units a kitchen run is tiled from (Mora's "Kitchen Modular" set), plus the hood. */
export const KITCHEN_UNITS = {
  base: { id: "kitchen_base_mora" },
  sink: { id: "kitchen_sink_mora", turn: 90 },
  cooker: { id: "kitchen_stove_mora" },
  wall: { id: "kitchen_wall_mora" },
  hood: { id: "hood_chimney_ge", turn: -90 },
} as const satisfies Record<string, ModelVariant>;

/** Window treatments with a real model; roller blinds are built in code (no usable model found). */
export const TREATMENT_MODELS: Readonly<Partial<Record<WindowTreatment["kind"], readonly [ModelVariant, ...ModelVariant[]]>>> = {
  curtains: [{ id: "curtains_communicationnode" }, { id: "curtain_milaink" }],
  venetian: [{ id: "blinds_venetian_akstudio", turn: -90 }],
};

export const SWITCH_MODEL: ModelVariant = { id: "switch_avot", turn: -90 };

/** The chosen model if it belongs to the fixture's kind, else the default. */
export function fixtureModel(kind: Exclude<FixtureKind, "kitchen_run">, chosen: string | undefined): ModelVariant {
  const list = FIXTURE_MODELS[kind];
  return list.find((v) => v.id === chosen) ?? list[0];
}
