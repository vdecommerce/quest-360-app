import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Root, Container, Text, Image, Video } from '@react-three/uikit'

const UI_PIXEL_SIZE = 0.0016
const DOCK_DISTANCE = 2.0
const GALLERY_PAGE_SIZE = 9

function useAssetList(pathname, exts, refreshToken = 0) {
  const [items, setItems] = useState([])

  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const res = await fetch(pathname, { cache: 'no-cache' })
        const list = await res.json()
        if (!Array.isArray(list)) return
        const normalized = list
          .filter((v) => typeof v === 'string' && exts.some(e => v.toLowerCase().endsWith(e)))
          .map((v) => (v.startsWith('/assets/') ? v : v.startsWith('assets/') ? `/${v}` : `/assets/${v}`))
        if (!canceled) setItems(normalized)
      } catch (e) {
        if (!canceled) setItems([])
      }
    })()
    return () => {
      canceled = true
    }
  }, [pathname, JSON.stringify(exts), refreshToken])

  return items
}

function usePanoList(refreshToken = 0) {
  const items = useAssetList('/assets/panos.json', ['.png', '.jpg'], refreshToken)
  return items.length ? items : ['/assets/foto.png']
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


function yawToFace(camera, worldPos) {
  const camPos = new THREE.Vector3()
  camera.getWorldPosition(camPos)
  const dx = camPos.x - worldPos.x
  const dz = camPos.z - worldPos.z
  return Math.atan2(dx, dz)
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
  titlePlacement = 'top',
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

  const positionKey = Array.isArray(initialPosition) ? initialPosition.join(',') : ''
  useEffect(() => {
    if (!visible) return
    if (!groupRef.current) return
    groupRef.current.getWorldPosition(tmpWorld)
    groupRef.current.rotation.set(0, yawToFace(camera, tmpWorld), 0)
  }, [visible, camera, positionKey, tmpWorld])

  if (!visible) return null

  const TitleBar = title ? (
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
      gap={12}
    >
      <Container
        flexGrow={1}
        height="100%"
        alignItems="center"
        justifyContent="flex-start"
        flexDirection="row"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <Text fontSize={24} color="#EAF6FF">
          {title}
        </Text>
      </Container>
      <UiIconButton label="X" onClick={onMinimize} size={36} />
    </Container>
  ) : null

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
        flexDirection="column"
      >
        {titlePlacement === 'top' && TitleBar}
        {children}
        {titlePlacement === 'bottom' && TitleBar}
      </Root>
    </group>
  )
}

