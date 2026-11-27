@echo off
chcp 65001 >nul
cd /d "%~dp0admin"
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/zh-cn
  pause
  exit /b 1
)
if not exist node_modules (
  echo 首次运行，正在安装后台依赖（使用国内镜像）...
  call npm install --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络。
    pause
    exit /b 1
  )
)
echo.
echo 管理台地址：http://localhost:5173
echo 关闭此窗口即停止后台服务。
echo.
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process 'http://localhost:5173'"
node server.js
pause
