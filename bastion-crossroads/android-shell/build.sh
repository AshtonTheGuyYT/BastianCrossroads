#!/bin/bash
# Builds and signs bastion-crossroads.apk without Gradle (javac -> dx -> aapt -> zipalign -> apksigner).
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk/platforms/android-23/android.jar
KS=${KEYSTORE:-keystore/bastion-release.jks}
rm -rf build && mkdir -p build/classes build/gen
echo "1/6 Generating resource IDs"
aapt package -f -m -J build/gen -M AndroidManifest.xml -S res -I "$SDK"
echo "2/6 Compiling Java"
if ! javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$SDK" -classpath "$SDK" -d build/classes $(find src build/gen -name '*.java') > build/javac.log 2>&1; then grep -v "Picked up" build/javac.log; exit 1; fi
echo "3/6 Converting to Android bytecode"
dalvik-exchange --dex --min-sdk-version=23 --output=build/classes.dex build/classes
echo "4/6 Packaging"
aapt package -f -M AndroidManifest.xml -S res -I "$SDK" -F build/unaligned.apk
(cd build && aapt add unaligned.apk classes.dex > /dev/null)
echo "5/6 Aligning"
zipalign -f -p 4 build/unaligned.apk build/aligned.apk
echo "6/6 Signing"
apksigner sign --ks "$KS" --ks-pass env:KS_PASS --key-pass env:KS_PASS --out build/bastion-crossroads.apk build/aligned.apk
apksigner verify --verbose build/bastion-crossroads.apk | head -5
