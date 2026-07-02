# Bloom AR Mobile Reverse Engineering

## Current Product Shape

Bloom AR is a camera-first AR web app. It renders a mirrored webcam feed, runs MediaPipe hand landmark detection on each video frame, projects hand landmarks into a Three.js scene, recognizes gestures, and draws holographic flowers, particles, butterflies, and HUD overlays on top of the live camera.

The fastest mobile application path is a mobile-first PWA/WebView app because the current implementation depends heavily on browser APIs:

- `navigator.mediaDevices.getUserMedia`
- `HTMLVideoElement`
- MediaPipe Tasks Vision WASM
- React Three Fiber DOM canvas
- CSS overlay layout

A full React Native/Expo port is possible, but it would require replacing the camera, video frame pipeline, MediaPipe runtime, and WebGL renderer integration.

## Runtime Flow

1. `src/main.tsx` mounts `<App />`.
2. `App` loads the hand tracking model through `useHandTracking`.
3. `WebcamFeed` requests the selfie camera and passes the ready `HTMLVideoElement` back to `App`.
4. `SceneCanvas` renders a transparent React Three Fiber canvas over the camera feed.
5. `SceneCanvas` calls `detectHands(video, timestamp)` inside `useFrame`.
6. `useSmoothedHandData` converts MediaPipe landmarks into Three.js world coordinates, smooths them, and classifies gestures.
7. `SceneCanvas` uses gesture state to coordinate hand sculptures, flowers, particle bursts, butterfly targets, physics colliders, and HUD updates.
8. `GestureHUD` renders the current user-facing gesture state.

## Component Inventory

### `src/App.tsx`

Role: App shell and orchestration layer.

Responsibilities:

- Holds the active camera `HTMLVideoElement`.
- Loads MediaPipe through `useHandTracking`.
- Tracks camera/model errors.
- Reads active gestures from the shared creative engine store for the HUD.
- Renders camera, 3D scene, header, status panel, HUD, loading/error overlays, and gesture lexicon footer.

Mobile notes:

- Keep as the top-level shell for PWA/WebView.
- For React Native, split the state machine from DOM markup and replace all HTML/CSS overlay elements with native `View`/`Text` components.
- The footer lexicon is too large for small screens and should become a drawer, bottom sheet, or compact help button in a native app.

### `src/components/WebcamFeed.tsx`

Role: Browser camera layer.

Responsibilities:

- Requests camera access with `getUserMedia`.
- Uses the front-facing camera with `facingMode: 'user'`.
- Attaches the camera stream to a hidden/covered `<video>`.
- Mirrors the preview with CSS.
- Stops tracks on unmount.

Mobile notes:

- Works in mobile browsers only on secure origins: HTTPS or localhost.
- iOS requires `playsInline`, already present.
- Native port replacement: `expo-camera` or `react-native-vision-camera`.
- The downstream hand detector currently requires an `HTMLVideoElement`; React Native would need a frame processor or a WebView bridge.

### `src/components/SceneCanvas.tsx`

Role: Active AR renderer and interaction coordinator.

Responsibilities:

- Hosts the React Three Fiber `<Canvas>`.
- Runs the frame loop.
- Calls MediaPipe detection.
- Maintains visual continuity for tracked hands with fade-in/fade-out buffers.
- Emits gesture updates to the shared creative engine store.
- Spawns gesture-driven particles.
- Coordinates butterfly landing, pinch orbs, victory flowers, thumbs-up bouquets, two-hand bouquet behavior, physics colliders, lighting, and postprocessing.

Mobile notes:

- This is the main porting hotspot.
- PWA/WebView path can keep it mostly intact, but should reduce particle count/postprocessing on low-end devices.
- React Native path would need `@react-three/fiber/native`, `expo-gl` or equivalent, and replacements for postprocessing/rapier compatibility if unsupported.
- `setState` calls inside `useFrame` are expensive on phones; future optimization should move rapidly changing render state into refs or external stores.

### `src/components/ThreeARScene.tsx`

