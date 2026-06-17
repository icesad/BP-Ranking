#Requires -Version 5.1
<#
    Claudies for Windows - simple GUI.
    Reuses the engine in claudies.ps1 (dot-sourced) and wraps it in WinForms.
#>

$ErrorActionPreference = 'Stop'

# --- Load the engine (functions only; dispatch is skipped on dot-source) ------
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$engine = Join-Path $here 'claudies.ps1'
if (-not (Test-Path -LiteralPath $engine)) {
    [System.Windows.Forms.MessageBox]::Show("Cannot find claudies.ps1 next to this GUI.") | Out-Null
    return
}
. $engine

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# ---------------------------------------------------------------------------
# Window
# ---------------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Claudies for Windows'
$form.Size = New-Object System.Drawing.Size(720, 480)
$form.StartPosition = 'CenterScreen'
$form.MinimumSize = New-Object System.Drawing.Size(640, 420)
$form.BackColor = [System.Drawing.Color]::FromArgb(30, 33, 39)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font('Segoe UI', 9)

# Header
$header = New-Object System.Windows.Forms.Label
$header.Text = 'Run multiple Claude accounts side by side - share Sessions to keep context across account switches.'
$header.AutoSize = $false
$header.Dock = 'Top'
$header.Height = 40
$header.TextAlign = 'MiddleLeft'
$header.Padding = New-Object System.Windows.Forms.Padding(12, 0, 12, 0)
$header.ForeColor = [System.Drawing.Color]::FromArgb(180, 200, 220)
$form.Controls.Add($header)

# Profiles list
$list = New-Object System.Windows.Forms.ListView
$list.View = 'Details'
$list.FullRowSelect = $true
$list.GridLines = $false
$list.MultiSelect = $false
$list.HideSelection = $false
$list.Location = New-Object System.Drawing.Point(12, 50)
$list.Size = New-Object System.Drawing.Size(480, 360)
$list.Anchor = 'Top,Bottom,Left,Right'
$list.BackColor = [System.Drawing.Color]::FromArgb(24, 26, 31)
$list.ForeColor = [System.Drawing.Color]::White
$list.Columns.Add('Profile', 150) | Out-Null
$list.Columns.Add('Sessions', 110) | Out-Null
$list.Columns.Add('Other shared', 200) | Out-Null
$form.Controls.Add($list)

# Status bar
$status = New-Object System.Windows.Forms.Label
$status.Dock = 'Bottom'
$status.Height = 26
$status.TextAlign = 'MiddleLeft'
$status.Padding = New-Object System.Windows.Forms.Padding(12, 0, 0, 0)
$status.ForeColor = [System.Drawing.Color]::FromArgb(150, 160, 170)
$form.Controls.Add($status)

# ---------------------------------------------------------------------------
# Buttons (right column)
# ---------------------------------------------------------------------------
function New-Btn($text, $y) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text
    $b.Location = New-Object System.Drawing.Point(504, $y)
    $b.Size = New-Object System.Drawing.Size(188, 34)
    $b.Anchor = 'Top,Right'
    $b.FlatStyle = 'Flat'
    $b.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(70, 80, 90)
    $b.BackColor = [System.Drawing.Color]::FromArgb(45, 50, 58)
    $b.ForeColor = [System.Drawing.Color]::White
    $form.Controls.Add($b)
    return $b
}

$btnNew      = New-Btn 'New profile...'        50
$btnLaunch   = New-Btn 'Launch Desktop'        90
$btnShare    = New-Btn 'Toggle Sessions share' 130
$btnCode     = New-Btn 'Claude Code launcher'  170
$btnShortcut = New-Btn 'Desktop shortcut'      210
$btnRemove   = New-Btn 'Remove profile'        250
$btnRefresh  = New-Btn 'Refresh'               300

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
function Get-SelectedName {
    if ($list.SelectedItems.Count -eq 0) { return $null }
    return $list.SelectedItems[0].Text
}

function Show-Msg($text, $title = 'Claudies') {
    [System.Windows.Forms.MessageBox]::Show($text, $title) | Out-Null
}

