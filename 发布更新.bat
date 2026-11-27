@echo off
chcp 65001 >nul
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
  echo [错误] 未安装 Git，请先安装：https://git-scm.com/download/win
  pause
  exit /b 1
)
git add -A
git commit -m "更新文章 %date% %time%"
git push
echo.
echo 推送完成，Cloudflare Pages 会在 1-2 分钟内自动构建部署。
pause
