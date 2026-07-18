# 📘 Manual de Operación y Soporte - Vante POS & Vante AI

Este documento contiene la especificación oficial de operación, configuración y resolución de problemas de **Vante POS** (Caja Principal y Terminales Móviles). Esta información sirve como base de conocimiento para **Vante AI** (el copiloto local integrado) y el personal técnico.

---

## 1. Arquitectura de Distribución Híbrida

Vante POS está diseñado con una arquitectura flexible de doble distribución:
*   **Modo Local (Caja Principal / Servidor):** Levanta automáticamente el backend (`apps/api`) y utiliza **SQLite** (`dev.db`) como base de datos local de cero-configuración.
*   **Modo Híbrido (Terminales Mostrador & Móviles):** Las terminales y celulares se conectan a través de una API en la nube (ej. Render) sincronizada con **PostgreSQL (Supabase)**.
*   **Panel de Super Admin:** Protegido por la Master Key `VANTE2401` y accesible con el atajo `Cmd + Shift + A` (Mac) o `Ctrl + Shift + A` (Windows). Permite conmutar la base de datos de SQLite a Supabase y configurar el servidor remoto.

---

## 2. Restricciones del Modo Demo Local (Sin Licencia Activa)

A menos que el sistema se active con una licencia válida ligada al Hardware ID + Email del cliente, operará en **Modo Demo** con las siguientes limitaciones automáticas:
*   **Catálogo:** Límite máximo de **200 productos**.
*   **Usuarios:** Límite máximo de **3 cajeros/administradores**.
*   **Hardware:** Soporte para **1 sola impresora** y **0 terminales adicionales / vendedores móviles**.
*   **Módulos Bloqueados en UI:** Cotizaciones, Proveedores, CRM de Clientes, Antigüedad de Saldos y Facturación CFDI.
*   **Expiración:** Plazo máximo de uso de **1 año**. Al faltar 30 días o menos, se muestra una alerta visual de cuenta regresiva. Cumplido el año, el sistema permite seguir cobrando y vendiendo normalmente, pero bloquea la creación de nuevos artículos en el catálogo.

---

## 3. Guía de Conexión de Vante Móvil

Para conectar un dispositivo Android con Vante Móvil al servidor en la nube:
1.  **URL del Servidor:** En la pantalla de login, toca el icono de engrane (⚙️) e introduce la URL del servidor (ej. `https://pdv-cafe.onrender.com/api/v1`).
2.  **Prueba de Conexión:** Toca **Guardar y Probar**. La aplicación realizará un test contra el endpoint `/productos` y verificará un código `HTTP 200/401/403` para confirmar que el servidor está en línea antes de guardar la configuración.
3.  **Inicio de Sesión:** Ingresa el PIN asignado (el PIN maestro predeterminado para el Administrador es `8888`).

---

## 4. Gestión de Mesas (Giro Cafetería)

*   **Activación:** El módulo de mesas solo se muestra en la interfaz si el Giro de la empresa está configurado como `'CAFETERIA'`.
*   **Sincronización:** Las mesas se administran en la terminal central de escritorio (PC). Al guardar la configuración en la PC, los nombres e IDs de las mesas se publican automáticamente al servidor mediante el endpoint `/api/v1/mesas`.
*   **Uso en Móvil:** Cuando un mesero inicia sesión en Vante Móvil, la aplicación descarga automáticamente la estructura de mesas desde el servidor. Si el servidor no tiene mesas configuradas, la app inicializará un mapa predeterminado de 12 mesas (`Mesa 1` a `Mesa 12`).
*   **Persistencia de Pedidos:** Los pedidos activos y estados de las mesas (Libre, Ocupada, Pidiendo Cuenta) se sincronizan localmente en cada dispositivo para asegurar la máxima velocidad de respuesta sin sobrecargar el servidor.

---

## 5. Control de Caja y Turnos

*   **Regla de Unicidad:** Cada cajero/usuario solo puede tener **un turno abierto a la vez** en el sistema.
*   **Alerta "Ya tienes un turno abierto en esta caja":** Si el sistema muestra este aviso al presionar "Abrir Turno / Iniciar Día", significa que ya iniciaste tu jornada laboral previamente. Solo debes pulsar **Aceptar** para cerrar la advertencia e ir directamente al menú de ventas o mesas para comenzar a operar.
*   **Corte de Caja:** Al finalizar la jornada, ve al módulo de Caja y presiona **Cerrar Turno**, ingresando el efectivo final para generar el reporte de arqueo.

---

## 6. Resolución de Problemas Frecuentes

### ❌ Error: "Fallo de Conexión" al guardar la URL en el móvil
*   **Causa 1:** El servidor remoto (en Render) está dormido ("Cold Start" de la capa gratuita). Toma hasta 30 segundos en despertar en el primer intento.
*   **Causa 2:** El dispositivo móvil no tiene acceso a Internet o la URL está mal escrita (debe incluir `https://` y terminar en `/api/v1`).
*   **Solución:** Verifica la URL abriéndola en el navegador del celular. Si responde, vuelve a intentar la prueba de conexión en la app.

### ❌ Error: "PIN Incorrecto" en el móvil
*   **Causa:** El móvil está apuntando a un servidor diferente o local, o el usuario no existe en la base de datos que está consultando el servidor en la nube.
*   **Solución:** Asegúrate de guardar la URL de conexión primero con éxito y verifica en Vante PC (Administración -> Usuarios) que el PIN y el usuario estén activos.

### ❌ Alerta: "Ya tienes un turno abierto..."
*   **Causa:** El usuario intentó abrir caja de nuevo sin cerrar el turno del día anterior.
*   **Solución:** Simplemente presiona **Aceptar** y vende normalmente. Si necesitas hacer el corte, haz clic en **Cerrar Turno** primero.
