# Mobile-Native Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mobile-native feel: bottom action bar, bottom-sheet modals, safe areas, touch targets, native CSS behaviors. Desktop unchanged via `sm:` breakpoints.

**Architecture:** Pure styling/layout changes across existing files; one CSS keyframe; no new components, hooks, or dependencies.

**Tech Stack:** Tailwind (arbitrary values for `env()`/`dvh`), existing components.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-02-mobile-polish-design.md`.
- No git commits (owner handles); no builds (owner tests); `npx tsc --noEmit` as final check.
- Mobile-first with `sm:` prefixes restoring current desktop behavior exactly.

---

### Task 1: Global shell — viewport, theme color, native CSS

**Files:**
- Modify: `index.html` (viewport + theme-color)
- Modify: `vite.config.ts` (manifest `theme_color`)
- Modify: `src/index.css` (append rules)

- [ ] **Step 1:** In `index.html`: viewport content becomes `width=device-width, initial-scale=1.0, viewport-fit=cover`; `theme-color` content becomes `#ffffff`.
- [ ] **Step 2:** In `vite.config.ts` manifest: `theme_color: '#ffffff'`.
- [ ] **Step 3:** Append to `src/index.css`:

```css
/* Mobile native feel */
html, body {
  overscroll-behavior: none;
}

body {
  -webkit-tap-highlight-color: transparent;
}

button, a, input[type='range'] {
  touch-action: manipulation;
}

/* Bottom-sheet slide-up (Modal.tsx, <sm only) */
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.modal-sheet {
  animation: sheet-up 0.25s ease-out;
}
```

---

### Task 2: Bottom-sheet Modal + touch-target Button

**Files:**
- Modify: `src/components/ui/Modal.tsx`
- Modify: `src/components/ui/Button.tsx`

- [ ] **Step 1:** In `Modal.tsx`, replace the container/panel markup (keep backdrop and inner content structure):

```tsx
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal: bottom sheet on phones, centered dialog on sm+ */}
      <div className="modal-sheet sm:animate-none relative bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full sm:max-w-2xl sm:mx-4 max-h-[92dvh] sm:max-h-[90vh] overflow-hidden flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0">
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden pt-2 flex justify-center">
          <span className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        {/* Header */}
        ...unchanged...
        {/* Content */}
        ...unchanged...
      </div>
    </div>
```

- [ ] **Step 2:** In `Button.tsx`, `baseStyles` gains `min-h-[44px]`:

```ts
const baseStyles = 'px-4 py-2 min-h-[44px] rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
```

---

### Task 3: MapPage — slim mobile header + floating bottom action bar

**Files:**
- Modify: `src/pages/MapPage.tsx`

- [ ] **Step 1:** Header element gains safe-area top padding: `<header className="bg-white shadow-sm z-10 pt-[env(safe-area-inset-top)]">`.
- [ ] **Step 2:** The center button container becomes desktop-only: `className="absolute left-1/2 transform -translate-x-1/2 hidden sm:flex gap-2"` (buttons inside unchanged).
- [ ] **Step 3:** Add the mobile action bar at the end of the map container div (`flex-1 relative`), after the memos/empty-state block:

```tsx
        {/* Mobile bottom action bar (thumb zone) */}
        <div className="sm:hidden absolute inset-x-0 bottom-0 z-20 flex justify-center gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pointer-events-none">
          <Button
            variant="primary"
            onClick={handleCreateAtMyLocation}
            disabled={isLocating}
            className="pointer-events-auto shadow-lg flex items-center whitespace-nowrap rounded-full px-5"
          >
            {isLocating ? (
              <Spinner size="sm" />
            ) : (
              <>
                <LocateFixed className="w-4 h-4 mr-2" />
                <span>Memo Here</span>
              </>
            )}
          </Button>
          <Button
            variant={isPlacementMode ? 'danger' : 'secondary'}
            onClick={isPlacementMode ? handleCancelPlacement : handleStartPlacement}
            className="pointer-events-auto shadow-lg flex items-center whitespace-nowrap rounded-full px-5"
          >
            {isPlacementMode ? (
              <>
                <X className="w-4 h-4 mr-2" />
                <span>Cancel</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                <span>Place on Map</span>
              </>
            )}
          </Button>
        </div>
```

- [ ] **Step 4:** Constrain the three overlay banners (placement indicator, geolocation error, edit controls): add `max-w-[calc(100vw-2rem)]` to each banner's className.

---

### Task 4: Map chrome, toasts, player targets, detail actions

**Files:**
- Modify: `src/components/map/MapView.tsx` (legend)
- Modify: `src/components/pwa/UpdateToast.tsx`, `src/components/pwa/InstallPrompt.tsx` (bottom offsets)
- Modify: `src/components/memos/AudioPlayer.tsx` (touch targets)
- Modify: `src/components/memos/MemoDetailModal.tsx` (action row wrap)

- [ ] **Step 1:** Legend container: `hidden sm:block absolute bottom-20 left-4 ...` (prepend `hidden sm:block`, drop nothing else).
- [ ] **Step 2:** `UpdateToast` outer div: `bottom-4` → `bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-4`.
- [ ] **Step 3:** `InstallPrompt` outer div: `bottom-4` → `bottom-[calc(5rem+env(safe-area-inset-bottom))] sm:bottom-4`.
- [ ] **Step 4:** `AudioPlayer`: range input class gains `h-6 cursor-pointer`; both skip buttons gain `p-2`.
- [ ] **Step 5:** `MemoDetailModal` action row: `className="mt-6 flex gap-3 justify-between border-t pt-4"` → `className="mt-6 flex flex-wrap gap-3 justify-between border-t pt-4"`.
- [ ] **Step 6:** Run `npx tsc --noEmit` — expected: clean.

**Verify (owner):** device-mode/phone — bottom pills reachable, sheet modals slide up over the home indicator, no tap flash or overscroll bounce, no legend, blended status bar when installed, desktop identical to before.
