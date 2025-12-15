# Implementation Plan: Restoring Movable VR Screen

## Goal
Restore the "movable screen" capability in VR by migrating the video player to **A-Frame**. The UI (Play, Pause, Progress, Volume) will be recreated using native 3D objects (planes, images) to ensure smooth interaction and high performance in VR, matching the "YouTube-style" look.

## Architecture

### 1. Framework
- **A-Frame 1.6.0**: For WebXR/VR support.
- **Custom Components**: Vanilla JavaScript for interaction logic.

### 2. Scene Graph
```mermaid
graph TD
    Scene[a-scene] --> Assets[a-assets]
    Scene --> CameraRig[Camera Rig]
    Scene --> PlayerRig[#player-rig (Movable Entity)]
    
    CameraRig --> Camera[a-camera]
    CameraRig --> RightHand[laser-controls right]
    CameraRig --> LeftHand[laser-controls left]
    
    PlayerRig --> Handle[Backing Plane (Grabbable Border)]
    PlayerRig --> VideoScreen[a-plane material=src:#bios-video]
    PlayerRig --> UI[UI Overlay Group]
    
    UI --> CenterPlay[Center Play Button]
    UI --> BottomBar[Bottom Control Bar]
    BottomBar --> ProgressBar[Progress Bar Plane]
    BottomBar --> VolControls[Volume Buttons]
    UI --> CloseBtn[Close Button]
```

### 3. Components Logic

#### `movable-screen`
- **Goal**: Allow the user to grab the screen by the border and move it.
- **Events**: Listens for `mousedown`/`mouseup` coming from A-Frame `cursor` (mouse or controller ray).
- **Action**:
  - On Grab: Store controller reference + compute a stable transform offset (matrix) between controller and `#player-rig`.
  - While Grabbed: In `tick`, update `#player-rig` world transform = `controller.matrixWorld * offset` (no re-parenting, avoids jumps/scale bugs).
  - On Release: Stop updating; the last world pose remains.

#### `fit-video`
- **Goal**: Keep correct aspect ratio on the video screen.
- **Events**: Listens for `loadedmetadata` on `<video>`.
- **Action**: Compute `videoWidth / videoHeight`, update `a-plane` width/height to a chosen max-height/width.

#### `video-controls`
- **Goal**: Handle video playback and UI updates.
- **Play/Pause**: Toggles video state and visibility of the Center Play icon.
- **Progress Bar**: 
  - Visual: Updates scale/position of a child plane based on `video.currentTime` (throttled ~10–15 Hz).
  - Interaction: Raycaster intersection on click determines new time using `evt.detail.intersection.uv.x` (stable regardless of scaling/rotation).
- **Volume**: Simple click handlers to adjust `video.volume`.
- **Close**: Pause video, optionally exit VR, show splash overlay again.

### 4. VR Interaction Model (Important)
- Put `raycaster="objects: .ui-hit"` + `cursor="rayOrigin: entity"` on both controllers.
- Give all clickable entities a larger invisible hit plane/collider with class `.ui-hit` for reliable Quest interaction.
- Prevent z-fighting by keeping UI slightly in front of the video (e.g. `z: 0.01`) and/or using `polygonOffset` on UI materials.

### 5. Video in WebXR (Important)
- Render video via `a-plane material="src: #bios-video; shader: flat; toneMapped: false"` (predictable brightness, no lighting needed).
- Unlock playback on the user gesture (Enter VR) using: `muted=true`, `playsInline=true`, `await play(); pause();` so the texture is ready in VR.

## Implementation Steps

### Step 1: MVP Scene + Video Surface
- Add A-Frame to `index.html` and replace the HTML `#video-player` with an `<a-scene>`.
- Move `<video id="bios-video">` into `<a-assets>` (still using `assets/video.mp4`).
- Show the video on an `a-plane` (flat shader) with a backing plane behind it.
- Add `fit-video` so the screen respects the real video aspect ratio.

### Step 2: Scene Setup (index.html)
- Implement the Scene Graph structure defined above.
- Camera rig: `a-camera` + controllers:
  - `laser-controls` (left/right)
  - `raycaster="objects: .ui-hit"`
  - `cursor="rayOrigin: entity; fuse: false"`
- Optional desktop: add a mouse cursor entity for debugging: `cursor="rayOrigin: mouse"`.

### Step 3: Script Implementation
- Implement `movable-screen` (matrix-offset follow; no re-parenting).
- Implement `video-controls`:
  - play/pause toggle
  - progress update throttling
  - seek via `intersection.uv.x`
  - volume +/-
  - close/back to splash
- Update the **Splash Screen** "Enter VR" button:
  - Unlock media (video + ambient sound) on user gesture.
  - Call `scene.enterVR()`.
  - Hide the HTML splash overlay.

### Step 4: Styling (YouTube-like)
- Match the "YouTube" aesthetic:
  - Dark semi-transparent backgrounds for bars.
  - Cyan/Blue accent color for the progress bar.
  - White icons.

### Step 5 (Optional): Polish / Robustness
- Add a subtle “billboard to camera” mode toggle if desired (screen faces user while moving).
- Clamp screen distance to avoid pulling through the camera.
- Add haptics on click for Quest controllers (optional).
