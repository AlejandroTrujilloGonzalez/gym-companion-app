Add-Type -AssemblyName System.Drawing

$assetsDirectory = Join-Path $PSScriptRoot '..\assets\images'
$backgroundColor = [System.Drawing.ColorTranslator]::FromHtml('#173B35')
$foregroundColor = [System.Drawing.ColorTranslator]::FromHtml('#F2F4EB')
$accentColor = [System.Drawing.ColorTranslator]::FromHtml('#F28C62')

function Draw-RoundedRectangle($graphics, $brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  $graphics.FillPath($brush, $path)
  $path.Dispose()
}

function Draw-BrandMark($bitmap, [bool]$monochrome = $false) {
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.ScaleTransform($bitmap.Width / 1024, $bitmap.Height / 1024)

  $markColor = if ($monochrome) { [System.Drawing.Color]::White } else { $foregroundColor }
  $markBrush = [System.Drawing.SolidBrush]::new($markColor)
  $accentBrush = [System.Drawing.SolidBrush]::new($(if ($monochrome) { $markColor } else { $accentColor }))

  $chartPen = [System.Drawing.Pen]::new($accentBrush, 34)
  $chartPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $chartPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $chartPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $points = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(378, 420),
    [System.Drawing.PointF]::new(490, 330),
    [System.Drawing.PointF]::new(584, 364),
    [System.Drawing.PointF]::new(708, 250)
  )
  $graphics.DrawLines($chartPen, $points)
  $graphics.DrawLine($chartPen, 708, 250, 657, 260)
  $graphics.DrawLine($chartPen, 708, 250, 698, 301)

  Draw-RoundedRectangle $graphics $markBrush 210 565 604 54 27
  Draw-RoundedRectangle $graphics $markBrush 252 405 92 374 25
  Draw-RoundedRectangle $graphics $markBrush 376 460 64 264 22
  Draw-RoundedRectangle $graphics $markBrush 584 460 64 264 22
  Draw-RoundedRectangle $graphics $markBrush 680 405 92 374 25

  $chartPen.Dispose()
  $accentBrush.Dispose()
  $markBrush.Dispose()
  $graphics.Dispose()
}

function Save-Png($bitmap, [string]$name) {
  $path = Join-Path $assetsDirectory $name
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
  Write-Output "Generated $path"
}

$icon = [System.Drawing.Bitmap]::new(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($icon)
$graphics.Clear($backgroundColor)
$graphics.Dispose()
Draw-BrandMark $icon
Save-Png $icon 'icon.png'

$foreground = [System.Drawing.Bitmap]::new(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
Draw-BrandMark $foreground
Save-Png $foreground 'android-icon-foreground.png'

$monochrome = [System.Drawing.Bitmap]::new(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
Draw-BrandMark $monochrome $true
Save-Png $monochrome 'android-icon-monochrome.png'

$splash = [System.Drawing.Bitmap]::new(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
Draw-BrandMark $splash
Save-Png $splash 'splash-icon.png'

$favicon = [System.Drawing.Bitmap]::new(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($favicon)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear($backgroundColor)
$graphics.Dispose()
Draw-BrandMark $favicon
Save-Png $favicon 'favicon.png'