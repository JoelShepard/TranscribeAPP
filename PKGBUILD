# Maintainer: JoeShep
pkgname=transcribejs
pkgver=0.4.4
pkgrel=1
pkgdesc="TranscribeJS native Linux desktop app (Tauri)"
arch=('x86_64')
url="https://github.com/JoelShepard/TranscribeAPP"
license=('MIT')
depends=('webkit2gtk-4.1' 'gtk3' 'libayatana-appindicator' 'gst-plugins-base-libs' 'gst-plugins-good' 'gst-plugins-bad')
makedepends=('bun' 'rust' 'cargo')
options=(!lto)
source=()
sha256sums=()

build() {
    cd "$srcdir/.."

    bun install --frozen-lockfile
    bun run build:tauri -- --no-bundle
}

package() {
    cd "$srcdir/.."

    install -Dm755 "src-tauri/target/release/app" "$pkgdir/usr/bin/$pkgname"

    install -Dm644 "src-tauri/icons/128x128.png" "$pkgdir/usr/share/icons/hicolor/128x128/apps/$pkgname.png"
    install -Dm644 "src-tauri/icons/32x32.png" "$pkgdir/usr/share/icons/hicolor/32x32/apps/$pkgname.png"

    install -dm755 "$pkgdir/usr/share/applications"
    cat > "$pkgdir/usr/share/applications/$pkgname.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=TranscribeJS
Comment=Audio transcription app
Exec=$pkgname
Icon=$pkgname
Terminal=false
Categories=Utility;Audio;
StartupNotify=true
EOF
}
