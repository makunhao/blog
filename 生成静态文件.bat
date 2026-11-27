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
)
call npx hexo generate
echo.
echo 已生成静态文件到 public 目录。
pause
