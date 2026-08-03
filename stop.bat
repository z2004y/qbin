@echo off
rem 停止 QBin (kill 所有名为 deno.exe 的进程 —— 仅在本机无其他重要 deno 进程时使用)
echo 正在停止 QBin (deno.exe)...
taskkill /F /IM deno.exe >nul 2>&1
echo 已停止。
pause
