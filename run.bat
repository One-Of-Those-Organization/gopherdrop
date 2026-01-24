@echo off
echo [INFO] Mematikan server lama (jika ada)...
taskkill /IM gopherdrop.exe /F >nul 2>&1

echo [INFO] Building gopherdrop...
go build -o gopherdrop.exe .

IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build Gagal! Cek kodinganmu.
    exit /b %ERRORLEVEL%
)

echo [INFO] Server berjalan...
gopherdrop.exe