@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ================================================
echo   BP-Ranking 修复索引 + 拆分 Claudies 独立仓库
echo ================================================
echo 当前目录: %CD%
echo.

REM ---------- 第 1 步：修复损坏的 git 索引（无损，文件不会丢） ----------
echo [1/3] 修复 git 索引...
if exist ".git\index.lock" del /q ".git\index.lock"
if exist ".git\index" del /q ".git\index"
git reset
if errorlevel 1 goto :err
echo       索引已重建，工作区改动原样保留。
echo.

REM ---------- 第 2 步：提交 6-19 新功能 + 把 Claudies 移出本仓库 ----------
echo [2/3] 提交新功能，并把 Claudies 移出本仓库...
git config user.name "icesad"
git config user.email "icesad6@163.com"
git rm -r --cached Claudies-Windows >nul 2>&1
git add -A
if errorlevel 1 goto :err
git commit -m "feat: 2026-06-19 OPC社区地图/活动/搭子等; 拆出 Claudies 为独立仓库"
echo.

REM ---------- 第 3 步：Claudies 单独建成独立仓库 ----------
echo [3/3] 初始化 Claudies 独立仓库...
cd /d "%~dp0Claudies-Windows"
if exist ".git" (
  echo       Claudies 已是 git 仓库，跳过 init。
) else (
  git init -b main
  if errorlevel 1 goto :err
)
git config user.name "icesad"
git config user.email "icesad6@163.com"
git add -A
git commit -m "init: Claudies for Windows"
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/icesad/Claudies-Windows.git
  echo       已设置 origin = https://github.com/icesad/Claudies-Windows.git
) else (
  echo       origin 已存在，跳过。
)
cd /d "%~dp0"
echo.

echo ================================================
echo   本地已就绪！剩下两步需要你手动做：
echo.
echo   1^) 在 GitHub 网页建两个 Public 空仓库（别勾 README/.gitignore）：
echo        icesad/BP-Ranking    和    icesad/Claudies-Windows
echo.
echo   2^) 开代理/VPN 后推送：
echo        git config --global http.proxy http://127.0.0.1:你的端口
echo        cd /d D:\BP-Ranking ^&^& git push -u origin main
echo        cd /d D:\BP-Ranking\Claudies-Windows ^&^& git push -u origin main
echo.
echo   表单里填：
echo        https://github.com/icesad/BP-Ranking
echo        https://github.com/icesad/Claudies-Windows
echo ================================================
echo.
pause
exit /b 0

:err
echo.
echo *** 出错了，请把上面这段报错截图发给我，我帮你看。***
pause
exit /b 1
