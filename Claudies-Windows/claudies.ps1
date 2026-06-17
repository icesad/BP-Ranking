#Requires -Version 5.1
<#
.SYNOPSIS
    Claudies for Windows - run multiple Claude Desktop / Claude Code accounts
    side by side, fully isolated, and optionally SHARE sessions so you can
    switch accounts and keep working in the same context.

.DESCRIPTION
    Windows port of the macOS "Claudies" idea (github.com/democra-ai/claudies).

    How it works
    ------------
    Claude Desktop is an Electron app, so it honors --user-data-dir=<path>,
    which relocates ALL of its state (login, chats, agent Sessions, MCP config,
    Skills, Preferences) into a folder you choose. A different folder = a fully
    independent account/instance.

    Claude Code honors the CLAUDE_CONFIG_DIR environment variable, so a per
    profile config dir gives Code an isolated login too.

    "Seamless context after switching accounts" is achieved by SHARING the
    agent Sessions folder between profiles using a Windows directory JUNCTION
    (mklink /J). Junctions need NO administrator rights. A Cowork/agent session
    started under account A is then physically the same folder account B reads,
    so you can hit a limit on A, launch B, and pick the work right back up.

    This tool only ever writes inside its own folder
    (%LOCALAPPDATA%\Claudies). It does NOT touch your existing default Claude
    install at %APPDATA%\Claude unless you explicitly run `add -FromDefault`,
    which COPIES (never moves) data.

.NOTES
    Unofficial community tool. Uses the public Electron flag --user-data-dir
    and the CLAUDE_CONFIG_DIR env var. Not affiliated with Anthropic.
    MIT License.
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = 'help',

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$Rest
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ----------------------------------------------------------------------------
# Paths & constants
# ----------------------------------------------------------------------------
$Script:Root        = Join-Path $env:LOCALAPPDATA 'Claudies'
$Script:ProfilesDir = Join-Path $Script:Root 'profiles'
$Script:SharedDir   = Join-Path $Script:Root 'shared'
$Script:RegistryPath = Join-Path $Script:Root 'registry.json'
$Script:DefaultUserData = Join-Path $env:APPDATA 'Claude'

# Items that can be shared between profiles.
# kind 'dir'  -> shared via directory junction (live, two-way)
# kind 'file' -> shared via copy-on-apply (a JSON key cannot be symlinked)
$Script:Shareables = @{
    sessions    = @{ Rel = 'local-agent-mode-sessions'; Kind = 'dir';  Desc = 'Cowork / agent Sessions (the working context)' }
    mcp         = @{ Rel = 'claude_desktop_config.json'; Kind = 'file'; Desc = 'MCP server configuration' }
    preferences = @{ Rel = 'preferences.json';           Kind = 'file'; Desc = 'App preferences' }
}

# ----------------------------------------------------------------------------
# Pretty output
# ----------------------------------------------------------------------------
function Write-Title($t) { Write-Host ""; Write-Host $t -ForegroundColor Cyan; Write-Host ('-' * $t.Length) -ForegroundColor DarkCyan }
function Write-Ok($t)    { Write-Host "  [ok] $t"   -ForegroundColor Green }
function Write-Info($t)  { Write-Host "  $t"        -ForegroundColor Gray }
function Write-Warn2($t) { Write-Host "  [!] $t"    -ForegroundColor Yellow }
function Write-Err2($t)  { Write-Host "  [x] $t"    -ForegroundColor Red }

# ----------------------------------------------------------------------------
# Registry helpers
# ----------------------------------------------------------------------------
function Initialize-Store {
    foreach ($d in @($Script:Root, $Script:ProfilesDir, $Script:SharedDir)) {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }
    if (-not (Test-Path -LiteralPath $Script:RegistryPath)) {
        @{ version = 1; profiles = @() } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Script:RegistryPath -Encoding UTF8
    }
}

function Get-Registry {
    Initialize-Store
    $raw = Get-Content -LiteralPath $Script:RegistryPath -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return @{ version = 1; profiles = @() } }
    $obj = $raw | ConvertFrom-Json
    # Normalize profiles to an array
    $profiles = @()
    if ($obj.PSObject.Properties.Name -contains 'profiles' -and $null -ne $obj.profiles) {
        $profiles = @($obj.profiles)
    }
    return @{ version = 1; profiles = $profiles }
}

