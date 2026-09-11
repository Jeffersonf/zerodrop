Add-Type -AssemblyName System.Drawing

$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Background: dark rounded rectangle
$bgRect = New-Object System.Drawing.Rectangle(8, 8, ($size - 16), ($size - 16))
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$radius = 48
$d = $radius * 2
$path.AddArc($bgRect.X, $bgRect.Y, $d, $d, 180, 90)
$path.AddArc($bgRect.Right - $d, $bgRect.Y, $d, $d, 270, 90)
$path.AddArc($bgRect.Right - $d, $bgRect.Bottom - $d, $d, $d, 0, 90)
$path.AddArc($bgRect.X, $bgRect.Bottom - $d, $d, $d, 90, 90)
$path.CloseFigure()

$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point($size, $size)),
    [System.Drawing.Color]::FromArgb(255, 15, 15, 22),
    [System.Drawing.Color]::FromArgb(255, 8, 8, 12)
)
$g.FillPath($brush, $path)

# Glowing border
$borderPen = New-Object System.Drawing.Pen(
    (New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point($size, $size)),
        [System.Drawing.Color]::FromArgb(255, 56, 189, 248),  # Sky blue
        [System.Drawing.Color]::FromArgb(255, 16, 185, 129)  # Emerald
    )),
    5
)
$g.DrawPath($borderPen, $path)

# Inner Shield / Infinity Zero-Drop Symbol
# Left loop (Cyan - Cable)
$penCyan = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 56, 189, 248), 12)
$penCyan.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penCyan.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

# Right loop (Emerald - 5G)
$penGreen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), 12)
$penGreen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$penGreen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

# Center pulse circle
$centerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.FillEllipse($centerBrush, 116, 116, 24, 24)

# Draw intertwining dual arcs
$g.DrawArc($penCyan, 48, 80, 96, 96, 45, 270)
$g.DrawArc($penGreen, 112, 80, 96, 96, 225, 270)

# Lightning / Fast-switch bolt in center
$boltBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(128, 60)),
    (New-Object System.Drawing.Point(128, 196)),
    [System.Drawing.Color]::FromArgb(255, 250, 204, 21),  # Amber
    [System.Drawing.Color]::FromArgb(255, 56, 189, 248)   # Cyan
)
$boltPoints = @(
    (New-Object System.Drawing.Point(134, 66)),
    (New-Object System.Drawing.Point(114, 124)),
    (New-Object System.Drawing.Point(128, 124)),
    (New-Object System.Drawing.Point(122, 190)),
    (New-Object System.Drawing.Point(146, 120)),
    (New-Object System.Drawing.Point(130, 120))
)
$g.FillPolygon($boltBrush, $boltPoints)

New-Item -ItemType Directory -Force -Path 'C:\Users\jeffe\.gemini\antigravity\scratch\net-failover\public' | Out-Null
$pngPath = 'C:\Users\jeffe\.gemini\antigravity\scratch\net-failover\public\icon.png'
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

# Convert to ICO
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$icoPath = 'C:\Users\jeffe\.gemini\antigravity\scratch\net-failover\public\icon.ico'
$fs = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create)
$icon.Save($fs)
$fs.Close()

$g.Dispose()
$bmp.Dispose()
Write-Host "Icones criados com sucesso: icon.png e icon.ico!"
