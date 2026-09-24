# Kept alive by the current-user Windows scheduled task. The monitor owns the
# service checks so recovery does not depend on scheduler child-process tracking.
$ErrorActionPreference = 'Stop'
$shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$launcher = Join-Path $PSScriptRoot 'start-local.ps1'
$logRoot = Join-Path $PSScriptRoot 'logs'
$mutex = New-Object System.Threading.Mutex($false, 'Local\CareerMentor-Watch-3000-8000')
$ownsMutex = $false
try {
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { exit 0 }
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    $monitorLog = Join-Path $logRoot 'recovery-monitor.log'
    $heartbeatFile = Join-Path $logRoot 'recovery-monitor-heartbeat.json'
    Add-Content -LiteralPath $monitorLog `
        -Value ((Get-Date).ToString('o') + ' Monitor started; checking ports 3000 and 8000 every 30 seconds.')
    while ($true) {
        # Keep the launcher isolated from this long-running monitor. The timeout
        # prevents an inherited process handle from stopping future checks.
        try {
            $launcherArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + `
                $launcher + '" -NoBrowser -ScheduledCheck'
            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = $shell
            $startInfo.Arguments = $launcherArguments
            $startInfo.WorkingDirectory = $PSScriptRoot
            $startInfo.UseShellExecute = $false
            $startInfo.CreateNoWindow = $true
            $launcherProcess = New-Object System.Diagnostics.Process
            $launcherProcess.StartInfo = $startInfo
            [void]$launcherProcess.Start()
            if ($launcherProcess.WaitForExit(180000)) {
                $launcherExitCode = $launcherProcess.ExitCode
            } else {
                Stop-Process -Id $launcherProcess.Id -Force -ErrorAction SilentlyContinue
                $launcherExitCode = 124
                Add-Content -LiteralPath $monitorLog `
                    -Value ((Get-Date).ToString('o') + ' Check timed out after 180 seconds. Will retry.')
            }
            $launcherProcess.Dispose()
            $checkTime = Get-Date
            if ($launcherExitCode -ne 0) {
                Add-Content -LiteralPath $monitorLog `
                    -Value ((Get-Date).ToString('o') + ' Check failed; see last-health-check.json. Will retry.')
            }
            [pscustomobject]@{
                CheckedAt = $checkTime.ToString('o')
                Status    = $(if ($launcherExitCode -eq 0) { 'ready' } else { 'retrying' })
                Ports     = @(3000, 8000)
                ExitCode  = $launcherExitCode
            } | ConvertTo-Json | Set-Content -LiteralPath $heartbeatFile -Encoding UTF8
        } catch {
            Add-Content -LiteralPath $monitorLog `
                -Value ((Get-Date).ToString('o') + ' ' + $_.Exception.Message)
        }
        Start-Sleep -Seconds 30
    }
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
