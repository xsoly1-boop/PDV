# Reglas y Estándares de Vante POS

## 1. Arquitectura de Distribución Híbrida
*   El proyecto se compila en dos variantes independientes: `Server` (Caja Principal) y `Client` (Terminales de Mostrador).
*   En modo local, la Caja Principal (Server) levanta automáticamente el backend (`apps/api`) y utiliza SQLite como base de datos local cero-configuración.
*   En modo híbrido, el panel de Super Admin (protegido por la Master Key `VANTE2401`) se utiliza para configurar las credenciales de Supabase y el servidor API de Render.

## 2. Restricciones del Modo Demo Local
A menos que la app esté activada con una licencia válida (Hardware ID + Email), el sistema opera en modo Demo restringido por un plazo máximo de 1 año con las siguientes limitaciones:
*   Catálogo limitado a un máximo de **200 productos**.
*   Base de datos limitada a un máximo de **3 usuarios** (cajeros/administradores).
*   Operación restringida a **1 impresora**, **0 vendedores móviles** y **0 terminales adicionales** (monopuesto).
*   Módulos bloqueados en UI: Cotizaciones, Proveedores, CRM Clientes, Antigüedad de Saldos y Facturación CFDI.
*   Sin marcas de agua visuales en la caja, pero con alertas de cuenta regresiva en el panel cuando falten **30 días o menos** para expirar el año.
*   **Comportamiento Post-Expiración**: Cumplido el año, el usuario podrá seguir vendiendo productos y cobrando normalmente, pero se bloqueará la creación de nuevos productos en el catálogo hasta ingresar la licencia.

## 3. Acceso del Super Admin
El panel de Super Admin es invisible y solo se accede en el Servidor mediante:
*   Atajo: `Ctrl + Shift + A` (Windows) / `Cmd + Shift + A` (Mac) + PIN maestro `VANTE2401`.
*   Hardware: Conexión de una memoria USB con el archivo criptográfico de firma `apex_superadmin.key`.

Consulte siempre la skill local `desktop-onboarding` para especificaciones detalladas de código y validaciones criptográficas.
