import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Root, Container, Text, Image, Video } from '@react-three/uikit'

const UI_PIXEL_SIZE = 0.0016
const DOCK_DISTANCE = 2.0

function useAssetList(pathname, ext) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch(pathname, { cache: 'no-cache' })
        const list = await res.json()
        if (!Array.isArray(list)) return
        const normalized = list
          .filter((v) => typeof v === 'string' && v.toLowerCase().endsWith(ext))
          .map((v) => (v.startsWith('/assets/') ? v : v.startsWith('assets/') ? `/${v}` : `/assets/${v}`))
        if (!canceled) setItems(normalized)
      } catch (e) {
        if (!canceled) setItems([])
      }
    })()
    return () => {
      canceled = true
    }
  }, [pathname, ext])

  return items
}

function usePanoList() {
  const items = useAssetList('/assets/panos.json', '.png')
  return items.length ? items : ['/assets/foto.png']
}

function useVideoList() {
  const items = useAssetList('/assets/videos.json', '.mp4')
  return items.length ? items : ['/assets/video.mp4']
}

function PanoSphere({ src }) {
  const texture = useTexture(src)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.repeat.x = -1

  return (
    <mesh>
      <sphereGeometry args={[50, 64, 32]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  )
}

function FollowCameraGroup({ distance = 0.85, y = -0.35, children }) {
  const ref = useRef()
  const { camera } = useThree()
  const dir = useMemo(() => new THREE.Vector3(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const look = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!ref.current) return
    camera.getWorldDirection(dir)
    camera.getWorldPosition(pos)
    const targetPos = pos.clone().add(dir.multiplyScalar(distance))
    targetPos.y += y
    ref.current.position.copy(targetPos)
    look.copy(pos)
    look.y = targetPos.y
    ref.current.lookAt(look)
    ref.current.rotation.x = 0
    ref.current.rotation.z = 0
  })

  return <group ref={ref}>{children}</group>
}

function yawToFace(camera, worldPos) {
  const camPos = new THREE.Vector3()
  camera.getWorldPosition(camPos)
  const dx = camPos.x - worldPos.x
  const dz = camPos.z - worldPos.z
  return Math.atan2(dx, dz)
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v))
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fileBaseName(p) {
  const s = String(p || '')
  const name = s.split('/').pop() || s
  return name
}

function truncateMiddle(text, max) {
  const s = String(text || '')
  if (s.length <= max) return s
  const keep = Math.max(4, Math.floor((max - 3) / 2))
  return `${s.slice(0, keep)}...${s.slice(s.length - keep)}`
}

function UiButton({
  label,
  onClick,
  variant = 'primary',
  width,
  height = 56
}) {
  const backgroundColor = variant === 'primary' ? '#ffffff' : '#000000'
  const backgroundOpacity = variant === 'primary' ? 0.1 : 0.55
  const textColor = variant === 'primary' ? '#EAF6FF' : '#FFFFFF'

  return (
    <Container
      onClick={onClick}
      width={width}
      height={height}
      backgroundColor={backgroundColor}
      backgroundOpacity={backgroundOpacity}
      borderRadius={999}
      alignItems="center"
      justifyContent="center"
      paddingX={18}
    >
      <Text fontSize={20} color={textColor}>
        {label}
      </Text>
    </Container>
  )
}

function UiIconButton({ label, onClick, size = 40 }) {
  return (
    <Container
      onClick={onClick}
      width={size}
      height={size}
      alignItems="center"
      justifyContent="center"
      backgroundColor="#000000"
      backgroundOpacity={0.55}
      borderRadius={999}
    >
      <Text fontSize={18} color="#FFFFFF">
        {label}
      </Text>
    </Container>
  )
}

