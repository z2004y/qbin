@echo off
rem ============================================
rem  QBin 启动脚本 (Deno + PostgreSQL)
rem  使用代理下载依赖，然后后台运行服务
rem ============================================
setlocal
cd /d "%~dp0"

set DENO=C:\Users\Ziyi Zhang\.deno\bin\deno.exe
set HTTP_PROXY=http://127.0.0.1:7890
set HTTPS_PROXY=http://127.0.0.1:7890

echo [1/2] 下载/校验依赖...
"%DENO%" cache -NER --unstable-kv --unstable-broadcast-channel index.ts
if errorlevel 1 ( echo 依赖下载失败 & pause & exit /b 1 )

echo [2/2] 启动 QBin (端口 8000)...
start "QBin Server" "%DENO%" run -NER --allow-ffi --allow-sys --unstable-kv --unstable-broadcast-channel index.ts

echo 已启动。访问 http://localhost:8000
echo 管理员: 见 .env 中的 ADMIN_EMAIL / ADMIN_PASSWORD
pause
