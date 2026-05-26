# Auto-Update Feature — Sprint Plan

Adds in-app update detection and one-click install using **`tauri-plugin-updater`** (the official Tauri v2 updater). When a new version is published, a non-blocking banner appears in the app. The user clicks "Update Now", the installer downloads in-place, and the app restarts into the new version.

---

## Architecture

```
Developer runs:  npm run version:bump 1.x.x
                 git tag v1.x.x && git push --tags
                          │
                          ▼
            GitHub Actions  (.github/workflows/release.yml)
              ├── Build Windows  (windows-latest)
              ├── Build macOS    (macos-latest)
              └── Build Linux    (ubuntu-latest)
                          │  tauri-apps/tauri-action signs each binary,
                          │  then generates latest.json and uploads all
                          │  artifacts to a GitHub Release
                          ▼
            GitHub Release  (public assets)
              ├── vaulty_1.x.x_x64-setup.exe        (Windows)
              ├── vaulty_1.x.x_x64-setup.exe.sig
              ├── vaulty_1.x.x_x64.dmg               (macOS)
              ├── vaulty_1.x.x_aarch64.dmg
              ├── vaulty_1.x.x_amd64.AppImage        (Linux)
              └── latest.json  ◄── app polls this URL
                          │
                          ▼
            Vaulty app (on user's machine)
              checks latest.json ~5 s after login
              if version > current → UpdateBanner appears
              user clicks "Update Now"
              │  download + signature verification
              └► install in-place → app restarts
```

---

## Placeholders — fill these in before Sprint U1

| Placeholder | What to put | Where used |
|---|---|---|
| `YOUR_GITHUB_USERNAME` | Your GitHub username or org | `tauri.conf.json`, workflow |
| `YOUR_REPO_NAME` | The repo name (e.g. `vaulty`) | `tauri.conf.json`, workflow |
| `TAURI_SIGNING_PUBLIC_KEY` | Output of key-gen step (see Sprint U1) | `tauri.conf.json` |
| `APPLE_CERTIFICATE` | Base64 `.p12` cert (optional — see macOS note) | GitHub secret |
| `APPLE_CERTIFICATE_PASSWORD` | .p12 passphrase (optional) | GitHub secret |
| `APPLE_ID` | Apple Developer email (optional) | GitHub secret |
| `APPLE_PASSWORD` | App-specific password from appleid.apple.com (optional) | GitHub secret |
| `APPLE_TEAM_ID` | 10-char Team ID from developer.apple.com (optional) | GitHub secret |

### Required GitHub Secrets (must be set before first release)

Go to `https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/settings/secrets/actions`

| Secret name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Private key from key-gen (multi-line string) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase you chose (or empty string `""`) |

`GITHUB_TOKEN` is injected automatically by GitHub Actions — no setup needed.

### macOS note

Without Apple Developer certificates, macOS builds still compile and the updater works for users who already have the app installed. First-time installs on macOS will show a Gatekeeper warning ("unidentified developer") — users must right-click → Open to bypass it once. Notarization removes this warning but requires an Apple Developer account ($99/year). The workflow has a commented-out notarization block; fill in the Apple secrets and uncomment it when ready.

---

## Key-generation steps (one-time, run locally before Sprint U1)

```bash
# Generate the signing keypair
npx tauri signer generate -w ~/.tauri/vaulty.key

# Output looks like:
#   Public key:  dW50cnVzdGVkIGNvbW1lbnQ...
#   Private key: (written to ~/.tauri/vaulty.key — never commit this)

# The PUBLIC KEY goes into tauri.conf.json (fill the placeholder)
# The PRIVATE KEY content goes into GitHub secret TAURI_SIGNING_PRIVATE_KEY
# (cat ~/.tauri/vaulty.key  to get the full text)
```

---

## Post-Sprint Checklist (run after EVERY sprint)

- [ ] `npx vue-tsc --noEmit` passes
- [ ] `cargo check` passes
- [ ] Update sprint checklist below
- [ ] Update `CLAUDE.md`

---

## Sprint U1 — Plugin, Config & Signing

**Goal:** The updater plugin is wired into Tauri. The app knows where to look for updates and how to verify signatures. No frontend changes yet.

**`src-tauri/Cargo.toml`**
- [ ] Add `tauri-plugin-updater = "2"` to `[dependencies]`

**`src-tauri/src/main.rs`**
- [ ] Register updater plugin: `.plugin(tauri_plugin_updater::Builder::new().build())`

**`src-tauri/tauri.conf.json`**
- [ ] Add updater config to `plugins` block:
  ```json
  "updater": {
    "pubkey": "TAURI_SIGNING_PUBLIC_KEY",
    "endpoints": [
      "https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/releases/latest/download/latest.json"
    ]
  }
  ```

**`package.json`**
- [ ] `npm install @tauri-apps/plugin-updater @tauri-apps/plugin-process`
  - `plugin-updater` — JS API for checking + downloading
  - `plugin-process` — provides `relaunch()` to restart the app after install

**`src-tauri/Cargo.toml`** (also add process plugin for relaunch)
- [ ] Add `tauri-plugin-process = "2"` to `[dependencies]`

**`src-tauri/src/main.rs`**
- [ ] Register process plugin: `.plugin(tauri_plugin_process::init())`

**Permissions** — Tauri v2 requires capability declarations:
- [ ] Add updater + process permissions to `src-tauri/capabilities/default.json`:
  ```json
  "permissions": [
    "updater:default",
    "process:allow-relaunch"
  ]
  ```

**Post-Sprint U1:**
- [ ] `cargo check` passes
- [ ] Updated this checklist

