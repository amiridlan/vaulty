# Password Vault

A secure desktop application for managing passwords, built with Vue 3, TypeScript, and Tauri. This app allows you to store, encrypt, and manage your passwords locally with a user-friendly interface.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Rust** (version 1.77.2 or higher) - [Install Rust](https://www.rust-lang.org/tools/install)
- **Cargo** (comes with Rust)

### Platform-Specific Requirements

- **Windows**: Visual Studio Build Tools (for building native modules). Install via Visual Studio Installer or download the Build Tools for Visual Studio.
- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: GTK development libraries (e.g., `sudo apt-get install libgtk-3-dev` on Ubuntu)

## Tech Stack

### Frontend

- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Typed superset of JavaScript
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Pinia** - State management for Vue
- **Vue Router** - Official router for Vue.js

### Backend

- **Tauri** - Framework for building desktop apps with web technologies
- **Rust** - Systems programming language for the backend
- **SQLite** - Embedded SQL database for local storage

### Plugins and Libraries

- **Tauri Plugins**: SQL, File System, Dialog
- **Crypto-JS** - JavaScript library for encryption
- **IndexedDB** - Browser-based database for web fallback mode

### Rust Crates (sync layer)

- **ed25519-dalek** - Ed25519 keypair generation for vault identity
- **aes-gcm** - AES-256-GCM encryption of the vault private key
- **pbkdf2 / sha2** - Key derivation from master password (100k iterations)
- **bs58** - Base58 encoding of the vault public key (the "sync code")
- **iroh** - QUIC-based P2P networking (hole-punching + relay fallback)
- **tokio** - Async runtime for the iroh accept loop

## Installation for Developers

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd vaulty
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run tauri:dev
   ```
   This will start the development server and open the Tauri app window.

## Installation for Users (NSIS/MSI)

For end-users who want to install the pre-built application:

1. Go to the [Releases](https://github.com/yourusername/vaulty/releases) page of this repository.

2. Download the appropriate installer for your platform:

   - **Windows MSI**: Download the `.msi` file
   - **Windows NSIS**: Download the `.exe` file

3. Run the installer:
   - Double-click the downloaded file
   - Follow the installation wizard
   - The app will be installed and added to your system's applications

### System Requirements for Installation

- **Windows**: Windows 10 or later
- **macOS**: macOS 10.13 or later
- **Linux**: GTK 3.0 or later

## Building the Application

To build the application for distribution:

```bash
npm run build:app
```

This will create platform-specific installers in the `releases` directory.

For packaging only:

```bash
npm run package
```

## Usage

1. Launch the application. On first run choose **New Vault** or **Join Existing Vault**.
   - **New Vault** — creates a fresh vault and generates a Sync Code. Save the Sync Code; you will need it to add other devices.
   - **Join Existing Vault** — enter the Sync Code from your original device and the same master password. Your vault data will appear after both devices are online together (Sprint 4+).
2. Create a strong master password (minimum 12 characters, includes uppercase, numbers, and symbols).
3. Set up a security question for password recovery.
4. Start adding and managing your passwords.

Your Sync Code is always visible in **Device Sync → Your Sync Code**.

### Pairing a Second Device

Once both devices are running, open **Device Sync → Add Device** on both:

1. On **Device A** — copy your Connection Ticket.
2. On **Device B** — paste Device A's ticket into the "Enter the other device's ticket" field and click **Connect**.
3. Both devices now appear in each other's **Connected Devices** list and begin syncing automatically.
4. Pairings persist across restarts. On next launch, devices on the same LAN reconnect automatically via mDNS without re-entering tickets.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues or questions, please open an issue on GitHub or contact the maintainers.
