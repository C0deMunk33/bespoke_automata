@echo off

echo Installing Node.js and npm....
REM Download and install Node.js LTS version 
msiexec /i https://nodejs.org/dist/v14.17.0/node-v14.17.0-x64.msi /quiet /qn /norestart

echo Installing Electron-forge and Yarn...
npm install -g electron-forge yarn

echo Installing Python...
REM Download and install Python 3.12.0 
msiexec /i https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe /quiet /qn /norestart

echo Creating and activating Python virtual environment...
python -m venv bespoke_env
.\bespoke_env\Scripts\Activate

echo Installing Python packages...
pip install towhee pymilvus==2.2.11 pandas numpy transformers torch

echo Installation completed successfully.

REM Check if Git is installed
where git > nul 2>&1
if %errorlevel% neq 0 (
    echo Git is not installed. Installing Git...
    REM Download and install Git
    msiexec /i https://github.com/git-for-windows/git/releases/download/v2.37.0.windows.1/Git-2.37.0-64-bit.exe /quiet /qn /norestart

    echo Git installed successfully.
    
    echo Cloning repository...
    git clone https://github.com/C0deMunk33/bespoke_automata
) else (
    echo Git is installed. Cloning repository...
    git clone https://github.com/C0deMunk33/bespoke_automata
)

echo Restarting command prompt...
timeout /t 5 /nobreak >nul
start cmd /k npm run start


REM alternate start method
REM start cmd /k "electron-forge init my-electron-app && cd my-electron-app && yarn install && yarn start"
