param([Parameter(Mandatory=$true)][string]$GameDir,[string]$Source,[string]$ExpectedHash,[switch]$Remove)
$ErrorActionPreference='Stop'
function FileHash([string]$Path){
 $stream=[IO.File]::OpenRead($Path);$sha=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')}
 finally{$stream.Dispose();$sha.Dispose()}
}
try {
 $target=Join-Path $GameDir 'sllm-tester-command-bridge.dll'
 $marker=Join-Path $GameDir 'sllm-tester-command-bridge.owner'
 $backup=Join-Path $GameDir 'sllm-tester-command-bridge.dll.pre-sllm'
 if($Remove){
  if(Test-Path -LiteralPath $target){
   $cur=FileHash $target
   $mine=(Test-Path -LiteralPath $marker) -and ([IO.File]::ReadAllText($marker).Trim() -eq $cur)
   if($cur -ne $ExpectedHash -and !$mine){Write-Output 'DLL changed; left in place.';exit 0}
   Remove-Item -LiteralPath $target
  }
  if(Test-Path -LiteralPath $backup){Move-Item -LiteralPath $backup -Destination $target}
  if(Test-Path -LiteralPath $marker){Remove-Item -LiteralPath $marker}
  Write-Output 'Managed DLL removed; any original restored.';exit 0
 }
 $incoming=FileHash $Source
 if($incoming -ne $ExpectedHash){throw 'Installer DLL hash mismatch.'}
 # 게임이 4.5.3 이면 native\bridge 의 새 DLL 을 넣는다(2026-11-08). native\command-bridge.dll 은 4.5.2용으로 고정돼 있다.
 $exe=Join-Path $GameDir 'stellaris.exe'
 if((Test-Path -LiteralPath $exe) -and ((FileHash $exe) -eq '2F0FC2A91CCEC9F77D390A5D198195927158C22444216A03596A23007FB3EAFB')){
  $new=Join-Path (Split-Path -Parent $Source) 'bridge\command-bridge.dll'
  if(!(Test-Path -LiteralPath $new)){throw 'The DLL for Stellaris 4.5.3 was not found in the app files.'}
  $Source=$new
  $incoming=FileHash $Source
 }
 if(Test-Path -LiteralPath $target){
  $current=FileHash $target
  if($current -ne $incoming){
   $owned=(Test-Path -LiteralPath $marker) -and ([IO.File]::ReadAllText($marker).Trim() -eq $current)
   if(!$owned){
    if(Test-Path -LiteralPath $backup){throw 'An original DLL backup already exists. Refusing to replace an unknown DLL.'}
    Copy-Item -LiteralPath $target -Destination $backup
   }
  }
 }
 Copy-Item -LiteralPath $Source -Destination $target -Force
 if((FileHash $target) -ne $incoming){throw 'Installed DLL verification failed.'}
 [IO.File]::WriteAllText($marker,$incoming,[Text.Encoding]::ASCII)
 Write-Output 'Command bridge installed and verified.';exit 0
}catch{Write-Output $_.Exception.Message;exit 1}