function Save-Registry($reg) {
    $reg | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Script:RegistryPath -Encoding UTF8
}

function Get-Profile($name) {
    $reg = Get-Registry
    return ($reg.profiles | Where-Object { $_.name -eq $name } | Select-Object -First 1)
}

function ConvertTo-SafeName($name) {
    if ([string]::IsNullOrWhiteSpace($name)) { throw "Profile name is required." }
    $clean = ($name -replace '[^A-Za-z0-9_\-]', '').ToLower()
    if ([string]::IsNullOrWhiteSpace($clean)) { throw "Profile name '$name' has no usable characters (use letters, numbers, - or _)." }
    return $clean
}

function Get-ProfileDir($name)     { Join-Path $Script:ProfilesDir $name }
function Get-CodeDir($name)        { Join-Path (Get-ProfileDir $name) '.claude-code' }
function Get-SharedStore($item)    { Join-Path $Script:SharedDir $item }

# ----------------------------------------------------------------------------
# Claude.exe detection
# ----------------------------------------------------------------------------
function Resolve-ClaudeExe {
    # 1) explicit override
    if ($env:CLAUDIES_CLAUDE_EXE -and (Test-Path -LiteralPath $env:CLAUDIES_CLAUDE_EXE)) {
        return (Resolve-Path -LiteralPath $env:CLAUDIES_CLAUDE_EXE).Path
    }
    $candidates = @()
    $base = Join-Path $env:LOCALAPPDATA 'AnthropicClaude'
    if (Test-Path -LiteralPath $base) {
        # Squirrel layout: app-<version>\claude.exe  (prefer the newest, it accepts args directly)
        $apps = Get-ChildItem -LiteralPath $base -Directory -Filter 'app-*' -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending
        foreach ($a in $apps) {
            $exe = Join-Path $a.FullName 'claude.exe'
            if (Test-Path -LiteralPath $exe) { $candidates += $exe }
        }
        $stub = Join-Path $base 'claude.exe'
        if (Test-Path -LiteralPath $stub) { $candidates += $stub }
    }
    # Other possible install locations
    $more = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\claude\Claude.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Claude\Claude.exe'),
        (Join-Path ${env:ProgramFiles} 'Claude\Claude.exe')
    )
    foreach ($m in $more) { if ($m -and (Test-Path -LiteralPath $m)) { $candidates += $m } }

    if ($candidates.Count -eq 0) { return $null }
    return $candidates[0]
}

# ----------------------------------------------------------------------------
# Junction / link helpers
# ----------------------------------------------------------------------------
function Test-IsJunction($path) {
    if (-not (Test-Path -LiteralPath $path)) { return $false }
    $item = Get-Item -LiteralPath $path -Force
    return (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq [IO.FileAttributes]::ReparsePoint)
}

function New-Junction($link, $target) {
    if (-not (Test-Path -LiteralPath $target)) { New-Item -ItemType Directory -Path $target -Force | Out-Null }
    # New-Item Junction does not require admin rights on Windows.
    New-Item -ItemType Junction -Path $link -Target $target -Force | Out-Null
}

function Copy-DirContents($from, $to) {
    if (-not (Test-Path -LiteralPath $from)) { return }
    if (-not (Test-Path -LiteralPath $to))   { New-Item -ItemType Directory -Path $to -Force | Out-Null }
    Get-ChildItem -LiteralPath $from -Force | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $to -Recurse -Force
    }
}

