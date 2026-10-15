<#
  NewWorld 게임의 카드 아트를 시뮬레이터용 썸네일로 변환한다.
  원본 PNG(약 149MB)를 가로 480px JPEG로 줄여 assets/cards/<카드ID>.jpg 로 저장한다.
  게임 아트가 바뀌면 다시 실행하면 된다. (추가 설치 없이 Windows 내장 System.Drawing 사용)

  사용: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/export-card-art.ps1
        [-GameResources D:\NewWorld\Assets\Resources] [-Width 480] [-Quality 82]
#>
param(
  [string]$GameResources = 'D:\NewWorld\Assets\Resources',
  [string]$OutDir = (Join-Path $PSScriptRoot '..\assets\cards'),
  [ValidateRange(64, 2048)][int]$Width = 480,
  [ValidateRange(1, 100)][int]$Quality = 82
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$cardsJson = Join-Path $GameResources 'cards.json'
if (-not (Test-Path $cardsJson)) { throw "cards.json을 찾을 수 없습니다: $cardsJson" }
$cards = (Get-Content $cardsJson -Raw -Encoding UTF8 | ConvertFrom-Json).cards

New-Item -ItemType Directory -Force $OutDir | Out-Null
# 삭제된 카드의 썸네일이 남지 않도록 이전 결과를 비운다 (이 폴더의 jpg만)
Get-ChildItem $OutDir -Filter *.jpg | Remove-Item

$jpeg = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]$Quality)
# 축소 시 가장자리에 반투명 테두리가 생기지 않도록
$wrap = New-Object System.Drawing.Imaging.ImageAttributes
$wrap.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)

$done = 0
$missing = @()
foreach ($card in $cards) {
  $src = if ($card.artworkPath) { Join-Path $GameResources ($card.artworkPath + '.png') }
  if (-not $src -or -not (Test-Path $src)) { $missing += $card.id; continue }

  $img = [System.Drawing.Image]::FromFile($src)
  try {
    $height = [int][Math]::Round($img.Height * $Width / $img.Width)
    $bmp = New-Object System.Drawing.Bitmap $Width, $height
    try {
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      try {
        $g.Clear([System.Drawing.Color]::Black)  # 투명 영역은 JPEG에서 검정으로 고정
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $dest = New-Object System.Drawing.Rectangle 0, 0, $Width, $height
        $g.DrawImage($img, $dest, 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $wrap)
      } finally { $g.Dispose() }
      $bmp.Save((Join-Path $OutDir "$($card.id).jpg"), $jpeg, $encoderParams)
    } finally { $bmp.Dispose() }
  } finally { $img.Dispose() }
  $done++
}

$totalMB = [Math]::Round(((Get-ChildItem $OutDir -Filter *.jpg | Measure-Object Length -Sum).Sum / 1MB), 2)
Write-Output "썸네일 $done 장 생성 ($totalMB MB) → $OutDir"
if ($missing.Count -gt 0) {
  Write-Warning "아트가 없는 카드 $($missing.Count)장: $($missing -join ', ')"
}
