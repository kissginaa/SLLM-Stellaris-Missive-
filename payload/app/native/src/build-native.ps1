param([Parameter(Mandatory=$true)][string]$Compiler)
$ErrorActionPreference='Stop'
$dest=Split-Path $PSScriptRoot -Parent
& $Compiler -shared -O2 -Wall -Wextra -Werror "$PSScriptRoot\command-bridge.c" -luser32 -o "$dest\command-bridge.dll"
if($LASTEXITCODE){throw 'DLL build failed'}
& $Compiler -O2 -municode -Wall -Wextra -Werror "$PSScriptRoot\bridge-client.c" -luser32 -lbcrypt -o "$dest\bridge-client.exe"
if($LASTEXITCODE){throw 'Client build failed'}
