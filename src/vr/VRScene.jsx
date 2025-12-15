import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Root, Container, Text, Image, Video } from '@react-three/uikit'

const UI_PIXEL_SIZE = 0.0013

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
          <Container
            onClick={onMinimize}
            width={36}
            height={36}
            alignItems="center"
            justifyContent="center"
            backgroundColor="#000000"
            backgroundOpacity={0.55}
            borderRadius={999}
          >
            <Text fontSize={20} color="#FFFFFF">
              X
            </Text>
          </Container>
        </Container>

        {children}
      </Root>
    </group>
  )
}

export default function VRScene() {
  const panos = usePanoList()
  const [panoIndex, setPanoIndex] = useState(() => Number.parseInt(localStorage.getItem('panoIndex') || '0', 10) || 0)
  const videos = useVideoList()
  const [videoIndex, setVideoIndex] = useState(() => Number.parseInt(localStorage.getItem('videoIndex') || '0', 10) || 0)

  const [menuOpen, setMenuOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(true)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryPage, setGalleryPage] = useState(0)

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
    setMenuOpen(false)
  }, [])
  const openGallery = useCallback(() => {
    setGalleryOpen(true)
    setMenuOpen(false)
    if (panos.length) setGalleryPage(Math.floor(panoIndex / 6))
  }, [panos.length, panoIndex])

  const videoRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const prime = async () => {
      const el = videoRef.current?.element
      if (!el) return
      try {
        el.muted = true
        await el.play()
        el.pause()
        el.currentTime = 0
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
  }, [videoSrc])

  const togglePlay = useCallback(async () => {
    const videoEl = videoRef.current?.element
    if (!videoEl) return
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
    } catch (e) {}
  }, [playing])

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

  return (
    <>
      <Suspense fallback={null}>
        <PanoSphere src={src} />
      </Suspense>

      <FollowCameraGroup>
        <Root
          pixelSize={UI_PIXEL_SIZE}
          width={520}
          height={110}
          backgroundColor="#0b1620"
          backgroundOpacity={0.72}
          borderRadius={999}
          padding={10}
        >
          <Container width="100%" height="100%" flexDirection="row" alignItems="center" justifyContent="space-between" gap={10} paddingX={10}>
            <Container
              onClick={() => setMenuOpen((v) => !v)}
              width={44}
              height={44}
              backgroundColor="#000000"
              backgroundOpacity={0.55}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={20} color="#fff">
                M
              </Text>
            </Container>
            <Container
              onClick={openVideo}
              width={44}
              height={44}
              backgroundColor="#000000"
              backgroundOpacity={0.55}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={18} color="#fff">
                V
              </Text>
            </Container>
            <Container
              onClick={openGallery}
              width={44}
              height={44}
              backgroundColor="#000000"
              backgroundOpacity={0.55}
              borderRadius={999}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={14} color="#fff">
                360
              </Text>
            </Container>
          </Container>
        </Root>
      </FollowCameraGroup>

      <Window
        visible={menuOpen}
        initialPosition={[0, 1.55, -1.2]}
        title="Menu"
        onMinimize={() => setMenuOpen(false)}
        width={700}
        height={520}
      >
        <Container width="100%" gap={10}>
          <Container
            onClick={openVideo}
            width="100%"
            height={56}
            backgroundColor="#ffffff"
            backgroundOpacity={0.1}
            borderRadius={14}
            paddingX={16}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={18} color="#EAF6FF">Video Player</Text>
          </Container>
          <Container
            onClick={openGallery}
            width="100%"
            height={56}
            backgroundColor="#ffffff"
            backgroundOpacity={0.1}
            borderRadius={14}
            paddingX={16}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={18} color="#EAF6FF">360 Gallery</Text>
          </Container>
          <Container
            onClick={() => setMenuOpen(false)}
            width="100%"
            height={56}
            backgroundColor="#ffffff"
            backgroundOpacity={0.06}
            borderRadius={14}
            paddingX={16}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={18} color="#A9D7FF">Close</Text>
          </Container>
        </Container>
      </Window>

      <Window
        visible={videoOpen}
        initialPosition={[0, 1.45, -2]}
        title="Video Player"
        onMinimize={() => setVideoOpen(false)}
        width={1100}
        height={760}
      >
        <Container width="100%" gap={12}>
          <Video
            ref={videoRef}
            src={videoSrc}
            muted={muted}
            loop
            playsInline
            preload="auto"
            width="100%"
            height={520}
            borderRadius={16}
          />

          <Container width="100%" flexDirection="row" gap={10} alignItems="center" justifyContent="space-between">
            <Container
              onClick={togglePlay}
              width={120}
              height={44}
              backgroundColor="#000000"
              backgroundOpacity={0.55}
              borderRadius={14}
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize={18} color="#fff">{playing ? 'Pause' : 'Play'}</Text>
            </Container>
            <Container flexDirection="row" gap={8} alignItems="center">
              <Container
                onClick={prevVideo}
                width={44}
                height={44}
                backgroundColor="#000000"
                backgroundOpacity={0.55}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={18} color="#fff">{'<'}</Text>
              </Container>
              <Container
                onClick={nextVideo}
                width={44}
                height={44}
                backgroundColor="#000000"
                backgroundOpacity={0.55}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={18} color="#fff">{'>'}</Text>
              </Container>
              <Container
                width={520}
                height={44}
                backgroundColor="#ffffff"
                backgroundOpacity={0.08}
                borderRadius={14}
                paddingX={12}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={14} color="#A9D7FF">
                  {videoSrc.replace('/assets/', '')}
                </Text>
              </Container>
            </Container>
          </Container>
        </Container>
      </Window>

      <Window
        visible={galleryOpen}
        initialPosition={[0.85, 1.45, -1.75]}
        title="360 Gallery"
        onMinimize={() => setGalleryOpen(false)}
        width={1000}
        height={760}
      >
        <Container width="100%" gap={12}>
          <Container width="100%" flexDirection="row" alignItems="center" justifyContent="space-between">
            <Text fontSize={16} color="#EAF6FF">
              {src.replace('/assets/', '')}
            </Text>
          </Container>

          <Container width="100%" flexDirection="row" flexWrap="wrap" gap={10} justifyContent="space-between">
            {pageItems.map((p, i) => {
              const selected = p === src
              const absoluteIndex = pageStart + i
              return (
                <Container
                  key={p}
                  onClick={() => setPanoIndex(absoluteIndex)}
                  width={170}
                  height={96}
                  backgroundColor={selected ? '#00f2fe' : '#ffffff'}
                  backgroundOpacity={selected ? 0.22 : 0.06}
                  borderRadius={14}
                  padding={6}
                >
                  <Image src={p} width="100%" height="100%" borderRadius={12} />
                </Container>
              )
            })}
          </Container>

          <Container width="100%" flexDirection="row" alignItems="center" justifyContent="space-between">
            <Container flexDirection="row" gap={8} alignItems="center">
              <Container
                onClick={() => setGalleryPage((p) => Math.max(0, p - 1))}
                width={44}
                height={44}
                backgroundColor="#000000"
                backgroundOpacity={0.55}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={18} color="#fff">
                  {'<'}
                </Text>
              </Container>
              <Container
                onClick={() => setGalleryPage((p) => Math.min(maxPage - 1, p + 1))}
                width={44}
                height={44}
                backgroundColor="#000000"
                backgroundOpacity={0.55}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={18} color="#fff">
                  {'>'}
                </Text>
              </Container>
              <Text fontSize={14} color="#A9D7FF">
                Page {safePage + 1}/{maxPage}
              </Text>
            </Container>

            <Container flexDirection="row" gap={8} alignItems="center">
              <Container
                onClick={prevPano}
                width={44}
                height={44}
                backgroundColor="#000000"
                backgroundOpacity={0.55}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={18} color="#fff">{'⟲'}</Text>
              </Container>
              <Container
                onClick={nextPano}
                width={44}
                height={44}
                backgroundColor="#000000"
                backgroundOpacity={0.55}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize={18} color="#fff">{'⟳'}</Text>
              </Container>
            </Container>
          </Container>
        </Container>
      </Window>
    </>
  )
}
