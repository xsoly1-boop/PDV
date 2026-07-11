#!/bin/bash
# Evitar que el script falle silenciosamente en caso de error
set -e

echo "========================================================="
echo "   INICIANDO COMPILACIÓN COMPLETA DE VANTE POS"
echo "   Generando: Server, Cliente y Generador de Licencias"
echo "========================================================="

# 1. Limpieza profunda
echo "1. Limpiando directorios temporales y compilaciones previas..."
rm -rf apps/pos-desktop/dist
rm -rf apps/pos-desktop/dist-electron
rm -rf apps/api/dist
rm -rf build
rm -rf dist
rm -f *.spec

# 2. Dependencias de Node.js y compilar backend
echo "2. Validando dependencias e instalando módulos..."
npm install

echo "3. Generando compilación de la API de base de datos local..."
npm run build --workspace=@punto-de-venta/api

# 3. Compilación de instaladores principales
echo "4. Compilando instaladores nativos de macOS (.dmg)..."
npm run electron:build:server --workspace=@punto-de-venta/pos-desktop
npm run electron:build:client --workspace=@punto-de-venta/pos-desktop

echo "5. Compilando instaladores nativos de Windows (.exe) desde macOS..."
npm run electron:build:server --workspace=@punto-de-venta/pos-desktop -- --win
npm run electron:build:client --workspace=@punto-de-venta/pos-desktop -- --win

# 4. Compilación del Generador de Licencias
echo "6. Compilando Generador de Licencias Gráfico para macOS y Windows..."
npm run build --prefix apps/license-generator
npm run build --prefix apps/license-generator -- --win

echo "========================================================="
echo "   PROCESO COMPLETADO EXITOSAMENTE"
echo "   Los archivos listos para distribución se encuentran en:"
echo ""
echo "   Instaladores POS (Server / Client) macOS y Windows:"
echo "   -> apps/pos-desktop/dist-electron/"
echo ""
echo "   Generador de Licencias Gráfico macOS & Windows:"
echo "   -> apps/license-generator/dist/"
echo "========================================================="
