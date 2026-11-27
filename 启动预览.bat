@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 LTS 版本：https://nodejs.org/zh-cn
  pause
  exit /b 1
)
if not exist node_modules (
  echo 首次运行，正在安装依赖（使用国内镜像）...
  call npm install --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
echo.
echo 正在启动本地预览，稍后浏览器访问 http://localhost:4000
echo 按 Ctrl+C 可停止服务。
echo.
call npx hexo server
pause
