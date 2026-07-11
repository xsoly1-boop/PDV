#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Conversor Completo Eleventa → Apex POS
Extrae TODOS los datos necesarios para migración:
  - Productos (catálogo)
  - Clientes (con datos fiscales SAT)
  - Categorías (departamentos)
  - Proveedores
  - Ventas históricas + artículos
  - Inventario (stock real)
"""
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
        
        # Pre-cargar mapeos de departamentos y proveedores para vincular por nombre
        cat_map = {}
        try:
            cur.execute('SELECT ID, TRIM(NOMBRE) FROM DEPARTAMENTOS')
            for row in cur.fetchall():
                cat_map[str(row[0]).strip()] = str(row[1]).strip()
        except Exception:
            pass

        prov_map = {}
        try:
            cur.execute('SELECT ID, TRIM(NOMBRE) FROM PROVEEDORES')
            for row in cur.fetchall():
                prov_map[str(row[0]).strip()] = str(row[1]).strip()
        except Exception:
            pass

        # ══════════════════════════════════════════
        # 1. PRODUCTOS
        # ══════════════════════════════════════════
        print("[1/6] Extrayendo productos...")
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
                categoria_id = str(mapped["categoria"]).strip() if mapped["categoria"] is not None else ""
                prov_id = str(mapped["proveedor_id"]).strip() if mapped["proveedor_id"] is not None else ""
                
                categoria_nombre = cat_map.get(categoria_id, "General")
                proveedor_nombre = prov_map.get(prov_id, None)
                
                productos_list.append({
                    "id": sku,
                    "sku": sku,
                    "nombre": nombre,
                    "costo": costo,
                    "precio": precio,
                    "stock": stock,
                    "categoria": categoria_nombre,
                    "proveedor_id": prov_id,
                    "proveedor_nombre": proveedor_nombre,
                    "permiteFracciones": "." in str(stock) or stock % 1 != 0
                })
            print(f"   ✔ {len(productos_list)} productos extraídos")
        except Exception as pe:
            print(f"   ✘ Error leyendo PRODUCTOS: {pe}", file=sys.stderr)
            
        # ══════════════════════════════════════════
        # 2. CLIENTES
        # ══════════════════════════════════════════
        print("[2/6] Extrayendo clientes...")
        clientes_list = []
        client_map = {}  # ID -> nombre (para vincular ventas)
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
            """)
            for row in cur.fetchall():
                cid = row[0]
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
                
                if nombre_completo:
                    client_map[cid] = nombre_completo
                
                clientes_list.append({
                    "cliente_id": str(cid),
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
            print(f"   ✔ {len(clientes_list)} clientes extraídos (CLIENTESV2)")
        except Exception as e2:
            print(f"   ⚠ CLIENTESV2 no disponible, usando tabla CLIENTES legacy...", file=sys.stderr)
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
                    
                    clientes_list.append({
                        "cliente_id": cid,
                        "nombre": nombre,
                        "telefono": "",
                        "saldo_deudor": saldo,
                        "limite_credito": limite,
                        "rfc": None, "razon_social": None, "regimen_fiscal": None,
                        "codigo_postal": None, "direccion_fiscal": None
                    })
                print(f"   ✔ {len(clientes_list)} clientes extraídos (legacy)")
            except Exception as ce:
                print(f"   ✘ Error leyendo CLIENTES: {ce}", file=sys.stderr)
            
        # ══════════════════════════════════════════
        # 3. CATEGORÍAS (Departamentos)
        # ══════════════════════════════════════════
        print("[3/6] Extrayendo categorías...")
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
            print(f"   ✔ {len(categorias_list)} categorías extraídas")
        except Exception as de:
            print(f"   ✘ Error leyendo DEPARTAMENTOS: {de}", file=sys.stderr)

        # ══════════════════════════════════════════
        # 4. PROVEEDORES
        # ══════════════════════════════════════════
        print("[4/6] Extrayendo proveedores...")
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
            print(f"   ✔ {len(proveedores_list)} proveedores extraídos")
        except Exception as pre:
            print(f"   ✘ Error leyendo PROVEEDORES: {pre}", file=sys.stderr)

        # ══════════════════════════════════════════
        # 5. VENTAS HISTÓRICAS + ARTÍCULOS
        # ══════════════════════════════════════════
        print("[5/6] Extrayendo ventas históricas...")
        ventas_list = []
        try:
            cur.execute("""
                SELECT ID, FOLIO, CREADO_EN, SUBTOTAL, IMPUESTOS, TOTAL, GANANCIA, CLIENTESV2_ID, FORMA_PAGO
                FROM VENTATICKETS
                WHERE ESTA_CANCELADO = 'f' AND ACTIVO = 't'
                ORDER BY ID ASC
            """)
            cols = [desc[0].upper() for desc in cur.description]
            ticket_rows = cur.fetchall()
            
            ticket_id_set = set()
            for row in ticket_rows:
                r = dict(zip(cols, row))
                tid = r["ID"]
                ticket_id_set.add(tid)
                
                client_name = client_map.get(r.get("CLIENTESV2_ID"), None)
                
                ventas_list.append({
                    "id": f"elev_t_{tid}",
                    "folio": f"ELEV-{r['FOLIO'] or tid}-{tid}",
                    "total": float(r["TOTAL"]) if r["TOTAL"] else 0,
                    "subtotal": float(r["SUBTOTAL"]) if r["SUBTOTAL"] else 0,
                    "descuento": 0.0,
                    "creadoAt": r["CREADO_EN"].isoformat() if isinstance(r["CREADO_EN"], datetime.datetime) else serialize_val(r["CREADO_EN"]),
                    "clienteNombre": client_name,
                    "detalles": []
                })
            
            print(f"   ✔ {len(ventas_list)} tickets de venta extraídos")
            
            # Now fetch line items
            print("   → Extrayendo artículos de tickets...")
            cur.execute("""
                SELECT TICKET_ID, PRODUCTO_CODIGO, CANTIDAD, PRECIO_USADO, TOTAL_ARTICULO
                FROM VENTATICKETS_ARTICULOS
                WHERE FUE_DEVUELTO = 'f'
            """)
            cols_art = [desc[0].upper() for desc in cur.description]
            art_rows = cur.fetchall()
            
            items_by_ticket = {}
            for row in art_rows:
                r = dict(zip(cols_art, row))
                tid = r["TICKET_ID"]
                if tid not in ticket_id_set:
                    continue
                item = {
                    "productoId": str(r["PRODUCTO_CODIGO"]).strip(),
                    "cantidad": float(r["CANTIDAD"]) if r["CANTIDAD"] else 0,
                    "precioUnitario": float(r["PRECIO_USADO"]) if r["PRECIO_USADO"] else 0,
                    "subtotal": float(r["TOTAL_ARTICULO"]) if r["TOTAL_ARTICULO"] else 0
                }
                if tid not in items_by_ticket:
                    items_by_ticket[tid] = []
                items_by_ticket[tid].append(item)
            
            linked_count = 0
            for t in ventas_list:
                raw_tid = int(t["id"].split('_')[-1])
                if raw_tid in items_by_ticket:
                    t["detalles"] = items_by_ticket[raw_tid]
                    linked_count += len(t["detalles"])
            
            print(f"   ✔ {len(art_rows)} artículos extraídos, {linked_count} vinculados a tickets")
        except Exception as ve:
            print(f"   ⚠ Error leyendo ventas: {ve}", file=sys.stderr)
            print(f"   → Continuando sin ventas históricas...")

        # ══════════════════════════════════════════
        # 6. INVENTARIO (Stock Real)
        # ══════════════════════════════════════════
        print("[6/6] Extrayendo inventario...")
        stock_list = []
        try:
            cur.execute("""
                SELECT TRIM(p.CODIGO), ib.CANTIDAD_ACTUAL 
                FROM INVENTARIO_BALANCES ib 
                JOIN PRODUCTOS p ON ib.PRODUCTO_ID = p.ID
                WHERE ib.CANTIDAD_ACTUAL IS NOT NULL
            """)
            for row in cur.fetchall():
                sku = row[0]
                qty = float(row[1]) if row[1] else 0
                if sku:
                    stock_list.append({
                        "sku": sku,
                        "stock": qty
                    })
            print(f"   ✔ {len(stock_list)} registros de inventario extraídos")
        except Exception as se:
            print(f"   ⚠ Error leyendo inventario: {se}", file=sys.stderr)
            print(f"   → Continuando sin datos de inventario...")

        cur.close()
        conn.close()
        
        # ══════════════════════════════════════════
        # GENERAR JSON FINAL
        # ══════════════════════════════════════════
        data_final = {
            "version": "2.0",
            "origen": "Eleventa",
            "fecha_exportacion": datetime.datetime.now().isoformat(),
            "productos": productos_list,
            "clientes": clientes_list,
            "clientes_deudores": [c for c in clientes_list if c.get("saldo_deudor", 0) > 0],
            "categorias": categorias_list,
            "proveedores": proveedores_list,
            "ventas": ventas_list,
            "inventario": stock_list,
            "resumen": {
                "total_productos": len(productos_list),
                "total_clientes": len(clientes_list),
                "total_categorias": len(categorias_list),
                "total_proveedores": len(proveedores_list),
                "total_ventas": len(ventas_list),
                "total_articulos_vendidos": sum(len(v["detalles"]) for v in ventas_list),
                "total_inventario": len(stock_list)
            }
        }
        
        # Ensure the output directory exists
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        
        with open(out_path, "w", encoding="utf-8") as fp:
            json.dump(data_final, fp, ensure_ascii=False, indent=2)
            
        print(f"\n{'='*50}")
        print(f"✅ MIGRACIÓN COMPLETA")
        print(f"{'='*50}")
        print(f"  Productos:     {len(productos_list):>8,}")
        print(f"  Clientes:      {len(clientes_list):>8,}")
        print(f"  Categorías:    {len(categorias_list):>8,}")
        print(f"  Proveedores:   {len(proveedores_list):>8,}")
        print(f"  Ventas:        {len(ventas_list):>8,}")
        print(f"  Artículos:     {sum(len(v['detalles']) for v in ventas_list):>8,}")
        print(f"  Inventario:    {len(stock_list):>8,}")
        print(f"{'='*50}")
        print(f"  Archivo: {out_path}")
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