function Window({
  visible,
  initialPosition,
  title,
  onMinimize,
  children,
  width = 1200,
  height = 800
}) {
  const groupRef = useRef()
  const dragging = useRef(false)
  const dragPointerId = useRef(null)
  const { camera } = useThree()
  const offset = useMemo(() => new THREE.Vector3(), [])
  const tmpWorld = useMemo(() => new THREE.Vector3(), [])
  const tmpLocal = useMemo(() => new THREE.Vector3(), [])

  const onDown = useCallback((e) => {
    e.stopPropagation()
    if (!groupRef.current) return
    dragging.current = true
    dragPointerId.current = e.pointerId
    e.target?.setPointerCapture?.(e.pointerId)

    groupRef.current.getWorldPosition(tmpWorld)
    offset.copy(tmpWorld).sub(e.point)
    groupRef.current.rotation.set(0, yawToFace(camera, tmpWorld), 0)
  }, [offset, tmpWorld])

  const onMove = useCallback((e) => {
    if (!dragging.current) return
    if (dragPointerId.current != null && e.pointerId !== dragPointerId.current) return
    if (!groupRef.current) return

    tmpWorld.copy(e.point).add(offset)
    if (groupRef.current.parent) {
      tmpLocal.copy(tmpWorld)
      groupRef.current.parent.worldToLocal(tmpLocal)
      groupRef.current.position.copy(tmpLocal)
    } else {
      groupRef.current.position.copy(tmpWorld)
    }

    groupRef.current.getWorldPosition(tmpWorld)
    groupRef.current.rotation.set(0, yawToFace(camera, tmpWorld), 0)
  }, [offset, tmpLocal, tmpWorld])

  const onUp = useCallback((e) => {
    if (dragPointerId.current != null && e.pointerId !== dragPointerId.current) return
    dragging.current = false
    dragPointerId.current = null
    e.target?.releasePointerCapture?.(e.pointerId)
  }, [])

  if (!visible) return null

  return (
    <group ref={groupRef} position={initialPosition}>
      <Root
        pixelSize={UI_PIXEL_SIZE}
        width={width}
        height={height}
        backgroundColor="#0b1620"
        backgroundOpacity={0.72}
        borderRadius={18}
        padding={18}
        gap={14}
      >
        <Container
          width="100%"
          height={48}
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          backgroundColor="#000000"
          backgroundOpacity={0.35}
          borderRadius={14}
          paddingX={16}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <Text fontSize={24} color="#EAF6FF">
            {title}
          </Text>
          <UiIconButton label="X" onClick={onMinimize} size={36} />
        </Container>

        {children}
      </Root>
    </group>
  )
}

