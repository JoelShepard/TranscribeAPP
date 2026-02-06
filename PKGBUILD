# Maintainer: JoeShep
pkgname=transcribejs
pkgver=0.1.4
pkgrel=1
pkgdesc="TranscribeJS desktop app powered by Tauri"
arch=('x86_64')
url="https://github.com/your/repo"
license=('MIT')
depends=('webkit2gtk' 'gtk3' 'libappindicator-gtk3' 'gst-plugins-base-libs' 'gst-plugins-good' 'gst-plugins-bad')
makedepends=('bun' 'cargo' 'nodejs') # cargo is part of rust
source=()
sha256sums=()

build() {
    # Move to project root (assuming PKGBUILD is in root)
    cd "$srcdir/.."
    
    # Install dependencies and build
    # Note: We use the existing environment, but for a clean chroot build usually we'd npm install here.
    # Assuming node_modules are present or bun install handles it.
    bun install
    bun run build:tauri
}

package() {
    cd "$srcdir/.."
    
    # Binary
    install -Dm755 "src-tauri/target/release/app" "$pkgdir/usr/bin/$pkgname"
    
    # Icon (using the largest one available)
    install -Dm644 "src-tauri/icons/128x128.png" "$pkgdir/usr/share/icons/hicolor/128x128/apps/$pkgname.png"
    install -Dm644 "src-tauri/icons/32x32.png" "$pkgdir/usr/share/icons/hicolor/32x32/apps/$pkgname.png"
    
    # Desktop Entry
    mkdir -p "$pkgdir/usr/share/applications"
    cat > "$pkgdir/usr/share/applications/$pkgname.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=TranscribeJS
Comment=TranscribeJS Desktop App
Exec=$pkgname
Icon=$pkgname
Terminal=false
Categories=Utility;Audio;
EOF
}
