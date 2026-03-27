$base = Join-Path $env:LOCALAPPDATA "omni-chat\redis-8.6.1"
$serverPath = Join-Path $base "redis-server.exe"
$dataDir = Join-Path $base "data"
$port = 6380

if (!(Test-Path $serverPath)) {
  Write-Error "redis-server.exe was not found at $serverPath"
  exit 1
}

New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

$existing = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "redis-server.exe" -and
    $_.CommandLine -like "*--port $port*"
  }

if ($existing) {
  Write-Output "Redis 8.6.1 is already running on port $port."
  exit 0
}

Start-Process -FilePath $serverPath `
  -ArgumentList @("--port", "$port", "--bind", "127.0.0.1", "--appendonly", "no", "--dir", "$dataDir") `
  -WindowStyle Hidden | Out-Null

Start-Sleep -Seconds 2

$started = Get-CimInstance Win32_Process |
  Where-Object {
    $_.Name -eq "redis-server.exe" -and
    $_.CommandLine -like "*--port $port*"
  }

if ($started) {
  Write-Output "Redis 8.6.1 started on 127.0.0.1:$port."
  exit 0
}

Write-Error "Redis 8.6.1 did not start successfully."
exit 1