Role: Older duplicate scene wrapper.

Responsibilities:

- Similar to `SceneCanvas`, but not imported by `App`.
- Lacks the `PetalTrail` integration and HUD gesture callback used by the active app.

Mobile notes:

- Treat as dead/legacy code unless another entry point starts using it.
- Before a serious mobile port, either delete it or merge useful differences into `SceneCanvas` to avoid maintaining two render coordinators.

### `src/components/GestureHUD.tsx`

Role: Gesture status overlay.

Responsibilities:

- Maps internal gesture ids to user-facing title, description, and emoji.
- Displays idle state when no gesture is active.
- Displays one card per active hand.

Mobile notes:

- Current cards have fixed `minWidth: 320px`, which is tight on narrow devices.
- Native port replacement is straightforward with a compact bottom overlay.
- The two-hand gestures `together` and `apart` are defined in the HUD, but `SceneCanvas` currently reports per-hand gestures only.

### `src/components/HandSculpture.tsx`

Role: Visual hand skeleton and fingertip flower renderer.

Responsibilities:

- Draws 21 hand joints and skeleton segments as translucent glass geometry.
- Generates unique flower species for each fingertip.
- Animates flower growth based on finger curl and gesture state.
- Emits idle sparkles, pollen, bubbles, and wave-petal particles.
- Estimates hand velocity from wrist motion.

Mobile notes:

- Rendering logic can stay in R3F-based mobile builds.
- Frequent particle spawns and 21 joints plus 20 segments per hand can be tuned for battery/performance.
- Native non-WebGL UI cannot reuse this directly; it belongs to the 3D renderer.

### `src/components/ButterflyMesh.tsx`

Role: Procedural animated butterfly.

Responsibilities:

- Creates body and triangular wing geometry.
- Flies toward a target fingertip during point gesture.
- Flutters away when inactive.
- Animates wing flapping and banking.

Mobile notes:

- Fully portable inside a Three.js renderer.
- Low geometry cost, safe for mobile.

### `src/components/PetalTrail.tsx`

Role: Sprite trail behind an open/waving index finger.

Responsibilities:

- Generates a rose petal texture with a canvas.
- Maintains a short history buffer of fingertip positions.
- Draws fading sprites along the path.

Mobile notes:

- Uses `document.createElement('canvas')`, so it is web/PWA friendly.
- Native R3F would need a replacement texture source or a native canvas-compatible texture generation path.

### `src/components/FlowerMesh.tsx` and `src/components/FlowerSprite.tsx`

Role: Legacy or alternate flower renderers.

Responsibilities:

- Present in the repo but not used by `App` or `SceneCanvas`.

Mobile notes:

- Audit before deletion. If unused, remove during cleanup to reduce porting surface.

### `src/flowers/HolographicFlower.tsx`

Role: Main procedural flower renderer.

Responsibilities:

- Defines `generateCrystalSpecies`.
- Creates procedural petal/core geometry.
- Uses translucent physical materials.
- Animates petal opening and subtle breathing.
- Adds point light when sufficiently grown.

Mobile notes:

- Portable inside Three.js/R3F.
- `MeshPhysicalMaterial` with transmission can be expensive on mobile; consider `MeshStandardMaterial` or lower-quality material profiles for phones.

### `src/flowers/ProceduralFlower.tsx`

Role: Alternate procedural flower implementation.

Responsibilities:

- Present in the repo but not used by the active scene.

Mobile notes:

- Same recommendation as other unused renderers: either document as experimental or remove before porting.

### `src/particles/GPUParticleSystem.tsx`

Role: Central particle renderer and particle simulation loop.

Responsibilities:

- Preallocates 3000 particles.
- Provides `spawn` and `spawnBurst` through context.
- Uses custom shader attributes for position, color, size, alpha, and particle type.
- Simulates particle motion on the CPU and renders via a single `THREE.Points`.
- Draws pollen, petals, spores, dust, trails, hearts, and bubbles.

Mobile notes:

