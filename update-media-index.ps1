$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mediaRoot = Join-Path $root "media_fotos"
$outputFile = Join-Path $root "media-index.json"
$outputJsFile = Join-Path $root "media-index.js"

if (-not (Test-Path $mediaRoot)) {
    Write-Error "Map niet gevonden: $mediaRoot"
    exit 1
}

$imageExt = @('.jpg', '.jpeg', '.png', '.webp', '.gif')
$folders = @()

Get-ChildItem -Path $mediaRoot -Directory | Sort-Object Name | ForEach-Object {
    $folderName = $_.Name
    $images = @()

    Get-ChildItem -Path $_.FullName -File | Sort-Object Name | ForEach-Object {
        if ($imageExt -contains $_.Extension.ToLowerInvariant()) {
            $relativePath = "media_fotos/$folderName/$($_.Name)"
            $images += [PSCustomObject]@{
                src = $relativePath
                name = $_.BaseName
            }
        }
    }

    $displayName = ($folderName -replace '-', ' ')

    $folders += [PSCustomObject]@{
        id = $folderName
        name = $displayName
        images = $images
    }
}

$payload = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString('s')
    folders = $folders
}

$json = $payload | ConvertTo-Json -Depth 6
$json | Set-Content -Path $outputFile -Encoding UTF8

$js = "window.MEDIA_INDEX = $json;"
$js | Set-Content -Path $outputJsFile -Encoding UTF8

Write-Host "media-index.json en media-index.js bijgewerkt met $($folders.Count) map(pen)."
