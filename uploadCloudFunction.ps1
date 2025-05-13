# PowerShell脚本：上传云函数
Write-Host "开始上传云函数..." -ForegroundColor Green

$cloudFunctions = @("generateScript", "manageUsers", "manageProjects", "getUser", "login")

foreach ($funcName in $cloudFunctions) {
    $funcPath = ".\cloudfunctions\$funcName"
    
    if (Test-Path $funcPath) {
        Write-Host "正在上传云函数: $funcName..." -ForegroundColor Yellow
        
        # 切换到云函数目录
        Set-Location $funcPath
        
        # 安装依赖
        Write-Host "安装依赖..." -ForegroundColor Cyan
        npm install
        
        # 返回主目录
        Set-Location ..\..\
    } else {
        Write-Host "云函数 $funcName 不存在，跳过" -ForegroundColor Red
    }
}

Write-Host "云函数上传完成!" -ForegroundColor Green 