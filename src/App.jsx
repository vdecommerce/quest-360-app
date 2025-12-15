import React, { useCallback, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Loader, OrbitControls } from '@react-three/drei'
import { XR, XROrigin, createXRStore } from '@react-three/xr'
import VRScene from './vr/VRScene.jsx'

const store = createXRStore({
  // Keep session init minimal for immersive-vr on Quest (avoid unsupported feature requests).
  anchors: false,
  bodyTracking: false,
  depthSensing: false,
  domOverlay: false,
  hitTest: false,
  layers: false,
  meshDetection: false,
  planeDetection: false,
  // Hand tracking is nice-to-have; keep it enabled.
  handTracking: true
})

export default function App() {
  const [entered, setEntered] = useState(false)

  const onEnter = useCallback(async () => {
    setEntered(true)
    try {
      await store.enterVR()
    } catch (e) {}
  }, [])

  const overlayStyle = useMemo(
    () => ({
      position: 'fixed',
      inset: 0,
      display: entered ? 'none' : 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 16,
      background: 'rgba(0,0,0,0.9)',
      color: '#fff',
      zIndex: 10
    }),
    [entered]
  )

  const buttonStyle = useMemo(
    () => ({
      padding: '18px 34px',
      fontSize: 20,
      borderRadius: 999,
      border: 'none',
      cursor: 'pointer',
      color: 'white',
      background: 'linear-gradient(45deg, #4facfe, #00f2fe)',
      boxShadow: '0 4px 15px rgba(0,242,254, 0.4)'
    }),
    []
  )

  return (
    <>
      <div style={overlayStyle}>
        <h1 style={{ margin: 0 }}>Cinema Glass</h1>
        <p style={{ margin: 0, opacity: 0.85 }}>
          Open het menu via A/B/X/Y of de dock. Kies Video Player of 360 Gallery.
        </p>
        <button style={buttonStyle} onClick={onEnter}>Enter VR</button>
      </div>

      <Canvas
        gl={{ antialias: true }}
        camera={{ position: [0, 1.6, 0], fov: 60 }}
      >
        <color attach="background" args={['#000']} />
        <XR store={store}>
          <XROrigin>
            <VRScene />
          </XROrigin>
        </XR>

        {!entered && (
          <>
            <OrbitControls target={[0, 1.5, -2]} />
            <Environment preset="city" />
          </>
        )}
      </Canvas>
      <Loader />
    </>
  )
}
