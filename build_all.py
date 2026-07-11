import os
import sys
import subprocess
import shutil
import platform

def run_command(cmd):
    print(f"\n>>> Ejecutando: {cmd}")
    # En Windows shell=True es requerido para comandos npm/npx globales
    use_shell = True
    result = subprocess.run(cmd, shell=use_shell)
    if result.returncode != 0:
        print(f"\n[ERROR] El comando falló con código de salida: {result.returncode}")
        sys.exit(result.returncode)

def clean_path(path):
    if os.path.exists(path):
        print(f"Limpiando: {path}")
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        except Exception as e:
            print(f"Aviso: No se pudo eliminar {path} ({e})")

def main():
    current_os = platform.system()
    print("=========================================================")
    # Emoji de terminal / computadora
    print(f"   VANTE POS - COMPILADOR UNIFICADO MULTIPLATAFORMA")
    print(f"   Sistema Operativo Detectado: {current_os}")
    print("=========================================================")

    # 1. Limpieza profunda
    print("\n[Paso 1] Limpiando compilaciones previas...")
    clean_paths = [
        "apps/pos-desktop/dist",
        "apps/pos-desktop/dist-electron",
        "apps/api/dist",
        "build",
        "dist"
    ]
    for p in clean_paths:
        clean_path(p)

    # Eliminar archivos .spec de PyInstaller
    for file in os.listdir("."):
        if file.endswith(".spec"):
            clean_path(file)

    # 2. Instalación de dependencias
    print("\n[Paso 2] Instalando módulos y dependencias...")
    run_command("npm install")

    # 3. Compilar API
    print("\n[Paso 3] Compilando backend local de base de datos...")
    run_command("npm run build --workspace=@punto-de-venta/api")

    # 4. Compilar POS Desktop & Licencias
    print("\n[Paso 4] Iniciando empaquetado nativo...")
    if current_os == "Darwin":  # macOS
        # Compilar macOS (.dmg)
        print("\n>>> Generando instaladores de macOS (.dmg)...")
        run_command("npm run electron:build:server --workspace=@punto-de-venta/pos-desktop")
        run_command("npm run electron:build:client --workspace=@punto-de-venta/pos-desktop")

        # Compilar Windows (.exe) desde macOS
        print("\n>>> Generando instaladores de Windows (.exe)...")
        run_command("npm run electron:build:server --workspace=@punto-de-venta/pos-desktop -- --win")
        run_command("npm run electron:build:client --workspace=@punto-de-venta/pos-desktop -- --win")

        # Compilar generador de licencias para macOS & Windows
        print("\n>>> Generando aplicación gráfica del Licenciador para macOS y Windows...")
        run_command("npm run build --prefix apps/license-generator")
        run_command("npm run build --prefix apps/license-generator -- --win")

    elif current_os == "Windows":  # Windows
        # Compilar Windows (.exe)
        print("\n>>> Generando instaladores de Windows (.exe)...")
        run_command("npm run electron:build:server --workspace=@punto-de-venta/pos-desktop")
        run_command("npm run electron:build:client --workspace=@punto-de-venta/pos-desktop")

        # Compilar generador de licencias para Windows
        print("\n>>> Generando aplicación gráfica del Licenciador para Windows (.exe)...")
        run_command("npm run build --prefix apps/license-generator")
        
    else:
        print(f"\n[ERROR] Sistema operativo no soportado para compilación directa: {current_os}")
        sys.exit(1)

    print("\n=========================================================")
    print("   ¡COMPILACIÓN COMPLETADA EXITOSAMENTE!")
    print("=========================================================")
    if current_os == "Darwin":
        print("   Los instaladores generados se encuentran en:")
        print("   - apps/pos-desktop/dist-electron/ (POS Server & Client macOS/Win)")
        print("   - apps/license-generator/dist/ (Licenciador macOS/Win)")
    else:
        print("   Los instaladores generados se encuentran en:")
        print("   - apps\\pos-desktop\\dist-electron\\ (POS Server & Client Windows)")
        print("   - apps\\license-generator\\dist\\ (Licenciador Windows)")
    print("=========================================================")

if __name__ == "__main__":
    main()
