# Framer Component QA Checklist

Purpose: Review a Framer component for marketplace quality at $12 price point.

Goal: Clean props UX, strong defaults, resilient layout, no unnecessary controls.

---

## 1. Component Purpose

- The component has a clearly defined job.
- It solves one primary use case.
- It is not a combination of multiple unrelated patterns.
- The default preset looks polished without editing.
- The component works when dropped into an empty canvas.

Fail if:

- The component feels like a mini design system.
- It requires editing before it looks usable.

---

## 2. Props Panel Structure

### A. Root Props Count

- Visible root controls can exceed 20 when justified by the component scope.
- Prioritize clear grouping and control relevance over strict control-count limits.
- No duplicated controls.
- No unused props.

Fail if:

- Controls are ungrouped or hard to scan.
- Props exist that do nothing visually.

---

### B. Group Order (must follow this structure)

1. Content
2. Layout
3. Style
4. States
5. Advanced

Fail if:

- Groups are random.
- Advanced controls appear at top level.

---

## 3. Naming Conventions

- Props use clear, human names.
- Booleans start with "Show" or "Enable".
- Enums use clean labels (S, M, L or Primary, Secondary).
- No internal terms like "stack wrapper" or "frame".

Fail if:

- Naming exposes internal build logic.
- Inconsistent terminology across props.

---

## 4. Control Discipline

### Do NOT include:

- Manual X and Y position controls.
- Absolute positioning toggle unless necessary.
- Line height slider.
- Letter spacing slider.
- Unlimited radius sliders (keep to 2-3 radius controls maximum).
- Raw shadow offset, blur, spread sliders.
- Mobile-specific micro sliders (e.g., mobilePadding, mobile-specific size overrides).

If present, flag for removal unless strongly justified.

Typography:

- Font controls should always use "extended" to expose fontFamily, fontSize, fontWeight, lineHeight, and letterSpacing.
- Font family selection is essential for brand matching.

---

## 5. Smart Defaults

- Component looks correct with zero changes.
- Spacing is based on 4 or 8 step increments.
- Radius values are clamped.
- Padding ranges are limited.
- Typography uses text styles, or exposes curated font controls (including font family) when needed.

Fail if:

- The layout breaks with long text.
- Empty optional content leaves awkward gaps.

---

## 6. Variants System

- Variants are logical and limited.
- Maximum:
- 3 size options.
- 3 style variants.
- 4 tones if required.
- Variants do not duplicate logic.

Fail if:

- There are more than 6 total combinations.
- Each variant duplicates styling manually.

---

## 7. Conditional Logic

- Advanced controls appear only when relevant.
- Icon controls only visible if icon enabled.
- Secondary button controls only visible if enabled.
- Custom color controls only visible if "Custom" selected.

Fail if:

- Props are visible but inactive.
- Nested toggle chains exceed 2 levels.

---

## 8. Layout System

- Uses stacks and constraints properly.
- Avoids fixed height unless required.
- Avoids absolute positioning for layout.
- Uses min and max width intelligently.
- Content reflows rather than scales.

Fail if:

- Component scales proportionally instead of reflowing.
- Content overlaps when resized.

---

## 9. Responsive Behavior

Must support Desktop and Mobile at minimum.

Check:

- Layout reflows cleanly on mobile.
- Tap targets are at least 44px.
- Text wraps correctly.
- No horizontal scroll on mobile.
- Optional sub-elements can be hidden on mobile.
- Mobile layout enum exists only if needed.

Fail if:

- Requires separate mobile padding sliders.
- Visual hierarchy collapses on smaller screens.

---

## 10. States and Accessibility

For interactive components:

- Hover state exists.
- Pressed state exists if applicable.
- Disabled state works.
- Focus state visible.
- Default color contrast acceptable.
- Reduced motion safe if animation exists.

Fail if:

- Focus state invisible.
- Disabled state identical to active.

---

## 11. Performance

- No excessive nesting.
- No unnecessary wrappers.
- No heavy blur or large shadow by default.
- No redundant auto layout layers.
- No unused images or media.

Fail if:

- Component contains decorative layers not tied to props.
- Excessive visual effects degrade performance.

---

## 12. Resilience Testing

Test the following scenarios:

- Very long title.
- Very long body.
- No body text.
- No image.
- No icon.
- Very short content.
- Large container width.
- Small container width.

Fail if:

- Layout collapses.
- Spacing breaks.
- Visual imbalance appears.

---

## 13. UX Cleanliness Score

Evaluate:

- Can a beginner understand this in 10 seconds?
- Are the most common edits accessible immediately?
- Does it feel restrained?
- Would removing 20 percent of props improve it?

If yes to removal question, reduce prop surface.

---

## 14. Marketplace Readiness

- Includes 3 demo examples on canvas.
- Prop naming consistent with other components in library.
- No breaking prop dependencies.
- Version labeled v1.0.
- No debug layers visible.
- No temporary colors or placeholder text.

---

## 15. Final Review Checklist Summary

Return evaluation as:

- Root props count: ___
- Groups structured correctly: Yes/No
- Redundant controls present: Yes/No
- Mobile layout clean: Yes/No
- Layout resilient: Yes/No
- Variant system clean: Yes/No
- Accessibility states correct: Yes/No
- Performance acceptable: Yes/No
- Overall publish-ready: Yes/No
