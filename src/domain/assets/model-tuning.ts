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
  wardrobe_antique_matejbiskup97: { turn: 90 },
  wardrobe_soviet_old_skilletik: { turn: 90 },
  desk_antique_wooden_lorenzo_drago: { turn: 90 },
  mirror_stand_jones_studio: { turn: 90 },
  art_fancy_picture_frame_jamie_mcfarlane: { turn: 90 },
  tv_unit_modern_minimalist_media_console_viksell: { turn: 90 },
  dresser_antique_darren_mcnerney: { turn: 90 },
  bench_church_sololopenko: { turn: 90 },
  wall_shelf_ikea_fja_llbo_lowkenen: { turn: 90 },
  coat_rack_wall_mounted_logan_s: { turn: 90 },
  sideboard_brutalist_console_02_sketch_studio: { turn: 270 },
  mirror_art_deco_ardocast: { turn: 180 },
  nightstand_bedside_andrea_digital_mhc: { turn: 180 },
  bed_01_5th_dimension: { turn: 270 },
  armchair_366_hectopod: { turn: 90 },
  coffee_table_mid_century_emperador_calebkung: { turn: 90 },
  dining_table_antique_wooden_gulerbrkn: { turn: 90 },
  coffee_table_modern_circular_glass_metal_lborion: { turn: 90 },
  dining_table_old_wooden_coozy: { turn: 90 },
  dining_table_silver10211: { turn: 90 },
  dining_table_wooden_j0y: { turn: 90 },
};