# ----------------------------------------------------------------------------
# Commands
# ----------------------------------------------------------------------------
function Invoke-Add {
    param([string]$Name, [switch]$FromDefault)
    $safe = ConvertTo-SafeName $Name
    $reg  = Get-Registry
    if ($reg.profiles | Where-Object { $_.name -eq $safe }) {
        Write-Warn2 "Profile '$safe' already exists."
        return
    }
    $dir = Get-ProfileDir $safe
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    New-Item -ItemType Directory -Path (Get-CodeDir $safe) -Force | Out-Null

    if ($FromDefault) {
        if (Test-Path -LiteralPath $Script:DefaultUserData) {
            Write-Info "Copying current default Claude data into the new profile (this can take a moment)..."
            Copy-DirContents $Script:DefaultUserData $dir
            Write-Ok "Seeded '$safe' from your existing default install (copy, original untouched)."
        } else {
            Write-Warn2 "No default install found at $Script:DefaultUserData - created an empty profile."
        }
    }

    $entry = [pscustomobject]@{
        name    = $safe
        dir     = $dir
        codeDir = (Get-CodeDir $safe)
        shared  = @()
        created = (Get-Date).ToString('o')
    }
    $reg.profiles = @($reg.profiles) + $entry
    Save-Registry $reg

    New-CodeLauncher $safe | Out-Null

    Write-Ok "Created profile '$safe'."
    Write-Info "Desktop : claudies launch $safe"
    Write-Info "Code    : claudies code $safe   (or run claude-$safe.cmd)"
    Write-Info "Share context with another profile:  claudies share $safe sessions"
}

function Invoke-List {
    $reg = Get-Registry
    Write-Title "Claudies profiles"
    if (@($reg.profiles).Count -eq 0) {
        Write-Info "No profiles yet. Create one:  claudies add work"
        return
    }
    foreach ($p in $reg.profiles) {
        $shared = if (@($p.shared).Count) { ($p.shared -join ', ') } else { '(none)' }
        Write-Host ("  * {0,-14} shared: {1}" -f $p.name, $shared) -ForegroundColor White
        Write-Info  "    $($p.dir)"
    }
    Write-Host ""
    Write-Info "Default (untouched) install: $Script:DefaultUserData"
}

function Invoke-Detect {
    Write-Title "Claude Desktop detection"
    $exe = Resolve-ClaudeExe
    if ($exe) {
        Write-Ok "Found: $exe"
    } else {
        Write-Err2 "Could not find Claude.exe automatically."
        Write-Info "Install Claude Desktop, or set an override:"
        Write-Info '  $env:CLAUDIES_CLAUDE_EXE = "C:\path\to\claude.exe"'
    }
    return $exe
}

function Invoke-Launch {
    param([string]$Name)
    $safe = ConvertTo-SafeName $Name
    $p = Get-Profile $safe
    if (-not $p) { Write-Err2 "No such profile '$safe'. Run: claudies add $safe"; return }
    $exe = Resolve-ClaudeExe
    if (-not $exe) { Write-Err2 "Claude.exe not found. Run: claudies detect"; return }

    $dir = $p.dir
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }

    Write-Info "Launching Claude Desktop as profile '$safe'..."
    Start-Process -FilePath $exe -ArgumentList @("--user-data-dir=$dir")
    Write-Ok "Launched. This window is account/profile '$safe'."
    Write-Info "Tip: quit other Claude windows before first login so the sign-in deep link routes here."
}

function New-CodeLauncher {
    param([string]$Name)
    $safe = ConvertTo-SafeName $Name
    $codeDir = Get-CodeDir $safe
    $cmdPath = Join-Path $Script:Root ("claude-$safe.cmd")
    $body = @"
@echo off
REM Claudies launcher for Claude Code profile '$safe'
set "CLAUDE_CONFIG_DIR=$codeDir"
claude %*
"@
    Set-Content -LiteralPath $cmdPath -Value $body -Encoding ASCII
    return $cmdPath
}

