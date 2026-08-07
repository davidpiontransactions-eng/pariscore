<#
.SYNOPSIS
  PariScore APK QA - checks statiques + WebView (Playwright) + install device.

.DESCRIPTION
  Tier 1 - QA statique APK (aucun device requis) :
    apksigner verify, zipalign, aapt2 badging, manifest (debuggable/permissions),
    assets web embarques, coherence version avec package.json.
  Tier 2 - QA WebView (Playwright, emulation Pixel 7) :
    tests/apk-webview.spec.ts contre QA_BASE_URL (defaut https://pariscore.fr,
    soit exactement ce que l'APK charge en mode remote).
  Tier 3 - installation adb si un device/emulateur est connecte.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-qa.ps1
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mobile-qa.ps1 -SkipWeb -Install
#>
param(
  [switch]$SkipWeb,
  [switch]$Install
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$env:JAVA_HOME = "D:\Android\jdk\jdk-21.0.12+8"
$env:ANDROID_HOME = "D:\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
$bt = "D:\Android\Sdk\build-tools\36.0.0"
$apksigner = "$bt\apksigner.bat"
$zipalign = "$bt\zipalign.exe"
$aapt2 = "$bt\aapt2.exe"
$apkanalyzer = "D:\Android\Sdk\cmdline-tools\latest\bin\apkanalyzer.bat"
$adb = "D:\Android\Sdk\platform-tools\adb.exe"

$pass = 0
$fail = 0
function Check([string]$name, [bool]$ok, [string]$detail = "") {
  if ($ok) { $script:pass++; Write-Host ("[PASS] " + $name) -ForegroundColor Green }
  else { $script:fail++; Write-Host ("[FAIL] " + $name + " -- " + $detail) -ForegroundColor Red }
}

$debugApk = "$root\android\app\build\outputs\apk\debug\app-debug.apk"
$releaseApk = "$root\android\app\build\outputs\apk\release\app-release.apk"

Write-Host "=== QA Tier 1 - APK statique ===" -ForegroundColor Cyan
Check "APK debug present" (Test-Path $debugApk)
Check "APK release present" (Test-Path $releaseApk)

# --- 1. Signatures ----------------------------------------------------------
$vDebug = & $apksigner verify -v --print-certs $debugApk 2>&1 | Out-String
Check "signature debug valide" ($vDebug -match "Verifies")
$vRel = & $apksigner verify -v --print-certs $releaseApk 2>&1 | Out-String
Check "signature release valide" ($vRel -match "Verifies")
Check "release signee keystore PariScore (pas cert debug)" ($vRel -match "CN=PariScore")
Check "scheme v2/v3 present (requis Play)" ($vRel -match "v2 scheme|v3 scheme")

# --- 2. Alignement ------------------------------------------------------------
& $zipalign -c 4 $releaseApk 2>&1 | Out-Null
Check "release alignee 4 octets (zipalign)" ($LASTEXITCODE -eq 0)

# --- 3. Badging + versions -----------------------------------------------------
$badge = & $aapt2 dump badging $releaseApk 2>&1 | Out-String
Check "appId = fr.pariscore.app" ($badge -match "name='fr\.pariscore\.app'")
$pkgVersion = ([regex]::Match($badge, "versionName='([^']+)'")).Groups[1].Value
$pjVersion = node -e "console.log(require('$($root.Replace('\','/'))/package.json').version)"
Check "versionName ($pkgVersion) == package.json ($pjVersion)" ($pkgVersion -eq $pjVersion)
$minOk = $false
if ($badge -match "minSdkVersion:'(\d+)'") { $minOk = [int]$matches[1] -ge 24 }
Check "minSdkVersion >= 24" $minOk
$targetOk = $false
if ($badge -match "targetSdkVersion:'(\d+)'") { $targetOk = [int]$matches[1] -ge 35 }
Check "targetSdkVersion >= 35 (politique Play)" $targetOk

# --- 4. Manifest : debuggable + permissions ------------------------------------
$manifestRel = & $apkanalyzer manifest print $releaseApk 2>&1 | Out-String
Check "release NON debuggable" (-not ($manifestRel -match "debuggable.*=.*true"))
$manifestDbg = & $apkanalyzer manifest print $debugApk 2>&1 | Out-String
Check "debug debuggable=true (attendu)" ($manifestDbg -match "debuggable.*=.*true")
$perms = & $apkanalyzer manifest permissions $releaseApk 2>&1 | Out-String
$permList = ($perms -split "`r?`n" | Where-Object { $_.Trim() -ne "" }) -join ", "
Write-Host ("Permissions release : " + $permList)
$risky = @("CAMERA", "READ_CONTACTS", "READ_PHONE_STATE", "ACCESS_FINE_LOCATION", "RECORD_AUDIO", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE")
$riskFound = @($risky | Where-Object { $perms -match $_ })
Check "aucune permission risquee" ($riskFound.Count -eq 0) ($riskFound -join ",")

# --- 5. Assets web + config Capacitor embarques ---------------------------------
$files = & $apkanalyzer files list $releaseApk 2>&1 | Out-String
Check "fallback web embarquee (assets/public/index.html)" ($files -match "assets/public/index\.html")
Check "capacitor.config.json embarquee" ($files -match "capacitor\.config\.json")

# --- 6. DEX references (pression 64k) --------------------------------------------
# apkanalyzer dex references renvoie "classes.dex<TAB><count>" par ligne dex.
$refs = 0
$dexLines = & $apkanalyzer dex references $releaseApk 2>&1
foreach ($l in $dexLines) {
  if ($l -match '(\d+)\s*$') { $refs += [int]$matches[1] }
}
Write-Host ("DEX references : " + $refs)
Check "DEX references < 64k" ($refs -lt 65536)

# --- Tier 2 : WebView (Playwright) ---------------------------------------------
Write-Host ""
Write-Host "=== QA Tier 2 - WebView (Playwright, Pixel 7) ===" -ForegroundColor Cyan
if ($SkipWeb) {
  Write-Host "(skipped : -SkipWeb)" -ForegroundColor DarkYellow
} else {
  Push-Location $root
  try {
    & npx playwright test tests/apk-webview.spec.ts --reporter=list
    $webCode = $LASTEXITCODE
  } finally { Pop-Location }
  Check "suite Playwright WebView" ($webCode -eq 0) ("exit " + $webCode)
}

# --- Tier 3 : install device/emulateur -------------------------------------------
Write-Host ""
Write-Host "=== QA Tier 3 - installation device/emulateur ===" -ForegroundColor Cyan
$devices = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match "device$" })
if ($devices.Count -eq 0) {
  Write-Host "Aucun device/emulateur connecte - Tier 3 skipe." -ForegroundColor DarkYellow
} elseif (-not $Install) {
  $serials = ($devices | ForEach-Object { ($_ -split "\s+")[0] }) -join ","
  Write-Host ("Device detecte (" + $serials + ") - utiliser -Install pour deployer.") -ForegroundColor DarkYellow
} else {
  foreach ($dev in $devices) {
    $serial = ($dev -split "\s+")[0]
    & $adb -s $serial install -r $releaseApk
    Check ("installation sur " + $serial) ($LASTEXITCODE -eq 0)
  }
}

Write-Host ""
$color = "Green"
if ($fail -gt 0) { $color = "Red" }
Write-Host ("QA SUMMARY : " + $pass + " PASS / " + $fail + " FAIL") -ForegroundColor $color
exit $fail

