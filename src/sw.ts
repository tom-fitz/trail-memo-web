/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Precache the built app shell (hashed JS/CSS, index.html, icons).
// Mapbox tiles, Firebase, and all other runtime requests are intentionally
// NOT cached — they go straight to the network.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA routing: serve the precached index.html for navigations.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Sent by the update toast when the user taps "Reload".
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Future: offline support — add workbox runtime caching routes here.
// Future: push notifications — add 'push' and 'notificationclick' listeners here.
