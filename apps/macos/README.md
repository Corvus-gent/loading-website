# HackersBay for macOS

The native SwiftUI app opens the live site in WKWebView and adds Captain Squawk to the menu bar. **Sink Luma** replays the cannonball. Enable native notifications from the menu to see mutual intros while the app runs. Squawk sounds start off and can be enabled separately. Shared intro checks stay inside the site’s WebView and the Mac receives only the matched intro ID.

Native Mac app: in the repo (apps/macos), launching later.

Build on macOS 13 or later with Xcode’s command-line tools and Python 3.

```sh
./apps/macos/build.sh
```

The script produces an arm64 + x86_64 universal DMG, zipped app bundle, and checksums under `apps/macos/dist/`. The bundle is ad hoc signed for local integrity. A Developer ID signature and Apple notarization are absent.

## First launch on macOS

In Finder, right-click **HackersBay.app** and choose **Open**. If Gatekeeper blocks the app, go to **System Settings → Privacy & Security → Open Anyway** after trying to launch once. These builds are distributed without Apple notarization.
