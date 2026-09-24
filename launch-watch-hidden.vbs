Option Explicit

Dim shell, fso, scriptDir, powershell, watcher, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
powershell = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")
watcher = fso.BuildPath(scriptDir, "watch-local.ps1")
command = Chr(34) & powershell & Chr(34) & _
    " -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File " & _
    Chr(34) & watcher & Chr(34)

shell.CurrentDirectory = scriptDir
shell.Run command, 0, False
