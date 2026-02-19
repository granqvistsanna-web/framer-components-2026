# Bubble Animation 3D

A stunning, interactive 3D bubble component for Framer with smooth morphing animations and mouse reactivity.

![Bubble Animation Preview](https://via.placeholder.com/800x400/0c4a6e/0ea5e9?text=Bubble+Animation+3D)

## Features

✨ **8 Beautiful Themes** - Ocean, Neon, Sunset, Monochrome, Forest, Cyberpunk, Golden, Custom  
🫧 **Multi-Bubble Layouts** - Orbit, Cluster, Scatter, Grid  
🖱️ **Interactive** - Mouse tracking, velocity reaction, click explosion  
🎨 **Visual Effects** - Bloom, wireframe, ambient particles  
🎵 **Audio Reactive** - Bubbles pulse with simulated audio  
♿ **Accessible** - Reduced motion support  

## Quick Start

1. Copy `BubbleAnimation3D.tsx` to your Framer project's `code/` folder
2. Drag the component from the Components panel to your canvas
3. Adjust properties in the right panel

## Properties

### Theme
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Theme | Enum | Ocean | Preset color theme |
| Primary | Color | #60a5fa | Main bubble color (Custom only) |
| Secondary | Color | #a78bfa | Accent/light color (Custom only) |
| Background | Color | #0f172a | Scene background (Custom only) |
| Gradient | Boolean | true | Radial gradient background |

### Geometry
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Bubbles | Number | 1 | Number of bubbles (1-8) |
| Layout | Enum | Orbit | Multi-bubble arrangement |
| Size | Number | 2 | Bubble scale (0.5-5) |
| Detail | Number | 64 | Geometry detail (16-128) |

### Animation
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Morph Speed | Number | 0.8 | Animation speed (0-3) |
| Morph Intensity | Number | 0.3 | Deformation amount (0-1) |
| Rotation | Number | 0.2 | Rotation speed (0-2) |
| Auto Rotate | Boolean | false | Continuous rotation when idle |
| Idle Float | Boolean | true | Gentle floating animation |
| Sync | Boolean | false | Synchronize multi-bubble animations |

### Interaction
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Mouse Track | Boolean | true | Enable mouse tracking |
| Track Speed | Number | 1.5 | Mouse sensitivity (0-5) |
| Velocity | Boolean | true | React to mouse velocity |
| Velocity Amount | Number | 0.5 | Velocity effect strength (0-2) |
| Click Explode | Boolean | false | Explode on click |
| Magnetic | Boolean | false | Bubble attracts to cursor |

### Effects
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Bloom | Boolean | false | HDR glow effect |
| Bloom Intensity | Number | 1.5 | Glow strength (0.1-3) |
| Wireframe | Boolean | false | Show wireframe overlay |
| Wireframe Opacity | Number | 0.3 | Wireframe transparency (0.05-1) |
| Particles | Boolean | true | Ambient floating particles |

### Advanced
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Audio Reactive | Boolean | false | React to simulated audio |
| Quality | Enum | Medium | Render quality (Low/Med/High/Ultra) |
| Max FPS | Number | 60 | Frame rate limit (30/60/120) |
| Reduced Motion | Boolean | false | Simplify animations |

## Usage Examples

### Single Bubble
```
Theme: Ocean
Bubbles: 1
Size: 2.5
Mouse Track: true
Idle Float: true
```

### Audio Visualizer
```
Theme: Cyberpunk
Bubbles: 3
Layout: Orbit
Audio Reactive: true
Bloom: true
Bloom Intensity: 2
```

### Interactive Cluster
```
Theme: Sunset
Bubbles: 5
Layout: Cluster
Click Explode: true
Magnetic: true
Velocity: true
```

### Performance Mode
```
Quality: Low
Detail: 32
Bloom: false
Particles: false
Max FPS: 30
```

## Performance Tips

- **Mobile**: Use Low quality, 1-2 bubbles, disable bloom
- **Tablet**: Medium quality, 1-3 bubbles
- **Desktop**: High quality, any configuration
- **High-end**: Ultra quality for best visuals

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires WebGL 2.0 support.

## File Size

- Component: ~34KB
- Three.js: Loaded from CDN (~150KB)

## License

Free to use in Framer projects.
