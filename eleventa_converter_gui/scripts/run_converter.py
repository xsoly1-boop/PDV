#!/usr/bin/env python3
import os
import sys
from pathlib import Path
import shutil
import json
from decimal import Decimal
import datetime

# Change directory so ICU version 54 resolves relative to resources/plugins
try:
    os.chdir('/Library/Frameworks/Firebird.framework/Versions/A/Resources')
except Exception as e:
    pass

try:
    import fdb
    fdb.load_api('/Library/Frameworks/Firebird.framework/Versions/A/Libraries/libfbclient.dylib')
except Exception as e:
    print(f"Error loading Firebird 2.5 client library: {e}", file=sys.stderr)
    sys.exit(1)

def serialize_val(val):
    if val is None:
        return None
    if isinstance(val, (int, float, str)):
        return val
    if isinstance(val, bytes):
        return val.hex()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return val.isoformat()
    return str(val)

def map_row(row_dict, mapping):
    res = {}
    for key, possibilities in mapping.items():
        val = None
        for p in possibilities:
            if p in row_dict:
                val = row_dict[p]
                break
        res[key] = val
    return res

def export_fdb_to_json(fdb_path, out_path):
    temp_fdb = "/tmp/eleventa_temp.fdb"
    copied = False
    try:
        # Copy to /tmp/ to bypass macOS permissions/sandbox issues (since firebird server runs as 'firebird' user)
        if os.path.exists(temp_fdb):
            try:
                os.remove(temp_fdb)
            except:
                pass
        shutil.copy2(fdb_path, temp_fdb)
        os.chmod(temp_fdb, 0o777)
        copied = True
        
        conn = fdb.connect(database=temp_fdb, user='sysdba', password='masterkey', charset='UTF8')
        cur = conn.cursor()
        
        # Mappings for fields (checks case-insensitively using upper-case keys)
        product_mapping = {
            "sku": ["CODIGO"],
            "nombre": ["DESCRIPCION"],
            "costo": ["PRECIO_COSTO", "PCOSTO"],
            "precio": ["PRECIO_VENTA", "PVENTA", "PFINAL"],
            "stock": ["INVENTARIO", "DINVENTARIO"],
            "categoria": ["DEPARTAMENTO_ID", "DEPT"],
            "proveedor_id": ["PROVEEDOR_ID", "PROVID"]
        }

        client_mapping = {
            "cliente_id": ["ID", "NUMERO"],
            "nombre": ["NOMBRE"],
            "saldo_deudor": ["SALDO", "DSALDOACTUAL"],
            "limite_credito": ["LIMITE_CREDITO"]
        }
        
        # 1. Map Products
        productos_list = []
        try:
            cur.execute('SELECT * FROM PRODUCTOS')
            cols = [desc[0].upper() for desc in cur.description]
            for row in cur.fetchall():
                row_dict = dict(zip(cols, row))
                mapped = map_row(row_dict, product_mapping)
                
                sku = str(mapped["sku"]).strip() if mapped["sku"] is not None else ""
                nombre = str(mapped["nombre"]).strip() if mapped["nombre"] is not None else ""
                costo = float(mapped["costo"]) if mapped["costo"] is not None else 0.0
                precio = float(mapped["precio"]) if mapped["precio"] is not None else 0.0
                stock = float(mapped["stock"]) if mapped["stock"] is not None else 0.0
                categoria = str(mapped["categoria"]).strip() if mapped["categoria"] is not None else "General"
                prov_id = str(mapped["proveedor_id"]).strip() if mapped["proveedor_id"] is not None else ""
                
                productos_list.append({
                    "id": sku,
                    "sku": sku,
                    "nombre": nombre,
                    "costo": costo,
                    "precio": precio,
                    "stock": stock,
                    "categoria": categoria,
                    "proveedor_id": prov_id,
                    "permiteFracciones": "." in str(stock) or stock % 1 != 0
                })
        except Exception as pe:
            print(f"Error reading PRODUCTOS: {pe}", file=sys.stderr)
            
        # 2. Map Clients (Version-independent fallback with billing details)
        clientes_list = []
        try:
            # Try CLIENTESV2, CLIENTESV2_CREDITO & CLIENTESV2_FACTURACION first (newer Eleventa versions)
            cur.execute("""
                SELECT 
                    c.ID, 
                    TRIM(c.NOMBRES), 
                    TRIM(c.APELLIDOS), 
                    TRIM(c.TELEFONO), 
                    cr.SALDO_ACTUAL, 
                    cr.LIMITE_CREDITO,
                    TRIM(f.RFC),
                    TRIM(f.NOMBRE),
                    TRIM(f.REGIMENES),
                    TRIM(f.CODIGOPOSTAL),
                    TRIM(f.CALLE)
                FROM CLIENTESV2 c
                JOIN CLIENTESV2_CREDITO cr ON c.ID = cr.CLIENTESV2_ID
                LEFT JOIN CLIENTESV2_FACTURACION f ON c.ID = f.CLIENTESV2_ID
                WHERE cr.SALDO_ACTUAL > 0
            """)
            for row in cur.fetchall():
                cid = str(row[0]).strip()
                nombres = str(row[1]).strip() if row[1] else ""
                apellidos = str(row[2]).strip() if row[2] else ""
                nombre_completo = f"{nombres} {apellidos}".strip()
                telefono = str(row[3]).strip() if row[3] else ""
                saldo = float(row[4]) if row[4] is not None else 0.0
                limite = float(row[5]) if row[5] is not None else 0.0
                rfc = str(row[6]).strip() if row[6] else None
                razon_social = str(row[7]).strip() if row[7] else None
                regimen = str(row[8]).strip() if row[8] else None
                cp = str(row[9]).strip() if row[9] else None
                calle = str(row[10]).strip() if row[10] else None
                
                clientes_list.append({
                    "cliente_id": cid,
                    "nombre": nombre_completo,
                    "telefono": telefono,
                    "saldo_deudor": saldo,
                    "limite_credito": limite,
                    "rfc": rfc,
                    "razon_social": razon_social,
                    "regimen_fiscal": regimen,
                    "codigo_postal": cp,
                    "direccion_fiscal": calle
                })
            print(f"Successfully loaded {len(clientes_list)} clients from CLIENTESV2 with billing details.")
        except Exception as e2:
            print(f"CLIENTESV2 query failed, falling back to legacy CLIENTES table. Error: {e2}", file=sys.stderr)
            # Legacy CLIENTES fallback (older Eleventa versions)
            try:
                cur.execute('SELECT * FROM CLIENTES')
                cols = [desc[0].upper() for desc in cur.description]
                for row in cur.fetchall():
                    row_dict = dict(zip(cols, row))
                    mapped = map_row(row_dict, client_mapping)
                    
                    cid = str(mapped["cliente_id"]).strip() if mapped["cliente_id"] is not None else ""
                    nombre = str(mapped["nombre"]).strip() if mapped["nombre"] is not None else ""
                    saldo = float(mapped["saldo_deudor"]) if mapped["saldo_deudor"] is not None else 0.0
                    limite = float(mapped["limite_credito"]) if mapped["limite_credito"] is not None else 0.0
                    
                    if saldo > 0:
                        clientes_list.append({
                            "cliente_id": cid,
                            "nombre": nombre,
                            "telefono": "",
                            "saldo_deudor": saldo,
                            "limite_credito": limite,
                            "rfc": None,
                            "razon_social": None,
                            "regimen_fiscal": None,
                            "codigo_postal": None,
                            "direccion_fiscal": None
                        })
                print(f"Successfully loaded {len(clientes_list)} clients from legacy CLIENTES.")
            except Exception as ce:
                print(f"Error reading legacy CLIENTES: {ce}", file=sys.stderr)
            
        # 3. Map Departments (Categories)
        categorias_list = []
        try:
            cur.execute('SELECT ID, TRIM(NOMBRE) FROM DEPARTAMENTOS')
            for row in cur.fetchall():
                cat_id = str(row[0]).strip()
                nombre = str(row[1]).strip() if row[1] else ""
                if nombre:
                    categorias_list.append({
                        "id": cat_id,
                        "nombre": nombre
                    })
            print(f"Successfully loaded {len(categorias_list)} departments from DEPARTAMENTOS.")
        except Exception as de:
            print(f"Error reading DEPARTAMENTOS: {de}", file=sys.stderr)

        # 4. Map Suppliers (Proveedores)
        proveedores_list = []
        try:
            cur.execute('SELECT ID, TRIM(NOMBRE), TRIM(REPRESENTANTE), TRIM(TELEFONOS), TRIM(CORREOS), TRIM(PAGINA_WEB), TRIM(NOTAS) FROM PROVEEDORES WHERE BORRADO_EN IS NULL')
            for row in cur.fetchall():
                prov_id = str(row[0]).strip()
                nombre = str(row[1]).strip() if row[1] else ""
                rep = str(row[2]).strip() if row[2] else None
                tel = str(row[3]).strip() if row[3] else None
                email = str(row[4]).strip() if row[4] else None
                web = str(row[5]).strip() if row[5] else None
                notas = str(row[6]).strip() if row[6] else None
                
                if nombre:
                    proveedores_list.append({
                        "id": prov_id,
                        "nombre": nombre,
                        "representante": rep,
                        "telefonos": tel,
                        "correos": email,
                        "pagina_web": web,
                        "notas": notas
                    })
            print(f"Successfully loaded {len(proveedores_list)} suppliers from PROVEEDORES.")
        except Exception as pre:
            print(f"Error reading PROVEEDORES: {pre}", file=sys.stderr)

        cur.close()
        conn.close()
        
        # Output structure required by AdminDashboard.tsx
        data_final = {
            "productos": productos_list,
            "clientes": clientes_list,
            "clientes_deudores": clientes_list,
            "categorias": categorias_list,
            "proveedores": proveedores_list
        }
        
        # Ensure the output directory exists
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(out_path, "w", encoding="utf-8") as fp:
            json.dump(data_final, fp, ensure_ascii=False, indent=2)
            
        print(f"✅ Conversion complete. JSON written to {out_path}")
        return True
    except Exception as e:
        print(f"Error converting database: {e}", file=sys.stderr)
        return False
    finally:
        if copied and os.path.exists(temp_fdb):
            try:
                os.remove(temp_fdb)
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python run_converter.py <fdb_path> <out_path>", file=sys.stderr)
        sys.exit(1)
        
    fdb_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    
    if not fdb_path.exists():
        print(f"Error: FDB file not found at {fdb_path}", file=sys.stderr)
        sys.exit(1)
        
    success = export_fdb_to_json(fdb_path, out_path)
    if not success:
        sys.exit(1)
