#!/usr/bin/env bash
# SLLM 배포판(설치 EXE) 만들기 — 리눅스/작업 VM용. Windows 에서는 build-installer.ps1.
# 규칙은 RELEASE_RULES_KO.md 를 따른다(경로는 지난 설치기와 같게, Node.js 불필요, 새 규칙 추가 금지).
# 쓰는 법: bash build-release.sh        (결과: dist/SLLM-Missive-Tester-Setup-<버전>.exe)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="${SLLM_BUILD_DIR:-/tmp/sllm-release-build}"
EV="31.7.7"
echo "[1/6] 작업 폴더 준비: $WORK"
rm -rf "$WORK"; mkdir -p "$WORK/nsis" "$WORK/stage"
echo "[2/6] 빌드 도구(NSIS 리눅스판)와 실행 프로그램(Electron $EV) 준비"
tar xzf "$ROOT/tools/nsis-linux-toolkit-3.0.4.1.tar.gz" -C "$WORK/nsis"
chmod +x "$WORK/nsis/linux/makensis"
cat "$ROOT"/tools/electron/electron-v$EV-win32-x64.zip.part* > "$WORK/electron.zip"
want=$(grep " \*electron-v$EV-win32-x64.zip\$" "$ROOT/tools/electron/electron-v$EV-SHASUMS256.txt" | cut -d' ' -f1)
got=$(sha256sum "$WORK/electron.zip" | cut -d' ' -f1)
[ "$want" = "$got" ] || { echo "Electron 압축 파일 해시가 맞지 않습니다."; exit 1; }
echo "[3/6] 앱 복사(node_modules 제외) + runtime 넣기"
mkdir -p "$WORK/stage/app"
(cd "$ROOT/payload/app" && tar cf - --exclude=node_modules --exclude=.git --exclude=runtime .) | (cd "$WORK/stage/app" && tar xf -)
python3 - "$WORK/electron.zip" "$WORK/stage/app/runtime" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
[ -f "$WORK/stage/app/runtime/electron.exe" ] || { echo "runtime/electron.exe 가 없습니다."; exit 1; }
[ -f "$WORK/stage/app/dist/main.js" ] || { echo "dist/main.js 가 없습니다. 먼저 앱을 빌드(tsc)하세요."; exit 1; }
echo "[4/6] 제거 목록(installer/uninstall-files.nsh) 만들기"
python3 - "$WORK/stage/app" "$ROOT/installer/uninstall-files.nsh" <<'PY'
import os, sys
root, out = sys.argv[1], sys.argv[2]
files, dirs = [], []
for d, ds, fs in os.walk(root):
    rel = os.path.relpath(d, root)
    for f in sorted(fs): files.append(os.path.normpath(os.path.join(rel, f)))
    if rel != '.': dirs.append(rel)
lines = ['Delete "$INSTDIR\\%s"' % f.replace('/', '\\') for f in sorted(files)]
lines += ['RMDir "$INSTDIR\\%s"' % d.replace('/', '\\') for d in sorted(dirs, key=len, reverse=True)]
open(out, 'w', encoding='utf-8-sig', newline='\r\n').write('\n'.join(lines) + '\n')
print('  files', len(files), 'dirs', len(dirs))
PY
echo "[5/6] 최소 설치 구성 + 게임 DLL 해시"
# 2026-10-21 사용자 결정 A안: 설치기에는 실행 프로그램·DLL·로컬 모드·첫 설치 도우미만. 나머지는 첫 실행 때 창작마당 묶음에서 채운다.
SEED="$WORK/stage/seed"; rm -rf "$SEED"; mkdir -p "$SEED"
for k in runtime tester-mod native/command-bridge.dll native/bridge/command-bridge.dll dist/bootstrap.js dist/app-update-core.js dist/version-check.js dist/environment-paths.js package.json start_app.bat update-public-key.pem README_KO.md ALPHA_SETUP_KO.md ALPHA_SETUP_EN.md; do
  if [ -e "$WORK/stage/app/$k" ]; then mkdir -p "$SEED/$(dirname "$k")"; cp -R "$WORK/stage/app/$k" "$SEED/$k";
  else case "$k" in *.md) ;; *) echo "최소 설치 구성 항목이 없습니다: $k"; exit 1;; esac; fi
done
[ ! -e "$SEED/dist/main.js" ] || { echo "최소 설치기에 dist/main.js 가 들어가면 안 됩니다."; exit 1; }
HASH=$(sha256sum "$SEED/native/command-bridge.dll" | cut -d' ' -f1 | tr a-f A-F)
echo "  $HASH"
echo "[6/6] 설치기 만들기"
mkdir -p "$ROOT/dist"
(cd "$ROOT/installer" && LC_ALL=C.UTF-8 LANG=C.UTF-8 NSISDIR="$WORK/nsis" "$WORK/nsis/linux/makensis" -V2 "-DDLL_HASH=$HASH" "-DPAYLOAD=$SEED" setup.nsi)
ls -la "$ROOT/dist"
echo "완료. 확인 목록은 RELEASE_RULES_KO.md 의 '만든 뒤 확인'."
