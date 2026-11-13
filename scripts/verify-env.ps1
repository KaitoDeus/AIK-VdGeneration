<#
.SYNOPSIS
    Verifies that the development environment has all necessary runtimes and tools installed for AIK-VdGeneration.
.DESCRIPTION
    Checks Node.js, npm, Python, Git, and optional FFmpeg.
#>

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host " AIK-VdGeneration: Environment Verification Script   " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

function Check-Command($cmd, $name, $versionArg = "--version") {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        $ver = & $cmd $versionArg 2>&1 | Select-Object -First 1
        Write-Host "[OK] $name detected: $ver" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[MISSING] $name is NOT installed or not in PATH." -ForegroundColor Red
        return $false
    }
}

$allGood = $true

$allGood = (Check-Command "node" "Node.js" "-v") -and $allGood
$allGood = (Check-Command "npm" "npm" "-v") -and $allGood
$allGood = (Check-Command "python" "Python" "--version") -and $allGood
$allGood = (Check-Command "git" "Git" "--version") -and $allGood
$hasFfmpeg = Check-Command "ffmpeg" "FFmpeg" "-version"

Write-Host ""
if ($allGood) {
    Write-Host "[SUCCESS] Tất cả môi trường cốt lõi (Node, npm, Python, Git) đã sẵn sàng!" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Vui lòng cài đặt các công cụ còn thiếu trước khi tiếp tục." -ForegroundColor Yellow
}

if (-not $hasFfmpeg) {
    Write-Host "[INFO] FFmpeg chưa có trong PATH. Remotion có thể tự động bundle chromium và ffmpeg, tuy nhiên cài đặt FFmpeg hệ thống sẽ tối ưu tốc độ trích xuất thời lượng âm thanh." -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Kiểm tra thư mục dự án:" -ForegroundColor Cyan
Write-Host "Root: D:\AIK-VdGeneration" -ForegroundColor Gray
Write-Host "Documentation: D:\AIK-VdGeneration\docs\" -ForegroundColor Gray
Write-Host "AI Skills: D:\AIK-VdGeneration\.agent\skills\" -ForegroundColor Gray
Write-Host "Project Memory: D:\AIK-VdGeneration\MEMORY.md" -ForegroundColor Gray
