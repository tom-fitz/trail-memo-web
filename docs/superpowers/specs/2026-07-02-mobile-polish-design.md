# TrailMemo Web — Mobile-Native Polish

**Date:** 2026-07-02
**Status:** Approved (header option 1 + full cleanup list)

## Goal

Make the PWA feel native on phones. Desktop layout stays as-is; all changes are mobile-first with `sm:` breakpoints preserving current desktop behavior.

## Changes

1. **Header & primary actions (option 1).** On `<sm`: the "New Memo"/"Memo Here" buttons leave the header and become a floating pill action bar at the bottom center of the map (thumb zone): primary "Memo Here" (GPS) + "Place on Map" (toggles to Cancel in placement mode). Header keeps title/count/refresh/logout and gains safe-area top padding. On `sm+`: header center buttons unchanged, bottom bar hidden.
2. **Bottom-sheet modals.** `Modal.tsx` becomes a bottom sheet on `<sm`: full-width, slides up (CSS keyframe), rounded top corners with a drag-handle bar, `max-h-[92dvh]`, safe-area bottom padding. `sm+` keeps the centered dialog. Applies to create/detail modals automatically.
3. **Safe areas.** `viewport-fit=cover` in the viewport meta; `env(safe-area-inset-*)` padding on the header, bottom action bar, update toast, and install prompt.
4. **Native-feel CSS** (`index.css`): `overscroll-behavior: none` (no rubber-band/pull-to-refresh over the map), transparent `-webkit-tap-highlight-color`, `touch-action: manipulation` on interactive elements, `sheet-up` keyframe for the modal.
5. **Touch targets.** `Button` gains `min-h-[44px]`; audio player slider gets a taller hit area (`h-6`) and skip buttons get `p-2` padding. Detail-modal action row gains `flex-wrap` for narrow screens.
6. **Map chrome.** Legend hidden on `<sm`; placement/edit/geo-error banners constrained to `max-w-[calc(100vw-2rem)]`.
7. **Status bar blending.** `theme-color` meta and manifest `theme_color` change `#2563eb` → `#ffffff` to blend with the white header when installed. (PWA icon stays blue.)
8. **Toast/prompt stacking.** UpdateToast and InstallPrompt sit above the mobile action bar: `bottom-[calc(5rem+env(safe-area-inset-bottom))]` on `<sm`, `sm:bottom-4` on desktop.

## Out of scope

Tab-bar navigation, dark mode, login/register pages (already mobile-friendly), gesture-driven sheet dismissal (close button/backdrop suffice).

## Testing

Owner verifies on a phone (or devtools device mode): actions reachable by thumb, modals slide from bottom and clear the home indicator, no tap flash, no pull-to-refresh bounce, legend gone, status bar blends when installed, desktop unchanged.
