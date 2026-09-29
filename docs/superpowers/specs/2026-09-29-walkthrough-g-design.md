# Walkthrough polish (phase G)

Status: built and checked in the running app, 2026-09-29.

## Motion (`src/domain/planner/walk-motion.ts`, unit tested)

- **Speed:** eases up and down with `approach`, a frame-rate independent exponential ease (rate 9 per second), so the walker no longer starts and stops dead. Sliding along a wall keeps the free axis moving.
- **Gaze:** follows the mouse through the same ease (rate 16). It turns the short way round (`shortestTurn`), which smooths mouse jitter without lag you can feel.
- **Eye height:** standing is 165 cm and sitting 115 cm. The "Sit" / "Stand" button, or the C key, switches between them, and the eye eases to the new height.

## Click a window to go there

- Windows in the 3D scene carry `userData.walkWindow`.
- A click in the walkthrough casts a ray through the pointer; with the pointer locked, the ray goes through the crosshair instead. A drag to look around does not count as a click.
- If the nearest thing hit is part of a window (frame, glass or curtain), `windowSpot` (unit tested) finds the spot to stand. It is in front of the window's middle, ideally 70 cm away, but moves nearer or further when furniture is in the way. At that spot the walker faces out.
- The walker glides there over 1.1 s with ease-in-out, turning the short way. Any movement key cancels the glide.

## Saved viewpoints

`SavedView` gains two optional fields, so views saved before still load:

- **`light`:** the hour, the lamp colour and the rooms switched by hand.
- **`walk`:** position, gaze and eye height.

Saving:

- Views saved from the camera panel store the light.
- The walkthrough has its own "Save this view" button, which also stores the walk spot.

Restoring uses the `apply-view` action (unit tested in `state.test.ts`):

- It sets the camera, the time of day and the lights.
- For a walk view, it reopens the walkthrough at that spot, seated or standing as saved.

The list shows "Walkthrough · eye 115 cm" and the saved hour.

## Photos while walking

The walkthrough bar has the Photo button. It uses the same progressive capture as the overview (twice the pixel density, 8 jittered frames), from the walker's eye.

## Keys

On desktop the pointer is locked while walking, so the bar's buttons are out of reach, and Esc releases the lock and ends the walk. Each button therefore has a key:

- C: sit or stand.
- V: save the view.
- P: take a photo.

The key handler binds once per walk and calls the latest callbacks through a ref, so a second saved view does not overwrite the first.

## Testing

Headless Chrome renders WebGL with SwiftShader (on the CPU), where the planner runs at about 1 frame a second, so 3D screenshots time out. Set `E2E_GPU=1` to launch Chrome with `--enable-gpu --ignore-gpu-blocklist --use-angle=gl`, which renders on the graphics card at 60 frames a second.

A synthetic Esc from Playwright does not release a pointer lock. Tests end a locked walk with `document.exitPointerLock()`.
