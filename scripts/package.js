import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const version = '1.2.2';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const bundlePath = path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'bundle');
const distPath = path.join(__dirname, '..', 'releases', `v${version}`);

// Create releases directory
if (!fs.existsSync(distPath)) {
  fs.mkdirSync(distPath, { recursive: true });
}

console.log('📦 Packaging Password Vault...\n');

// Copy built files
const platforms = {
  'msi': 'Windows Installer',
  'nsis': 'Windows Setup',
  'dmg': 'macOS Disk Image',
  'deb': 'Linux Debian Package',
  'appimage': 'Linux AppImage'
};

Object.keys(platforms).forEach(platform => {
  const platformPath = path.join(bundlePath, platform);
  if (fs.existsSync(platformPath)) {
    const files = fs.readdirSync(platformPath);
    files.forEach(file => {
      const src = path.join(platformPath, file);
      const dest = path.join(distPath, file);
      fs.copyFileSync(src, dest);
      console.log(`✅ Packaged: ${platforms[platform]} - ${file}`);
    });
  }
});

// Create README for distribution
const readmeContent = `
# Password Vault v${version}

## Installation

### Windows
- **MSI Installer**: Double-click the .msi file
- **NSIS Setup**: Double-click the .exe file

### macOS
- **DMG**: Open the .dmg file and drag to Applications
- Requires macOS 10.13 or later

### Linux
- **Debian/Ubuntu**: \`sudo dpkg -i password-vault_${version}_amd64.deb\`
- **AppImage**: \`chmod +x password-vault_${version}_amd64.AppImage && ./password-vault_${version}_amd64.AppImage\`

## System Requirements

- **Windows**: Windows 10 or later
- **macOS**: macOS 10.13 or later
- **Linux**: GTK 3.0 or later

## First Launch

1. Create a strong master password (minimum 12 characters)
2. Choose and answer a security question
3. Start managing your passwords securely

## Support

For issues or questions, visit: https://github.com/yourusername/password-vault

---

Built with ❤️ using Vue 3, TypeScript, and Tauri
`;

fs.writeFileSync(path.join(distPath, 'README.txt'), readmeContent.trim());

console.log('\n✨ Package complete!');
console.log(`📁 Distribution files: ${distPath}`);