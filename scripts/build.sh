#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${ZIG:=zig}"
: "${ARES_PACKAGE:=ares-package}"
command -v "$ZIG" >/dev/null || { echo 'Install Zig 0.14.1 or set ZIG to its executable.'; exit 1; }
python3 - <<'PYBUILD'
from pathlib import Path
import shutil
for p in [Path('build/native-app'),Path('build/native-service')]:
 if p.exists(): shutil.rmtree(p)
p=Path('launcher/apps.js')
if not p.exists(): p.write_text('window.TV_APPS = {apps: [], inputs: []};\n')
PYBUILD
mkdir -p build/native-app/state build/native-service/state dist
# Stage from a clean set of public sources; never package local runtime state.
cp native/app/*.js native/app/*.json native/app/*.png build/native-app/
cp -R native/app/vendor build/native-app/
cp native/service/*.js native/service/*.json build/native-service/
touch build/native-app/state/.keep build/native-service/state/.keep
"$ZIG" cc -target arm-linux-musleabi -Os -static -s native/app/detach.c -o build/native-app/detach
"$ZIG" cc -target arm-linux-musleabi -Os -static -s native/prototype/relay.c native/prototype/filter.c -o build/native-app/relay
"$ZIG" cc -target arm-linux-musleabi -Os -static -s native/app/resume.c -o build/native-app/resume
"$ARES_PACKAGE" build/native-app build/native-service -o dist
python3 scripts/fix-package-data.py dist/com.local.nativehome_0.6.13_arm.ipk
"$ARES_PACKAGE" launcher renewal-service aerials-service -o dist
python3 - <<'PY'
from pathlib import Path
import hashlib
p=Path('dist');(p/'SHA256SUMS').write_text(''.join(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.name+'\n' for f in sorted(p.glob('*.ipk'))))
PY
