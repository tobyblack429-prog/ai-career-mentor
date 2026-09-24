# Current-user Windows logon startup and continuous recovery. No passwords stored.
$ErrorActionPreference = 'Stop'
$taskName = 'AI Career Mentor - Local Recovery'
$taskPath = '\'
$launcher = Join-Path $PSScriptRoot 'watch-local.ps1'
$logRoot = Join-Path $PSScriptRoot 'logs'
$wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
$vbsLauncher = Join-Path $PSScriptRoot 'launch-watch-hidden.vbs'
$userId = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$description = 'CareerMentor local website: hidden logon startup and continuous health/recovery checks. Managed by enable-auto-start.ps1.'

if (-not (Test-Path -LiteralPath $vbsLauncher)) { throw "Missing hidden launcher: $vbsLauncher" }
$arguments = '//nologo "' + $vbsLauncher + '"'
$existing = Get-ScheduledTask -TaskPath $taskPath -TaskName $taskName -ErrorAction SilentlyContinue
$existingAction = if ($existing) { @($existing.Actions)[0] } else { $null }
$isManagedTask = $existing -and
    $existing.Description -like 'CareerMentor local website:*Managed by enable-auto-start.ps1.'
if ($existing -and -not $isManagedTask -and (-not $existingAction -or
    $existingAction.Execute -ne $wscript -or
    $existingAction.Arguments -ne $arguments)) {
    throw "Another task named '$taskName' already exists. It was not changed."
}

$action = New-ScheduledTaskAction -Execute $wscript -Argument $arguments -WorkingDirectory $PSScriptRoot
$triggers = @(
    (New-ScheduledTaskTrigger -AtLogOn -User $userId),
    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1))
)
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$task = New-ScheduledTask -Action $action -Trigger $triggers -Settings $settings `
    -Principal $principal -Description $description

if ($existing) {
    Register-ScheduledTask -TaskPath $taskPath -TaskName $taskName -InputObject $task -Force | Out-Null
} else {
    Register-ScheduledTask -TaskPath $taskPath -TaskName $taskName -InputObject $task | Out-Null
}
Start-ScheduledTask -TaskPath $taskPath -TaskName $taskName
Start-Sleep -Seconds 1

$registered = Get-ScheduledTask -TaskPath $taskPath -TaskName $taskName -ErrorAction Stop
$taskInfo = Get-ScheduledTaskInfo -TaskPath $taskPath -TaskName $taskName -ErrorAction Stop
$registeredAction = @($registered.Actions)[0]
$triggerCount = @($registered.Triggers).Count
if (-not $registeredAction -or
    $registeredAction.Execute -ne $wscript -or
    $registeredAction.Arguments -ne $arguments -or
    $triggerCount -lt 2 -or
    -not $registered.Settings.Hidden -or
    $registered.Settings.MultipleInstances -ne 'IgnoreNew') {
    throw "Scheduled task verification failed for '$taskPath$taskName'."
}

New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
[pscustomobject]@{
    RegisteredAt   = (Get-Date).ToString('o')
    TaskName       = $taskName
    TaskPath       = $taskPath
    UserId         = $userId
    State          = [string]$registered.State
    Execute        = $registeredAction.Execute
    Arguments      = $registeredAction.Arguments
    TriggerCount   = $triggerCount
    LastRunTime    = $taskInfo.LastRunTime
    NextRunTime    = $taskInfo.NextRunTime
    LastTaskResult = $taskInfo.LastTaskResult
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $logRoot 'auto-start-registration.json') -Encoding UTF8

Write-Host "Enabled: $taskName"
Write-Host "Verified task path: $taskPath"
Write-Host "Task state: $($registered.State); triggers: $triggerCount; last result: $($taskInfo.LastTaskResult)"
Write-Host 'The site will start after Windows logon; services are checked every 30 seconds.'
Write-Host 'The scheduler restarts the monitor if it exits unexpectedly.'
Write-Host 'No browser window is opened by the scheduled check.'
