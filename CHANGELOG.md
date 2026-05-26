# Changelog

All notable changes to Vaulty are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

## [1.2.2] — current

### Added
- P2P device sync via iroh (QUIC) — pair devices once, sync automatically on LAN or over the internet
- Device management: rename and revoke paired devices
- Vault identity (Ed25519 keypair) for cryptographic device pairing
- Auto-reconnect to known peers on startup
- Background sync every 5 minutes while devices are connected
- Graceful degradation banner when P2P endpoint is unavailable
- In-app update notifications with one-click install
