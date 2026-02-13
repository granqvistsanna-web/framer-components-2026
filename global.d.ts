interface GsapTimeline {
  to: (...args: unknown[]) => GsapTimeline
  fromTo: (...args: unknown[]) => GsapTimeline
  call: (callback: () => void, params?: unknown[], position?: number) => GsapTimeline
  set: (...args: unknown[]) => GsapTimeline
  kill: () => void
}

interface GsapApi {
  timeline: (...args: unknown[]) => GsapTimeline
  registerPlugin: (...plugins: unknown[]) => void
  killTweensOf: (target: unknown) => void
  set: (...args: unknown[]) => void
  to: (...args: unknown[]) => void
  getProperty: (target: unknown, property: string) => number
}

interface DraggableInstance {
  x: number
  y: number
  kill: () => void
}

interface DraggableApi {
  create: (target: unknown, config: Record<string, unknown>) => DraggableInstance[]
}

interface CustomEaseApi {
  create: (name: string, definition: string) => void
}

interface Window {
  gsap?: GsapApi
  Draggable?: DraggableApi
  CustomEase?: CustomEaseApi
}

declare module "framer" {
  export const ControlType: {
    String: string
    Number: string
    Boolean: string
    Color: string
    Enum: string
    Font: string
    Object: string
    Array: string
    File: string
    EventHandler: string
    Slot: string
  }

  export function addPropertyControls(
    component: unknown,
    controls: Record<string, unknown>
  ): void

  export function useIsStaticRenderer(): boolean
}
