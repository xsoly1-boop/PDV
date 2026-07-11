import os
import json
import pandas as pd

def migrate_excel_to_json(products_path, clients_path, output_json_path):
    print("Iniciando conversión de reportes SICAR...")
    data = {
        "categorias": [],
        "proveedores": [],
        "clientes": [],
        "productos": [],
        "inventario": [],
        "ventas": []
    }
    
    # 1. Procesar Productos
    if products_path and os.path.exists(products_path):
        print(f"Leyendo catálogo de productos desde {products_path}...")
        try:
            df = pd.read_excel(products_path)
            # Normalizar nombres de columnas de SICAR
            # SICAR suele exportar: 'Clave', 'Descripción', 'Precio Compra', 'Precio Venta', 'Existencia', 'Categoría', 'Unidad Medida'
            for idx, row in df.iterrows():
                sku = str(row.get('Clave', row.get('Código', ''))).strip()
                nombre = str(row.get('Descripción', row.get('Nombre', ''))).strip()
                costo = float(row.get('Precio Compra', row.get('Costo', 0)))
                precio = float(row.get('Precio Venta', row.get('Precio', 0)))
                stock = float(row.get('Existencia', row.get('Stock', 0)))
                categoria = str(row.get('Categoría', 'General')).strip()
                unidad = str(row.get('Unidad Medida', row.get('Unidad', 'pieza'))).strip()
                
                if not sku or sku == 'nan' or not nombre or nombre == 'nan':
                    continue
                
                # Agregar categoría única
                if categoria not in data["categorias"] and categoria != 'nan':
                    data["categorias"].append(categoria)
                
                data["productos"].append({
                    "sku": sku,
                    "nombre": nombre,
                    "costo": costo,
                    "precio": precio,
                    "stock": stock,
                    "categoria": categoria if categoria != 'nan' else 'General',
                    "unidad": unidad if unidad != 'nan' else 'pieza'
                })
                
                # Inventario inicial
                data["inventario"].append({
                    "productoId": sku,
                    "sucursalId": "suc-norte",
                    "cantidad": stock,
                    "tipo": "ENTRADA_AJUSTE",
                    "observacion": "Stock inicial migrado de SICAR"
                })
            print(f"✔ Procesados {len(data['productos'])} productos.")
        except Exception as e:
            print(f"❌ Error procesando productos: {str(e)}")
            
    # 2. Procesar Clientes
    if clients_path and os.path.exists(clients_path):
        print(f"Leyendo clientes desde {clients_path}...")
        try:
            df_cli = pd.read_excel(clients_path)
            # Columnas SICAR comunes: 'Nombre', 'Teléfono', 'Límite Crédito', 'Saldo', 'RFC', 'Razón Social'
            for idx, row in df_cli.iterrows():
                nombre = str(row.get('Nombre', '')).strip()
                telefono = str(row.get('Teléfono', row.get('Celular', '')))
                limite = float(row.get('Límite Crédito', row.get('Límite', 0)))
                saldo = float(row.get('Saldo', row.get('Adeudo', 0)))
                rfc = str(row.get('RFC', '')).strip()
                razon_social = str(row.get('Razón Social', '')).strip()
                
                if not nombre or nombre == 'nan':
                    continue
                
                data["clientes"].append({
                    "nombre": nombre,
                    "telefono": telefono if pd.notna(row.get('Teléfono')) and telefono != 'nan' else "",
                    "limiteCredito": limite,
                    "saldoDeudor": saldo,
                    "rfc": rfc if pd.notna(row.get('RFC')) and rfc != 'nan' else "",
                    "razonSocial": razon_social if pd.notna(row.get('Razón Social')) and razon_social != 'nan' else ""
                })
            print(f"✔ Procesados {len(data['clientes'])} clientes.")
        except Exception as e:
            print(f"❌ Error procesando clientes: {str(e)}")

    # Escribir archivo de salida
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"✔ Archivo de migración unificado creado exitosamente en: {output_json_path}")
    print("Puedes cargar este archivo JSON directamente desde el panel de migración en la app.")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Uso: python sicar_to_vante.py <ruta_productos.xlsx> <ruta_clientes.xlsx> <salida.json>")
    else:
        migrate_excel_to_json(sys.argv[1], sys.argv[2], sys.argv[3])
