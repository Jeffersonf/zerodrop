Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
appDir = FSO.GetParentFolderName(WScript.ScriptFullName)
exePath = FSO.BuildPath(appDir, "node_modules\electron\dist\electron.exe")
WshShell.CurrentDirectory = appDir
WshShell.Run """" & exePath & """ """ & appDir & """", 0, False
