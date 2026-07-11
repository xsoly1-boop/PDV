@echo off
echo =========================================================
echo    INICIANDO COMPILACIÓN COMPLETA DE VANTE POS (WINDOWS)
echo    Generando: Server, Cliente y Generador de Licencias
echo =========================================================

:: 1. Limpieza de compilaciones anteriores
echo 1. Limpiando directorios temporales y compilaciones previas...
if exist apps\pos-desktop\dist rmdir /s /q apps\pos-desktop\dist
if exist apps\pos-desktop\dist-electron rmdir /s /q apps\pos-desktop\dist-electron
if exist apps\api\dist rmdir /s /q apps\api\dist
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist
if exist *.spec del /q *.spec

:: 2. Instalación limpia de dependencias
echo 2. Validando dependencias de Node.js...
call npm install

:: 3. Compilar Backend API Local
echo 3. Generando compilación de la API de base de datos...
call npm run build --workspace=@punto-de-venta/api

:: 4. Generar compilados para Windows (POS Server / Client)
echo 4. Compilando instalador de Servidor (.exe)...
call npm run electron:build:server --workspace=@punto-de-venta/pos-desktop
echo 5. Compilando instalador de Cliente (.exe)...
call npm run electron:build:client --workspace=@punto-de-venta/pos-desktop

:: 5. Generar compilado del Generador de Licencias
echo 6. Compilando Generador de Licencias (.exe)...
call npm run build --prefix apps/license-generator

echo =========================================================
echo    PROCESO COMPLETADO EXITOSAMENTE
echo    Los archivos listos para distribución se encuentran en:
echo    
echo    Instaladores POS (Server / Client) Windows:
echo    - apps\pos-desktop\dist-electron\
echo    
echo    Generador de Licencias Windows (.exe):
echo    - apps\license-generator\dist\
echo =========================================================
pause