---

## Sprint U2 — Frontend

**Goal:** A non-blocking update banner appears in the dashboard when a newer version is available. Shows version number and release notes. Download progress is visible. App restarts after install.

**`src/stores/updater.ts`** (new file)

State:
- `updateAvailable: boolean`
- `updateVersion: string`
- `releaseNotes: string`
- `downloadProgress: number` (0–100, shown during download)
- `isDownloading: boolean`
- `dismissed: boolean` (user can dismiss for the session)

Actions:
- `checkForUpdate()` — calls `check()` from `@tauri-apps/plugin-updater`; no-ops in web mode; sets state from result; silently ignores network errors (not every user is online)
- `downloadAndInstall()` — calls `update.downloadAndInstall(cb)` with a progress callback, then calls `relaunch()` from `@tauri-apps/plugin-process`

**`src/components/UpdateBanner.vue`** (new file)

Visual states:
```
[default]
┌──────────────────────────────────────────────────────────────┐
│  ↑  Vaulty 1.x.x is available  ·  <release notes text>   [✕]│
│                               [Update Now]                    │
└──────────────────────────────────────────────────────────────┘

[downloading]
┌──────────────────────────────────────────────────────────────┐
│  ↓  Downloading…  ██████████████░░░░  72%                [✕] │
└──────────────────────────────────────────────────────────────┘

[ready to restart]
┌──────────────────────────────────────────────────────────────┐
│  ✓  Update ready  ·  Vaulty will restart to apply.           │
│                               [Restart Now]                   │
└──────────────────────────────────────────────────────────────┘
```

Behavior:
- Only rendered when `updateStore.updateAvailable && !updateStore.dismissed`
- "✕" sets `dismissed = true` for the session (not persisted — they'll see it again next launch)
- Release notes collapsed by default, expandable inline
- Dismissing during a download cancels nothing — download continues in store; banner just hides

**`src/App.vue`** (modify)
- [ ] Import and mount `UpdateBanner` above `<Dashboard>` (visible only in dashboard view)
- [ ] After transitioning to `appView = 'dashboard'`, wait 5 s then call `updateStore.checkForUpdate()`
  - 5 s delay: gives iroh endpoint + background sync time to settle before adding network traffic

---

## Sprint U3 — Release Automation

**Goal:** Pushing a git tag triggers a full cross-platform build, signs all artifacts, and publishes a GitHub Release with `latest.json`. A version bump script keeps `package.json` and `tauri.conf.json` in sync.

**`.github/workflows/release.yml`** (new file)

```yaml
name: Release

on:
  push:
    tags: ['v[0-9]*']

jobs:
  publish:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: ubuntu-22.04
            args: ''
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Install Linux system deps
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev \
            librsvg2-dev patchelf

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - run: npm ci

      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          # ── macOS notarization (optional — fill Apple secrets to enable) ──
          # APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          # APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          # APPLE_ID: ${{ secrets.APPLE_ID }}
          # APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          # APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: Vaulty ${{ github.ref_name }}
          releaseBody: |
            See [CHANGELOG.md](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME/blob/main/CHANGELOG.md)
            for release notes.
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}
```

The `tauri-apps/tauri-action` step:
- Runs `tauri build` on each platform
- Signs each artifact using the private key secret
- Generates `latest.json` combining all platform binaries
- Creates the GitHub Release and uploads everything

**`scripts/bump-version.js`** (new file)

A small Node script that takes a semver string and writes it to both:
- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`

```bash
npm run version:bump 1.3.0
# → updates both files
# → prints a reminder to commit + tag
```

**`package.json`** — add script:
```json
"version:bump": "node scripts/bump-version.js"
```

**`CHANGELOG.md`** (new file, linked from release notes)
- Standard [Keep a Changelog](https://keepachangelog.com) format
- Updated manually before each release tag

**Release workflow (after this sprint):**
```bash
# 1. Write release notes in CHANGELOG.md
# 2. Bump version
npm run version:bump 1.3.0

# 3. Commit + tag
git add package.json src-tauri/tauri.conf.json CHANGELOG.md
git commit -m "chore: release v1.3.0"
git tag v1.3.0
git push && git push --tags

# GitHub Actions takes it from here — ~15 min to build all platforms
```

**Post-Sprint U3:**
- [ ] Do a dry-run: push a `v0.0.1-test` tag to a private branch, verify the workflow runs and produces a draft release with `latest.json`
- [ ] Verify `latest.json` contains all three platform entries
- [ ] Delete test release
- [ ] Update CLAUDE.md

---

## Sprint Status

| Sprint | Title | Status |
|--------|-------|--------|
| U1 | Plugin, Config & Signing | ✅ Complete |
| U2 | Frontend (store + UI) | ✅ Complete |
| U3 | Release Automation (CI + version script) | ✅ Complete |

---

## File Map

```
src-tauri/
├── Cargo.toml                       (add updater + process plugins)
├── src/main.rs                      (register both plugins)
├── capabilities/default.json        (add updater + process permissions)
└── tauri.conf.json                  (add plugins.updater block)

src/
├── stores/updater.ts                (new — update state + check/install logic)
└── components/UpdateBanner.vue      (new — banner UI, all three states)

.github/
└── workflows/release.yml            (new — matrix build + publish)

scripts/
└── bump-version.js                  (new — sync version across package.json + tauri.conf.json)

CHANGELOG.md                         (new — release notes, linked from GitHub releases)
```

---

## Total diff surface

~6 new files, 4 modified files. No changes to existing stores, services, or the sync architecture.