- Good architecture for mobile because particles are batched.
- `MAX_PARTICLES = 3000` may be high for mid-range phones with camera, hand tracking, postprocessing, and physics active.
- Native port depends on shader support in the selected renderer.

### `src/particles/ParticleContext.tsx`

Role: Particle spawn API.

Responsibilities:

- Defines particle types and spawn parameters.
- Exposes `useParticles`.

Mobile notes:

- Portable TypeScript/React layer.

### `src/effects/particlePool.ts`

Role: Static particle constants.

Responsibilities:

- Defines max particles, gravity, and drag values.

Mobile notes:

- Currently not wired into `GPUParticleSystem`.
- Make it the single source of truth before tuning mobile performance.

### `src/effects/flowerEffects.ts`

Role: Flower effect utilities.

Responsibilities:

- Present in the repo; inspect before final port cleanup.

Mobile notes:

- If unused, remove or fold into the active flower/particle systems.

## Hooks And Gesture Pipeline

### `src/hooks/useHandTracking.ts`

Role: MediaPipe model lifecycle.

Responsibilities:

- Loads MediaPipe WASM from jsDelivr.
- Loads the hand landmarker model from Google Cloud Storage.
- Creates a GPU delegated `HandLandmarker`.
- Exposes `detectHands(video, timestamp)`.
- Closes the landmarker on unmount.

Mobile notes:

- PWA/WebView path can reuse it, assuming network access and WebAssembly support.
- Production mobile builds should bundle model/WASM assets locally instead of depending on CDNs.
- Native path needs a different MediaPipe integration.

### `src/hooks/useSmoothedHandData.ts`

Role: Converts raw MediaPipe output into stable app hand models.

Responsibilities:

- Maps video-space landmarks into Three.js coordinates.
- Smooths landmarks with EMA.
- Computes finger curls and pinch strength.
- Runs `GestureEngine`.
- Applies confidence threshold, gesture priority, and 200ms hysteresis.
- Returns `HandData[]`.

Mobile notes:

- This is one of the most reusable modules.
- For native, replace only the input landmark type and any dependency on `useThree`.
- Consider extracting the pure gesture/smoothing logic away from R3F camera access.

### `src/hooks/useGestureEngine.ts`

Role: Gesture hook wrapper.

Responsibilities:

- Present in the repo but not part of the active app path.

Mobile notes:

- Audit for duplication before porting.

## Shared Engine State

### `src/store/creativeEngineStore.ts`

Role: Shared state boundary for the creative coding engine.

Responsibilities:

- Stores active left/right hand gestures.
- Normalizes raw gesture strings into the app's `GestureType` union.
- Lets the scene layer publish gesture state without threading HUD callbacks through the app tree.

Mobile notes:

- This is the start of the reusable Interaction Layer boundary.
- Future tracking, performance profile, selected effect, and permission state should live here or in adjacent stores instead of being passed through visual components.

### `src/gestures/GestureEngine.ts`

Role: Primary gesture classifier.

Responsibilities:

- Registers gesture definitions for pinch, open palm, closed fist, victory, point, thumbs up, hands together, and hands apart.
- Computes smoothed confidence over an 8-frame buffer.
- Sorts results by confidence.

Mobile notes:

- Highly portable.
- Gesture thresholds are tuned against current Three.js projection scale, so they must be recalibrated if the coordinate system changes in native.

### `src/gestures/classifier.ts`

Role: Older/simple gesture classifier.

Responsibilities:

- Detects pinch, fist, and open palm from 3D landmarks.
- Not used by the active app path.

Mobile notes:

- Candidate for removal or unit tests as a fallback classifier.

## Utility Modules

### `src/utils/coordinateMapping.ts`

Role: Video-to-Three coordinate projection.

Responsibilities:

- Accounts for CSS `object-fit: cover` cropping.
- Mirrors x coordinates to match the selfie preview.
- Converts normalized MediaPipe coordinates to NDC.
- Unprojects NDC into a world-space plane.

Mobile notes:

- Critical for PWA/WebView correctness.
- Native port must rewrite this around the native camera preview dimensions and renderer camera.

