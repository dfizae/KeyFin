<#
.SYNOPSIS
  가구 원본(투명 PNG, 방향별 2장)을 방 씬·상점용 스프라이트로 만든다.

.DESCRIPTION
  원본 파일 이름은 `<asset_key>__left_wall.png` · `<asset_key>__right_wall.png` 이다.
  left_wall 은 등받이가 왼쪽 벽에 붙어 오른쪽 앞을 보는 그림(서버 placementDirection FRONT_RIGHT),
  right_wall 은 그 반대(FRONT_LEFT)다. 벽 장식은 붙는 벽을 뜻한다.
  두 장은 좌우 반전이 아니라 따로 렌더된 그림이라(빛·그림자 방향이 같다) 둘 다 쓴다.

  1) 알파 > AlphaFloor 인 픽셀의 경계(bbox)를 찾아 여백을 잘라낸다. 원본은 모두 같은 카메라 배율이라 가구마다 따로 맞추지 않고
     전부 같은 배율(SceneScale)로만 줄인다 — 씬 크기와 접지점은 features/room/catalog.ts 가 **줄이기 전** 잘라낸 그림 기준으로
     계산해 둔 값이라(씬 크기 = 잘라낸 px ÷ 6.3), 새 가구를 잴 때는 -SceneScale 1 로 뽑은 그림에서 잰다.
  2) left.png · right.png 는 방 씬용, shop.png 는 left 그림을 긴 변 ShopSize 로 줄인 상점 타일용이다
     (상점 카드는 72pt 라 방용 원본을 그대로 읽으면 메모리를 낭비한다).

  Windows PowerShell 5.1 + .NET System.Drawing 전용 로컬 도구이며 앱 빌드와 무관하다.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/assets/build-furniture-sprites.ps1 -Source C:\Users\SSAFY\Desktop\Room_Matched_PNG_146\room_matched_png -Target assets/sprites/furniture
