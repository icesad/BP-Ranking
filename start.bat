@echo off
chcp 65001 >nul
title Demo-Ranking
cd /d "D:\BP-Ranking"
echo ============================================
echo   Demo-Ranking 启动中...
echo ============================================
if not exist node_modules (
  echo 首次运行，正在安装依赖，请稍候...
  call npm install
)
start "" cmd /c "ping -n 9 127.0.0.1 >nul & start http://localhost:3100"
echo 服务器启动中，约 8 秒后自动打开浏览器。
echo 保持此窗口打开 = 服务器运行中；停止请按 Ctrl + C。
echo.
call npm run dev
echo.
echo 服务器已停止，按任意键关闭。
pause >nul
