#!/bin/bash
# Builds the libretro core (ARMv6 for Raspberry Pi Zero W) and a host test harness.
set -e
cd "$(dirname "$0")"
export PATH=/opt/homebrew/bin:$PATH
Q=third_party/quickjs
QFLAGS='-D_GNU_SOURCE -DCONFIG_VERSION="2024-01-13" -O2 -w'
SRC="src/canvas2d.c src/js_bindings.c src/libretro_core.c"
mkdir -p build
case "$1" in
  host)
    for f in quickjs cutils libbf libregexp libunicode; do
      [ -f build/${f}_host.o ] || clang $QFLAGS -c $Q/$f.c -o build/${f}_host.o
    done
    clang -O2 -w -I third_party -I $Q -DHOST $SRC src/host_test.c build/*_host.o -lm -lpthread -o build/host_test
    ;;
  arm)
    for f in quickjs cutils libbf libregexp libunicode; do
      [ -f build/${f}_arm.o ] || zig cc -target arm-linux-gnueabihf.2.28 -mcpu=arm1176jzf_s $QFLAGS -fPIC -c $Q/$f.c -o build/${f}_arm.o
    done
    zig cc -target arm-linux-gnueabihf.2.28 -mcpu=arm1176jzf_s -O2 -w -fPIC -shared -I third_party -I $Q $SRC build/*_arm.o -lm -lpthread -Wl,-z,defs -o build/retro_arcade_studio_libretro.so
    ;;
  *) echo "usage: build.sh host|arm"; exit 2;;
esac
