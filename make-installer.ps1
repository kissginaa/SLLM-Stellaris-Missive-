# SLLM 설치기 한 번에 만들기 (Windows). 더블클릭용 설치기_만들기.bat 이 이 파일을 부른다.
# 순서: 도구 확인(+앱 업데이트 서명 키) → 실행 앱과 payload 비교 → 앱 빌드(tsc)+자동 검사 → 버전 확인 → 설치기 빌드 → 바탕화면 새 폴더에 복사 → 창작마당 모드 폴더에 앱 업데이트 묶음.
# 규칙은 RELEASE_RULES_KO.md 그대로다(경로·방식 변경 없음). 창작마당 모드 폴더에는 앱 업데이트 묶음(sllm_app_update)을 넣고, 모드 파일은 payload/app/tester-mod 와 똑같이 맞춘 뒤(descriptor.mod·sllm_app_update 제외, 2026-10-27 · 썸네일은 2026-11-04부터 같이 맞춤) descriptor.mod 의 version 줄과 연결 신호(sllm_probe_connection.txt HELLO)의 버전을 같은 버전으로 맞춘다(2026-10-18 · 2026-10-24).
# 버전: 버전이 적힌 곳 중 가장 높은 것으로 나머지를 자동으로 맞춘다(package.json·lock·descriptor.mod·HELLO·setup.nsi). 직접 정하려면 -Bump 0.1.0-alpha.6
# -UpdateOnly (업데이트_만들기.bat): 설치기는 만들지 않고 창작마당용 앱 업데이트 묶음(sllm_app_update)만 만든다. 지난 묶음과 버전이 같으면 한 단계(…alpha.8 → …alpha.8.1 → …alpha.8.2) 자동으로 올린다.
param([string]$Bump, [string]$MakeNSIS, [switch]$SkipTests, [switch]$UpdateOnly)
$ErrorActionPreference = 'Stop'
$dev = $PSScriptRoot
$payload = Join-Path $dev 'payload\app'
$desk = Split-Path -Parent $dev
$run = Join-Path $desk 'app\SLLM-Tester'
$tmp = Join-Path $env:TEMP 'sllm-tsc'
$step = 0
$total = if ($UpdateOnly) { 5 } else { 7 }
function Say($t) { $script:step++; Write-Host ""; Write-Host ("[{0}/{1}] {2}" -f $script:step, $total, $t) -ForegroundColor Cyan }
function Fail($t) { throw $t }
function RmJunction($p) {
  if (Test-Path -LiteralPath $p) {
    $expected = [IO.Path]::GetFullPath((Join-Path $tmp 'app\node_modules'))
    if ([IO.Path]::GetFullPath($p) -ne $expected) { throw 'Unexpected build junction path.' }
    $item = Get-Item -LiteralPath $p -Force
    if (!($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Expected a build junction.' }
    [IO.Directory]::Delete($p, $false)
  }
}
function ReadText($p) { [IO.File]::ReadAllText($p) }
function HasBom($p) { $b = [IO.File]::ReadAllBytes($p); return ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF) }
function WriteText($p, $t) { [IO.File]::WriteAllText($p, $t, [Text.UTF8Encoding]::new((HasBom $p))) }
function VersionFiles {
  $l = @()
  foreach ($root in @($payload, $run)) {
    if (!(Test-Path -LiteralPath $root)) { continue }
    $l += Join-Path $root 'package.json'
    $l += Join-Path $root 'package-lock.json'
    $l += Join-Path $root 'tester-mod\descriptor.mod'
    $l += (Get-ChildItem -LiteralPath $root -Recurse -File -Filter 'sllm_probe_connection.txt' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\node_modules\\' }).FullName
  }
  $l += Join-Path $dev 'installer\setup.nsi'
  return $l | Where-Object { $_ }
}
try {
  if ($UpdateOnly) { Write-Host "=== SLLM 앱 업데이트 묶음 만들기 (설치기는 만들지 않음) ===" -ForegroundColor Green } else { Write-Host "=== SLLM 설치기 만들기 ===" -ForegroundColor Green }
  # 1) 도구
  Say '도구 확인 (Node.js · NSIS)'
  foreach ($c in @('node', 'npm.cmd')) { if (!(Get-Command $c -ErrorAction SilentlyContinue)) { Fail "$c 를 찾을 수 없습니다. 개발용 PC 에 Node.js 가 필요합니다(설치기를 쓰는 사용자는 필요 없음)." } }
  if (!$MakeNSIS) {
    $f = Get-Command makensis.exe -ErrorAction SilentlyContinue
    if ($f) { $MakeNSIS = $f.Source } else { foreach ($c in @('C:\Program Files (x86)\NSIS\makensis.exe', 'C:\Program Files\NSIS\makensis.exe')) { if (Test-Path -LiteralPath $c) { $MakeNSIS = $c; break } } }
  }
  if (!$UpdateOnly -and (!$MakeNSIS -or !(Test-Path -LiteralPath $MakeNSIS)) -and (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host "  NSIS 가 없어 자동 설치합니다 (winget, 관리자 허용 창이 뜨면 '예')." -ForegroundColor Yellow
    winget install -e --id NSIS.NSIS --accept-package-agreements --accept-source-agreements
    foreach ($c in @('C:\Program Files (x86)\NSIS\makensis.exe', 'C:\Program Files\NSIS\makensis.exe')) { if (Test-Path -LiteralPath $c) { $MakeNSIS = $c; break } }
  }
  if (!$UpdateOnly -and (!$MakeNSIS -or !(Test-Path -LiteralPath $MakeNSIS))) { Fail "NSIS(makensis.exe)가 없습니다. 먼저 설치해 주세요:  winget install NSIS.NSIS   (설치 후 이 도구를 다시 실행)" }
  if (!(Test-Path -LiteralPath $payload)) { Fail "payload\app 폴더가 없습니다: $payload" }
  if (!$UpdateOnly) { Write-Host "  NSIS: $MakeNSIS" }
  # 앱 업데이트 서명 키(2026-10-18): 처음 한 번 만들고(%USERPROFILE%\.sllm), 공개 키를 payload·실행 앱에 넣는다(설치기에 같이 들어감).
  & node (Join-Path $dev 'tools\make-app-update.js') key $payload $run
  if ($LASTEXITCODE) { Fail '앱 업데이트 서명 키를 준비하지 못했습니다 (위 메시지를 확인하세요).' }
  # 버전 자동 인식: 버전이 적힌 곳(package.json · descriptor.mod · HELLO · setup.nsi)에서 가장 높은 버전을 찾아 나머지를 맞춘다.
  # (파일 하나만 알파 6 으로 바꿔도 된다. 직접 정하려면 -Bump 0.1.0-alpha.6)
  function VerKey($v) {
    $m = [regex]::Match($v, '^(\d+)\.(\d+)\.(\d+)(?:-([A-Za-z]+)((?:\.\d+)*))?$'); if (!$m.Success) { return $null }
    $tag = $m.Groups[4].Value.ToLower(); $rank = 4; if ($tag) { $rank = @{ alpha = 1; beta = 2; rc = 3 }[$tag]; if (!$rank) { $rank = 0 } }
    $n = @([int]$m.Groups[1].Value, [int]$m.Groups[2].Value, [int]$m.Groups[3].Value, [int]$rank)
    foreach ($x in $m.Groups[5].Value.Split('.')) { if ($x) { $n += [int]$x } }
    while ($n.Count -lt 10) { $n += 0 }
    return $n
  }
  function VerCmp($a, $b) { $x = VerKey $a; $y = VerKey $b; for ($i = 0; $i -lt 10; $i++) { if ($x[$i] -ne $y[$i]) { if ($x[$i] -lt $y[$i]) { return -1 } else { return 1 } } }; return 0 }
  $docMod = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Paradox Interactive\Stellaris\mod\sllm_missive'
  $oldMan = Join-Path $docMod 'sllm_app_update\manifest.json'; $prevVer = $null; $prevDll = $null
  if (Test-Path -LiteralPath $oldMan) { try { $pm = Get-Content -LiteralPath $oldMan -Raw -Encoding UTF8 | ConvertFrom-Json; $prevVer = $pm.version; $prevDll = (@($pm.files) | Where-Object { $_.path -eq 'native/command-bridge.dll' } | Select-Object -First 1).sha256 } catch { $prevVer = $null } }
  function NextVer($v) {
    $m = [regex]::Match($v, '^(\d+\.\d+\.\d+-[A-Za-z]+)((?:\.\d+)+)$'); if (!$m.Success) { return $null }
    $n = @($m.Groups[2].Value.TrimStart('.').Split('.')); if ($n.Count -lt 2) { return $v + '.1' }
    $n[-1] = [string]([int]$n[-1] + 1); return $m.Groups[1].Value + '.' + ($n -join '.')
  }
  $spots = @()
  foreach ($root in @($payload, $run)) {
    $spots += @{ f = (Join-Path $root 'package.json'); re = '"version"\s*:\s*"([^"]+)"' }
    $spots += @{ f = (Join-Path $root 'tester-mod\descriptor.mod'); re = '(?m)^\s*version\s*=\s*"([^"]+)"' }
    foreach ($h in (Get-ChildItem -LiteralPath $root -Recurse -File -Filter 'sllm_probe_connection.txt' -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch '\\node_modules\\' })) { $spots += @{ f = $h.FullName; re = '/;/version=([^/"\s]+)' } }
  }
  $spots += @{ f = (Join-Path $dev 'installer\setup.nsi'); re = '!define\s+APP_VERSION\s+"([^"]+)"' }
  $spots = @($spots | Where-Object { Test-Path -LiteralPath $_.f })
  $oldPkg = ([regex]::Match((ReadText (Join-Path $payload 'package.json')), '"version"\s*:\s*"([^"]+)"')).Groups[1].Value
  $target = $Bump; $from = '-Bump'
  if (!$target) {
    foreach ($s in $spots) { $m = [regex]::Match((ReadText $s.f), $s.re); if ($m.Success -and (VerKey $m.Groups[1].Value)) { if (!$target -or (VerCmp $m.Groups[1].Value $target) -gt 0) { $target = $m.Groups[1].Value; $from = $s.f } } }
  }
  if (!$target -or !(VerKey $target)) { Fail "버전을 읽지 못했습니다(형식 예: 0.1.0-alpha.6)." }
  if ($UpdateOnly -and !$Bump -and $prevVer -and (VerKey $prevVer) -and (VerCmp $target $prevVer) -le 0) {
    $nv = NextVer $prevVer; if (!$nv) { Fail "지난 업데이트 묶음($prevVer)과 버전이 같습니다. -Bump 로 더 높은 버전을 정해 주세요." }
    Write-Host "  지난 업데이트 묶음이 이미 $prevVer 이라 앱이 새 버전으로 알아보지 못합니다 → $nv 으로 올립니다." -ForegroundColor Yellow
    $target = $nv; $from = '자동 올림'
  }
  $changed = 0
  foreach ($s in $spots) {
    $t = ReadText $s.f; $m = [regex]::Match($t, $s.re)
    if ($m.Success -and $m.Groups[1].Value -ne $target) {
      $old = $m.Groups[1].Value; $re = [regex]::new($s.re)
      WriteText $s.f ($re.Replace($t, [Text.RegularExpressions.MatchEvaluator]{ param($mm) $mm.Value.Replace($old, $target) }, 1)); $changed++; Write-Host "  버전 맞춤: $($s.f)  ($old → $target)"
    }
  }
  if ($oldPkg -and $oldPkg -ne $target) { foreach ($root in @($payload, $run)) { $lock = Join-Path $root 'package-lock.json'; if (Test-Path -LiteralPath $lock) { $t = ReadText $lock; if ($t.Contains('"' + $oldPkg + '"')) { WriteText $lock $t.Replace('"' + $oldPkg + '"', '"' + $target + '"'); $changed++; Write-Host "  버전 맞춤: $lock" } } } }
  if ($changed) { Write-Host "  가장 높은 버전 $target (기준: $from) 으로 맞췄습니다. README·ALPHA_SETUP·RELEASE_NOTES 문서의 버전 표기와 새 기능 요약은 따로 고쳐야 합니다." -ForegroundColor Yellow }
  $ver = ([regex]::Match((ReadText (Join-Path $payload 'package.json')), '"version"\s*:\s*"([^"]+)"')).Groups[1].Value
  Write-Host "  빌드할 버전: $ver"
  # 2) 실행 앱 = payload
  Say '실행 앱과 payload 가 같은지 확인'
  if (!(Test-Path -LiteralPath $run)) { Fail "실행 앱 폴더가 없습니다: $run" }
  $skipTop = @('node_modules', 'runtime', 'dist')
  $skipLeaf = @('manage-dll.ps1', 'register-mod.ps1', 'tester-registration.json')
  function Get-Map($root) {
    $m = @{}
    foreach ($f in Get-ChildItem -LiteralPath $root -Recurse -File -Force) {
      $rel = $f.FullName.Substring($root.Length + 1); $parts = $rel.Split('\')
      if ($skipTop -contains $parts[0] -or $parts -contains '.git' -or $skipLeaf -contains $f.Name) { continue }
      $m[$rel] = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash
    }
    return $m
  }
  $a = Get-Map $payload; $b = Get-Map $run; $diff = @()
  foreach ($k in $a.Keys) { if (!$b.ContainsKey($k)) { $diff += "실행 앱에 없음: $k" } elseif ($a[$k] -ne $b[$k]) { $diff += "내용이 다름: $k" } }
  foreach ($k in $b.Keys) { if (!$a.ContainsKey($k)) { $diff += "payload 에 없음: $k" } }
  if ($diff.Count) { $diff | Select-Object -First 30 | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }; Fail "실행 앱($run)과 payload\app 이 다릅니다 ($($diff.Count)건). Claude 에게 맞춰 달라고 하세요." }
  Write-Host "  같음 ($($a.Count)개 파일)"
  # 3) 빌드 + 검사
  Say '앱 빌드(tsc) + 자동 검사'
  if (Test-Path -LiteralPath $tmp) { RmJunction "$tmp\app\node_modules"; Remove-Item -LiteralPath $tmp -Recurse -Force }
  $tapp = Join-Path $tmp 'app'
  robocopy $payload $tapp /E /XD node_modules .git runtime dist /NFL /NDL /NJH /NJS | Out-Null
  $nm = Join-Path $run 'node_modules'
  if (Test-Path -LiteralPath $nm) { New-Item -ItemType Junction -Path (Join-Path $tapp 'node_modules') -Target $nm | Out-Null }
  else { Push-Location $tapp; try { & npm.cmd install; if ($LASTEXITCODE) { Fail 'npm install 실패' } } finally { Pop-Location } }
  Push-Location $tapp
  try {
    & npx.cmd tsc
    if ($LASTEXITCODE) { Fail 'tsc 빌드 실패 (위 오류를 확인하세요).' }
    if (!(Test-Path -LiteralPath 'dist\main.js')) { Fail 'dist\main.js 가 만들어지지 않았습니다.' }
    if (!$SkipTests) {
      & npm.cmd test | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray; $_ } | Tee-Object -Variable log | Out-Null
      $code = $LASTEXITCODE
      $fails = @($log | Where-Object { $_ -match '^\s*FAIL\b' -and $_ -notmatch '^\s*FAIL\s*[:=]?\s*\d+\s*$' })
      $real = @($fails | Where-Object { $_ -notmatch '^\s*FAIL safety env:' })
      if ($real.Count) { ($log | Out-String) | Set-Content -LiteralPath (Join-Path $dev 'build-test.log') -Encoding UTF8; $real | Select-Object -First 20 | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }; Fail "자동 검사 실패 $($real.Count) 개. (전체 기록: build-test.log)" }
      elseif ($fails.Count) { Write-Host "  참고: 'safety env' 검사 $($fails.Count)개는 이 PC 에 스텔라리스가 설치돼 있어서 나오는 환경 차이라 넘어갑니다." -ForegroundColor Yellow }
      elseif ($code) { Fail '자동 검사 실패 (종료 코드 이상, 실패 줄 없음).' }
      Write-Host ("  " + (($log | Select-Object -Last 2) -join ' '))
    }
  } finally { Pop-Location }
  # 빌드 결과를 payload 와 실행 앱의 dist 에 반영(소스와 같은 빌드로 유지)
  robocopy (Join-Path $tapp 'dist') (Join-Path $payload 'dist') /MIR /NFL /NDL /NJH /NJS | Out-Null
  robocopy (Join-Path $tapp 'dist') (Join-Path $run 'dist') /MIR /NFL /NDL /NJH /NJS | Out-Null
  RmJunction "$tapp\node_modules"
  Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  # 4) 버전 일치
  Say "버전 표기 확인 ($ver)"
  $bad = @(); foreach ($f in VersionFiles) { if ((Test-Path -LiteralPath $f) -and !(ReadText $f).Contains($ver)) { $bad += $f } }
  if ($bad.Count) { $bad | ForEach-Object { Write-Host "  버전 $ver 이(가) 없음: $_" -ForegroundColor Yellow }; Fail "버전이 파일마다 다릅니다. -Bump 로 직접 정할 수 있습니다." }
  Write-Host "  모두 일치"
  if (!$UpdateOnly) {
  # 5) 설치기
  Say '설치기 만들기 (build-installer.ps1)'
  & (Join-Path $dev 'build-installer.ps1') -MakeNSIS $MakeNSIS
  # 6) 결과
  Say '결과 복사'
  $exe = Join-Path $dev "dist\SLLM-Missive-Tester-Setup-$ver.exe"
  if (!(Test-Path -LiteralPath $exe)) { Fail "설치기 파일이 없습니다: $exe" }
  Copy-Item -LiteralPath $exe -Destination $desk -Force
  $h = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
  $mb = [math]::Round((Get-Item -LiteralPath $exe).Length / 1MB, 1)
  }
  # 7) 앱 업데이트 묶음(2026-10-18): 창작마당 구독자는 모드 업데이트만 받으면 앱 안에서 「업데이트」로 새 버전이 된다.
  Say '창작마당 모드 폴더에 앱 업데이트 묶음 넣기 (sllm_app_update)'
  $mods = @($docMod)
  $ws = Join-Path $dev "dist\workshop_$ver\sllm_missive"; if (Test-Path -LiteralPath $ws) { $mods += $ws }
  # 창작마당 모드 파일을 payload/app/tester-mod 와 똑같이 맞춘다(2026-10-27 사용자 결정). 전에는 버전 줄만 바꿔서 새 모드 파일이 빠진 채 올라갔다(알파 10.2·11).
  # 창작마당용 descriptor.mod·앱 묶음(sllm_app_update)·옛 변경사항 글은 그대로 두고, 그 밖에 tester-mod 에 없는 옛 모드 파일은 지운다(/MIR).
  # 썸네일(thumbnail.png)은 2026-11-04 사용자 결정으로 tester-mod 것을 그대로 올린다(전엔 창작마당 폴더 것을 따로 두어 새 썸네일이 안 넘어갔다). 스팀 한도 1MB.
  $srcMod = Join-Path $payload 'tester-mod'
  if (!(Test-Path -LiteralPath (Join-Path $srcMod 'common'))) { Fail "모드 원본이 없습니다: $srcMod" }
  foreach ($md in $mods) {
    if (!(Test-Path -LiteralPath $md)) { continue }
    robocopy $srcMod $md /MIR /XD sllm_app_update /XF descriptor.mod '창작마당_변경사항_*.txt' /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { Fail "창작마당 모드 폴더에 모드 파일을 복사하지 못했습니다(robocopy $LASTEXITCODE): $md" }
    $thumb = Join-Path $md 'thumbnail.png'; if ((Test-Path -LiteralPath $thumb) -and (Get-Item -LiteralPath $thumb).Length -gt 1MB) { Write-Host "  [주의] 썸네일이 1MB를 넘습니다. 스팀이 업로드를 거부할 수 있습니다: $thumb" -ForegroundColor Yellow }
    $nSrc = @(Get-ChildItem -LiteralPath $srcMod -Recurse -File | Where-Object { $_.Name -ne 'descriptor.mod' -and $_.Name -ne 'thumbnail.png' }).Count
    $nDst = @(Get-ChildItem -LiteralPath $md -Recurse -File | Where-Object { $_.FullName -notmatch '\\sllm_app_update\\' -and $_.Name -ne 'descriptor.mod' -and $_.Name -ne 'thumbnail.png' -and $_.Name -notlike '창작마당_변경사항_*.txt' }).Count
    if ($nSrc -ne $nDst) { Fail "창작마당 모드 폴더의 모드 파일 수가 원본과 다릅니다(원본 $nSrc, 창작마당 $nDst): $md" }
    Write-Host "  모드 파일 맞춤: tester-mod → $md ($nSrc 개)"
  }
  $global:LASTEXITCODE = 0
  & node (Join-Path $dev 'tools\make-app-update.js') bundle $payload @mods
  $bundleOk = !$LASTEXITCODE
  # 창작마당 모드 descriptor.mod 의 version 줄도 앱 묶음 버전으로 맞춘다(2026-10-24 사용자 결정). 다른 줄(이름·태그·remote_file_id 등)은 건드리지 않는다.
  if ($bundleOk) {
    $verRe = [regex]'(?m)^(\s*version\s*=\s*")([^"]*)(")'
    foreach ($md in $mods) {
      $dm = Join-Path $md 'descriptor.mod'; if (!(Test-Path -LiteralPath $dm)) { continue }
      $t = ReadText $dm; $vm = $verRe.Match($t)
      if (!$vm.Success) { Write-Host "  descriptor.mod 에 version 줄이 없습니다: $dm" -ForegroundColor Yellow }
      elseif ($vm.Groups[2].Value -ne $ver) { WriteText $dm ($verRe.Replace($t, '${1}' + $ver + '${3}', 1)); Write-Host "  descriptor.mod 버전 맞춤: $($vm.Groups[2].Value) → $ver  ($dm)" }
    }
    # 창작마당 모드의 연결 신호(HELLO) 버전도 맞춘다(2026-10-24): 안 맞추면 앱이 「연결 모드가 앱보다 낮은 버전」이라고 경고한다.
    $helloRe = [regex]'(/;/version=)([^/"\s]+)'
    foreach ($md in $mods) {
      foreach ($hf in (Get-ChildItem -LiteralPath $md -Recurse -File -Filter 'sllm_probe_connection.txt' -ErrorAction SilentlyContinue)) {
        $t = ReadText $hf.FullName; $hm = $helloRe.Match($t)
        if ($hm.Success -and $hm.Groups[2].Value -ne $ver) { WriteText $hf.FullName ($helloRe.Replace($t, '${1}' + $ver, 1)); Write-Host "  연결 신호(HELLO) 버전 맞춤: $($hm.Groups[2].Value) → $ver  ($($hf.FullName))" }
      }
    }
  }
  if (!$bundleOk) { if ($UpdateOnly) { Fail '앱 업데이트 묶음을 만들지 못했습니다(위 메시지를 확인하세요).' } else { Write-Host "  앱 업데이트 묶음을 만들지 못했습니다(설치기는 정상). 창작마당에 올리기 전에 위 메시지를 확인하세요." -ForegroundColor Yellow } }
  $newDll = (Get-FileHash -LiteralPath (Join-Path $payload 'native\command-bridge.dll') -Algorithm SHA256 -ErrorAction SilentlyContinue).Hash
  $dllChanged = $newDll -and $prevDll -and ($newDll.ToLower() -ne ([string]$prevDll).ToLower())
  Write-Host ""
  Write-Host "=== 완료 ===" -ForegroundColor Green
  if ($UpdateOnly) {
    Write-Host "  앱 업데이트 묶음 버전: $ver"
    Write-Host "  묶음 위치: $docMod\sllm_app_update"
    Write-Host "  창작마당 런처에서 이 모드 폴더(sllm_missive)를 올리면 됩니다. 설치기는 만들지 않았고 올릴 필요도 없습니다. (업로드는 런처에서 직접)"
    if ($dllChanged) { Write-Host "  [주의] 게임 연결 DLL(native\command-bridge.dll)이 지난 묶음과 달라졌습니다. 이 버전은 앱 안 업데이트로 받을 수 없어 사용자에게 새 설치기를 안내합니다. 설치기_만들기.bat 으로 설치기를 만들어 올리세요." -ForegroundColor Yellow }
  } else {
  Write-Host "  설치기: $exe  ($mb MB)"
  Write-Host "  바탕화면 새 폴더에도 복사했습니다: $desk"
  Write-Host "  SHA256: $h"
  $zip = Join-Path $dev "dist\SLLM-Missive-Manual-$ver.zip"
  if (Test-Path -LiteralPath $zip) { Write-Host "  수동 설치 ZIP(설치기 없이 쓰는 용): $zip  ($([math]::Round((Get-Item -LiteralPath $zip).Length / 1MB, 1)) MB)"; Write-Host "  ZIP SHA256: $((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash)" }
  Write-Host "  (실제 Windows 설치·게임 실행 검수는 따로 해 주세요. 창작마당 모드 폴더에는 앱 업데이트 묶음만 넣었습니다. 업로드는 런처에서 직접.)"
  Write-Host "  [중요] 설치기는 최소 구성입니다(앱 본체 없음). 새 사용자가 설치하려면 이 버전($ver) 이상의 앱 묶음이 든 모드를 창작마당에 먼저 올려야 합니다." -ForegroundColor Yellow
  }
} catch {
  Write-Host ""
  Write-Host "[실패] $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
