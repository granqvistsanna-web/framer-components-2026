/**
 * #36 ThreeJS Infinite Slider
 *
 * Infinite-scroll image slider with WebGL distortion effect.
 * Supports vertical and horizontal directions.
 */
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import * as React from "react"
import { startTransition, useEffect, useRef, useState } from "react"
import * as THREE from "three"

// ---------------------------------------------------------------------------
// Config defaults
// ---------------------------------------------------------------------------

const DEFAULT_SLIDES = [
    { image: "", title: "Slide 1" },
    { image: "", title: "Slide 2" },
    { image: "", title: "Slide 3" },
    { image: "", title: "Slide 4" },
    { image: "", title: "Slide 5" },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlideData {
    image?: string
    title?: string
    link?: string
}

interface SlideSize {
    aspectRatio?: number
    minHeight?: number
    maxHeight?: number
    gap?: number
}

interface ScrollTuning {
    smoothing?: number
    momentum?: number
    wheelSpeed?: number
    dragSpeed?: number
}

interface ThreeJSSliderProps {
    slides?: SlideData[]
    backgroundColor?: string
    direction?: "vertical" | "horizontal"
    slideSize?: SlideSize
    interactive?: boolean
    distortionStrength?: number
    borderRadius?: number
    activeScale?: number
    randomHeights?: boolean
    snapToSlide?: boolean
    snapStrength?: number
    scrollTuning?: ScrollTuning
    showOverlay?: boolean
    overlayFont?: Record<string, any>
    overlayColor?: string
    overlaySize?: number
    counterSize?: number
    overlayPosition?: "top-left" | "top-center" | "top-right" | "top-split" | "center-left" | "center" | "center-right" | "center-split" | "bottom-left" | "bottom-center" | "bottom-right" | "bottom-split"
    autoplay?: boolean
    autoplaySpeed?: number
    maxDpr?: number
    enableMotion?: boolean
    respectReducedMotion?: boolean
    style?: React.CSSProperties
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const wrap = (value: number, range: number) => ((value % range) + range) % range
const zeroPad = (n: number) => String(n).padStart(2, "0")

/** Parse rgba/hsla color strings (from Framer) into a format THREE.Color supports */
const parseColor = (color: string): string => {
    const rgba = color.match(
        /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    )
    if (rgba) return `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`
    const hsla = color.match(
        /hsla?\(\s*([\d.]+)\s*,\s*([\d.%]+)\s*,\s*([\d.%]+)/
    )
    if (hsla) return `hsl(${hsla[1]}, ${hsla[2]}, ${hsla[3]})`
    return color
}

// ---------------------------------------------------------------------------
// Static fallback
// ---------------------------------------------------------------------------

function StaticFallback({
    slides,
    backgroundColor,
    overlayColor,
    style,
}: {
    slides: SlideData[]
    backgroundColor: string
    overlayColor: string
    style?: React.CSSProperties
}) {
    const firstWithImage = slides.find((s) => s.image)
    return (
        <div
            style={{
                ...style,
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                background: backgroundColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            {firstWithImage?.image && (
                <img
                    src={firstWithImage.image}
                    alt={firstWithImage.title || ""}
                    style={{
                        maxWidth: "60%",
                        maxHeight: "70%",
                        objectFit: "cover",
                        borderRadius: 2,
                    }}
                />
            )}
            <div
                style={{
                    position: "absolute",
                    bottom: 24,
                    left: 24,
                    color: overlayColor,
                    fontFamily: "Inter, sans-serif",
                    fontSize: 14,
                    opacity: 0.7,
                }}
            >
                {slides.length} slides
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function ThreeJSSlider(props: ThreeJSSliderProps) {
    const {
        slides = DEFAULT_SLIDES,
        backgroundColor = "#141414",
        direction = "vertical",
        slideSize,
        interactive = true,
        distortionStrength = 2.5,
        borderRadius = 0,
        activeScale = 1.0,
        randomHeights = true,
        snapToSlide = false,
        snapStrength = 0.03,
        scrollTuning,
        showOverlay = true,
        overlayFont = {},
        overlayColor = "#ffffff",
        overlaySize = 16,
        counterSize = 14,
        overlayPosition = "bottom-left",
        autoplay = false,
        autoplaySpeed = 0.15,
        maxDpr = 2,
        enableMotion = true,
        respectReducedMotion = true,
        style,
    } = props

    const slideAspectRatio = slideSize?.aspectRatio ?? 1.5
    const slideMinHeight = slideSize?.minHeight ?? 1
    const slideMaxHeight = slideSize?.maxHeight ?? 1.5
    const slideGap = slideSize?.gap ?? 0.05
    const scrollSmoothing = scrollTuning?.smoothing ?? 0.05
    const momentumFriction = scrollTuning?.momentum ?? 0.95
    const wheelSpeed = scrollTuning?.wheelSpeed ?? 0.01
    const dragSpeed = scrollTuning?.dragSpeed ?? 0.01

    const isStatic = useIsStaticRenderer()
    const outerRef = useRef<HTMLDivElement>(null)
    const canvasContainerRef = useRef<HTMLDivElement>(null)
    const [activeSlide, setActiveSlide] = useState(0)
    const [webglFailed, setWebglFailed] = useState(false)

    // Ref for programmatic scroll from keyboard nav
    const scrollTargetRef = useRef<((delta: number) => void) | null>(null)
    // Ref for click-to-navigate (set by WebGL effect, read by click handler)
    const activeSlideIndexRef = useRef(0)

    // Stabilize slides reference — only change when content changes
    const slidesRef = useRef(slides)
    const slidesKey = JSON.stringify(
        slides.map((s) => `${s.image || ""}|${s.title || ""}|${s.link || ""}`)
    )
    const slidesKeyRef = useRef(slidesKey)
    if (slidesKey !== slidesKeyRef.current) {
        slidesKeyRef.current = slidesKey
        slidesRef.current = slides
    }

    // Refs for mutable state accessed in animation loop
    const configRef = useRef({
        backgroundColor,
        direction,
        slideAspectRatio,
        slideMinHeight,
        slideMaxHeight,
        slideGap,
        distortionStrength,
        borderRadius,
        activeScale,
        randomHeights,
        scrollSmoothing,
        momentumFriction,
        wheelSpeed,
        dragSpeed,
        snapToSlide,
        snapStrength,
        autoplay,
        autoplaySpeed,
        maxDpr,
        enableMotion,
        respectReducedMotion,
        interactive,
    })
    configRef.current = {
        backgroundColor,
        direction,
        slideAspectRatio,
        slideMinHeight,
        slideMaxHeight,
        slideGap,
        distortionStrength,
        borderRadius,
        activeScale,
        randomHeights,
        scrollSmoothing,
        momentumFriction,
        wheelSpeed,
        dragSpeed,
        snapToSlide,
        snapStrength,
        autoplay,
        autoplaySpeed,
        maxDpr,
        enableMotion,
        respectReducedMotion,
        interactive,
    }

    // Check reduced motion preference
    const prefersReducedMotionRef = useRef(false)
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => {
            prefersReducedMotionRef.current = mq.matches
        }
        update()
        mq.addEventListener?.("change", update)
        return () => mq.removeEventListener?.("change", update)
    }, [])

    // -----------------------------------------------------------------------
    // Main WebGL setup
    // -----------------------------------------------------------------------
    useEffect(() => {
        if (isStatic) return () => {}
        const container = canvasContainerRef.current
        if (!container) return () => {}

        const validSlides = slidesRef.current.filter((s) => s.image)
        if (validSlides.length === 0) return () => {}

        const totalSlides = validSlides.length

        // Three.js setup
        let renderer: THREE.WebGLRenderer
        try {
            renderer = new THREE.WebGLRenderer({
                antialias: true,
                powerPreference: "high-performance",
            })
        } catch {
            startTransition(() => setWebglFailed(true))
            return () => {}
        }

        startTransition(() => setWebglFailed(false))

        const getSize = () => {
            const rect = container.getBoundingClientRect()
            return {
                width: Math.max(1, Math.floor(rect.width)),
                height: Math.max(1, Math.floor(rect.height)),
            }
        }

        const size = getSize()
        renderer.setSize(size.width, size.height, false)
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
        renderer.domElement.style.width = "100%"
        renderer.domElement.style.height = "100%"
        renderer.domElement.style.display = "block"
        container.appendChild(renderer.domElement)

        let disposed = false

        const scene = new THREE.Scene()
        const bgColorObj = new THREE.Color(parseColor(backgroundColor))
        scene.background = bgColorObj
        let lastBgColor = backgroundColor

        const camera = new THREE.PerspectiveCamera(
            45,
            size.width / size.height,
            0.1,
            100
        )
        camera.position.z = 5

        // Generate slide heights (random or uniform)
        const slideHeights = Array.from(
            { length: totalSlides },
            () =>
                configRef.current.randomHeights
                    ? configRef.current.slideMinHeight +
                      Math.random() * (configRef.current.slideMaxHeight - configRef.current.slideMinHeight)
                    : configRef.current.slideMaxHeight
        )

        const slideOffsets: number[] = []
        let stackPosition = 0
        for (let i = 0; i < totalSlides; i++) {
            if (i === 0) {
                slideOffsets.push(0)
                stackPosition = slideHeights[0] / 2
            } else {
                stackPosition += configRef.current.slideGap + slideHeights[i] / 2
                slideOffsets.push(stackPosition)
                stackPosition += slideHeights[i] / 2
            }
        }

        const loopLength =
            stackPosition + configRef.current.slideGap + slideHeights[0] / 2
        const halfLoop = loopLength / 2

        // Create meshes
        const meshes: THREE.Mesh[] = []
        const textureLoader = new THREE.TextureLoader()

        // Cover-fill shader — maps texture like CSS object-fit: cover
        const coverVertexShader = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `
        const coverFragmentShader = `
            uniform sampler2D uTexture;
            uniform vec2 uPlaneAspect;
            uniform vec2 uImageAspect;
            uniform float uOpacity;
            uniform float uBorderRadius;
            varying vec2 vUv;
            void main() {
                vec2 uv = vUv;
                float planeRatio = uPlaneAspect.x / uPlaneAspect.y;
                float imageRatio = uImageAspect.x / uImageAspect.y;
                if (planeRatio > imageRatio) {
                    float scale = imageRatio / planeRatio;
                    uv.y = uv.y * scale + (1.0 - scale) * 0.5;
                } else {
                    float scale = planeRatio / imageRatio;
                    uv.x = uv.x * scale + (1.0 - scale) * 0.5;
                }
                vec4 texColor = texture2D(uTexture, uv);
                vec4 placeholder = vec4(0.15, 0.15, 0.15, 1.0);
                gl_FragColor = mix(placeholder, texColor, uOpacity);

                // Rounded corners via SDF
                if (uBorderRadius > 0.0) {
                    float ar = uPlaneAspect.x / uPlaneAspect.y;
                    vec2 uvCorr = (vUv - 0.5) * vec2(ar, 1.0);
                    vec2 halfSize = vec2(ar * 0.5, 0.5);
                    float r = uBorderRadius;
                    vec2 q = abs(uvCorr) - halfSize + r;
                    float d = length(max(q, 0.0)) - r;
                    gl_FragColor.a *= 1.0 - smoothstep(-0.003, 0.003, d);
                }
            }
        `

        for (let i = 0; i < totalSlides; i++) {
            const height = slideHeights[i]
            const width = height * configRef.current.slideAspectRatio

            const geometry = new THREE.PlaneGeometry(width, height, 32, 16)
            const material = new THREE.ShaderMaterial({
                vertexShader: coverVertexShader,
                fragmentShader: coverFragmentShader,
                uniforms: {
                    uTexture: { value: null },
                    uPlaneAspect: { value: new THREE.Vector2(width, height) },
                    uImageAspect: { value: new THREE.Vector2(1, 1) },
                    uOpacity: { value: 0.0 },
                    uBorderRadius: { value: borderRadius },
                },
                transparent: true,
                side: THREE.DoubleSide,
            })
            const mesh = new THREE.Mesh(geometry, material)

            mesh.userData = {
                originalVertices: [...geometry.attributes.position.array],
                offset: slideOffsets[i],
                index: i,
            }

            const imgUrl = validSlides[i].image
            if (imgUrl) {
                textureLoader.load(imgUrl, (texture) => {
                    if (disposed) {
                        texture.dispose()
                        return
                    }
                    material.uniforms.uTexture.value = texture
                    material.uniforms.uImageAspect.value.set(
                        texture.image.width,
                        texture.image.height
                    )
                    mesh.userData.opacityTarget = 1.0
                })
            }

            scene.add(mesh)
            meshes.push(mesh)
        }

        // Distortion
        function applyDistortion(
            mesh: THREE.Mesh,
            scrollAxisPos: number,
            strength: number,
            horizontal: boolean
        ) {
            const positions = (mesh.geometry as THREE.PlaneGeometry).attributes
                .position
            const original = mesh.userData.originalVertices as number[]

            for (let i = 0; i < positions.count; i++) {
                const x = original[i * 3]
                const y = original[i * 3 + 1]
                const distance = horizontal
                    ? Math.sqrt((scrollAxisPos + x) ** 2 + y * y)
                    : Math.sqrt(x * x + (scrollAxisPos + y) ** 2)
                const falloff = Math.max(0, 1 - distance / 2)
                const bend = Math.pow(Math.sin((falloff * Math.PI) / 2), 1.5)
                positions.setZ(i, bend * strength)
            }
            positions.needsUpdate = true
            mesh.geometry.computeVertexNormals()
        }

        // Scroll state
        let scrollPosition = 0
        let scrollTarget = 0
        let scrollMomentum = 0
        let isScrolling = false
        let lastFrameTime = 0

        let distortionAmount = 0
        let distortionTarget = 0
        let velocityPeak = 0
        let scrollDirection = 0
        let directionTarget = 0
        const velocityHistory = [0, 0, 0, 0, 0]

        let isDragging = false
        let dragStartY = 0
        let dragStartX = 0
        let dragDelta = 0
        let totalDragDistance = 0
        let touchStartX = 0
        let touchStartY = 0
        let touchLastX = 0
        let touchLastY = 0
        let touchTotalDistance = 0

        let activeSlideIndex = -1
        let scrollTimeout: ReturnType<typeof setTimeout> | null = null
        let isHovered = false
        let autoplayIdleTime = 0

        const addDistortionBurst = (amount: number) => {
            distortionTarget = Math.min(1, distortionTarget + amount)
        }

        // Event handlers scoped to container
        const onWheel = (e: WheelEvent) => {
            if (!configRef.current.interactive) return
            e.preventDefault()
            // Use deltaX for horizontal (trackpad), fall back to deltaY
            const isHoriz = configRef.current.direction === "horizontal"
            const rawDelta = isHoriz
                ? (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)
                : e.deltaY
            const clampedDelta =
                Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), 150)
            addDistortionBurst(Math.abs(clampedDelta) * 0.001)
            scrollTarget += clampedDelta * configRef.current.wheelSpeed
            isScrolling = true
            if (scrollTimeout) clearTimeout(scrollTimeout)
            scrollTimeout = setTimeout(() => (isScrolling = false), 150)
        }

        const onTouchStart = (e: TouchEvent) => {
            if (!configRef.current.interactive) return
            touchStartX = touchLastX = e.touches[0].clientX
            touchStartY = touchLastY = e.touches[0].clientY
            touchTotalDistance = 0
            scrollMomentum = 0
            if (scrollTimeout) clearTimeout(scrollTimeout)
        }

        const onTouchMove = (e: TouchEvent) => {
            if (!configRef.current.interactive) return
            e.preventDefault()
            const isHoriz = configRef.current.direction === "horizontal"
            const delta = isHoriz
                ? e.touches[0].clientX - touchLastX
                : e.touches[0].clientY - touchLastY
            touchLastX = e.touches[0].clientX
            touchLastY = e.touches[0].clientY
            touchTotalDistance += Math.abs(delta)
            addDistortionBurst(Math.abs(delta) * 0.02)
            scrollTarget -= delta * 0.01
            isScrolling = true
        }

        const onTouchEnd = () => {
            if (!configRef.current.interactive) return
            const isHoriz = configRef.current.direction === "horizontal"
            // Tap detection — click-to-center or follow link
            if (touchTotalDistance < 5) {
                const clicked = getClickedSlide(touchStartX, touchStartY)
                if (clicked !== null && clicked !== activeSlideIndex) {
                    scrollToSlide(clicked)
                } else {
                    const link = validSlides[activeSlideIndex]?.link
                    if (link) window.open(link, "_blank", "noopener")
                }
            }
            const swipeDelta = isHoriz
                ? touchLastX - touchStartX
                : touchLastY - touchStartY
            const swipeVelocity = swipeDelta * 0.005
            if (Math.abs(swipeVelocity) > 0.5) {
                scrollMomentum = -swipeVelocity * 0.1
                addDistortionBurst(Math.abs(swipeVelocity) * 0.45)
                isScrolling = true
                if (scrollTimeout) clearTimeout(scrollTimeout)
                scrollTimeout = setTimeout(() => (isScrolling = false), 800)
            } else {
                // No swipe — reset isScrolling that onTouchMove set
                if (scrollTimeout) clearTimeout(scrollTimeout)
                scrollTimeout = setTimeout(() => (isScrolling = false), 150)
            }
        }

        const onPointerDown = (e: PointerEvent) => {
            if (!configRef.current.interactive) return
            if (e.pointerType === "touch") return
            isDragging = true
            dragStartX = e.clientX
            dragStartY = e.clientY
            dragDelta = 0
            totalDragDistance = 0
            scrollMomentum = 0
            renderer.domElement.style.cursor = "grabbing"
        }

        const onPointerMove = (e: PointerEvent) => {
            if (!configRef.current.interactive || !isDragging) return
            if (e.pointerType === "touch") return
            const isHoriz = configRef.current.direction === "horizontal"
            const delta = isHoriz
                ? e.clientX - dragStartX
                : e.clientY - dragStartY
            dragStartX = e.clientX
            dragStartY = e.clientY
            dragDelta = delta
            totalDragDistance += Math.abs(delta)
            addDistortionBurst(Math.abs(delta) * 0.02)
            scrollTarget -= delta * configRef.current.dragSpeed
            isScrolling = true
        }

        const onPointerUp = (e: PointerEvent) => {
            if (!isDragging) return
            if (e.pointerType === "touch") return
            isDragging = false
            renderer.domElement.style.cursor = configRef.current.interactive
                ? "grab"
                : "default"
            // Click detection — click-to-center or follow link
            if (totalDragDistance < 5) {
                const clicked = getClickedSlide(e.clientX, e.clientY)
                if (clicked !== null && clicked !== activeSlideIndex) {
                    scrollToSlide(clicked)
                } else {
                    const link = validSlides[activeSlideIndex]?.link
                    if (link) window.open(link, "_blank", "noopener")
                }
                return
            }
            if (Math.abs(dragDelta) > 2) {
                scrollMomentum = -dragDelta * 0.01
                addDistortionBurst(Math.abs(dragDelta) * 0.005)
                isScrolling = true
                setTimeout(() => (isScrolling = false), 800)
            }
        }

        renderer.domElement.style.cursor = interactive ? "grab" : "default"

        // Raycaster for click-to-center
        const raycaster = new THREE.Raycaster()
        const pointerNDC = new THREE.Vector2()

        const getClickedSlide = (clientX: number, clientY: number): number | null => {
            const rect = renderer.domElement.getBoundingClientRect()
            pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1
            pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1
            raycaster.setFromCamera(pointerNDC, camera)
            const hits = raycaster.intersectObjects(meshes)
            if (hits.length > 0) return hits[0].object.userData.index as number
            return null
        }

        const scrollToSlide = (targetIndex: number) => {
            const targetOffset = slideOffsets[targetIndex]
            const wrappedPos = wrap(scrollTarget, loopLength)
            let delta = targetOffset - wrappedPos
            if (delta > halfLoop) delta -= loopLength
            if (delta < -halfLoop) delta += loopLength
            addDistortionBurst(Math.min(1, Math.abs(delta) * 0.4))
            scrollTarget += delta
            isScrolling = true
            if (scrollTimeout) clearTimeout(scrollTimeout)
            scrollTimeout = setTimeout(() => (isScrolling = false), 600)
        }

        // Expose scroll function for keyboard nav
        scrollTargetRef.current = (delta: number) => {
            addDistortionBurst(Math.abs(delta) * 0.3)
            scrollTarget += delta
            isScrolling = true
            if (scrollTimeout) clearTimeout(scrollTimeout)
            scrollTimeout = setTimeout(() => (isScrolling = false), 300)
        }

        const onMouseEnter = () => { isHovered = true }
        const onMouseLeave = () => { isHovered = false; autoplayIdleTime = 0 }

        container.addEventListener("mouseenter", onMouseEnter)
        container.addEventListener("mouseleave", onMouseLeave)
        container.addEventListener("wheel", onWheel, { passive: false })
        container.addEventListener("touchstart", onTouchStart, {
            passive: true,
        })
        container.addEventListener("touchmove", onTouchMove, { passive: false })
        container.addEventListener("touchend", onTouchEnd)
        container.addEventListener("pointerdown", onPointerDown)
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)

        // Resize
        const resize = () => {
            const s = getSize()
            renderer.setSize(s.width, s.height, false)
            camera.aspect = s.width / s.height
            camera.updateProjectionMatrix()
            renderer.setPixelRatio(
                Math.min(
                    window.devicePixelRatio || 1,
                    configRef.current.maxDpr
                )
            )
        }

        let resizeObserver: ResizeObserver | null = null
        if (typeof ResizeObserver === "function") {
            resizeObserver = new ResizeObserver(resize)
            resizeObserver.observe(container)
        } else {
            window.addEventListener("resize", resize)
        }
        resize()

        // Animation loop
        let rafId = 0

        const animate = (time: number) => {
            rafId = requestAnimationFrame(animate)

            const cfg = configRef.current
            const motionEnabled =
                cfg.enableMotion &&
                !(cfg.respectReducedMotion && prefersReducedMotionRef.current)

            const rawDelta = lastFrameTime
                ? (time - lastFrameTime) / 1000
                : 0.016
            const deltaTime = Math.min(rawDelta, 0.1) // Cap to prevent spikes on tab return
            lastFrameTime = time

            const previousScroll = scrollPosition

            if (motionEnabled && isScrolling) {
                scrollTarget += scrollMomentum
                scrollMomentum *= cfg.momentumFriction
                if (Math.abs(scrollMomentum) < 0.001) scrollMomentum = 0
            }

            // Snap-to-slide: when idle, ease scrollTarget toward nearest slide
            if (
                cfg.snapToSlide &&
                !isScrolling &&
                Math.abs(scrollMomentum) < 0.001
            ) {
                const wrappedPos = wrap(scrollTarget, loopLength)
                let bestDist = Infinity
                let bestOffset = 0
                for (let i = 0; i < totalSlides; i++) {
                    let d = slideOffsets[i] - wrappedPos
                    // Check both wrap directions
                    if (d > halfLoop) d -= loopLength
                    if (d < -halfLoop) d += loopLength
                    if (Math.abs(d) < Math.abs(bestDist)) {
                        bestDist = d
                        bestOffset = d
                    }
                }
                if (Math.abs(bestOffset) > 0.001) {
                    scrollTarget += bestOffset * cfg.snapStrength
                }
            }

            // Autoplay: continuously scroll when idle and not hovered
            if (cfg.autoplay && motionEnabled && !isScrolling && !isDragging) {
                if (isHovered) {
                    autoplayIdleTime = 0
                } else {
                    autoplayIdleTime += deltaTime
                    if (autoplayIdleTime > 0.8) {
                        scrollTarget += cfg.autoplaySpeed * deltaTime
                    }
                }
            } else {
                autoplayIdleTime = 0
            }

            scrollPosition +=
                (scrollTarget - scrollPosition) * cfg.scrollSmoothing

            // Normalize to prevent floating-point drift over extended use
            if (Math.abs(scrollPosition) > loopLength * 1000) {
                const offset =
                    Math.floor(scrollPosition / loopLength) * loopLength
                scrollPosition -= offset
                scrollTarget -= offset
            }

            const frameDelta = scrollPosition - previousScroll

            if (Math.abs(frameDelta) > 0.00001) {
                directionTarget = frameDelta > 0 ? 1 : -1
            }
            scrollDirection += (directionTarget - scrollDirection) * 0.08

            const velocity = Math.abs(frameDelta) / deltaTime
            velocityHistory.push(velocity)
            velocityHistory.shift()
            const avgVelocity =
                velocityHistory.reduce((a, b) => a + b) /
                velocityHistory.length

            if (avgVelocity > velocityPeak) velocityPeak = avgVelocity
            const isDecelerating =
                avgVelocity / (velocityPeak + 0.001) < 0.7 &&
                velocityPeak > 0.5
            velocityPeak *= 0.99

            if (velocity > 0.05)
                distortionTarget = Math.max(
                    distortionTarget,
                    Math.min(1, velocity * 0.1)
                )
            if (isDecelerating || avgVelocity < 0.2)
                distortionTarget *= isDecelerating ? 0.95 : 0.855

            distortionAmount +=
                (distortionTarget - distortionAmount) * 0.1

            const signedDistortion = distortionAmount * scrollDirection

            // Update scene background only when changed
            if (cfg.backgroundColor !== lastBgColor) {
                bgColorObj.set(parseColor(cfg.backgroundColor))
                lastBgColor = cfg.backgroundColor
            }

            const isHoriz = cfg.direction === "horizontal"
            let closestDist = Infinity
            let closestIdx = 0

            for (const mesh of meshes) {
                const { offset, index } = mesh.userData
                let pos = -(offset - wrap(scrollPosition, loopLength))
                pos = wrap(pos + halfLoop, loopLength) - halfLoop

                if (isHoriz) {
                    mesh.position.x = pos
                    mesh.position.y = 0
                } else {
                    mesh.position.y = pos
                    mesh.position.x = 0
                }

                if (Math.abs(pos) < closestDist) {
                    closestDist = Math.abs(pos)
                    closestIdx = index
                }

                // Active slide scale
                if (cfg.activeScale > 1.0) {
                    const scaleRange = 2.5
                    const t = Math.max(0, 1 - Math.abs(pos) / scaleRange)
                    const s = 1 + (cfg.activeScale - 1) * t * t
                    mesh.scale.set(s, s, 1)
                } else {
                    mesh.scale.set(1, 1, 1)
                }

                // Animate opacity fade-in
                const mat = mesh.material as THREE.ShaderMaterial
                const target = (mesh.userData.opacityTarget as number) || 0
                const current = mat.uniforms.uOpacity.value as number
                if (current < target) {
                    mat.uniforms.uOpacity.value = Math.min(
                        target,
                        current + deltaTime * 1.8
                    )
                }

                // Update border radius uniform
                mat.uniforms.uBorderRadius.value = cfg.borderRadius

                if (Math.abs(pos) < halfLoop + cfg.slideMaxHeight) {
                    applyDistortion(
                        mesh,
                        pos,
                        cfg.distortionStrength * signedDistortion,
                        isHoriz
                    )
                }
            }

            if (closestIdx !== activeSlideIndex) {
                activeSlideIndex = closestIdx
                activeSlideIndexRef.current = closestIdx
                startTransition(() => setActiveSlide(closestIdx))
            }

            renderer.render(scene, camera)
        }

        rafId = requestAnimationFrame(animate)

        return () => {
            disposed = true
            scrollTargetRef.current = null
            cancelAnimationFrame(rafId)
            if (scrollTimeout) clearTimeout(scrollTimeout)
            if (resizeObserver) resizeObserver.disconnect()
            else window.removeEventListener("resize", resize)

            container.removeEventListener("mouseenter", onMouseEnter)
            container.removeEventListener("mouseleave", onMouseLeave)
            container.removeEventListener("wheel", onWheel)
            container.removeEventListener("touchstart", onTouchStart)
            container.removeEventListener("touchmove", onTouchMove)
            container.removeEventListener("touchend", onTouchEnd)
            container.removeEventListener("pointerdown", onPointerDown)
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerup", onPointerUp)

            for (const mesh of meshes) {
                mesh.geometry.dispose()
                const mat = mesh.material as THREE.ShaderMaterial
                const tex = mat.uniforms.uTexture?.value as THREE.Texture | null
                if (tex) tex.dispose()
                mat.dispose()
            }
            renderer.dispose()
            if (renderer.domElement.parentElement === container) {
                container.removeChild(renderer.domElement)
            }
        }
    }, [isStatic, slidesKey])

    // Determine valid slides for overlay
    const validSlides = slides.filter((s) => s.image)
    const slideCount = validSlides.length
    const clampedActive = Math.min(activeSlide, slideCount - 1)
    const currentTitle = validSlides[clampedActive]?.title || ""

    if (isStatic || webglFailed) {
        return (
            <StaticFallback
                slides={slides}
                backgroundColor={backgroundColor}
                overlayColor={overlayColor}
                style={style}
            />
        )
    }

    if (validSlides.length === 0) {
        return (
            <div
                style={{
                    ...style,
                    width: "100%",
                    height: "100%",
                    background: backgroundColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <div
                    style={{
                        border: "1px dashed rgba(255,255,255,0.25)",
                        borderRadius: 12,
                        padding: "2rem",
                        color: overlayColor,
                        opacity: 0.5,
                        fontSize: 14,
                    }}
                >
                    Add images to slides
                </div>
            </div>
        )
    }

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (!interactive) return
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
        if (tag === "input" || tag === "textarea" || tag === "select") return
        if ((e.target as HTMLElement)?.isContentEditable) return

        if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault()
            scrollTargetRef.current?.(0.5)
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault()
            scrollTargetRef.current?.(-0.5)
        } else if (e.key === "Enter") {
            const link = validSlides[activeSlideIndexRef.current]?.link
            if (link) window.open(link, "_blank", "noopener")
        }
    }

    const [overlayV, overlayH] = overlayPosition.includes("-")
        ? overlayPosition.split("-") as [string, string]
        : ["center", overlayPosition] as [string, string]

    const isSplit = overlayH === "split"
    const isCenter = overlayH === "center"
    const overlayJustify =
        isSplit ? "space-between" : isCenter ? "center" : overlayH === "right" ? "flex-end" : "flex-start"
    const overlayDirection = isCenter ? "column" as const : "row" as const
    const overlayAlign = isCenter ? "center" : "center"
    const overlayTop =
        overlayV === "top" ? "2rem" : overlayV === "bottom" ? undefined : "50%"
    const overlayBottom = overlayV === "bottom" ? "2rem" : undefined
    const overlayTransform =
        overlayV === "center" ? "translateY(-50%)" : undefined

    return (
        <div
            ref={outerRef}
            role="region"
            aria-roledescription="carousel"
            aria-label="Image Slider"
            tabIndex={0}
            onKeyDown={onKeyDown}
            data-slider-36
            style={{
                ...style,
                width: "100%",
                height: "100%",
                position: "relative",
                overflow: "hidden",
                background: backgroundColor,
                touchAction: interactive ? "none" : undefined,
                userSelect: "none",
                outline: "none",
            }}
        >
            <style>{`[data-slider-36]:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }`}</style>

            <div
                ref={canvasContainerRef}
                style={{ position: "absolute", inset: 0 }}
            />

            <div
                aria-live="polite"
                aria-atomic="true"
                style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0,0,0,0)",
                    whiteSpace: "nowrap",
                    border: 0,
                }}
            >
                Slide {clampedActive + 1} of {slideCount}
            </div>

            {showOverlay && slideCount > 0 && (
                <div
                    style={{
                        position: "absolute",
                        top: overlayTop,
                        bottom: overlayBottom,
                        left: 0,
                        transform: overlayTransform,
                        width: "100%",
                        padding: "0 2rem",
                        display: "flex",
                        flexDirection: overlayDirection,
                        justifyContent: overlayJustify,
                        alignItems: overlayAlign,
                        pointerEvents: "none",
                        zIndex: 2,
                        gap: isCenter ? 4 : 16,
                    }}
                >
                    <p
                        style={{
                            ...overlayFont,
                            fontSize: overlaySize,
                            color: overlayColor,
                            margin: 0,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {currentTitle}
                    </p>
                    <p
                        style={{
                            ...overlayFont,
                            fontSize: counterSize,
                            color: overlayColor,
                            margin: 0,
                            opacity: 0.7,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {zeroPad(clampedActive + 1)} / {zeroPad(slideCount)}
                    </p>
                </div>
            )}
        </div>
    )
}

ThreeJSSlider.displayName = "#36 ThreeJS Infinite Slider"

// ---------------------------------------------------------------------------
// Property controls
// ---------------------------------------------------------------------------

addPropertyControls(ThreeJSSlider, {
    slides: {
        type: ControlType.Array,
        title: "Slides",
        control: {
            type: ControlType.Object,
            controls: {
                image: {
                    type: ControlType.Image,
                    title: "Image",
                },
                title: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "Slide",
                },
                link: {
                    type: ControlType.Link,
                    title: "Link",
                },
            },
        },
        defaultValue: DEFAULT_SLIDES,
        maxCount: 20,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: "#141414",
        section: "Style",
    },
    direction: {
        type: ControlType.Enum,
        title: "Direction",
        options: ["vertical", "horizontal"],
        optionTitles: ["Vertical", "Horizontal"],
        defaultValue: "vertical",
        section: "Style",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Corner Radius",
        min: 0,
        max: 0.15,
        step: 0.005,
        defaultValue: 0,
        section: "Style",
    },
    slideSize: {
        type: ControlType.Object,
        title: "Slide Size",
        controls: {
            aspectRatio: {
                type: ControlType.Number,
                title: "Aspect Ratio",
                min: 0.5,
                max: 3,
                step: 0.1,
                defaultValue: 1.5,
            },
            minHeight: {
                type: ControlType.Number,
                title: "Min Height",
                min: 0.3,
                max: 3,
                step: 0.1,
                defaultValue: 1,
            },
            maxHeight: {
                type: ControlType.Number,
                title: "Max / Uniform Height",
                min: 0.5,
                max: 4,
                step: 0.1,
                defaultValue: 1.5,
            },
            gap: {
                type: ControlType.Number,
                title: "Gap",
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.05,
            },
        },
        section: "Style",
    },
    randomHeights: {
        type: ControlType.Boolean,
        title: "Random Heights",
        defaultValue: true,
        section: "Style",
    },
    activeScale: {
        type: ControlType.Number,
        title: "Active Scale",
        min: 1.0,
        max: 1.4,
        step: 0.01,
        defaultValue: 1.0,
        section: "Style",
    },
    interactive: {
        type: ControlType.Boolean,
        title: "Interactive",
        defaultValue: true,
        section: "Interaction",
    },
    distortionStrength: {
        type: ControlType.Number,
        title: "Distortion",
        min: 0,
        max: 10,
        step: 0.1,
        defaultValue: 2.5,
        section: "Interaction",
    },
    snapToSlide: {
        type: ControlType.Boolean,
        title: "Snap to Slide",
        defaultValue: false,
        section: "Interaction",
    },
    snapStrength: {
        type: ControlType.Number,
        title: "Snap Strength",
        min: 0.01,
        max: 0.15,
        step: 0.01,
        defaultValue: 0.03,
        hidden: (props) => !props.snapToSlide,
        section: "Interaction",
    },
    scrollTuning: {
        type: ControlType.Object,
        title: "Scroll Tuning",
        controls: {
            smoothing: {
                type: ControlType.Number,
                title: "Smoothing",
                min: 0.01,
                max: 0.5,
                step: 0.01,
                defaultValue: 0.05,
            },
            momentum: {
                type: ControlType.Number,
                title: "Momentum",
                min: 0.8,
                max: 0.99,
                step: 0.01,
                defaultValue: 0.95,
            },
            wheelSpeed: {
                type: ControlType.Number,
                title: "Wheel Speed",
                min: 0.001,
                max: 0.05,
                step: 0.001,
                defaultValue: 0.01,
            },
            dragSpeed: {
                type: ControlType.Number,
                title: "Drag Speed",
                min: 0.001,
                max: 0.05,
                step: 0.001,
                defaultValue: 0.01,
            },
        },
        section: "Interaction",
    },
    showOverlay: {
        type: ControlType.Boolean,
        title: "Show Overlay",
        defaultValue: true,
        section: "Overlay",
    },
    overlayFont: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultFontType: "sans-serif",
        hidden: (props) => !props.showOverlay,
        section: "Overlay",
    },
    overlayColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#ffffff",
        hidden: (props) => !props.showOverlay,
        section: "Overlay",
    },
    overlaySize: {
        type: ControlType.Number,
        title: "Title Size",
        min: 10,
        max: 72,
        step: 1,
        unit: "px",
        defaultValue: 16,
        hidden: (props) => !props.showOverlay,
        section: "Overlay",
    },
    counterSize: {
        type: ControlType.Number,
        title: "Counter Size",
        min: 8,
        max: 48,
        step: 1,
        unit: "px",
        defaultValue: 14,
        hidden: (props) => !props.showOverlay,
        section: "Overlay",
    },
    overlayPosition: {
        type: ControlType.Enum,
        title: "Position",
        options: [
            "top-left", "top-center", "top-right", "top-split",
            "center-left", "center", "center-right", "center-split",
            "bottom-left", "bottom-center", "bottom-right", "bottom-split",
        ],
        optionTitles: [
            "Top Left", "Top Center", "Top Right", "Top Split",
            "Center Left", "Center", "Center Right", "Center Split",
            "Bottom Left", "Bottom Center", "Bottom Right", "Bottom Split",
        ],
        defaultValue: "bottom-left",
        hidden: (props) => !props.showOverlay,
        section: "Overlay",
    },
    autoplay: {
        type: ControlType.Boolean,
        title: "Autoplay",
        defaultValue: false,
        section: "Interaction",
    },
    autoplaySpeed: {
        type: ControlType.Number,
        title: "Autoplay Speed",
        min: 0.02,
        max: 1,
        step: 0.01,
        defaultValue: 0.15,
        hidden: (props) => !props.autoplay,
        section: "Interaction",
    },
    maxDpr: {
        type: ControlType.Number,
        title: "Max DPR",
        min: 1,
        max: 3,
        step: 0.25,
        unit: "\u00d7",
        defaultValue: 2,
        section: "Performance",
    },
    enableMotion: {
        type: ControlType.Boolean,
        title: "Enable Motion",
        defaultValue: true,
        section: "Performance",
    },
    respectReducedMotion: {
        type: ControlType.Boolean,
        title: "Reduced Motion",
        defaultValue: true,
        hidden: (props) => !props.enableMotion,
        section: "Performance",
    },
})