function Invoke-Code {
    param([string]$Name, [switch]$Start)
    $safe = ConvertTo-SafeName $Name
    $p = Get-Profile $safe
    if (-not $p) { Write-Err2 "No such profile '$safe'."; return }
    $codeDir = $p.codeDir
    if (-not (Test-Path -LiteralPath $codeDir)) { New-Item -ItemType Directory -Path $codeDir -Force | Out-Null }
    $cmd = New-CodeLauncher $safe

    Write-Title "Claude Code - profile '$safe'"
    Write-Info "CLAUDE_CONFIG_DIR = $codeDir"
    Write-Info "Launcher script   = $cmd"
    Write-Host ""
    Write-Info "Use it any of these ways:"
    Write-Info "  1) Run the generated launcher:   claude-$safe"
    Write-Info "  2) For this shell only:"
    Write-Host  "       `$env:CLAUDE_CONFIG_DIR = `"$codeDir`"; claude" -ForegroundColor White
    if ($Start) {
        $env:CLAUDE_CONFIG_DIR = $codeDir
        Write-Ok "Set CLAUDE_CONFIG_DIR for this session. Starting claude..."
        & claude
    }
}

function Invoke-Share {
    param([string]$Name, [string[]]$Items)
    $safe = ConvertTo-SafeName $Name
    $p = Get-Profile $safe
    if (-not $p) { Write-Err2 "No such profile '$safe'."; return }
    if (-not $Items -or $Items.Count -eq 0) { $Items = @('sessions') }

    foreach ($itemRaw in $Items) {
        $item = $itemRaw.ToLower()
        if (-not $Script:Shareables.ContainsKey($item)) {
            Write-Warn2 "Unknown shareable '$item'. Options: $($Script:Shareables.Keys -join ', ')"
            continue
        }
        $spec   = $Script:Shareables[$item]
        $target = Join-Path $p.dir $spec.Rel        # the path inside the profile
        $store  = Get-SharedStore $item             # central shared store

        if ($spec.Kind -eq 'dir') {
            if (Test-IsJunction $target) { Write-Ok "'$item' already shared for '$safe'."; continue }
            if (-not (Test-Path -LiteralPath $store)) { New-Item -ItemType Directory -Path $store -Force | Out-Null }
            # Preserve any existing local data by merging it into the shared store first.
            if (Test-Path -LiteralPath $target) {
                Write-Info "Merging existing '$item' data into the shared store..."
                Copy-DirContents $target $store
                Remove-Item -LiteralPath $target -Recurse -Force
            }
            New-Junction $target $store
            Write-Ok "Shared '$item' for '$safe'  ->  $store  (live, two-way)"
        }
        else {
            # file: copy-on-apply from shared store (create store copy if needed)
            $storeFile = Join-Path $store ([IO.Path]::GetFileName($spec.Rel))
            if (-not (Test-Path -LiteralPath $store)) { New-Item -ItemType Directory -Path $store -Force | Out-Null }
            if (-not (Test-Path -LiteralPath $storeFile)) {
                if (Test-Path -LiteralPath $target) { Copy-Item -LiteralPath $target -Destination $storeFile -Force }
                else { '{}' | Set-Content -LiteralPath $storeFile -Encoding UTF8 }
            }
            Copy-Item -LiteralPath $storeFile -Destination $target -Force
            Write-Ok "Applied shared '$item' to '$safe' (copy). Re-run share to re-sync."
        }
    }

    # record sharing in registry
    $reg = Get-Registry
    foreach ($pp in $reg.profiles) {
        if ($pp.name -eq $safe) {
            $cur = @()
            if ($pp.PSObject.Properties.Name -contains 'shared' -and $pp.shared) { $cur = @($pp.shared) }
            $pp.shared = @($cur + $Items | Select-Object -Unique)
        }
    }
    Save-Registry $reg
    Write-Host ""
    Write-Info "Now any profile you also `share` with the same item points at the same store,"
    Write-Info "so you can switch accounts and continue the same context."
}

function Invoke-Unshare {
    param([string]$Name, [string[]]$Items)
    $safe = ConvertTo-SafeName $Name
    $p = Get-Profile $safe
    if (-not $p) { Write-Err2 "No such profile '$safe'."; return }
    if (-not $Items -or $Items.Count -eq 0) { $Items = @('sessions') }

    foreach ($itemRaw in $Items) {
        $item = $itemRaw.ToLower()
        if (-not $Script:Shareables.ContainsKey($item)) { Write-Warn2 "Unknown shareable '$item'."; continue }
        $spec   = $Script:Shareables[$item]
        $target = Join-Path $p.dir $spec.Rel
        $store  = Get-SharedStore $item

        if ($spec.Kind -eq 'dir') {
            if (Test-IsJunction $target) {
                Remove-Item -LiteralPath $target -Recurse -Force   # removes the junction, not the store
                New-Item -ItemType Directory -Path $target -Force | Out-Null
                Copy-DirContents $store $target                    # keep a private copy of the context
                Write-Ok "Unshared '$item' for '$safe' (kept a private copy of the data)."
            } else {
                Write-Info "'$item' was not shared for '$safe'."
            }
        } else {
            Write-Info "'$item' is copy-based; nothing to unlink. The current file stays as-is."
        }
    }

    $reg = Get-Registry
    foreach ($pp in $reg.profiles) {
        if ($pp.name -eq $safe -and $pp.PSObject.Properties.Name -contains 'shared' -and $pp.shared) {
            $pp.shared = @($pp.shared | Where-Object { $Items -notcontains $_ })
        }
    }
    Save-Registry $reg
}

function Invoke-Status {
    Write-Title "Claudies status"
    $exe = Resolve-ClaudeExe
    if ($exe) { Write-Ok "Claude Desktop: $exe" } else { Write-Err2 "Claude Desktop: not found (claudies detect)" }
    if (Get-Command claude -ErrorAction SilentlyContinue) { Write-Ok "Claude Code CLI: on PATH" } else { Write-Warn2 "Claude Code CLI ('claude') not on PATH" }
    Write-Info "Store: $Script:Root"

    $reg = Get-Registry
    Write-Host ""
    if (@($reg.profiles).Count -eq 0) { Write-Info "No profiles."; return }
    foreach ($p in $reg.profiles) {
        Write-Host ("  Profile: {0}" -f $p.name) -ForegroundColor White
        $dirOk = Test-Path -LiteralPath $p.dir
        if ($dirOk) { Write-Ok "data dir present" } else { Write-Err2 "data dir MISSING: $($p.dir)" }
        foreach ($item in $Script:Shareables.Keys) {
            $spec   = $Script:Shareables[$item]
            $target = Join-Path $p.dir $spec.Rel
            if ($spec.Kind -eq 'dir' -and (Test-IsJunction $target)) {
                Write-Info "  - $item : SHARED (junction)"
            } elseif (Test-Path -LiteralPath $target) {
                Write-Info "  - $item : local"
            } else {
                Write-Info "  - $item : (none yet)"
            }
        }
        Write-Host ""
    }
}

function Invoke-Shortcut {
    param([string]$Name)
    $safe = ConvertTo-SafeName $Name
    $p = Get-Profile $safe
    if (-not $p) { Write-Err2 "No such profile '$safe'."; return }
    $exe = Resolve-ClaudeExe
    if (-not $exe) { Write-Err2 "Claude.exe not found."; return }

    $desktop = [Environment]::GetFolderPath('Desktop')
    $lnkPath = Join-Path $desktop ("Claude ($safe).lnk")
    $wsh = New-Object -ComObject WScript.Shell
    $sc  = $wsh.CreateShortcut($lnkPath)
    $sc.TargetPath       = $exe
    $sc.Arguments        = "--user-data-dir=$($p.dir)"
    $sc.WorkingDirectory = (Split-Path $exe)
    $sc.IconLocation     = "$exe,0"
    $sc.Description      = "Claude Desktop - profile $safe (Claudies)"
    $sc.Save()
    Write-Ok "Created desktop shortcut: $lnkPath"
}

function Invoke-Remove {
    param([string]$Name, [switch]$Purge)
    $safe = ConvertTo-SafeName $Name
    $p = Get-Profile $safe
    if (-not $p) { Write-Err2 "No such profile '$safe'."; return }

    # Drop junctions first so we never delete shared-store contents by accident.
    foreach ($item in $Script:Shareables.Keys) {
        $spec   = $Script:Shareables[$item]
        $target = Join-Path $p.dir $spec.Rel
        if ($spec.Kind -eq 'dir' -and (Test-IsJunction $target)) {
            Remove-Item -LiteralPath $target -Recurse -Force
        }
    }

    if ($Purge) {
        if (Test-Path -LiteralPath $p.dir) { Remove-Item -LiteralPath $p.dir -Recurse -Force }
        Write-Ok "Removed profile '$safe' and deleted its data."
    } else {
        Write-Ok "Removed profile '$safe' from the registry. Data kept at: $($p.dir)"
        Write-Info "Use -Purge to also delete the data."
    }
    $cmd = Join-Path $Script:Root ("claude-$safe.cmd")
    if (Test-Path -LiteralPath $cmd) { Remove-Item -LiteralPath $cmd -Force }

    $reg = Get-Registry
    $reg.profiles = @($reg.profiles | Where-Object { $_.name -ne $safe })
    Save-Registry $reg
}

function Show-Help {
@"
Claudies for Windows  -  multiple Claude accounts, side by side, shared context

USAGE
  claudies <command> [args]

COMMANDS
  add <name> [-FromDefault]   Create a profile. -FromDefault copies your current
                              default Claude data as a starting point.
  list                        List profiles and what each one shares.
  launch <name>               Open Claude Desktop running as <name> (isolated).
  code <name> [-Start]        Show/prepare Claude Code for <name> (CLAUDE_CONFIG_DIR).
                              -Start sets the var and runs `claude` now.
  share <name> [items...]     Share items between profiles (default: sessions).
                              items: sessions | mcp | preferences
  unshare <name> [items...]   Stop sharing; keep a private copy of the data.
  shortcut <name>             Put a desktop shortcut for the profile.
  status                      Health check of detection + every profile.
  detect                      Show the detected Claude.exe path.
  remove <name> [-Purge]      Remove a profile (-Purge also deletes its data).
  help                        This text.

THE ACCOUNT-SWITCH WORKFLOW (your goal)
  1.  claudies add work
  2.  claudies add personal
  3.  claudies share work sessions
  4.  claudies share personal sessions
      -> both profiles now read/write the SAME Sessions folder.
  5.  claudies launch work      (sign in with account A, start a Cowork task)
  6.  hit a usage limit? ->  claudies launch personal   (sign in with account B)
      The same session/context is right there - keep working.

NOTES
  * Junctions need no admin rights. Nothing here touches your default
    %APPDATA%\Claude install unless you use `add -FromDefault` (which copies).
  * Override detection if needed:  set CLAUDIES_CLAUDE_EXE to your claude.exe path.
"@ | Write-Host
}

# ----------------------------------------------------------------------------
# Dispatch
# ----------------------------------------------------------------------------
function Get-Flag([string[]]$arr, [string]$flag) {
    return (@($arr) -contains $flag)
}
function Get-Positionals([string[]]$arr) {
    return @($arr | Where-Object { $_ -and -not $_.StartsWith('-') })
}

# When this file is dot-sourced (e.g. by the GUI) InvocationName is '.', so we
# load the functions but skip the CLI dispatch below.
if ($MyInvocation.InvocationName -eq '.') { return }

try {
    $pos = Get-Positionals $Rest
    switch ($Command.ToLower()) {
        'add'      { Invoke-Add      -Name $pos[0] -FromDefault:(Get-Flag $Rest '-FromDefault') }
        'list'     { Invoke-List }
        'ls'       { Invoke-List }
        'launch'   { Invoke-Launch   -Name $pos[0] }
        'open'     { Invoke-Launch   -Name $pos[0] }
        'code'     { Invoke-Code     -Name $pos[0] -Start:(Get-Flag $Rest '-Start') }
        'share'    { Invoke-Share    -Name $pos[0] -Items @($pos | Select-Object -Skip 1) }
        'unshare'  { Invoke-Unshare  -Name $pos[0] -Items @($pos | Select-Object -Skip 1) }
        'shortcut' { Invoke-Shortcut -Name $pos[0] }
        'status'   { Invoke-Status }
        'detect'   { Invoke-Detect | Out-Null }
        'remove'   { Invoke-Remove   -Name $pos[0] -Purge:(Get-Flag $Rest '-Purge') }
        'rm'       { Invoke-Remove   -Name $pos[0] -Purge:(Get-Flag $Rest '-Purge') }
        default    { Show-Help }
    }
}
catch {
    Write-Err2 $_.Exception.Message
    exit 1
}
