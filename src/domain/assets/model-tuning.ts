/**
 * Per-model settings the catalogue cannot know: the turn that makes its
 * front face +z (checked by rendering each model), and which of its
 * materials are upholstery, tinted to the piece's colour.
 *
 * Imported by scripts/assets with a relative path, so keep it free of `@/`.
 */
export const MODEL_TUNING: Readonly<Record<string, { turn?: number; fabric?: RegExp }>> = {
  // Modelled with its long side front to back.
  modern_coffee_table_01: { turn: 90 },
  modern_arm_chair_01: { fabric: /pillow/ },
  wooden_display_shelves_01: { turn: 90 },
  bed_v1_mh: { turn: 180, fabric: /^Fabric/ },
  bed_poliform_ramos: { fabric: /edredon/ },
  dresser_sifonyer_renend: { turn: 90 },
  office_chair_redfox: { fabric: /Cloth/ },
  sideboard_teak_kung: { turn: 270 },
  tv_unit_wood_slls: { turn: 270 },
  bench_wooden_stano: { turn: 90 },
  wall_shelf_simple_blender3d: { turn: 90 },
  glam_velvet_sofa: { fabric: /fabric/ },
  sheen_chair: { fabric: /^fabric/ },
};