export default function VRScene() {
  const { camera, gl } = useThree()
  const panos = usePanoList()
  const [panoIndex, setPanoIndex] = useState(() => Number.parseInt(localStorage.getItem('panoIndex') || '0', 10) || 0)
  const videos = useVideoList()
  const [videoIndex, setVideoIndex] = useState(() => Number.parseInt(localStorage.getItem('videoIndex') || '0', 10) || 0)

  const [videoOpen, setVideoOpen] = useState(true)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryPage, setGalleryPage] = useState(0)
  const [videoPage, setVideoPage] = useState(0)
  const [videoFullscreen, setVideoFullscreen] = useState(false)
  const [openOrder, setOpenOrder] = useState([])
  const [windowPositions, setWindowPositions] = useState({})

  const src = panos.length ? panos[(panoIndex % panos.length + panos.length) % panos.length] : '/assets/foto.png'
  const videoSrc = videos.length ? videos[(videoIndex % videos.length + videos.length) % videos.length] : '/assets/video.mp4'

  useEffect(() => {
    if (!panos.length) return
    const idx = (panoIndex % panos.length + panos.length) % panos.length
    localStorage.setItem('panoIndex', String(idx))
  }, [panoIndex, panos.length])

  useEffect(() => {
    if (!videos.length) return
    const idx = (videoIndex % videos.length + videos.length) % videos.length
    localStorage.setItem('videoIndex', String(idx))
  }, [videoIndex, videos.length])

  const openVideo = useCallback(() => {
    setVideoOpen(true)
  }, [])
  const openGallery = useCallback(() => {
    setGalleryOpen(true)
    if (panos.length) setGalleryPage(Math.floor(panoIndex / 6))
  }, [panos.length, panoIndex])

  const closeAll = useCallback(() => {
    setVideoOpen(false)
    setGalleryOpen(false)
    setVideoFullscreen(false)
  }, [])

  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const [timeLabel, setTimeLabel] = useState('0:00 / 0:00')
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    const prime = async () => {
      const el = videoRef.current?.element
      if (!el) return
      try {
        el.muted = true
        await el.play()
        el.currentTime = 0.001
      } catch (e) {}
    }
    window.addEventListener('pointerdown', prime, { once: true })
    return () => window.removeEventListener('pointerdown', prime)
  }, [])

  useEffect(() => {
    const el = videoRef.current?.element
    if (!el) return
    el.pause()
    el.currentTime = 0
    setPlaying(false)
    setMuted(true)
    setVideoReady(false)
  }, [videoSrc])

  useEffect(() => {
    const el = videoRef.current?.element
    if (!el) return
    // Ensure the video texture has frames even before the user presses play.
    ;(async () => {
      try {
        el.muted = true
        setMuted(true)
        await el.play()
        setPlaying(true)
      } catch (e) {}
    })()
  }, [videoSrc])

  useEffect(() => {
    const el = videoRef.current?.element
    if (!el) return
    const tick = () => {
      setVideoReady(el.readyState >= 2 && (el.videoWidth || 0) > 0)
    }
    const id = window.setInterval(tick, 250)
    tick()
    return () => window.clearInterval(id)
  }, [videoSrc])

  useEffect(() => {
    const el = videoRef.current?.element
    if (!el) return
    const tick = () => {
      const duration = el.duration || 0
      const current = el.currentTime || 0
      const p = duration > 0 ? current / duration : 0
      setProgress(clamp01(p))
      setTimeLabel(`${formatTime(current)} / ${formatTime(duration)}`)
    }
    const id = window.setInterval(tick, 125)
    tick()
    return () => window.clearInterval(id)
  }, [videoSrc])

  useEffect(() => {
    if (videoRef.current?.element) {
      videoRef.current.element.load()
    }
  }, [videoSrc])

  const togglePlay = useCallback(async () => {
    const videoEl = videoRef.current?.element
    if (!videoEl) return
    if (videoEl.readyState < 2) {
      console.warn('Video not ready, trying to load')
      videoEl.load()
    }
    try {
      if (playing) {
        videoEl.pause()
        setPlaying(false)
      } else {
        setMuted(false)
        videoEl.muted = false
        await videoEl.play()
        setPlaying(true)
      }
    } catch (e) {
      console.error('Video play error:', e)
    }
  }, [playing])

  const toggleMute = useCallback(() => {
    const videoEl = videoRef.current?.element
    if (!videoEl) return
    const next = !muted
    setMuted(next)
    videoEl.muted = next
  }, [muted])

  const nextVideo = useCallback(() => {
    if (!videos.length) return
    setVideoIndex((i) => (i + 1) % videos.length)
  }, [videos.length])
  const prevVideo = useCallback(() => {
    if (!videos.length) return
    setVideoIndex((i) => (i - 1 + videos.length) % videos.length)
  }, [videos.length])

  const nextPano = useCallback(() => {
    if (!panos.length) return
    setPanoIndex((i) => (i + 1) % panos.length)
  }, [panos.length])
  const prevPano = useCallback(() => {
    if (!panos.length) return
    setPanoIndex((i) => (i - 1 + panos.length) % panos.length)
  }, [panos.length])

  const pageSize = 6
  const maxPage = Math.max(1, Math.ceil(panos.length / pageSize))
  const safePage = Math.min(maxPage - 1, Math.max(0, galleryPage))
  const pageStart = safePage * pageSize
  const pageItems = panos.slice(pageStart, pageStart + pageSize)

  const videoMaxPage = Math.max(1, Math.ceil(videos.length / pageSize))
  const videoSafePage = Math.min(videoMaxPage - 1, Math.max(0, videoPage))
  const videoStart = videoSafePage * pageSize
  const videoItems = videos.slice(videoStart, videoStart + pageSize)

  const dockRef = useRef()
  const dockDragging = useRef(false)
  const dockPointerId = useRef(null)
  const dockMoved = useRef(false)
  const dockPlaced = useRef(false)
  const dockOffset = useMemo(() => new THREE.Vector3(), [])
  const dockTmpWorld = useMemo(() => new THREE.Vector3(), [])
  const dockTmpLocal = useMemo(() => new THREE.Vector3(), [])
  const camPos = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])

  const placeDockAtCamera = useCallback(() => {
    if (!dockRef.current) return
    camera.getWorldPosition(camPos)
    camera.getWorldDirection(camDir)
    camDir.y = 0
    if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, -1)
    camDir.normalize()
    const targetPos = camPos.clone().add(camDir.multiplyScalar(DOCK_DISTANCE))
    targetPos.y = camPos.y - 0.75
    dockRef.current.position.copy(targetPos)
    dockRef.current.rotation.set(0, yawToFace(camera, targetPos), 0)
    dockPlaced.current = true
  }, [camDir, camPos])

  const getDockWorld = useCallback(() => {
    if (dockRef.current && dockPlaced.current) {
      const p = new THREE.Vector3()
      dockRef.current.getWorldPosition(p)
      return p
    }
    camera.getWorldPosition(camPos)
    camera.getWorldDirection(camDir)
    camDir.y = 0
    if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, -1)
    camDir.normalize()
    const targetPos = camPos.clone().add(camDir.multiplyScalar(DOCK_DISTANCE))
    targetPos.y = camPos.y - 0.75
    return targetPos
  }, [camDir, camPos])

  useEffect(() => {
    // Initial placement (desktop and before XR enters)
    placeDockAtCamera()
  }, [])

  const placeWindow = useCallback((key) => {
    const dockWorld = getDockWorld()
    const yaw = yawToFace(camera, dockWorld)
    const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2))

    setOpenOrder((prev) => {
      const next = prev.includes(key) ? prev : [...prev, key]
      const slots = [0, -1, 1]
      const mapping = {}
      for (let i = 0; i < next.length; i++) {
        const k = next[i]
        const slot = slots[i] ?? (i - 1)
        const p = dockWorld.clone()
        p.y = dockWorld.y + 0.95
        p.add(right.clone().multiplyScalar(slot * 0.85))
        mapping[k] = { position: [p.x, p.y, p.z], yaw }
      }
      setWindowPositions(mapping)
      return next
    })
  }, [getDockWorld])

  useEffect(() => {
    if (videoOpen) placeWindow('video')
  }, [videoOpen])
  useEffect(() => {
    if (galleryOpen) placeWindow('gallery')
  }, [galleryOpen])

  const dockDown = useCallback((e) => {
    e.stopPropagation()
    if (!dockRef.current) return
    dockDragging.current = true
    dockPointerId.current = e.pointerId
    e.target?.setPointerCapture?.(e.pointerId)
    dockRef.current.getWorldPosition(dockTmpWorld)
    dockOffset.copy(dockTmpWorld).sub(e.point)
    dockMoved.current = true
  }, [dockOffset, dockTmpWorld])

  const dockMove = useCallback((e) => {
    if (!dockDragging.current) return
    if (dockPointerId.current != null && e.pointerId !== dockPointerId.current) return
    if (!dockRef.current) return
    dockTmpWorld.copy(e.point).add(dockOffset)
    if (dockRef.current.parent) {
      dockTmpLocal.copy(dockTmpWorld)
      dockRef.current.parent.worldToLocal(dockTmpLocal)
      dockRef.current.position.copy(dockTmpLocal)
    } else {
      dockRef.current.position.copy(dockTmpWorld)
    }
    dockRef.current.getWorldPosition(dockTmpWorld)
    dockRef.current.rotation.set(0, yawToFace(camera, dockTmpWorld), 0)
  }, [dockOffset, dockTmpLocal, dockTmpWorld])

  const dockUp = useCallback((e) => {
    if (dockPointerId.current != null && e.pointerId !== dockPointerId.current) return
    dockDragging.current = false
    dockPointerId.current = null
    e.target?.releasePointerCapture?.(e.pointerId)
  }, [])

  const wasPresentingRef = useRef(false)
  useFrame(() => {
    const isPresenting = gl.xr.isPresenting
    if (!wasPresentingRef.current && isPresenting) {
      // XR just started: place dock once in front of the user.
      if (!dockMoved.current) placeDockAtCamera()
    }
    wasPresentingRef.current = isPresenting
  })

  return (
    <>
      <Suspense fallback={null}>
        <PanoSphere src={src} />
      </Suspense>

      <group ref={dockRef}>
        <Root
          pixelSize={UI_PIXEL_SIZE}
          width={860}
          height={120}
          backgroundColor="#0b1620"
          backgroundOpacity={0.72}
          borderRadius={999}
          padding={12}
          onPointerDown={dockDown}
          onPointerMove={dockMove}
          onPointerUp={dockUp}
          onPointerCancel={dockUp}
        >
          <Container width="100%" height="100%" flexDirection="row" alignItems="center" justifyContent="space-between" gap={12} paddingX={16}>
            <UiButton
              label="Video Player"
              onClick={() => {
                openVideo()
                placeWindow('video')
              }}
              width={240}
              height={70}
            />
            <UiButton
              label="360 Gallery"
              onClick={() => {
                openGallery()
                placeWindow('gallery')
              }}
              width={240}
              height={70}
            />
            <Container
              onClick={closeAll}
              width={180}
              height={70}
              backgroundColor="#ffffff"
              backgroundOpacity={0.06}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={20} color="#A9D7FF">Close</Text>
            </Container>
          </Container>
        </Root>
      </group>

      <Window
        visible={videoOpen}
        initialPosition={windowPositions.video?.position ?? [0, 1.55, -2]}
        title="Video Player"
        onMinimize={() => setVideoOpen(false)}
        width={videoFullscreen ? 1400 : 1100}
        height={videoFullscreen ? 900 : 760}
      >
        <Container width="100%" gap={12}>
          <Container width="100%" flexDirection="row" alignItems="center" gap={10}>
            <Container flexShrink={1} gap={4}>
              <Text fontSize={18} color="#EAF6FF">{truncateMiddle(fileBaseName(videoSrc), 42)}</Text>
              <Text fontSize={14} color="#A9D7FF">{timeLabel}</Text>
            </Container>
            <Container flexShrink={0}>
              <UiButton label={videoFullscreen ? 'Exit Fullscreen' : 'Fullscreen'} onClick={() => setVideoFullscreen((v) => !v)} width={240} height={52} />
            </Container>
          </Container>

          {!videoFullscreen && (
            <Container width="100%" gap={10}>
              <Container width="100%" flexDirection="row" alignItems="center" justifyContent="space-between">
                <Text fontSize={16} color="#EAF6FF">Video Library</Text>
                <Text fontSize={14} color="#A9D7FF">Page {videoSafePage + 1}/{videoMaxPage}</Text>
              </Container>
              <Container width="100%" gap={10}>
                {videoItems.map((p, i) => {
                  const absoluteIndex = videoStart + i
                  const selected = absoluteIndex === ((videoIndex % videos.length + videos.length) % videos.length)
                  return (
                    <Container
                      key={p}
                      onClick={() => setVideoIndex(absoluteIndex)}
                      width="100%"
                      height={84}
                      flexDirection="row"
                      alignItems="center"
                      justifyContent="space-between"
                      backgroundColor={selected ? '#00f2fe' : '#ffffff'}
                      backgroundOpacity={selected ? 0.18 : 0.06}
                      borderRadius={16}
                      paddingX={14}
                    >
                      <Container width="80%" gap={4}>
                        <Text fontSize={18} color="#EAF6FF">{truncateMiddle(fileBaseName(p), 50)}</Text>
                        <Text fontSize={14} color="#A9D7FF">MP4</Text>
                      </Container>
                      <Text fontSize={14} color="#A9D7FF">{selected ? 'Selected' : ''}</Text>
                    </Container>
                  )
                })}
              </Container>

              <Container width="100%" flexDirection="row" alignItems="center" justifyContent="space-between">
                <Container flexDirection="row" gap={10} alignItems="center">
                  <UiIconButton label="<" onClick={() => setVideoPage((p) => Math.max(0, p - 1))} size={44} />
                  <UiIconButton label=">" onClick={() => setVideoPage((p) => Math.min(videoMaxPage - 1, p + 1))} size={44} />
                </Container>
                <Text fontSize={14} color="#A9D7FF">Page {videoSafePage + 1}/{videoMaxPage}</Text>
              </Container>
            </Container>
          )}

          {!videoReady && (
            <Container
              width="100%"
              height={48}
              backgroundColor="#ffffff"
              backgroundOpacity={0.06}
              borderRadius={16}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={14} color="#A9D7FF">Video loading… (tap Play if it stays black)</Text>
            </Container>
          )}

          <Suspense fallback={<Text>Loading...</Text>}>
            <Container backgroundColor="black">
              <Video
                ref={videoRef}
                src={videoSrc}
                crossOrigin="anonymous"
                muted={muted}
                loop
                playsInline
                preload="auto"
                width="100%"
                height={videoFullscreen ? 700 : 400}
                borderRadius={16}
                onError={(e) => console.error('Video loading error:', e)}
              />
            </Container>
          </Suspense>

          <Container width="100%" flexDirection="row" gap={10} alignItems="center" justifyContent="space-between">
            <UiButton label={playing ? 'Pause' : 'Play'} onClick={togglePlay} variant="secondary" width={160} height={52} />
            <UiButton label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} variant="secondary" width={180} height={52} />
            <Container width="100%" height={52} backgroundColor="#ffffff" backgroundOpacity={0.06} borderRadius={16} paddingX={14} alignItems="center" justifyContent="center">
              <Text fontSize={14} color="#A9D7FF">Progress {Math.round(progress * 100)}%</Text>
            </Container>
          </Container>
        </Container>
      </Window>

      <Window
        visible={galleryOpen}
        initialPosition={windowPositions.gallery?.position ?? [0.85, 1.55, -2]}
        title="360 Gallery"
        onMinimize={() => setGalleryOpen(false)}
        width={1000}
        height={760}
      >
        <Container width="100%" gap={12}>
          <Container width="100%" flexDirection="row" alignItems="center" justifyContent="space-between">
            <Container width="70%" gap={4}>
              <Text fontSize={18} color="#EAF6FF">Select a 360 image</Text>
              <Text fontSize={14} color="#A9D7FF">{truncateMiddle(fileBaseName(src), 46)}</Text>
            </Container>
            <Container width="30%" alignItems="flex-end">
              <Text fontSize={14} color="#A9D7FF">Page {safePage + 1}/{maxPage}</Text>
            </Container>
          </Container>

          <Container width="100%" gap={10}>
            {pageItems.map((p, i) => {
              const selected = p === src
              const absoluteIndex = pageStart + i
              return (
                <Container
                  key={p}
                  onClick={() => setPanoIndex(absoluteIndex)}
                  width="100%"
                  height={104}
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="space-between"
                  backgroundColor={selected ? '#00f2fe' : '#ffffff'}
                  backgroundOpacity={selected ? 0.18 : 0.06}
                  borderRadius={16}
                  paddingX={14}
                  paddingY={10}
                  gap={14}
                >
                  <Container
                    width={200}
                    height={84}
                    borderRadius={14}
                    backgroundColor="#ffffff"
                    backgroundOpacity={0.04}
                    padding={6}
                  >
                    <Image src={p} width="100%" height="100%" borderRadius={10} />
                  </Container>
                  <Container width="100%" gap={6}>
                    <Text fontSize={18} color="#EAF6FF">{truncateMiddle(fileBaseName(p), 56)}</Text>
                    <Text fontSize={14} color="#A9D7FF">PNG - 360 pano</Text>
                  </Container>
                  <Container width={110} alignItems="flex-end">
                    <Text fontSize={14} color="#A9D7FF">{selected ? 'Selected' : ''}</Text>
                  </Container>
                </Container>
              )
            })}
          </Container>

          <Container width="100%" flexDirection="row" alignItems="center" justifyContent="space-between">
            <Container flexDirection="row" gap={10} alignItems="center">
              <UiIconButton label="<" onClick={() => setGalleryPage((p) => Math.max(0, p - 1))} size={44} />
              <UiIconButton label=">" onClick={() => setGalleryPage((p) => Math.min(maxPage - 1, p + 1))} size={44} />
            </Container>
            <Text fontSize={14} color="#A9D7FF">Page {safePage + 1}/{maxPage}</Text>
          </Container>
        </Container>
      </Window>
    </>
  )
}
