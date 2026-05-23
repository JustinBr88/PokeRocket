---
name: Unova Interface
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1b1c1c'
  surface-container: '#1f2020'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e4e2e1'
  on-surface-variant: '#c0cab5'
  inverse-surface: '#e4e2e1'
  inverse-on-surface: '#303030'
  outline: '#8a9481'
  outline-variant: '#41493a'
  surface-tint: '#89db60'
  primary: '#93e569'
  on-primary: '#113800'
  primary-container: '#78c850'
  on-primary-container: '#1c5100'
  inverse-primary: '#286c00'
  secondary: '#82cfff'
  on-secondary: '#00344b'
  secondary-container: '#00abec'
  on-secondary-container: '#003c55'
  tertiary: '#ffc1b8'
  on-tertiary: '#690100'
  tertiary-container: '#ff9989'
  on-tertiary-container: '#920100'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a4f879'
  primary-fixed-dim: '#89db60'
  on-primary-fixed: '#072100'
  on-primary-fixed-variant: '#1c5200'
  secondary-fixed: '#c6e7ff'
  secondary-fixed-dim: '#82cfff'
  on-secondary-fixed: '#001e2d'
  on-secondary-fixed-variant: '#004c6b'
  tertiary-fixed: '#ffdad4'
  tertiary-fixed-dim: '#ffb4a8'
  on-tertiary-fixed: '#410000'
  on-tertiary-fixed-variant: '#930100'
  background: '#131313'
  on-background: '#e4e2e1'
  surface-variant: '#353535'
typography:
  headline-lg:
    fontFamily: Space Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -1px
  headline-md:
    fontFamily: Space Mono
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '500'
    lineHeight: '1.5'
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.0'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1.0'
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 12px
  margin-desktop: 32px
  border-width: 3px
---

## Brand & Style

This design system captures the technical, high-contrast aesthetic of the generation-five portable gaming era. The brand personality is industrial, energetic, and highly functional, mirroring the "urban evolution" theme of its source material. It targets an audience that values nostalgia paired with high-clarity information density.

The style is a hybrid of **Tactile Retro** and **Brutalist Pixel Art**. It utilizes heavy mechanical borders, diagonal chamfered corners, and 2D pixel-perfect rendering to create a "tactile screen" feel. Every element is designed to feel like a physical component on a backlit resistive touch screen, utilizing high-contrast color blocks and glossy finishes to simulate depth without the use of soft shadows.

## Colors

The palette is anchored by a deep industrial dark gray and true black, providing a high-contrast foundation for vibrant, functional accents. 

- **Neutral Base:** The primary background uses `#2D2D2D`, often textured with a subtle grid. Surfaces and container backgrounds utilize `#000000` for maximum contrast.
- **Functional Accents:** Vibrant Green (`#78C850`), Blue (`#00AEEF`), and Red (`#FF0000`) are used strictly for status indication, type-tagging, and active selection states.
- **Typography:** Text is predominantly `#FFFFFF` for readability, with `#F0F0F0` used for secondary data or labels within lighter containers.

## Typography

This design system uses high-fidelity monospaced fonts to replicate the look of pixel-grid rendering. 

- **Headlines:** Use `Space Mono` for a tech-heavy, slightly wider character set that feels authoritative and digital.
- **Body & Data:** Use `JetBrains Mono` for all interface text. The increased x-height and clear character distinction mimic the legibility of DS-era pixel fonts at small scales.
- **Rendering Note:** All text should be rendered with `font-smooth: never` or `image-rendering: pixelated` where possible to maintain the sharp, aliased aesthetic of the original hardware.

## Layout & Spacing

The layout philosophy follows a **Fixed-Module Grid**, treating the viewport as a series of specific touch-targets. 

- **Grid:** A 12-column layout is used for desktop, but components are usually grouped into "pods" that span 6 columns to simulate the dual-pane layout of the DS hardware.
- **Rhythm:** Spacing is strictly mathematical, based on a 4px baseline unit. 
- **Adaptation:** On mobile, the layout stacks vertically, emphasizing large, thumb-friendly touch zones that span the full width of the screen. Gutters are kept tight (16px) to maximize the "information density" look characteristic of JRPGs.

## Elevation & Depth

Depth is conveyed through **Mechanical Layering** rather than realistic lighting.

- **Borders:** Every container is defined by a 3px or 4px solid black border. 
- **Bevels:** Buttons and containers use diagonal "cut-outs" on corners (usually top-right and bottom-left) to create a faceted, machine-milled appearance.
- **Gloss & Textures:** A subtle linear-gradient "gloss" overlay (top-to-middle) is applied to buttons to simulate a screen finish. A fixed-position CRT scanline texture (1px height, 50% opacity, alternating) should be applied to the top layer of the entire UI.
- **Selection:** Instead of shadows, active elements are indicated by a thick, vibrant accent border (Green or Blue) and "corner brackets" that pulse or animate.

## Shapes

The shape language is strictly **Geometric and Angular**. 

- **Corner Radius:** No standard rounding (0px). All "rounded" effects are achieved through 45-degree chamfers or pixel-stepped corners.
- **Diagonal Cut-outs:** High-priority buttons must feature a 12px diagonal cut-out on opposite corners to maintain the hardware aesthetic.
- **Progress Bars:** Health and EXP-style bars use flat, unrounded ends with a 2px inner padding from their containers.

## Components

- **Tactile Buttons:** Large, dark-gray containers with a 3px black border and a diagonal cut on the top-left. Text is centered and uppercase. On hover/active, the background shifts to a vibrant accent color.
- **Type Tags:** Small, pill-like rectangles (but with sharp corners) used for categorization. Each tag has a solid background color corresponding to its "Type" and white, pixelated text.
- **Information Cards:** Utilize a subtle dot-pattern background (`#363636`). Headers are separated by a 2px horizontal line.
- **Input Fields:** Thick black borders with a slightly recessed look, achieved using a dark-gray-to-black inner gradient.
- **CRT Overlays:** A global scanline overlay and a very slight "inner glow" on the edges of the screen to simulate the curved nature of older portable displays.
- **Checkboxes:** Square boxes with a 3px border. When checked, they are filled with a 4x4 pixel-art "X" or checkmark in the primary green accent color.