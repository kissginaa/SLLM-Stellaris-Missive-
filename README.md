SLLM Missive (SteLLaris Missive)
An unofficial Stellaris mod plus a desktop app (Electron) that lets you hold AI-driven conversations with in-game leaders: diplomacy, letters, speeches, banquets and more. The app sends the results back into the game.
> Supported: Windows x64, Stellaris **4.5.2 and 4.5.3 (verified builds only)**. Multiplayer and Ironman are not supported.
> This is a fan-made project and is not affiliated with Paradox Interactive.
한국어: README.ko.md
---
Read this first: why Windows or your antivirus may warn you
We have received repeated feedback about safety: "Windows blocks it", "my antivirus complains". This section explains what triggers each warning, what each file does, and what it does not do, as plainly as we can. All source code is in this repository, so you can check it yourself.
1. The blue "Windows protected your PC" screen (SmartScreen)
Two reasons:
The installer is not code-signed (no Authenticode certificate). This is a free hobby project and we have not bought a signing certificate, which costs a few hundred dollars per year. Windows warns about unsigned files that few people have downloaded yet. It means "not widely known yet", not "known to be dangerous".
The installer asks for administrator rights. It needs them to copy a file into the game folder, register the mod in your Documents folder and register an uninstaller.
> To continue, click **More info → Run anyway**. Before that, we recommend comparing the file hash as described in [Verify your download](#verify-your-download).
2. Antivirus (Defender and others) warns or deletes a file
There are real reasons a scanner may be suspicious. We will not hide them:
What looks suspicious	Why it looks that way	What it actually does
`command-bridge.dll` (copied to the game folder as `sllm-tester-command-bridge.dll`) and `bridge-client.exe`	Loading a DLL into another running program (Stellaris) has the same outward shape as game-cheat tools and malware. Heuristic scanners judge by technique, so false positives are possible.	It is a channel that delivers one game command request at a time from the app to the game (details below). It does not modify `stellaris.exe`, contains no networking code, and does not read files to send them anywhere.
Large installer	The app is built on Electron (Chromium), so the runtime alone is over 100 MB. Big compressed installers get scanned more aggressively.	The size is the Electron runtime, not extra code. We are splitting the installer into a minimal one to reduce its size.
No code signature	Same as SmartScreen above.	We publish the SHA-256 of every release file.
PowerShell scripts	The installer calls `installer/*.ps1` to find the game folder, copy the DLL and register the mod.	All scripts are in `installer/` in this repository and run as shipped. Nothing is downloaded from the internet and executed.
If your antivirus removed a file:
Upload the installer to VirusTotal and look at the result (a few engines may give a generic detection).
If you are still unsure, read the source and build it yourself (see Build from source).
You can report a false positive to Microsoft: https://www.microsoft.com/wdsi/filesubmission
---
What each component does
```
Install folder (default: Desktop\app\SLLM-Tester)
├─ runtime\electron.exe       Official Electron runtime. Runs the app UI and AI calls
├─ dist\, ui\                 The app itself (built from src\ and ui\ in this repository)
├─ native\bridge-client.exe   Small program that delivers one command from the app to the game
├─ native\command-bridge.dll  DLL that executes that command inside the game process (also copied to the game folder)
├─ tester-mod\                Mod files the game reads (scripts, events, localisation); registered in Documents\...\mod, not in the game folder
└─ update-public-key.pem      Public key used to verify app updates
```
The game bridge DLL (`command-bridge.dll`)
Stellaris has no official way for a mod to apply "what the AI decided" to the running game. The app therefore uses this DLL as a narrow channel to deliver commands (for example granting a gift or changing a diplomatic state) one at a time.
The app writes one request file (`sx<random>.ini`) into its user data folder and runs `bridge-client.exe`.
`bridge-client.exe` attaches the DLL to the running Stellaris window so the game's own command path runs that request, then reports the result (success, failure, or the game's acknowledgement) back to the app.
On any build other than the verified ones (4.5.2, `stellaris.exe` SHA-256 `400DF27C…F7A83`; 4.5.3, `2F0FC2A9…3EAFB`), the installer refuses to install and the DLL refuses to run (`installer/verify-game.ps1`).
If the app cannot tell whether a request reached the game, it never retries automatically, so the same command cannot run twice. See `classifyDelivery` in `src/native-bridge.ts`.
The DLL has no networking code. It only reads the request file and calls the game's command handler.
A pre-existing DLL with the same name is backed up before install and restored on uninstall (`installer/manage-dll.ps1`). If the hash does not match what we expect, it refuses to overwrite an unknown DLL.
> **Administrator note:** if only Stellaris runs as administrator while SLLM runs as a normal user, Windows blocks the connection (UIPI). The app detects this and tells you. Run both at the same privilege level.
What the app sends over the internet
Only AI service calls. Your conversation text (including a summary of the game situation) is sent to the provider you configure: OpenAI, Google Gemini/Vertex, Anthropic, OpenRouter, Groq, or a local server on `localhost`. You choose which one.
API keys are stored with OS-level encryption tied to your Windows account (Electron `safeStorage`). If you turn off "Save API key on this PC", the key is never written to disk and is only remembered while the app runs. Keys are not written to settings files or logs.
There are no author-run servers. No analytics, telemetry, crash reporting or ads. You can verify this by searching `src/` for network calls: the AI provider addresses in `src/aiclient.ts` and related files are all there is.
Chat history, memories, bookshelf and similar data stay in the app data folder on your PC.
How automatic updates stay safe
The app never downloads updates from the internet. It only looks at the update bundle inside the mod folder delivered by Steam Workshop.
`manifest.json` must match its Ed25519 signature (`manifest.sig`), checked with the public key shipped inside the app.
Every file must match the SHA-256 in the manifest and be inside an allowed folder.
Only if the version is higher does the app ask "Update now?". If you accept, only changed files are replaced (and rolled back on failure).
When an update brings a new game bridge DLL (for example after a game patch), it is shipped as `native/bridge/command-bridge.dll`. The app copies it into the game folder only while the game is closed, and only if the DLL there is the one SLLM installed (its `.owner` hash file must match). It backs up the old DLL first and restores it if anything fails. Code: `src/game-dll.ts`.
The private signing key exists only on the author's PC and is never committed to this repository. The public key (`update-public-key.pem`) is in the repository. Code: `src/app-update-core.ts`.
What it does not do
Modify or delete `stellaris.exe` or other original game files (it adds one DLL, and restores the original state on uninstall)
Log keystrokes, capture your screen, or collect information about other programs
Access personal files outside its own folders (apart from the SLLM-related game and Documents paths)
Download and run code without your knowledge
---
Verify your download
Compare the SHA-256 of the installer in PowerShell with the value in the release notes:
```powershell
Get-FileHash .\SLLM-Missive-Tester-Setup-<version>.exe -Algorithm SHA256
```
The hash must match exactly. If it does not, do not run the file, and please tell us.
The SHA-256 of the game bridge DLL is also listed with each release. The installer checks it again before installing.
Install / uninstall
Install: run the installer from Releases and confirm the game folder. Close Stellaris first.
If you subscribe to the mod on Steam Workshop, turn off the local-mod install option (never enable two SLLM mods at once).
Uninstall: Windows Settings → Apps. Only mod files whose managed hash is unchanged are removed, and the original DLL is restored. Your chat history and other user data are kept.
Build from source
```text
payload/app/   App source (src/ TypeScript, ui/ screens, tester-mod/ game mod source, native/src/ bridge source)
installer/     NSIS installer script and PowerShell helpers
tools/         Update bundle tooling
```
```bash
cd payload/app
npm install
npx tsc        # builds dist/
npm test       # self test
```
This repository holds code, mod scripts and documents. New images and other art (UI pictures, news photos, sounds) and build outputs (`dist/`, the Electron runtime, compiled DLL/EXE) are not added here; they ship with the Steam Workshop mod and the installer.
The installer is built with NSIS and `make-installer.ps1`; see `RELEASE_RULES_KO.md` for the release rules (Korean).
Folders containing material taken from the original game (such as `example/`) are not in the repository, so a few self-tests fail without them.
Reporting vulnerabilities
If you find a security problem, please report it privately as described in `SECURITY.md` instead of opening a public issue.
License
Licensed under the GNU General Public License v3.0 (GPL-3.0). See LICENSE.
The Electron runtime bundled in the installer is MIT-licensed by its own authors. "Stellaris" and related names belong to Paradox Interactive; this project is not affiliated with them.
