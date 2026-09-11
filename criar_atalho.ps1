$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\NetFailover.lnk")
$Shortcut.TargetPath = "C:\Users\jeffe\.gemini\antigravity\scratch\net-failover\iniciar.bat"
$Shortcut.WorkingDirectory = "C:\Users\jeffe\.gemini\antigravity\scratch\net-failover"
$Shortcut.Description = "NetFailover Studio - Monitor de Rede e Failover"
$Shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,14"
$Shortcut.Save()
Write-Host "Atalho Desktop criado com sucesso!"
