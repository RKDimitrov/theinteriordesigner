import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { chromium, type Page } from "@playwright/test";
import sharp from "sharp";
import { assetPaths } from "../../src/domain/assets/catalogue.ts";
import { MODEL_TUNING } from "../../src/domain/assets/model-tuning.ts";
import { fitDistance, RENDER_VIEW, viewDirection } from "./framing.ts";
import { PUBLIC, ROOT, writeFile } from "./io.ts";

/*
 * Catalogue pictures: every furniture model photographed the same way (one
 * camera angle, one light, a clear background) in headless Chrome with
 * three.js, so the cards look like a set whatever the source's own preview
 * showed. Written to public/renders/<id>.webp.
 */

/** Rendered at twice the size it is saved at, which smooths the edges. */
const RENDER_PX = 768;
const SAVED_PX = 384;
const MARGIN = 0.08;
const ORIGIN = "http://render.local";
const THREE_DIR = join(ROOT, "node_modules", "three");
const TYPES: Record<string, string> = { ".js": "text/javascript", ".glb": "model/gltf-binary", ".html": "text/html" };

/** The studio: a neutral room light, one key light and a soft shadow under the piece. */
const PAGE = `<!doctype html>
<script type="importmap">{ "imports": { "three": "/three/build/three.module.js", "three/addons/": "/three/examples/jsm/" } }</script>
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(${RENDER_PX}, ${RENDER_PX});
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.NeutralToneMapping;
// A little under-exposed, so white pieces keep their shape on a pale card.
renderer.toneMappingExposure = 0.85;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.8;
const key = new THREE.DirectionalLight(0xfff4e2, 1.4);
// Nearly overhead, so the shadow stays under the piece and inside the picture.
key.position.set(-0.35, 4, 0.6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 10;
key.shadow.blurSamples = 24;
Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.1, far: 10 });
key.shadow.bias = -0.0005;
scene.add(key);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.16 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let current = null;

// Loads a model standing on the ground, centred, its longest side 1 unit; returns its size [w, h, d].
window.loadModel = async (url, turnDeg) => {
  if (current) scene.remove(current);
  const gltf = await loader.loadAsync(url);
  const object = gltf.scene;
  object.rotation.y = (turnDeg * Math.PI) / 180;
  current = new THREE.Group();
  current.add(object);
  current.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  object.position.set(-centre.x, -box.min.y, -centre.z);
  const k = 1 / Math.max(size.x, size.y, size.z);
  current.scale.setScalar(k);
  current.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(current);
  return [size.x * k, size.y * k, size.z * k];
};

// Photographs the loaded model from dir at distance, looking at its centre; returns a PNG data URL.
window.shoot = async (height, dir, distance, fov) => {
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 50);
  const target = new THREE.Vector3(0, height / 2, 0);
  camera.position.set(dir[0], dir[1], dir[2]).multiplyScalar(distance).add(target);
  camera.lookAt(target);
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL("image/png");
};
window.ready = true;
</script>`;

interface StudioWindow {
  loadModel: (url: string, turnDeg: number) => Promise<[number, number, number]>;
  shoot: (height: number, dir: readonly [number, number, number], distance: number, fov: number) => Promise<string>;
}

function fileFor(pathname: string): string | null {
  const under = (base: string, rest: string) => {
    const path = normalize(join(base, rest));
    return path.startsWith(base) ? path : null;
  };
  if (pathname.startsWith("/three/")) return under(THREE_DIR, pathname.slice(7));
  if (pathname.startsWith("/models/")) return under(join(PUBLIC, "models"), pathname.slice(8));
  return null;
}

async function studio(): Promise<{ page: Page; close: () => Promise<void> }> {
  const browser = await chromium.launch({
    channel: process.env["E2E_BROWSER_CHANNEL"] || undefined,
    // Without these, headless Chrome draws WebGL on the CPU. On Windows ANGLE's default (Direct3D) is
    // already the graphics card, and its OpenGL backend fails to link three's shaders on some drivers.
    args: ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "win32" ? [] : ["--use-angle=gl"])],
  });
  const page = await browser.newPage({ viewport: { width: RENDER_PX, height: RENDER_PX } });
  page.on("pageerror", (e) => console.error(`render page: ${e.message}`));
  await page.route(`${ORIGIN}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname === "/") return route.fulfill({ contentType: TYPES[".html"]!, body: PAGE });
    const file = fileFor(pathname);
    try {
      return route.fulfill({ contentType: TYPES[extname(pathname)] ?? "application/octet-stream", body: readFileSync(file!) });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction("window.ready === true", undefined, { timeout: 30_000 });
  return { page, close: () => browser.close() };
}

/** Renders the pictures of `ids`; returns the ids that failed. */
export async function renderModels(ids: readonly string[], log: (line: string) => void): Promise<string[]> {
  if (ids.length === 0) return [];
  const { page, close } = await studio();
  const failed: string[] = [];
  const dir = viewDirection(RENDER_VIEW);
  try {
    for (const id of ids) {
      try {
        const size = await page.evaluate(([url, turn]) => (window as unknown as StudioWindow).loadModel(url, turn), [assetPaths.model(id), MODEL_TUNING[id]?.turn ?? 0] as const);
        const distance = fitDistance(size, RENDER_VIEW, MARGIN);
        const png = await page.evaluate(([h, d, dist, fov]) => (window as unknown as StudioWindow).shoot(h, d, dist, fov), [size[1], dir, distance, RENDER_VIEW.fovDeg] as const);
        const shot = Buffer.from(png.split(",")[1]!, "base64");
        // A lost WebGL context draws nothing and reports no error.
        if ((await sharp(shot).stats()).channels[3]?.max === 0) throw new Error("the picture is empty");
        const webp = await sharp(shot).resize(SAVED_PX, SAVED_PX).webp({ quality: 84, alphaQuality: 90 }).toBuffer();
        writeFile(join(PUBLIC, assetPaths.render(id)), webp);
        log(`rendered ${id}`);
      } catch (err) {
        failed.push(id);
        log(`FAILED render ${id}: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`);
      }
    }
  } finally {
    await close();
  }
  return failed;
}
