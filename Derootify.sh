#!/bin/sh

### Procursus 2

### INFO: Repacks deb as rootless with iphoneos-arm64 arch, moves legacy tweak dir to
###       new directory, and resigns. Does not do any further modification.

# ✅ PATHを確実に通す
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

set -e

# --- 必須ツールの確認 ---
if ! type dpkg-deb >/dev/null 2>&1; then
	echo "Please install dpkg-deb."
	exit 1
fi

if ! type file >/dev/null 2>&1; then
	echo "Please install file."
	exit 1
fi

if ! type fakeroot >/dev/null 2>&1; then
	echo "Please install fakeroot."
	exit 1
fi

# ✅ ldidを明示的に指定（Procursus版を確認）
if ! /opt/homebrew/bin/ldid 2>&1 | grep -q procursus; then
	echo "Please install Procursus ldid."
	exit 1
fi

LDID="/opt/homebrew/bin/ldid -Hsha256"

# --- 引数チェック ---
if [ -z "$1" ] || ! file "$1" | grep -q "Debian binary package" ; then
    echo "Usage: $0 [/path/to/deb]"
    exit 1
fi

echo "Creating workspace"
TEMPDIR_OLD="$(mktemp -d)"
TEMPDIR_NEW="$(mktemp -d)"

if [ ! -d "$TEMPDIR_OLD" ] || [ ! -d "$TEMPDIR_NEW" ]; then
	echo "Creating temporary directories failed."
    exit 1
fi

### --- Real script start ---

dpkg-deb -R "$1" "$TEMPDIR_OLD"

if [ -d "$TEMPDIR_OLD/var/jb" ]; then
    echo "Deb already rootless. Skipping and exiting cleanly."
    rm -rf "$TEMPDIR_OLD" "$TEMPDIR_NEW"
    exit 0
fi

mkdir -p "$TEMPDIR_NEW"/var/jb
cp -a "$TEMPDIR_OLD"/DEBIAN "$TEMPDIR_NEW"
sed 's|iphoneos-arm|iphoneos-arm64|' < "$TEMPDIR_OLD"/DEBIAN/control > "$TEMPDIR_NEW"/DEBIAN/control

rm -rf "$TEMPDIR_OLD"/DEBIAN
mv -f "$TEMPDIR_OLD"/.* "$TEMPDIR_OLD"/* "$TEMPDIR_NEW"/var/jb >/dev/null 2>&1 || true

if [ -d "$TEMPDIR_NEW/var/jb/Library/MobileSubstrate/DynamicLibraries" ]; then
    mkdir -p "$TEMPDIR_NEW/var/jb/usr/lib"
    mv "$TEMPDIR_NEW/var/jb/Library/MobileSubstrate/DynamicLibraries" "$TEMPDIR_NEW/var/jb/usr/lib/TweakInject"
fi

find "$TEMPDIR_NEW" -type f | while read -r file; do
  if file -ib "$file" | grep -q "x-mach-binary; charset=binary"; then
    echo "$file"
    INSTALL_NAME=$(otool -D "$file" | grep -v -e ":$" -e "^Archive :" | head -n1)
    otool -L "$file" | tail -n +2 | grep /usr/lib/'[^/]'\*.dylib | cut -d' ' -f1 | tr -d "[:blank:]" > "$TEMPDIR_OLD"/._lib_cache
    if [ -n "$INSTALL_NAME" ]; then
        install_name_tool -id @rpath/"$(basename "$INSTALL_NAME")" "$file" >/dev/null 2>&1
    fi
    if otool -L "$file" | grep -q CydiaSubstrate; then
        install_name_tool -change /Library/Frameworks/CydiaSubstrate.framework/CydiaSubstrate @rpath/libsubstrate.dylib "$file" >/dev/null 2>&1
    fi
    if [ -f "$TEMPDIR_OLD"/._lib_cache ]; then
        cat "$TEMPDIR_OLD"/._lib_cache | while read line; do
            install_name_tool -change "$line" @rpath/"$(basename "$line")" "$file" >/dev/null 2>&1
        done
    fi
    install_name_tool -add_rpath "/usr/lib" "$file" >/dev/null 2>&1
    install_name_tool -add_rpath "/var/jb/usr/lib" "$file" >/dev/null 2>&1

    # ✅ フルパス指定で署名
    $LDID -s "$file"
  fi
done

fakeroot dpkg-deb -b "$TEMPDIR_NEW" "$(pwd)"/"$(grep Package: "$TEMPDIR_NEW"/DEBIAN/control | cut -f2 -d ' ')"_"$(grep Version: "$TEMPDIR_NEW"/DEBIAN/control | cut -f2 -d ' ')"_"$(grep Architecture: "$TEMPDIR_NEW"/DEBIAN/control | cut -f2 -d ' ')".deb

### --- Real script end ---
echo "Cleaning up"
rm -rf "$TEMPDIR_OLD" "$TEMPDIR_NEW"
