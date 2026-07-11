import hashlib
import sys

def generate_key(hardware_id, email):
    combined = f"{hardware_id.strip()}:{email.lower().strip()}:VANTE-SECRET-2026"
    hash_object = hashlib.sha256(combined.encode('utf-8'))
    computed_hash = hash_object.hexdigest().upper()
    return computed_hash[:16]

def main():
    print("=========================================================")
    print("         GENERADOR DE LICENCIAS - VANTE POS")
    print("=========================================================")
    
    # Soporte para argumentos de terminal directo
    if len(sys.argv) >= 3:
        hw_id = sys.argv[1]
        email = sys.argv[2]
    else:
        hw_id = input("1. Ingrese el HARDWARE ID del cliente: ").strip()
        email = input("2. Ingrese el EMAIL del cliente: ").strip()
        
    if not hw_id or not email:
        print("\n[ERROR] Ambos campos son obligatorios.")
        sys.exit(1)
        
    license_key = generate_key(hw_id, email)
    
    print("\n---------------------------------------------------------")
    print(f"  CLIENTE:      {email}")
    print(f"  HARDWARE ID:  {hw_id}")
    print(f"  LICENCIA:     {license_key}")
    print("---------------------------------------------------------")
    print("\nPara crear un DONGLE USB de activación automática:")
    print(f"Cree un archivo llamado 'vante_license.key' con el contenido:")
    print(f"{email}:{license_key}")
    print("=========================================================")

if __name__ == "__main__":
    main()
