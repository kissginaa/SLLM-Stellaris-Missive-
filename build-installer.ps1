param([string]$MakeNSIS)
# SLLM 배포판(설치 EXE) 만들기 — Windows용. 리눅스/작업 VM에서는 build-release.sh.
# 규칙은 RELEASE_RULES_KO.md 를 따른다(경로는 지난 설치기와 같게, Node.js 불필요, 새 규칙 추가 금지).
$ErrorActionPreference='Stop'
$projectRoot=$PSScriptRoot
$ev='31.7.7'
if(!$MakeNSIS){
 $found=Get-Command makensis.exe -ErrorAction SilentlyContinue
 if($found){$MakeNSIS=$found.Source}
 else{foreach($candidate in @('C:\Program Files (x86)\NSIS\makensis.exe','C:\Program Files\NSIS\makensis.exe')){if(Test-Path -LiteralPath $candidate){$MakeNSIS=$candidate;break}}}
}
if(!$MakeNSIS -or !(Test-Path -LiteralPath $MakeNSIS)){throw 'Install NSIS or pass -MakeNSIS with the path to makensis.exe. (No NSIS? use build-release.sh on Linux.)'}
$work=Join-Path $env:TEMP 'sllm-release-build'
if(Test-Path -LiteralPath $work){Remove-Item -LiteralPath $work -Recurse -Force}
$stage=Join-Path $work 'app'; New-Item -ItemType Directory -Path $stage -Force | Out-Null
# 1) 실행 프로그램(Electron) 조각 합치기 + 해시 확인
$zip=Join-Path $work 'electron.zip'
$parts=Get-ChildItem -LiteralPath (Join-Path $projectRoot 'tools\electron') -Filter "electron-v$ev-win32-x64.zip.part*" | Sort-Object Name
$out=[IO.File]::Create($zip); try{foreach($p in $parts){$b=[IO.File]::ReadAllBytes($p.FullName);$out.Write($b,0,$b.Length)}}finally{$out.Dispose()}
$want=((Get-Content (Join-Path $projectRoot "tools\electron\electron-v$ev-SHASUMS256.txt")) | Where-Object {$_ -match " \*electron-v$ev-win32-x64\.zip$"}).Split(' ')[0]
if((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $want.ToUpper()){throw 'Electron zip hash mismatch.'}
# 2) 앱 복사(node_modules·runtime 제외) + runtime 풀기
$appRoot=Join-Path $projectRoot 'payload\app'
robocopy $appRoot $stage /E /XD node_modules .git runtime /NFL /NDL /NJH /NJS | Out-Null
Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $stage 'runtime')
if(!(Test-Path -LiteralPath (Join-Path $stage 'runtime\electron.exe'))){throw 'runtime\electron.exe missing.'}
if(!(Test-Path -LiteralPath (Join-Path $stage 'dist\main.js'))){throw 'dist\main.js missing. Build the app (tsc) first.'}
# 3) 제거 목록
$manifest=@()
foreach($file in Get-ChildItem -LiteralPath $stage -Recurse -File | Sort-Object FullName){ $manifest+='Delete "$INSTDIR\'+$file.FullName.Substring($stage.Length+1)+'"' }
foreach($folder in Get-ChildItem -LiteralPath $stage -Recurse -Directory | Sort-Object {$_.FullName.Length} -Descending){ $manifest+='RMDir "$INSTDIR\'+$folder.FullName.Substring($stage.Length+1)+'"' }
[IO.File]::WriteAllLines((Join-Path $projectRoot 'installer\uninstall-files.nsh'),$manifest,[Text.UTF8Encoding]::new($true))
# 4) 최소 설치 구성(2026-10-21 사용자 결정 A안): 설치기에는 실행 프로그램·DLL·로컬 모드·첫 설치 도우미만 넣는다.
#    나머지 앱 파일은 처음 켤 때 dist\bootstrap.js 가 창작마당 묶음(sllm_app_update)에서 서명·해시를 확인하고 채운다.
#    제거 목록(3)은 위의 전체 구성으로 만들었으므로 채워진 파일도 함께 지운다.
$seed=Join-Path $work 'seed'
$keep=@('runtime','tester-mod','native\command-bridge.dll','native\bridge\command-bridge.dll','dist\bootstrap.js','dist\app-update-core.js','dist\version-check.js','dist\environment-paths.js','package.json','start_app.bat','update-public-key.pem')
$docs=@('README_KO.md','ALPHA_SETUP_KO.md','ALPHA_SETUP_EN.md')
foreach($k in $keep+$docs){
 $src=Join-Path $stage $k
 if(!(Test-Path -LiteralPath $src)){ if($docs -contains $k){continue}; throw "Minimal installer item missing: $k" }
 $dst=Join-Path $seed $k; New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null
 Copy-Item -LiteralPath $src -Destination $dst -Recurse
}
if(Test-Path -LiteralPath (Join-Path $seed 'dist\main.js')){throw 'Minimal installer must not contain dist\main.js.'}
# 5) DLL 해시 + 설치기
$hash=(Get-FileHash -LiteralPath (Join-Path $seed 'native\command-bridge.dll') -Algorithm SHA256).Hash
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'dist') -Force | Out-Null
$env:NSISDIR=Split-Path -Parent $MakeNSIS
& $MakeNSIS /V2 "/DDLL_HASH=$hash" "/DPAYLOAD=$seed" (Join-Path $projectRoot 'installer\setup.nsi')
if($LASTEXITCODE -ne 0){throw 'Installer build failed.'}
Write-Output 'Installer built in dist. See RELEASE_RULES_KO.md checklist.'
# 6) 수동 설치 ZIP(2026-10-21): 설치기(exe)를 쓰고 싶지 않은 사용자용. 설치기와 같은 최소 구성 + 설명서 + 파일별 SHA-256. 게임 폴더에는 아무것도 넣지 않는다.
$ver=([regex]::Match([IO.File]::ReadAllText((Join-Path $seed 'package.json')),'"version"\s*:\s*"([^"]+)"')).Groups[1].Value
$manual=Join-Path $work 'manual'
if(Test-Path -LiteralPath $manual){Remove-Item -LiteralPath $manual -Recurse -Force}
Copy-Item -LiteralPath $seed -Destination $manual -Recurse
foreach($g in 'MANUAL_INSTALL_KO.md','MANUAL_INSTALL_EN.md'){Copy-Item -LiteralPath (Join-Path $projectRoot "installer\$g") -Destination (Join-Path $manual $g)}
$sums=@(foreach($f in (Get-ChildItem -LiteralPath $manual -Recurse -File | Sort-Object FullName)){ (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash+'  '+$f.FullName.Substring($manual.Length+1).Replace('\','/') })
[IO.File]::WriteAllLines((Join-Path $manual 'SHA256SUMS.txt'),$sums,[Text.UTF8Encoding]::new($false))
$zipOut=Join-Path $projectRoot "dist\SLLM-Missive-Manual-$ver.zip"
if(Test-Path -LiteralPath $zipOut){Remove-Item -LiteralPath $zipOut -Force}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($manual,$zipOut,[IO.Compression.CompressionLevel]::Optimal,$false)
Write-Output "Manual-install zip: $zipOut"
