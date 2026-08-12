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

call npm.cmd ci --registry=https://registry.npmjs.org/ --replace-registry-host=always
if errorlevel 1 goto :error

echo.
echo GreenTwin dependencies installed successfully.
pause
goto :end

:error
echo.
echo GreenTwin dependency installation failed. See the error above.
pause

:end
endlocal