export default function VRScene() {
  const { camera, gl } = useThree()
  const [panoRefreshToken, setPanoRefreshToken] = useState(0)
  const panos = usePanoList(panoRefreshToken)
  const [panoIndex, setPanoIndex] = useState(() => Number.parseInt(localStorage.getItem('panoIndex') || '0', 10) || 0)

  const [videoOpen, setVideoOpen] = useState(true)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryPage, setGalleryPage] = useState(0)
  const [openOrder, setOpenOrder] = useState([])
  const [windowPositions, setWindowPositions] = useState({})
  const [cinemaMode, setCinemaMode] = useState(false)
  const [ambientEnabled, setAmbientEnabled] = useState(() => (localStorage.getItem('ambientEnabled') ?? '1') !== '0')

  const src = panos.length ? panos[(panoIndex % panos.length + panos.length) % panos.length] : '/assets/foto.png'
  const videoSrc = '/assets/video.mp4'

  useEffect(() => {
    if (!panos.length) return
    const idx = (panoIndex % panos.length + panos.length) % panos.length
    localStorage.setItem('panoIndex', String(idx))
  }, [panoIndex, panos.length])


  const openVideo = useCallback(() => {
    setVideoOpen(true)
  }, [])
  const openGallery = useCallback(() => {
    setGalleryOpen(true)
    if (panos.length) setGalleryPage(Math.floor(panoIndex / GALLERY_PAGE_SIZE))
  }, [panos.length, panoIndex])

  const closeAll = useCallback(() => {
    setVideoOpen(false)
    setGalleryOpen(false)
  }, [])

  const videoRef = useRef(null)
  const ambientAudioRef = useRef(null)
  const [videoElement, setVideoElement] = useState(null)
  const videoTexture = useMemo(() => {
    if (!videoElement) return null
    const tex = new THREE.VideoTexture(videoElement)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [videoElement])
  const [playing, setPlaying] = useState(false)
  const [ambientStarted, setAmbientStarted] = useState(false)

  useEffect(() => {
    localStorage.setItem('ambientEnabled', ambientEnabled ? '1' : '0')
  }, [ambientEnabled])

  useEffect(() => {
    const el = document.createElement('video')
    el.src = videoSrc
    el.crossOrigin = 'anonymous'
    el.preload = 'auto'
    el.loop = true
    el.playsInline = true
    setVideoElement(el)

    return () => {
      try {
        el.pause()
      } catch (e) {
        // ignore
      }
      if (el.parentElement) el.remove()
      el.removeAttribute('src')
      el.load?.()
    }
  }, [videoSrc])

  useEffect(() => {
    const videoEl = videoElement
    if (!videoEl) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)

    videoEl.addEventListener('play', onPlay)
    videoEl.addEventListener('pause', onPause)
    videoEl.addEventListener('ended', onEnded)

    return () => {
      videoEl.removeEventListener('play', onPlay)
      videoEl.removeEventListener('pause', onPause)
      videoEl.removeEventListener('ended', onEnded)
    }
  }, [videoElement])

  useEffect(() => {
    const videoEl = videoElement
    if (!videoEl) return

    if (videoOpen) {
      if (!videoEl.isConnected) {
        document.body.append(videoEl)
        videoEl.style.position = 'absolute'
        videoEl.style.width = '1px'
        videoEl.style.height = '1px'
        videoEl.style.zIndex = '-1000'
        videoEl.style.top = '0px'
        videoEl.style.left = '0px'
      }
      videoEl.preload = 'auto'
      videoEl.playsInline = true
      return
    }

    try {
      videoEl.pause()
    } catch (e) {
      // ignore
    }
    if (videoEl.parentElement === document.body) videoEl.remove()
    setPlaying(false)
  }, [videoOpen, videoElement])




  const togglePlay = useCallback(async () => {
    const videoEl = videoElement ?? videoRef.current?.element
    if (!videoEl) return

    if (!videoEl.isConnected) {
      document.body.append(videoEl)
      videoEl.style.position = 'absolute'
      videoEl.style.width = '1px'
      videoEl.style.height = '1px'
      videoEl.style.zIndex = '-1000'
      videoEl.style.top = '0px'
      videoEl.style.left = '0px'
    }
    videoEl.preload = 'auto'
    videoEl.playsInline = true
    try {
      if (playing) {
        videoEl.pause()
      } else {
        if (videoEl.readyState < 2) {
          console.warn('Video not ready, trying to load')
          await new Promise((resolve, reject) => {
            const onReady = () => {
              cleanup()
              resolve()
            }
            const onError = () => {
              cleanup()
              reject(new Error('Video failed to load'))
            }
            const cleanup = () => {
              videoEl.removeEventListener('canplay', onReady)
              videoEl.removeEventListener('loadeddata', onReady)
              videoEl.removeEventListener('error', onError)
            }
            videoEl.addEventListener('canplay', onReady)
            videoEl.addEventListener('loadeddata', onReady)
            videoEl.addEventListener('error', onError)
            videoEl.load()
          })
        }
        await videoEl.play()
        // Start ambient audio after user interaction to bypass autoplay blocks
        if (ambientEnabled && ambientAudioRef.current && (!ambientStarted || ambientAudioRef.current.paused)) {
          try {
            await ambientAudioRef.current.play()
            setAmbientStarted(true)
          } catch (e) {
            console.warn('Ambient audio play failed:', e)
          }
        }
      }
    } catch (e) {
      console.error('Video play error:', e)
    }
  }, [playing, ambientStarted, ambientEnabled, videoElement])

  useEffect(() => {
    if (cinemaMode && videoElement && !playing) {
      togglePlay()
    }
  }, [cinemaMode, videoElement, playing, togglePlay])

  const nextPano = useCallback(() => {
    if (!panos.length) return
    setPanoIndex((i) => (i + 1) % panos.length)
  }, [panos.length])
  const prevPano = useCallback(() => {
    if (!panos.length) return
    setPanoIndex((i) => (i - 1 + panos.length) % panos.length)
  }, [panos.length])

  const pageSize = GALLERY_PAGE_SIZE
  const maxPage = Math.max(1, Math.ceil(panos.length / pageSize))
  const safePage = Math.min(maxPage - 1, Math.max(0, galleryPage))
  const pageStart = safePage * pageSize
  const pageItems = panos.slice(pageStart, pageStart + pageSize)

  const refreshPanos = useCallback(() => {
    setPanoRefreshToken((v) => v + 1)
  }, [])


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
  const savedDockPosition = useRef(new THREE.Vector3())
  const savedDockRotation = useRef(new THREE.Euler())

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
    savedDockPosition.current.copy(targetPos)
    savedDockRotation.current.set(0, yawToFace(camera, targetPos), 0)
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

  useEffect(() => {
    const audio = new Audio('/assets/geluid.mp3')
    audio.loop = true
    audio.volume = 1.0
    ambientAudioRef.current = audio
    if (!ambientEnabled) {
      audio.pause()
    }
    return () => {
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    const audio = ambientAudioRef.current
    if (!audio) return

    if (!ambientEnabled) {
      audio.pause()
      return
    }

    if (ambientStarted && audio.paused) {
      audio.play().catch((e) => console.warn('Ambient audio play failed:', e))
    }
  }, [ambientEnabled, ambientStarted])

  const toggleAmbient = useCallback(async () => {
    const audio = ambientAudioRef.current
    setAmbientEnabled((v) => !v)
    if (!audio) return

    if (ambientEnabled) {
      audio.pause()
      return
    }

    try {
      await audio.play()
      setAmbientStarted(true)
    } catch (e) {
      console.warn('Ambient audio play failed:', e)
    }
  }, [ambientEnabled])

  const placeWindows = useCallback((openKeys) => {
    if (!openKeys.length) {
      setWindowPositions({})
      return
    }
    const dockWorld = getDockWorld()
    const yaw = yawToFace(camera, dockWorld)
    const right = new THREE.Vector3(Math.sin(yaw + Math.PI / 2), 0, Math.cos(yaw + Math.PI / 2))

    const mapping = {}
    const slots = [0, 1, -1, 2, -2, 3, -3]
    const spacing = openKeys.length > 1 ? 2.25 : 1.4
    for (let i = 0; i < openKeys.length; i++) {
      const k = openKeys[i]
      const slot = slots[i] ?? (i % 2 === 0 ? Math.ceil(i / 2) : -Math.ceil(i / 2))
      const p = dockWorld.clone()
      p.y = dockWorld.y + 0.95
      p.add(right.clone().multiplyScalar(slot * spacing))
      mapping[k] = { position: [p.x, p.y, p.z], yaw }
    }
    setWindowPositions(mapping)
  }, [camera, getDockWorld])

  useEffect(() => {
    if (cinemaMode) return
    setOpenOrder((prev) => {
      let next = prev.filter((k) => (k === 'video' ? videoOpen : k === 'gallery' ? galleryOpen : false))
      if (videoOpen && !next.includes('video')) next = [...next, 'video']
      if (galleryOpen && !next.includes('gallery')) next = [...next, 'gallery']
      return next
    })
  }, [videoOpen, galleryOpen, cinemaMode])

  useEffect(() => {
    if (cinemaMode) return
    const orderedOpen = openOrder.filter((k) => (k === 'video' ? videoOpen : k === 'gallery' ? galleryOpen : false))
    placeWindows(orderedOpen)
  }, [videoOpen, galleryOpen, cinemaMode, openOrder, placeWindows])
  useEffect(() => {
    if (!cinemaMode && galleryOpen && panos.length) setGalleryPage(Math.floor(panoIndex / pageSize))
  }, [cinemaMode, galleryOpen, panos.length, panoIndex, pageSize])

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

  useEffect(() => {
    if (dockRef.current && !cinemaMode && dockPlaced.current) {
      dockRef.current.position.copy(savedDockPosition.current)
      dockRef.current.rotation.copy(savedDockRotation.current)
    }
  }, [cinemaMode])

  return (
    <>
      <Suspense fallback={null}>
        <PanoSphere src={src} />
      </Suspense>

      {!cinemaMode && (
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
              label={videoOpen ? 'Close Video' : 'Video Player'}
              onClick={() => {
                if (!videoOpen) {
                  setVideoOpen(true)
                } else {
                  setVideoOpen(false)
                }
              }}
              width={210}
              height={70}
            />
            <UiButton
              label="360 Gallery"
              onClick={() => {
                openGallery()
              }}
              width={210}
              height={70}
            />
            <UiButton
              label={ambientEnabled ? 'Ambient: On' : 'Ambient: Off'}
              onClick={toggleAmbient}
              width={200}
              height={70}
              variant={ambientEnabled ? 'primary' : 'secondary'}
            />
            <Container
              onClick={closeAll}
              width={160}
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
      )}

      <Window
        visible={videoOpen && !cinemaMode}
        initialPosition={windowPositions.video?.position ?? [-1.0, 1.55, -2]}
        title="Video Player"
        titlePlacement="bottom"
        width={1000}
        height={750}
      >
        <Container flexGrow={1} width="100%" backgroundColor="black">
          <Video
            ref={videoRef}
            src={videoElement ?? undefined}
            crossOrigin="anonymous"
            autoplay={false}
            loop
            playsInline
            preload="auto"
            width="100%"
            height="100%"
            borderRadius={16}
            onError={(e) => console.error('Video loading error:', e)}
          />
        </Container>
        <Container padding={10} justifyContent="center" alignItems="center" flexDirection="row" gap={20}>
          <UiButton label={playing ? 'Pause' : 'Play'} onClick={togglePlay} width={160} height={52} />
          <UiButton label="Cinema Mode" onClick={() => {
            if (dockRef.current) {
              savedDockPosition.current.copy(dockRef.current.position)
              savedDockRotation.current.copy(dockRef.current.rotation)
            }
            setCinemaMode(true)
          }} width={160} height={52} />
          <UiButton label="Close" onClick={() => setVideoOpen(false)} width={160} height={52} />
        </Container>
      </Window>

      <Window
        visible={galleryOpen && !cinemaMode}
        initialPosition={windowPositions.gallery?.position ?? [1.0, 1.55, -2]}
        title="360 Gallery"
        titlePlacement="bottom"
        onMinimize={() => setGalleryOpen(false)}
        width={1000}
        height={760}
      >
        <Container width="100%" flexDirection="row" alignItems="center" justifyContent="space-between" gap={12}>
          <Container flexDirection="row" gap={10}>
            <UiButton
              label="Prev"
              variant={safePage > 0 ? 'primary' : 'secondary'}
              onClick={() => {
                if (safePage > 0) setGalleryPage((p) => Math.max(0, p - 1))
              }}
              width={130}
              height={52}
            />
            <UiButton
              label="Next"
              variant={safePage < maxPage - 1 ? 'primary' : 'secondary'}
              onClick={() => {
                if (safePage < maxPage - 1) setGalleryPage((p) => Math.min(maxPage - 1, p + 1))
              }}
              width={130}
              height={52}
            />
          </Container>
          <Text fontSize={18} color="#EAF6FF">
            Page {safePage + 1}/{maxPage}
          </Text>
          <UiButton label="Refresh" onClick={refreshPanos} width={160} height={52} variant="secondary" />
        </Container>

        <Container flexGrow={1} width="100%" flexDirection="row" flexWrap="wrap" gap={10} padding={10}>
          {pageItems.map((p, idx) => {
            const selected = p === src
            const i = pageStart + idx
            return (
              <Container
                key={p}
                onClick={() => setPanoIndex(i)}
                width="32%"
                height={190}
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                backgroundColor={selected ? '#00f2fe' : '#ffffff'}
                backgroundOpacity={selected ? 0.18 : 0.06}
                borderRadius={16}
                padding={10}
              >
                <Image src={p} width="100%" height="100%" borderRadius={10} />
              </Container>
            )
          })}
        </Container>
      </Window>

      {cinemaMode && (
        <>
          <mesh>
            <sphereGeometry args={[25, 64, 32]} />
            <meshBasicMaterial color="black" opacity={0.8} transparent side={THREE.BackSide} />
          </mesh>
          <mesh position={[0, 1.5, -3]} onClick={() => setCinemaMode(false)}>
            <planeGeometry args={[6, 3.375]} />
            <meshBasicMaterial map={videoTexture} />
          </mesh>
          <group position={[0, -2, -2]}>
            <Root
              pixelSize={UI_PIXEL_SIZE}
              width={200}
              height={60}
              backgroundColor="#000000"
              backgroundOpacity={0.5}
              borderRadius={10}
            >
              <Container width="100%" height="100%" alignItems="center" justifyContent="center">
                <UiButton label="Back" onClick={() => setCinemaMode(false)} width={180} height={50} />
              </Container>
            </Root>
          </group>
        </>
      )}
    </>
  )
}
