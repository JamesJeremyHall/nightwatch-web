# Nightwatch local static server (no install - uses Windows PowerShell's HttpListener).
# Serves C:\projects\nightwatch at http://localhost:8000 so OpenStreetMap tiles load
# (OSM's servers 403 raw file:// pages because they send no Referer).
$ErrorActionPreference = 'Stop'
$root = 'C:\projects\nightwatch'
$port = 8000

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host ("Nightwatch map server running:  http://localhost:" + $port + "/map.html   (Ctrl+C to stop)")

function Get-Mime($path) {
  switch -Regex ([System.IO.Path]::GetExtension($path).ToLower()) {
    '\.html?$'        { 'text/html; charset=utf-8' }
    '\.js'            { 'application/javascript; charset=utf-8' }
    '\.css'           { 'text/css; charset=utf-8' }
    '\.json'          { 'application/json; charset=utf-8' }
    '\.png'           { 'image/png' }
    '\.(jpg|jpeg)'    { 'image/jpeg' }
    '\.gif'           { 'image/gif' }
    '\.svg'           { 'image/svg+xml' }
    '\.ico'           { 'image/x-icon' }
    '\.md'            { 'text/markdown; charset=utf-8' }
    default           { 'application/octet-stream' }
  }
}

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel  = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    if ($full -notlike ($root + '*')) { throw 'bad path' }
    if ([System.IO.Directory]::Exists($full)) { $full = Join-Path $full 'index.html' }
    if (Test-Path -LiteralPath $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ctx.Response.ContentType = Get-Mime $full
      $ctx.Response.StatusCode = 200
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes('404 - not found')
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
  } catch {
    $ctx.Response.StatusCode = 400
  } finally {
    $ctx.Response.Close()
  }
}
