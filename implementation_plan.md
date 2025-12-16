# Implementation Plan - Audio & Window Fixes

## 1. Ambient Sound (Omgevingsgeluid)
**Problem:** The file `geluid.mp3` exists but is never loaded or played.
**Solution:** Implement a global audio player in `VRScene.jsx`.

*   **Action:** Add a `useEffect` hook in `VRScene` to manage the audio.
*   **Details:**
    *   Create `new Audio('/assets/geluid.mp3')`.
    *   Set `loop = true`.
    *   Set `volume = 0.5` (adjustable).
    *   Call `play()` on mount.
    *   Handle cleanup (pause/reset) on unmount.

## 2. Video Sound & Autoplay
**Problem:** Video autoplays silently (muted). Users expect sound, but browser policies block autoplay with sound.
**Solution:** Disable autoplay and ensure explicit "Play" action enables sound.

*   **Action:** Modify the `<Video>` component in `VRScene.jsx`.
    *   Remove `autoplay={true}`.
    *   Keep `muted={true}` as initial state (good practice), but ensure `togglePlay` sets `muted = false`.
*   **Action:** Update `togglePlay` logic (if needed) to ensure it handles the "first play" correctly.
    *   *Current logic:* `if (playing) pause else play & unmute`.
    *   *New behavior:* Video starts paused. User clicks "Play". Logic executes `else` branch -> Plays & Unmutes. This works perfectly.

## 3. Movable Video Window (Verplaatsbaar Venster)
**Problem:** The Video window cannot be moved because it lacks a title bar (which acts as the drag handle).
**Solution:** Add a title to the Video Window.

*   **Action:** In `VRScene.jsx`, add `title="Video Player"` to the `<Window>` component wrapping the video.
*   **Result:** This will render the header bar with the title "Video Player" and the "X" button, and enable the existing drag-and-drop logic.

## Summary of Changes (`src/vr/VRScene.jsx`)

```javascript
// 1. Add Ambient Sound
useEffect(() => {
  const audio = new Audio('/assets/geluid.mp3')
  audio.loop = true
  audio.volume = 0.5
  audio.play().catch(e => console.warn("Ambient audio autoplay blocked:", e))
  return () => {
    audio.pause()
    audio.src = ''
  }
}, [])

// 2. Fix Video Window (add title) & Video Component (remove autoplay)
<Window
  visible={videoOpen}
  title="Video Player" // <-- Added title for dragging
  ...
>
  <Video
    ...
    autoplay={false} // <-- Changed from true (or removed)
    muted={true}     // <-- Kept true initially, unmuted by togglePlay
    ...
  />
</Window>
```

## Verification
1.  **Ambient:** Enter VR -> Hear background sound.
2.  **Video:** Open Video Player -> Video is paused -> Click Play -> Video plays WITH sound.
3.  **Window:** Open Video Player -> Drag the title bar -> Window moves.
