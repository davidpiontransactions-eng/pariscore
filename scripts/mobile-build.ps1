<#
.SYNOPSIS
  PariScore Android Engineering Loop (Capacitor) - packager, tester, compiler.

.DESCRIPTION
  Boucle d'execution a 5 etapes (ASCII-only : compatible PowerShell 5.1) :
    1. assets   : generation resources/ (icon 1024, splash 2732, dist fallback)
                  + declinaisons natives Android via @capacitor/assets
    2. sync     : cap sync android (copie assets web + plugins natifs)
    3. debug    : gradlew assembleDebug   -> outputs/apk/debug/app-debug.apk
    4. release  : gradlew assembleRelease -> outputs/apk/release/app-release.apk
                  (signe via android/keystore.properties)
    5. verify   : apksigner verify + aapt2 badging (+ adb install si -Install)

  Toolchain (hors C:, le disque C: est sature) :
    JAVA_HOME        = D:\Android\jdk\jdk-21.0.12+8   (Temurin 21 LTS - requis Capacitor 8)
    ANDROID_HOME     = D:\Android\Sdk  (platforms 34+36, build-tools 34/35/36)
    GRADLE_USER_HOME = E:\Android\gradle-home  (dist Gradle + cache AGP)
    Projet Android   = E:\Android\Pariscore (jonction Windows : ./android)

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-build.ps1 -Step all
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-build.ps1 -Step release
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-build.ps1 -Step verify -Install
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-build.ps1 -Step sync -ServerUrl http://10.0.2.2:3000
#>
param(
  [ValidateSet("assets", "sync", "debug", "release", "verify", "all")]
  [string]$Step = "all",
  [switch]$Install,
  [string]$ServerUrl = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# --- Environnement toolchain Android ---------------------------------------
$env:JAVA_HOME = "D:\Android\jdk\jdk-21.0.12+8"
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "D:\Android\Sdk"
$env:GRADLE_USER_HOME = "E:\Android\gradle-home"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
if ($ServerUrl) { $env:CAPACITOR_SERVER_URL = $ServerUrl }

function Step-Header([string]$t) {
  Write-Host ""
  Write-Host ("=== [" + $t + "] " + ("=" * 56)) -ForegroundColor Cyan
}

function Invoke-Cap([string[]]$cmdArgs) {
  & "$root\node_modules\.bin\cap.exe" @cmdArgs
  if ($LASTEXITCODE -ne 0) { throw "cap $cmdArgs failed (exit $LASTEXITCODE)" }
}

function Invoke-Gradle([string[]]$cmdArgs) {
  Push-Location "$root\android"
  try {
    & .\gradlew.bat --no-daemon @cmdArgs
    $code = $LASTEXITCODE
  } finally { Pop-Location }
  if ($code -ne 0) { throw "gradlew $cmdArgs failed (exit $code)" }
}

# --- Etape 1 : ASSETS --------------------------------------------------------
if ($Step -in @("assets", "all")) {
  Step-Header "1/5 assets - icon, splash, fallback web, declinaisons natives"
  node "$root\scripts\gen-mobile-assets.js"
  if ($LASTEXITCODE -ne 0) { throw "gen-mobile-assets.js failed" }
  # capacitor-assets reecrit aussi public/manifest.json (paths PWA invalides) :
  # on le sauvegarde avant et on le restaure apres (byte-identique).
  $manifest = "$root\public\manifest.json"
  if (Test-Path $manifest) { Copy-Item $manifest "$manifest.mobile-bak" -Force }
  & "$root\node_modules\.bin\capacitor-assets.exe" generate android
  $assetsCode = $LASTEXITCODE
  if (Test-Path "$manifest.mobile-bak") {
    Move-Item "$manifest.mobile-bak" $manifest -Force
  }
  if ($assetsCode -ne 0) { throw "capacitor-assets failed" }
}

# --- Etape 2 : SYNC ----------------------------------------------------------
if ($Step -in @("sync", "all")) {
  Step-Header "2/5 sync - cap sync android"
  Invoke-Cap @("sync", "android")
}

# --- Etape 3 : DEBUG ---------------------------------------------------------
if ($Step -in @("debug", "all")) {
  Step-Header "3/5 assembleDebug"
  Invoke-Gradle @("assembleDebug")
}

# --- Etape 4 : RELEASE SIGNEE ------------------------------------------------
if ($Step -in @("release", "all")) {
  Step-Header "4/5 assembleRelease (signature keystore)"
  if (-not (Test-Path "$root\android\keystore.properties")) {
    throw "android/keystore.properties absent - copier keystore.properties.example."
  }
  Invoke-Gradle @("assembleRelease")
}

# --- Etape 5 : VERIFICATION ---------------------------------------------------
if ($Step -in @("verify", "all")) {
  Step-Header "5/5 verify - signature, badging, installation eventuelle"
  $apkDirs = @()
  if ($env:ANDROID_BUILD_DIR) { $apkDirs += "$env:ANDROID_BUILD_DIR\outputs\apk" }
  $apkDirs += "$root\android\app\build\outputs\apk"
  $apks = @()
  foreach ($d in $apkDirs) {
    if (Test-Path $d) { $apks += Get-ChildItem $d -Recurse -Filter *.apk }
  }
  if ($apks.Count -eq 0) { throw "Aucun APK trouve - lancer d'abord -Step debug/release" }
  $aapt2 = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Directory | Sort-Object Name -Descending | Select-Object -First 1
  foreach ($apk in $apks) {
    Write-Host ""
    Write-Host ("APK : " + $apk.FullName + " (" + [math]::Round($apk.Length / 1MB, 2) + " MB)") -ForegroundColor Yellow
    & "$env:ANDROID_HOME\build-tools\$($aapt2.Name)\apksigner.bat" verify --print-certs $apk.FullName 2>&1 | Select-Object -First 4
    & "$env:ANDROID_HOME\build-tools\$($aapt2.Name)\aapt2.exe" dump badging $apk.FullName 2>$null |
      Select-String "package:|sdkVersion|targetSdkVersion" | Select-Object -First 3
  }
  if ($Install) {
    $adb = "$env:ANDROID_HOME\platform-tools\adb.exe"
    $devices = & $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" }
    if (-not $devices) { Write-Host "Aucun device/emulateur connecte - installation ignoree." -ForegroundColor DarkYellow }
    foreach ($dev in $devices) {
      $serial = ($dev -split "\s+")[0]
      foreach ($apk in ($apks | Where-Object { $_.Name -like "*release*" })) {
        Write-Host ("adb install " + $apk.Name + " -> " + $serial)
        & $adb -s $serial install -r $apk.FullName
      }
    }
  }
}

Write-Host ""
Write-Host ("TERMINE - etape '$Step' OK") -ForegroundColor Green