#>
param(
  # <asset_key>__left_wall.png · __right_wall.png 가 있는 원본 폴더
  [Parameter(Mandatory = $true)][string]$Source,
  # 결과를 쓸 폴더. asset_key 별 하위 폴더를 만든다
  [Parameter(Mandatory = $true)][string]$Target,
  # 방 씬용 그림(left·right)을 원본에서 줄이는 배율. 원본은 6.3px/씬 단위인데 방은 1배에서 화면 1단위가 약 3.5~4px(1080p 폰)라
  # 2/3(4.2px/씬 단위)이면 평소에는 선명하고 용량은 절반 아래가 된다. 최대 확대(2배)에서는 조금 부드러워진다 — 선명도가 더 필요하면 1 로 돌린다.
  # 모든 가구에 같은 값을 써야 한다(가구끼리 크기 비율이 원본 배율에서 나온다). 카탈로그의 씬 크기·앵커는 비율이라 이 값과 무관하다.
  [double]$SceneScale = (2.0 / 3),
  # 상점 타일의 긴 변(px). 72pt × 약 3.5 배
  [int]$ShopSize = 256,
  # 잘라낸 경계 바깥에 남길 여백(px). 밉맵 가장자리가 잘리지 않게 한다
  [int]$Padding = 2,
  # 이 값보다 알파가 큰 픽셀만 내용으로 본다(안티에일리어싱 가장자리 제외)
  [int]$AlphaFloor = 8
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# 146장을 PowerShell 반복문으로 훑으면 몇십 분이 걸려 경계 찾기만 C# 로 돌린다.
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class FurnitureAlphaBounds {
  public static Rectangle Find(Bitmap bitmap, int floor) {
    var rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
    var data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    try {
      var bytes = new byte[data.Stride * bitmap.Height];
      Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
      int minX = bitmap.Width, minY = bitmap.Height, maxX = -1, maxY = -1;
      for (int y = 0; y < bitmap.Height; y++) {
        int row = y * data.Stride;
        for (int x = 0; x < bitmap.Width; x++) {
          if (bytes[row + x * 4 + 3] <= floor) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < 0) throw new InvalidOperationException("empty image");
      return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    } finally {
      bitmap.UnlockBits(data);
    }
  }
}
'@

function New-Canvas {
  param([int]$Width, [int]$Height)

  $bmp = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Canvas {
  param($Canvas, [string]$TargetFile)

  $Canvas.Graphics.Dispose()
  $dir = Split-Path $TargetFile -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $Canvas.Bitmap.Save($TargetFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $Canvas.Bitmap.Dispose()
}

# 'scene' = 여백을 잘라낸 뒤 SceneScale 로 줄임, 'tile' = 긴 변을 ShopSize 로 줄임
function Write-Sprite {
  param([string]$SourceFile, [string]$TargetFile, [string]$Mode)

  $src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $SourceFile).Path)
  try {
    $box = [FurnitureAlphaBounds]::Find($src, $AlphaFloor)
    if ($Mode -eq 'scene') {
      $x = [Math]::Max(0, $box.X - $Padding)
      $y = [Math]::Max(0, $box.Y - $Padding)
      $crop = New-Object System.Drawing.Rectangle $x, $y, ([Math]::Min($src.Width, $box.Right + $Padding) - $x), ([Math]::Min($src.Height, $box.Bottom + $Padding) - $y)
      # 여백까지 포함한 잘라낸 그림을 통째로 줄인다 — 그래야 카탈로그의 앵커 비율(잘라낸 그림 기준)이 그대로 맞는다.
      $outW = [Math]::Max(1, [int][Math]::Round($crop.Width * $SceneScale))
      $outH = [Math]::Max(1, [int][Math]::Round($crop.Height * $SceneScale))
      $canvas = New-Canvas -Width $outW -Height $outH
      $dest = New-Object System.Drawing.Rectangle 0, 0, $outW, $outH
      $canvas.Graphics.DrawImage($src, $dest, $crop.X, $crop.Y, $crop.Width, $crop.Height, [System.Drawing.GraphicsUnit]::Pixel)
    } else {
      $ratio = $ShopSize / [Math]::Max($box.Width, $box.Height)
      $outW = [Math]::Max(1, [int][Math]::Round($box.Width * $ratio))
      $outH = [Math]::Max(1, [int][Math]::Round($box.Height * $ratio))
      $canvas = New-Canvas -Width $outW -Height $outH
      $dest = New-Object System.Drawing.Rectangle 0, 0, $outW, $outH
      $canvas.Graphics.DrawImage($src, $dest, $box.X, $box.Y, $box.Width, $box.Height, [System.Drawing.GraphicsUnit]::Pixel)
    }
    Save-Canvas -Canvas $canvas -TargetFile $TargetFile
    $kb = [int]((Get-Item $TargetFile).Length / 1KB)
    Write-Output ("  {0,-9} {1,4}x{2,-4} {3,4} KB" -f (Split-Path $TargetFile -Leaf), $outW, $outH, $kb)
  } finally {
    $src.Dispose()
  }
}

$sourceRoot = (Resolve-Path $Source).Path

# 원본에는 있지만 앱에 넣지 않는 것. 백엔드 V20 이 탁상 소품·작은 화분을 상품에서 뺐고 앞으로도 넣지 않기로 했다(사용자 결정 2026-09-21).
# 서버에 없는 가구는 살 수도 받을 수도 없어 그림만 번들 용량을 차지한다 — 다시 넣으려면 여기서 빼고 catalog.ts·furniture-sprites.ts 에 더한다.
$EXCLUDED = @(
  'decor_books_bookend', 'decor_candle_tray', 'decor_donut_vase', 'decor_mantel_clock', 'decor_metal_bird',
  'decor_metal_knot', 'decor_mini_frame', 'decor_mushroom_lamp', 'decor_orbit_sculpture', 'decor_wave_vase',
  'plant_bonsai_slate', 'plant_cactus_concrete', 'plant_pothos_hanging', 'plant_succulent_blush'
)

$keys = Get-ChildItem -Path $sourceRoot -Filter '*__left_wall.png' | ForEach-Object { $_.Name -replace '__left_wall\.png$', '' } |
  Where-Object { $EXCLUDED -notcontains $_ } | Sort-Object
foreach ($key in $keys) {
  $left = Join-Path $sourceRoot "${key}__left_wall.png"
  $right = Join-Path $sourceRoot "${key}__right_wall.png"
  if (-not (Test-Path $right)) { throw "$key 의 right_wall 그림이 없다" }
  Write-Output "[$key]"
  Write-Sprite -SourceFile $left -TargetFile (Join-Path $Target "$key\left.png") -Mode 'scene'
  Write-Sprite -SourceFile $right -TargetFile (Join-Path $Target "$key\right.png") -Mode 'scene'
  Write-Sprite -SourceFile $left -TargetFile (Join-Path $Target "$key\shop.png") -Mode 'tile'
}
Write-Output ("{0} 종 완료" -f $keys.Count)
