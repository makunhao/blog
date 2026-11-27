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
echo.
echo 正在推送到 GitHub...
echo.
git push origin main
if errorlevel 1 (
  echo.
  echo ============================================================
  echo [失败] 推送没有成功，上面的红字就是原因。
  echo 常见情况：
  echo   1) 连不上 github.com：检查网络 / 代理
  echo   2) Authentication failed：重新登录 GitHub 凭据
  echo   3) rejected / fetch first：先在命令行执行 git pull --rebase origin main
  echo ============================================================
  pause
  exit /b 1
)

echo.
echo ============================================================
echo [成功] 已推送到 GitHub，Cloudflare 会在 1-2 分钟内自动构建。
echo 去 Cloudflare：计算 - Workers 和 Pages - blog - 部署，看最新构建状态。
echo ============================================================
pause
