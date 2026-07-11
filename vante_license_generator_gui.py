import tkinter as tk
from tkinter import messagebox
import hashlib
import os
import sys
from PIL import Image, ImageTk

def resource_path(relative_path):
    """ Retorna la ruta absoluta del recurso, compatible con desarrollo y empaquetado PyInstaller """
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def generate_key(hardware_id, email):
    combined = f"{hardware_id.strip()}:{email.lower().strip()}:VANTE-SECRET-2026"
    hash_object = hashlib.sha256(combined.encode('utf-8'))
    computed_hash = hash_object.hexdigest().upper()
    return computed_hash[:16]

class LicenseGeneratorApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Vante POS - Generador de Licencias")
        self.root.geometry("480x560")
        self.root.resizable(False, False)
        self.root.configure(bg="#000000")
        
        # 1. Contenedor principal negro para forzar fondo negro en macOS
        self.main_container = tk.Frame(root, bg="#000000")
        self.main_container.pack(fill="both", expand=True)
        
        # 2. Cargar logotipo en el encabezado
        logo_path = resource_path("vante_logo.png")
        self.logo_rendered = False
        if os.path.exists(logo_path):
            try:
                img = Image.open(logo_path)
                img.thumbnail((160, 80), Image.Resampling.LANCZOS)
                self.logo_img = ImageTk.PhotoImage(img)
                logo_label = tk.Label(self.main_container, image=self.logo_img, bg="#000000")
                logo_label.pack(pady=(25, 10))
                self.logo_rendered = True
            except Exception as e:
                print("No se pudo cargar el logo:", e)
                
        if not self.logo_rendered:
            self.render_text_logo()
            
        # 3. Card flotante para los controles
        self.card = tk.Frame(
            self.main_container, 
            bg="#0c0d12", 
            highlightthickness=1, 
            highlightbackground="#27272a",
            padx=30,
            pady=25
        )
        self.card.pack(fill="both", expand=True, padx=25, pady=(0, 25))

        # 4. Campo Hardware ID (Gris oscuro, Letras Blancas)
        hw_label = tk.Label(
            self.card, 
            text="HARDWARE ID DEL CLIENTE", 
            font=("Arial", 9, "bold"), 
            bg="#0c0d12", 
            fg="#ffffff"
        )
        hw_label.pack(anchor="w", pady=(0, 5))
        
        self.hw_entry = tk.Entry(
            self.card, 
            font=("Arial", 11), 
            bg="#1e1f29", 
            fg="#ffffff", 
            insertbackground="white", 
            bd=0, 
            highlightthickness=1, 
            highlightbackground="#27272a", 
            highlightcolor="#f59e0b"
        )
        self.hw_entry.pack(fill="x", pady=(0, 15), ipady=8)
        
        # 5. Campo Email (Gris oscuro, Letras Blancas)
        email_label = tk.Label(
            self.card, 
            text="EMAIL DE REGISTRO", 
            font=("Arial", 9, "bold"), 
            bg="#0c0d12", 
            fg="#ffffff"
        )
        email_label.pack(anchor="w", pady=(0, 5))
        
        self.email_entry = tk.Entry(
            self.card, 
            font=("Arial", 11), 
            bg="#1e1f29", 
            fg="#ffffff", 
            insertbackground="white", 
            bd=0, 
            highlightthickness=1, 
            highlightbackground="#27272a", 
            highlightcolor="#f59e0b"
        )
        self.email_entry.pack(fill="x", pady=(0, 20), ipady=8)
        
        # 6. Botón Generar (Amber con micro-animación hover)
        self.gen_btn = tk.Label(
            self.card, 
            text="GENERAR ACTIVACIÓN", 
            font=("Arial", 11, "bold"), 
            bg="#f59e0b", 
            fg="#000000", 
            cursor="hand2",
            padx=10,
            pady=12,
            relief="flat"
        )
        self.gen_btn.bind("<Button-1>", lambda e: self.on_generate())
        self.gen_btn.bind("<Enter>", lambda e: self.gen_btn.configure(bg="#fbbf24"))
        self.gen_btn.bind("<Leave>", lambda e: self.gen_btn.configure(bg="#f59e0b"))
        self.gen_btn.pack(fill="x", pady=(0, 20))
        
        # 7. Campo de Resultado
        self.key_label = tk.Label(
            self.card, 
            text="CLAVE GENERADA", 
            font=("Arial", 9, "bold"), 
            bg="#0c0d12", 
            fg="#ffffff"
        )
        self.key_label.pack(anchor="w", pady=(0, 5))
        
        self.result_frame = tk.Frame(
            self.card, 
            bg="#000000", 
            highlightthickness=1, 
            highlightbackground="#27272a"
        )
        self.result_frame.pack(fill="x")
        
        self.result_text = tk.Label(
            self.result_frame, 
            text="--", 
            font=("Courier", 13, "bold"), 
            bg="#000000", 
            fg="#10b981",
            anchor="center",
            pady=12
        )
        self.result_text.pack(side="left", padx=15, fill="x", expand=True)
        
        self.copy_btn = tk.Label(
            self.result_frame, 
            text="COPIAR", 
            font=("Arial", 8, "bold"), 
            bg="#2d2d2d", 
            fg="#06b6d4",
            cursor="hand2",
            relief="flat",
            padx=12,
            pady=6
        )
        self.copy_btn.bind("<Button-1>", lambda e: self.on_copy())
        self.copy_btn.bind("<Enter>", lambda e: self.copy_btn.configure(bg="#3f3f46"))
        self.copy_btn.bind("<Leave>", lambda e: self.copy_btn.configure(bg="#2d2d2d"))
        self.copy_btn.pack(side="right", padx=10, pady=5)
        
        # Forzar redibujado en macOS debido a un bug de Tcl/Tk
        self.root.after(10, self.force_mac_redraw)
        
    def force_mac_redraw(self):
        try:
            self.root.geometry("480x561")
            self.root.update()
        except Exception:
            pass
        
    def render_text_logo(self):
        fallback_label = tk.Label(
            self.main_container, 
            text="VANTE POS", 
            font=("Arial", 18, "bold"), 
            bg="#000000", 
            fg="#f59e0b"
        )
        fallback_label.pack(pady=25)
        
    def on_generate(self):
        hw_id = self.hw_entry.get().strip()
        email = self.email_entry.get().strip()
        
        if not hw_id or not email:
            messagebox.showerror("Campos vacíos", "Por favor ingrese tanto el Hardware ID como el Email.")
            return
            
        license_key = generate_key(hw_id, email)
        self.result_text.configure(text=license_key)
        
    def on_copy(self):
        key = self.result_text.cget("text")
        if key == "--":
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(key)
        messagebox.showinfo("Copiado", "¡Clave de activación copiada al portapapeles!")

if __name__ == "__main__":
    root = tk.Tk()
    app = LicenseGeneratorApp(root)
    root.mainloop()
