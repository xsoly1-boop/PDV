-- 20260709000000_enterprise_core.sql
-- Migración para añadir tablas y funciones empresariales a Supabase

-- ------------------------------------------------------------
-- Tablas principales
-- ------------------------------------------------------------

-- Sucursales de la empresa
CREATE TABLE IF NOT EXISTS sucursales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    direccion TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Existencias por sucursal y producto
CREATE TABLE IF NOT EXISTS existencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sucursal_id UUID NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 0,
    actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Facturas CFDI vinculadas a ventas
CREATE TABLE IF NOT EXISTS facturas_cfdi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    uuid_cfdi TEXT NOT NULL,
    xml BYTEA,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Extensión de perfil de usuario
CREATE TABLE IF NOT EXISTS perfiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('Administrador','Cajero','Gerente','Usuario')),
    sucursal_id UUID REFERENCES sucursales(id)
);

-- ------------------------------------------------------------
-- Funciones de negocio
-- ------------------------------------------------------------

-- Función para traspaso de inventario entre sucursales
CREATE OR REPLACE FUNCTION public.realizar_traspaso_inventario(
    p_producto_id UUID,
    p_sucursal_origen UUID,
    p_sucursal_destino UUID,
    p_cantidad INTEGER
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
    v_existencia_origen RECORD;
    v_existencia_destino RECORD;
BEGIN
    -- Bloquear filas de origen y destino para evitar condiciones de carrera
    SELECT * INTO v_existencia_origen
    FROM existencias
    WHERE producto_id = p_producto_id AND sucursal_id = p_sucursal_origen
    FOR UPDATE;

    IF v_existencia_origen.cantidad < p_cantidad THEN
        RAISE EXCEPTION 'Inventario insuficiente en sucursal origen';
    END IF;

    -- Restar del origen
    UPDATE existencias
    SET cantidad = cantidad - p_cantidad,
        actualizado_en = now()
    WHERE id = v_existencia_origen.id;

    -- Sumar al destino (crear fila si no existe)
    SELECT * INTO v_existencia_destino
    FROM existencias
    WHERE producto_id = p_producto_id AND sucursal_id = p_sucursal_destino
    FOR UPDATE;

    IF v_existencia_destino IS NULL THEN
        INSERT INTO existencias (sucursal_id, producto_id, cantidad)
        VALUES (p_sucursal_destino, p_producto_id, p_cantidad);
    ELSE
        UPDATE existencias
        SET cantidad = cantidad + p_cantidad,
            actualizado_en = now()
        WHERE id = v_existencia_destino.id;
    END IF;
END;
$$;

-- Función para validar roles de usuario
CREATE OR REPLACE FUNCTION public.check_user_role(
    p_user_id UUID,
    p_required_roles TEXT[]
) RETURNS BOOLEAN LANGUAGE sql AS $$
    SELECT rol = ANY(p_required_roles) FROM perfiles WHERE user_id = p_user_id;
$$;

-- ------------------------------------------------------------
-- Políticas de Row Level Security (RLS)
-- ------------------------------------------------------------

-- Activar RLS en tablas críticas
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE existencias ENABLE ROW LEVEL SECURITY;

-- Política: usuarios pueden ver sus propias ventas o, si son Administrador, todas
CREATE POLICY ventas_policy ON ventas
    USING (check_user_role(auth.uid(), ARRAY['Administrador','Gerente'])
           OR owner_id = auth.uid());

-- Política: usuarios pueden leer existencias solo de su sucursal asignada
CREATE POLICY existencias_policy ON existencias
    USING (
        EXISTS (
            SELECT 1 FROM perfiles p
            WHERE p.user_id = auth.uid() AND p.sucursal_id = sucursal_id
        )
    );

-- ------------------------------------------------------------
-- Comentarios finales
-- ------------------------------------------------------------
-- Esta migración define la infraestructura necesaria para la gestión multisucursal,
-- el traspaso de inventario y la generación de facturas CFDI, así como un modelo
-- de roles (perfil) que será utilizado por el middleware de autorización del API.