### `src/utils/smoothing.ts`

Role: EMA smoothing class.

Responsibilities:

- Stores landmark history by hand id and landmark index.
- Smooths vector movement with `Vector3.lerp`.

Mobile notes:

- Portable.

### `src/utils/math.ts`

Role: Duplicate EMA smoother plus finger curl calculation.

Responsibilities:

- Defines another `EMASmoother`.
- Defines `calculateFingerCurl`.

Mobile notes:

- Duplicates `src/utils/smoothing.ts` and `src/utils/handMath.ts`.
- Consolidate before porting to reduce inconsistent behavior.

### `src/utils/handMath.ts`

Role: Finger curl calculation.

Responsibilities:

- Computes open/closed curl ratios from hand landmark joints.

Mobile notes:

- Portable.

### `src/utils/gesture.ts`

Role: Gesture utility module.

Responsibilities:

- Present in the repo; inspect before cleanup.

Mobile notes:

- Likely overlaps with `GestureEngine` or `classifier`.

### `src/utils/textureGenerator.ts`

Role: Procedural canvas texture factory.

Responsibilities:

- Generates rose, petal, sparkle, heart, glow, and butterfly textures with browser canvas.

Mobile notes:

- Good for PWA/WebView.
- Native port should pre-generate image assets or replace canvas texture generation.

## Styling And App Shell

### `src/index.css`

Role: Global styles, utility classes, and overlay layout.

Responsibilities:

- Defines theme variables.
- Locks the app to full-screen.
- Provides glass panel, typography, utility, header/footer, loader, error, and gesture lexicon styles.

Mobile notes:

- Already has some responsive rules.
- Needs safe-area support, smaller HUD/footer behavior, and a reduced overlay footprint for phones.

### `src/App.css`

Role: Empty stylesheet.

Responsibilities:

- None currently.

Mobile notes:

- Candidate for deletion unless future component-scoped styles are added.

## Mobile App Strategy

### Recommended Phase 1: Mobile PWA

Use the existing React/Vite app as the mobile application base.

Tasks:

- Add PWA manifest and mobile viewport metadata.
- Serve over HTTPS for camera permission on real devices.
- Bundle MediaPipe assets locally.
- Tune performance for mobile: lower particle count, optional postprocessing, adaptive DPR.
- Replace the large footer lexicon with a compact help surface.
- Add camera permission and unsupported-browser screens.

Why this first:

- Preserves the current hand tracking/rendering stack.
- Avoids replacing the hardest pieces immediately.
- Can be installed to home screen on iOS and Android.

### Phase 2: Capacitor Shell

Wrap the PWA with Capacitor if app-store packaging is required.

Tasks:

- Add Capacitor.
- Configure iOS/Android camera permissions.
- Keep the web runtime inside a native WebView.
- Verify MediaPipe WASM and WebGL support in target WebViews.

Why this second:

- Gives app-store packaging while retaining the working web implementation.

### Phase 3: Native Renderer Port

Only pursue if WebView/PWA performance or distribution constraints are unacceptable.

Tasks:

- Replace `WebcamFeed` with a native camera module.
- Replace `useHandTracking` with native MediaPipe or frame processor integration.
- Move `useSmoothedHandData` projection logic behind a platform adapter.
- Port `SceneCanvas` to native R3F/GL or another native 3D renderer.
- Replace DOM HUD with native UI.

Why this last:

- It is a rewrite of the camera and rendering substrate, not a simple component port.

## Cleanup Before Porting

- Remove or merge `ThreeARScene` if it remains unused.
- Decide whether `FlowerMesh`, `FlowerSprite`, and `ProceduralFlower` are active alternatives or dead code.
- Consolidate duplicate math/smoothing utilities.
- Move inline styles out of `App` and `GestureHUD` where mobile responsiveness requires media queries.
- Make `particlePool.ts` drive `GPUParticleSystem` constants.
- Add tests around `GestureEngine`, finger curl math, and coordinate mapping before changing platform layers.
