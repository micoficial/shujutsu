param([string]$OutDir, [string]$Hospitals = '4,485')
# OGP画像（1200x630）とアイコン（180x180）を作る： powershell -File scripts/make_images.ps1 -OutDir src/assets
Add-Type -AssemblyName System.Drawing

function New-Brush([string]$hex) { return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex)) }
function RoundRect([System.Drawing.Graphics]$g, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90); $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90); $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure(); $g.FillPath($brush, $p); $p.Dispose()
}
$fontName = 'Yu Gothic UI'
$installed = (New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { $_.Name }
if (-not ($installed -contains $fontName)) { $fontName = 'Meiryo' }

# ---- OGP 1200x630 ----
$bmp = New-Object System.Drawing.Bitmap 1200, 630
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#f5f6f3'))
$teal = New-Brush '#0d5c63'; $ink = New-Brush '#18242a'; $muted = New-Brush '#5a666d'; $white = New-Brush '#ffffff'; $line = New-Brush '#dfe3df'
$g.FillRectangle($teal, 0, 0, 1200, 14)

$fTitle = New-Object System.Drawing.Font($fontName, 90, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSub = New-Object System.Drawing.Font($fontName, 36, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSmall = New-Object System.Drawing.Font($fontName, 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$fKey = New-Object System.Drawing.Font($fontName, 30, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fRow = New-Object System.Drawing.Font($fontName, 26, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

$g.DrawString('手術件数しらべ', $fTitle, $ink, 60, 92)
$g.DrawString('病院ごとの手術件数・入院患者数を', $fSub, $muted, 68, 236)
$g.DrawString('国のDPC公開データで', $fSub, $muted, 68, 286)
RoundRect $g (New-Brush '#d7efec') 68 372 452 56 28
$g.DrawString("無料・登録なし・全国${Hospitals}病院", $fKey, $teal, 92, 382)
$g.DrawString('micoficial.github.io/shujutsu', $fSmall, $muted, 70, 540)

# 件数の表のイラスト
RoundRect $g $line 736 70 404 492 26
RoundRect $g $white 732 64 404 492 26
$g.DrawString('手術件数', $fKey, $ink, 772, 92)
$g.FillRectangle($ink, 772, 140, 324, 3)
$bars = @(300, 252, 214, 170, 128)
$y = 168
$i = 1
foreach ($w in $bars) {
  RoundRect $g (New-Brush '#cfe6e3') 772 ($y + 8) $w 44 8
  $g.DrawString("$i", $fRow, $teal, 784, ($y + 14))
  $g.FillRectangle($line, 772, ($y + 70), 324, 2)
  $y += 76
  $i += 1
}
$bmp.Save((Join-Path $OutDir 'og.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# ---- アイコン 180x180（favicon.svg と同じ形） ----
$s = 180
$bmp = New-Object System.Drawing.Bitmap $s, $s
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#0d5c63'))
$k = $s / 64
RoundRect $g (New-Brush '#9fd0ca') (12 * $k) (34 * $k) (10 * $k) (18 * $k) (3 * $k)
RoundRect $g (New-Brush '#d7efec') (27 * $k) (24 * $k) (10 * $k) (28 * $k) (3 * $k)
RoundRect $g $white (42 * $k) (12 * $k) (10 * $k) (40 * $k) (3 * $k)
$bmp.Save((Join-Path $OutDir 'icon-180.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"font=$fontName"
