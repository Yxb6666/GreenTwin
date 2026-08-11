@echo off
setlocal
set "PATH=C:\Users\wen\Developer\node-v24.19.0-win-x64;%PATH%"
cd /d "C:\Users\wen\Desktop\GreenTwin"

echo GreenTwin Node.js version:
node -v
if errorlevel 1 goto :error

echo GreenTwin npm version:
call npm.cmd -v
if errorlevel 1 goto :error

call npm.cmd run dev
if errorlevel 1 goto :error
goto :end

:error
echo.
echo GreenTwin failed to start. See the error above.
pause

:end
endlocal
