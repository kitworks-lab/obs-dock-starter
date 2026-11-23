# obs-dock-starter

[日本語版 README (README.ja.md)](./README.ja.md)

A zero-dependency HTML/CSS/JS starter kit for building OBS Studio Custom Browser Dock widgets that sync with a transparent Browser Source overlay through `localStorage`.

No Node.js server, no obs-websocket plugin, no build step, and no external CDN calls. Put all 4 files in one local folder, point OBS at them, and edit from there.

## Files

- `dock.html`: Dark OBS dock controller with status presets, live text inputs, counter and goal buttons, overlay visibility toggle, and sync status.
- `overlay.html`: Transparent `1920x1080` OBS Browser Source overlay that updates immediately when you click controls in the dock.
- `shared.js`: Small state helper with schema versioning (`SCHEMA_VERSION = 1`), safe JSON parsing, `storage` event listening, `BroadcastChannel`, and a 350ms deduplicated polling fallback.
- `style.css`: CSS custom properties at the top of the file so you can change colors, fonts, or card geometry in under a minute.

## 3-Step OBS Studio Setup

1. Download this repo (Code -> Download ZIP) and unzip it into a permanent local folder, for example `C:\OBS-Widgets\obs-dock-starter\`.
2. Add the Browser Source in OBS:
   - Sources -> `+` -> **Browser**
   - Check **Local file** and select `overlay.html`
   - Set **Width** to `1920` and **Height** to `1080`
3. Add the Custom Browser Dock in OBS:
   - Top menu -> **Docks** -> **Custom Browser Docks...**
   - Enter a Dock Name (for example `Stream Dock`)
   - Open `dock.html` in Chrome or Edge, copy the full `file:///...` URL from the address bar, paste it into the **URL** field, and click **Apply**

Drag the floating dock window to the left or right edge of OBS to snap it next to your Scene or Audio Mixer panels.

> Tip: Pasting a raw Windows path (`C:\...\dock.html`) often fails in OBS. Copying the `file:///...` address from a browser avoids encoding bugs with spaces or non-ASCII folder names.

## How Sync Works

```text
+-------------------+        localStorage.setItem(KEY)        +----------------------+
|     dock.html     |  ------------------------------------>  |     overlay.html     |
| Custom Browser    |        + BroadcastChannel (fast)        | 1920x1080 Browser    |
| Dock (controller) |        + 350ms seq:updatedAt poll       | Source (transparent) |
+-------------------+                                         +----------------------+
         \                                                              /
          +------------------------ shared.js -------------------------+
                  Schema validation (v1) + safe JSON.parse + dedupe
```

In normal desktop browsers, `BroadcastChannel` and the `storage` event propagate immediately between two tabs. Some OBS Studio CEF builds suppress `BroadcastChannel` or `storage` events across `file:///` dock and source contexts.

`shared.js` stamps every state write with a monotonic `seq` and `updatedAt`. The 350ms fallback poll reads `localStorage`, checks `seq:updatedAt`, and skips DOM updates whenever nothing changed. That keeps CPU usage near zero while preventing missed updates across OBS versions.

## Customization

### Re-skin in 30 seconds

Edit the `:root` variables at the top of `style.css`:

```css
:root {
  --dock-accent: #2f8f5b;
  --ov-bg: rgba(24, 25, 29, 0.92);
  --ov-ink: #f4f5f7;
  --ov-radius: 10px;
}
```

### URL query flags on `overlay.html`

If you add `overlay.html` as a URL (`file:///.../overlay.html?pos=top-right&theme=paper`) instead of the local file picker, you can pass query options without duplicating files:

| Parameter | Values | Default |
| --- | --- | --- |
| `pos` | `bottom-left`, `bottom-right`, `top-left`, `top-right` | `bottom-left` |
| `theme` | `dark`, `paper` | `dark` |
| `scale` | `0.5` to `2.5` | `1` |

### Adding your own state field

1. Add the field and default value to `createDefaultState()` in `shared.js`.
2. Sanitize it inside `sanitizeState()`.
3. Bump `SCHEMA_VERSION` if the shape breaks older saved data.
4. Wire an input in `dock.html` to `ObsDockStarter.saveState({ yourField: value })` and read `state.yourField` inside `overlay.html`.

## Production-Ready OBS Widgets & Live Demos

If you want finished OBS dock widgets (Pomodoro timers, live clocks, countdowns, watch-party sync, subscriber goal meters, endurance counters, and topic roulettes) built on this local-first architecture:

- Live browser demos (no install): [kitworks-lab.github.io](https://kitworks-lab.github.io/?lang=en)
- English editions (Free Lite and Pro on Gumroad): [earnbot7.gumroad.com](https://earnbot7.gumroad.com/)
- Japanese editions (BOOTH): [kitworks.booth.pm](https://kitworks.booth.pm/)
- Local automation book (Japanese, Zenn): [Zero-Dependency Node.js Practical Guide](https://zenn.dev/kitworks/books/388f2b2ed4c788)

## License

MIT License. See [LICENSE](./LICENSE).
