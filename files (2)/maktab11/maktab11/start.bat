@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules call npm install
set /p ADMIN_PASSWORD=Admin parolini kiriting: 
if not exist .secret powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')" > .secret
set /p SECRET=<.secret
start "" http://localhost:3000
node server.js
pause
