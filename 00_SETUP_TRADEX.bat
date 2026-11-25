@echo off
setlocal enabledelayedexpansion
title TradeX One-Click Setup
cd /d "%~dp0"
set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

echo ==================================================
echo           TradeX - One-Click Setup
echo ==================================================
echo Project folder: "%APP_DIR%"
echo.

:: 1. Check Python 3
echo [1/5] Checking Python 3...
set "PY_CMD="
python --version >nul 2>&1
if %errorlevel%==0 (
    set "PY_CMD=python"
) else (
    py -3 --version >nul 2>&1
    if %errorlevel%==0 set "PY_CMD=py -3"
)

if "%PY_CMD%"=="" (
    echo [!] Python 3 not found. Attempting auto-install via winget...
    winget --version >nul 2>&1
    if %errorlevel%==0 (
        winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
        echo.
        echo Python installed! Please close this window and run setup.bat again.
        pause
        exit /b 1
    ) else (
        echo [ERROR] Python 3 is required. Opening https://www.python.org/downloads/
        start "" "https://www.python.org/downloads/"
        pause
        exit /b 1
    )
)
for /f "tokens=*" %%v in ('%PY_CMD% --version 2^>^&1') do echo     [OK] %%v

:: 2. Create virtual environment
echo.
echo [2/5] Checking virtual environment (.venv)...
if not exist ".venv\Scripts\python.exe" (
    echo     Creating .venv...
    %PY_CMD% -m venv .venv
    if not exist ".venv\Scripts\python.exe" (
        echo     [FAIL] Could not create .venv
        pause
        exit /b 1
    )
)
echo     [OK] .venv ready

:: 3. Install requirements
echo.
echo [3/5] Installing required packages from requirements.txt...
".venv\Scripts\python.exe" -m pip install --upgrade pip >nul 2>&1
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo     [FAIL] pip install failed. Check your internet connection.
    pause
    exit /b 1
)

:: 4. Checklist verification of all packages
echo.
echo [4/5] Verifying installed packages checklist...
".venv\Scripts\python.exe" -c "import pathlib, importlib; reqs=[l.strip().split('==')[0].split('>=')[0].split('<=')[0].split('[')[0].strip() for l in pathlib.Path('requirements.txt').read_text().splitlines() if l.strip() and not l.strip().startswith('#')]; ok=True; [print(f'    [OK] {r}') if (importlib.import_module(r.replace('-','_')) or True) else None for r in reqs]"
if %errorlevel% neq 0 (
    echo     [FAIL] One or more packages failed to import.
    pause
    exit /b 1
)

:: 5. Create Desktop TradeX.bat launcher
echo.
echo [5/5] Creating TradeX.bat shortcut on Desktop...
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do set "DESKTOP_DIR=%%D"
set "SHORTCUT=%DESKTOP_DIR%\TradeX.bat"

(
echo @echo off
echo title TradeX Launcher
echo cd /d "%APP_DIR%"
echo.
echo netstat -ano ^| findstr ":8770 " ^| findstr "LISTENING" ^>nul 2^>^&1
echo if %%errorlevel%%==0 ^(
echo     start "" "http://localhost:8770/hub.html"
echo     exit /b 0
echo ^)
echo.
echo start "TradeX Server" /min "%APP_DIR%\.venv\Scripts\python.exe" hub\server.py
echo.
echo set /a tries=0
echo :wait_loop
echo timeout /t 1 /nobreak ^>nul
echo netstat -ano ^| findstr ":8770 " ^| findstr "LISTENING" ^>nul 2^>^&1
echo if %%errorlevel%%==0 goto open_browser
echo set /a tries+=1
echo if %%tries%% lss 15 goto wait_loop
echo.
echo :open_browser
echo start "" "http://localhost:8770/hub.html"
echo exit /b 0
) > "%SHORTCUT%"

if exist "%SHORTCUT%" (
    echo     [OK] Created "%SHORTCUT%"
) else (
    echo     [FAIL] Could not create Desktop shortcut
)

echo.
echo ==================================================
echo   Setup Complete! Starting TradeX...
echo ==================================================
netstat -ano | findstr ":8770 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    start "TradeX Server" /min "%APP_DIR%\.venv\Scripts\python.exe" hub\server.py
    set /a stries=0
    :boot_wait
    timeout /t 1 /nobreak >nul
    netstat -ano | findstr ":8770 " | findstr "LISTENING" >nul 2>&1
    if %errorlevel%==0 goto boot_done
    set /a stries+=1
    if %stries% lss 15 goto boot_wait
)
:boot_done
start "" "http://localhost:8770/hub.html"
echo Website opened: http://localhost:8770/hub.html
timeout /t 3 /nobreak >nul
exit /b 0
