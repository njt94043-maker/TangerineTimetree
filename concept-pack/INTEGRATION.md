# TGT Concept Pack — Integration Guide

## Folder Structure

```
concept-pack/
├── icons/
│   └── generate-icons.html    # Open in browser → download all icon sizes
├── splash/
│   ├── SplashScreen.tsx       # React component (drop into src/components/)
│   └── SplashScreen.css       # Animations (import in component)
├── skeleton/
│   ├── SkeletonLoaders.tsx    # 4 variants: PageLoader, CardSkeleton, InlineSkeleton, DotLoader
│   └── SkeletonLoaders.css    # All skeleton animations
├── preview/
│   └── all-components.html    # Full interactive preview (open in browser)
└── INTEGRATION.md             # This file
```

---

## 1. Icons

Open `icons/generate-icons.html` in a browser. It renders your `logo-512.png` at
every size needed for PWA, iOS, Android, and favicons. Click download on each or
use "Download All".

**Sizes generated:**
- PWA: 128, 192, 256, 384, 512
- iOS: 120, 152, 167, 180, 1024 (App Store)
- Android: 48, 96, 192, 432 (adaptive foreground), 512 (Play Store)
- Favicon: 16, 32, 64

---

## 2. Splash Screen

### Files to copy
```
splash/SplashScreen.tsx  →  web/src/components/SplashScreen.tsx
splash/SplashScreen.css  →  web/src/components/SplashScreen.css
```

### Wiring into App.tsx

Replace the current auth loading state:

```tsx
// Before (current)
if (authLoading) {
  return (
    <div className="app app-centered">
      <LoadingSpinner />
    </div>
  );
}

// After
const [splashDone, setSplashDone] = useState(false);

if (!splashDone) {
  return (
    <SplashScreen
      ready={!authLoading}
      onComplete={() => setSplashDone(true)}
    />
  );
}
```

### Props
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ready` | boolean | false | When true + min time elapsed, begins exit |
| `onComplete` | () => void | — | Called after exit animation finishes |
| `minDisplayMs` | number | 1800 | Minimum time splash stays visible (ms) |

### How it works
1. Splash mounts immediately, plays the Juice Drop entrance (~1s)
2. Waits for `minDisplayMs` AND `ready` to both be true
3. Plays exit animation (0.6s fade-up)
4. Calls `onComplete` → parent unmounts splash, shows app

### iOS PWA launch image
Add to `index.html` for the native iOS splash:
```html
<link rel="apple-touch-startup-image" href="/logo-512.png" />
```
The CSS splash takes over once JS loads.

---

## 3. Skeleton Loaders

### Files to copy
```
skeleton/SkeletonLoaders.tsx  →  web/src/components/SkeletonLoaders.tsx
skeleton/SkeletonLoaders.css  →  web/src/components/SkeletonLoaders.css
```

### Components

**PageLoader** — Full-page centered (replaces LoadingSpinner)
```tsx
<PageLoader text="Loading" />
```

**CardSkeleton** — Neumorphic card placeholder (gigs, invoices)
```tsx
<CardSkeleton lines={3} />
```

**InlineSkeleton** — List row placeholders (GigList, InvoiceList)
```tsx
<InlineSkeleton rows={5} />
```

**DotLoader** — Minimal inline indicator
```tsx
<DotLoader />
```

### All components:
- Use CSS custom properties from App.css (with fallbacks)
- Respect `prefers-reduced-motion`
- Reference `/logo-512.png` from public/

---

## 4. CSS Custom Properties Used

The components reference these vars (already in your App.css):

```css
--bg-primary: #08080c
--bg-card: #111118
--bg-card-light: #1a1a24
--color-tangerine: #f39c12
--color-green: #00e676
--color-text-muted: #4a4a60
--radius-card: 14px
--shadow-raised: ...
```

All have hardcoded fallbacks so they work standalone too.

---

## 5. Platform Notes

### iOS 17+ (PWA standalone)
- Splash CSS handles `env(safe-area-inset-*)` for notch/dynamic island
- `display-mode: standalone` media query adds extra top padding
- Apple touch icon already configured in index.html

### Android (Galaxy S23 Ultra / Chrome)
- Manifest icons at 192 + 512 are the minimum
- The 432px adaptive foreground gives Android room to apply its mask shape
- Chrome uses the splash screen from manifest + `background_color` + icon

### Desktop (Chrome / Edge / Safari)
- Works as a normal web page splash
- PWA install uses manifest icons
- Favicon sizes cover browser tabs + bookmarks