function Refresh-List {
    $list.Items.Clear()
    $reg = Get-Registry
    foreach ($p in $reg.profiles) {
        $sessTarget = Join-Path $p.dir 'local-agent-mode-sessions'
        $sessShared = Test-IsJunction $sessTarget
        $others = @()
        foreach ($it in @('mcp','preferences')) {
            $spec = $Script:Shareables[$it]
            $t = Join-Path $p.dir $spec.Rel
            if ($spec.Kind -eq 'dir' -and (Test-IsJunction $t)) { $others += $it }
            elseif ($p.PSObject.Properties.Name -contains 'shared' -and (@($p.shared) -contains $it)) { $others += $it }
        }
        $item = New-Object System.Windows.Forms.ListViewItem($p.name)
        $item.SubItems.Add($(if ($sessShared) { 'SHARED' } else { 'private' })) | Out-Null
        $item.SubItems.Add($(if ($others.Count) { $others -join ', ' } else { '-' })) | Out-Null
        $list.Items.Add($item) | Out-Null
    }
    $exe = Resolve-ClaudeExe
    if ($exe) { $status.Text = "Claude Desktop: $exe" }
    else { $status.Text = 'Claude Desktop not found - set $env:CLAUDIES_CLAUDE_EXE'; $status.ForeColor = [System.Drawing.Color]::Khaki }
}

# ---------------------------------------------------------------------------
# Button actions
# ---------------------------------------------------------------------------
$btnNew.Add_Click({
    $name = [Microsoft.VisualBasic.Interaction]::InputBox('Profile name (letters/numbers/-/_):', 'New profile', 'work')
    if ([string]::IsNullOrWhiteSpace($name)) { return }
    try {
        $seed = [System.Windows.Forms.MessageBox]::Show(
            'Seed this profile from your current default Claude data? (copies, original untouched)',
            'Seed from default?', 'YesNo', 'Question')
        if ($seed -eq 'Yes') { Invoke-Add -Name $name -FromDefault }
        else { Invoke-Add -Name $name }
        Refresh-List
    } catch { Show-Msg $_.Exception.Message 'Error' }
})

$btnLaunch.Add_Click({
    $n = Get-SelectedName
    if (-not $n) { Show-Msg 'Select a profile first.'; return }
    try { Invoke-Launch -Name $n } catch { Show-Msg $_.Exception.Message 'Error' }
})

$btnShare.Add_Click({
    $n = Get-SelectedName
    if (-not $n) { Show-Msg 'Select a profile first.'; return }
    try {
        $reg = Get-Registry
        $p = $reg.profiles | Where-Object { $_.name -eq $n } | Select-Object -First 1
        $sessTarget = Join-Path $p.dir 'local-agent-mode-sessions'
        if (Test-IsJunction $sessTarget) { Invoke-Unshare -Name $n -Items @('sessions') }
        else { Invoke-Share -Name $n -Items @('sessions') }
        Refresh-List
    } catch { Show-Msg $_.Exception.Message 'Error' }
})

$btnCode.Add_Click({
    $n = Get-SelectedName
    if (-not $n) { Show-Msg 'Select a profile first.'; return }
    try {
        $cmd = New-CodeLauncher $n
        $p = Get-Profile $n
        Show-Msg ("Claude Code launcher ready:`n`n  {0}`n`nCLAUDE_CONFIG_DIR = {1}`n`nRun 'claude-{2}' in a terminal to start Code on this account." -f $cmd, $p.codeDir, $n) 'Claude Code'
    } catch { Show-Msg $_.Exception.Message 'Error' }
})

$btnShortcut.Add_Click({
    $n = Get-SelectedName
    if (-not $n) { Show-Msg 'Select a profile first.'; return }
    try { Invoke-Shortcut -Name $n; Show-Msg "Desktop shortcut created for '$n'." } catch { Show-Msg $_.Exception.Message 'Error' }
})

$btnRemove.Add_Click({
    $n = Get-SelectedName
    if (-not $n) { Show-Msg 'Select a profile first.'; return }
    $res = [System.Windows.Forms.MessageBox]::Show(
        "Remove profile '$n'?`n`nYes = remove and DELETE its data`nNo = remove from list, keep data folder",
        'Remove profile', 'YesNoCancel', 'Warning')
    if ($res -eq 'Cancel') { return }
    try {
        if ($res -eq 'Yes') { Invoke-Remove -Name $n -Purge } else { Invoke-Remove -Name $n }
        Refresh-List
    } catch { Show-Msg $_.Exception.Message 'Error' }
})

$btnRefresh.Add_Click({ Refresh-List })

# VisualBasic for InputBox
Add-Type -AssemblyName Microsoft.VisualBasic

Refresh-List
[void]$form.ShowDialog()
