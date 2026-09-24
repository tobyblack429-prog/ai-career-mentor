param([switch]$NoBrowser, [switch]$ScheduledCheck)

$ErrorActionPreference = 'Stop'

# Windows paths are case-insensitive, but webpack uses the path text as part of
# a module identifier.  Starting the same checkout once as D:\Codex and once as
# D:\codex can therefore load two copies of Next's router and break hydration
# with "Missing ActionQueueContext".  Rebuild the path from directory entries,
# then align it with pnpm's existing Next junction so the project and all
# dependency paths use one spelling.
function Resolve-CanonicalDirectoryPath([string]$Path) {
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetPathRoot($fullPath)
    $cursor = [System.IO.DirectoryInfo]::new($root)
    foreach ($part in $fullPath.Substring($root.Length).Split(
            [System.IO.Path]::DirectorySeparatorChar,
            [System.StringSplitOptions]::RemoveEmptyEntries)) {
        $entry = @($cursor.EnumerateFileSystemInfos($part))[0]
        if (-not $entry) { throw "Cannot resolve project path component: $part" }
        $cursor = [System.IO.DirectoryInfo]::new($entry.FullName)
    }
    return $cursor.FullName
}

$projectRoot = Resolve-CanonicalDirectoryPath $PSScriptRoot
$nextJunction = Get-Item -LiteralPath (Join-Path $projectRoot 'frontend\node_modules\next') `
    -Force -ErrorAction SilentlyContinue
if ($nextJunction -and $nextJunction.LinkType -and $nextJunction.Target) {
    $nextTarget = [string]@($nextJunction.Target)[0]
    $dependencyMarker = '\frontend\node_modules\.pnpm\'
    $markerIndex = $nextTarget.IndexOf($dependencyMarker, [System.StringComparison]::OrdinalIgnoreCase)
    if ($markerIndex -gt 0) { $projectRoot = $nextTarget.Substring(0, $markerIndex) }
}
$logRoot = Join-Path $projectRoot 'logs'
$siteUrl = 'http://localhost:3000/dashboard'

function Test-ServiceReady([string]$Name) {
    try {
        if ($Name -eq 'backend') {
            $health = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 3
            return ($health.service -eq 'AI Career Mentor' -and
                $health.status -eq 'ok' -and $health.database -eq 'connected')
        }
        $response = Invoke-WebRequest $siteUrl -UseBasicParsing -TimeoutSec 8
        return ($response.StatusCode -eq 200 -and $response.Content -match 'CareerMentor')
    } catch {
        return $false
    }
}

function Test-PortInUse([int]$Port) {
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    return @($listeners | Where-Object { $_.Port -eq $Port }).Count -gt 0
}

function Get-NodePath {
    $command = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    # Also support double-click startup when the bundled Node is not on PATH.
    $candidates = @(
        (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe'),
        (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe')
    )
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    throw 'Node.js was not found. Install Node.js or add node.exe to PATH.'
}

function Start-LocalService([string]$Name, [int]$Port, [string]$Executable,
    [string[]]$Arguments, [string]$Directory) {
    if (Test-ServiceReady $Name) {
        Write-Host "$Name is already running on port $Port."
        return
    }
    if (Test-PortInUse $Port) {
        # Another launch may still be warming up. Never replace or kill its process.
        Write-Host "Port $Port is busy; checking whether $Name is still starting..."
        $deadline = (Get-Date).AddSeconds(30)
        do {
            if (Test-ServiceReady $Name) { return }
            Start-Sleep -Seconds 1
        } while ((Get-Date) -lt $deadline)
        throw "Port $Port is occupied, but $Name is not healthy. Inspect the existing process and $logRoot."
    }

    if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) {
        throw "Missing runtime: $Executable"
    }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $stdout = Join-Path $logRoot "$Name-$stamp.out.log"
    $stderr = Join-Path $logRoot "$Name-$stamp.err.log"
    Write-Host "Starting $Name in the background..."
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments `
        -WorkingDirectory $Directory -WindowStyle Hidden `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru

    $deadline = (Get-Date).AddSeconds(120)
    do {
        if (Test-ServiceReady $Name) {
            Write-Host "$Name is ready on port $Port (launcher PID $($process.Id))."
            return
        }
        if ($process.HasExited) {
            throw "$Name exited with code $($process.ExitCode). See $stderr and $stdout."
        }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    throw "$Name did not become ready within 120 seconds. See $stderr and $stdout."
}

# The site owns these two fixed ports. Use the same lock even when opened via
# the C: junction instead of the D: project path, or by the scheduled check.
$mutex = New-Object System.Threading.Mutex($false, 'Local\CareerMentor-3000-8000')
$ownsMutex = $false
try {
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) {
        if ($ScheduledCheck) { exit 0 }
        Write-Host 'A startup is already in progress; waiting before opening the website...'
        $lockDeadline = (Get-Date).AddSeconds(150)
        do {
            try { $ownsMutex = $mutex.WaitOne(1000) }
            catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
        } while (-not $ownsMutex -and (Get-Date) -lt $lockDeadline)
        if (-not $ownsMutex) { throw 'Another startup is still running. Please inspect the logs folder.' }
    }

    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    $node = Get-NodePath
    $next = Join-Path $projectRoot 'frontend\node_modules\next\dist\bin\next'
    if (-not (Test-Path -LiteralPath $next -PathType Leaf)) {
        throw 'Frontend dependencies are missing. Restore frontend/node_modules first.'
    }
    $env:NEXT_TELEMETRY_DISABLED = '1'
    $env:PYTHONUNBUFFERED = '1'
    # Next invokes Node child processes; inherit the same resolved executable directory.
    $env:PATH = (Split-Path -Parent $node) + ';' + $env:PATH

    $failures = @()
    try {
        Start-LocalService -Name backend -Port 8000 `
            -Executable (Join-Path $projectRoot 'backend\venv\Scripts\python.exe') `
            -Arguments @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') `
            -Directory (Join-Path $projectRoot 'backend')
    } catch { $failures += 'Backend: ' + $_.Exception.Message }

    # Check both services even when one fails, so a backend fault does not
    # prevent the dashboard itself from being restored.
    try {
        Start-LocalService -Name frontend -Port 3000 -Executable $node `
            -Arguments @(('"' + $next + '"'), 'dev', '--hostname', '127.0.0.1', '--port', '3000') `
            -Directory (Join-Path $projectRoot 'frontend')
    } catch { $failures += 'Frontend: ' + $_.Exception.Message }
    if ($failures.Count -gt 0) { throw ($failures -join ' | ') }

    if ($ScheduledCheck) {
        [pscustomobject]@{
            checked_at = (Get-Date).ToString('o')
            status = 'ready'
            url = $siteUrl
        } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'last-health-check.json') -Encoding UTF8
    }

    Write-Host "Ready: $siteUrl"
    Write-Host "Logs: $logRoot"
    Write-Host 'You may close this startup window. Double-click start.bat whenever you want to open the website.'
    if (-not $NoBrowser) { Start-Process $siteUrl }
} catch {
    Write-Host ('Startup failed: ' + $_.Exception.Message) -ForegroundColor Red
    if ($ScheduledCheck -and (Test-Path -LiteralPath $logRoot)) {
        [pscustomobject]@{
            checked_at = (Get-Date).ToString('o')
            status = 'error'
            message = $_.Exception.Message
            url = $siteUrl
        } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'last-health-check.json') -Encoding UTF8
    }
    exit 1
} finally {
    if ($ownsMutex) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
