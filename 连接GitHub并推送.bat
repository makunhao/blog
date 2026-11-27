@echo off
chcp 65001 >nul
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Git，请先安装：https://git-scm.com/download/win
  pause
  exit /b 1
)

echo ============================================================
echo  第一步：请先在浏览器打开 https://github.com/new
echo  仓库名称填 blog，不要勾选 README / .gitignore / License
echo  创建完成后回到这里继续
echo ============================================================
echo.
set /p GHUSER=请输入你的 GitHub 用户名（不是邮箱）:
if "%GHUSER%"=="" (
  echo [错误] 用户名不能为空。
  pause
  exit /b 1
)

git remote remove origin >nul 2>nul
git remote add origin https://github.com/%GHUSER%/blog.git
echo.
echo 正在推送到 https://github.com/%GHUSER%/blog.git
echo 首次推送会弹出浏览器，请登录 GitHub 并授权。
echo.
git push -u origin main
if errorlevel 1 (
  echo.
  echo [失败] 请检查：1) 仓库是否已创建 2) 用户名是否拼错 3) 能否访问 github.com
  echo 如需重试，关掉窗口重新双击本脚本即可。
  pause
  exit /b 1
)
echo.
echo ============================================================
echo  推送成功！仓库地址：https://github.com/%GHUSER%/blog
echo  下一步：打开 https://dash.cloudflare.com 连接该仓库
echo ============================================================
pause
