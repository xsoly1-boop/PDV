"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Giro = exports.EstadoTraspaso = exports.EstadoReserva = exports.TipoMovimiento = exports.Rol = void 0;
var Rol;
(function (Rol) {
    Rol["ADMINISTRADOR"] = "ADMINISTRADOR";
    Rol["GERENTE"] = "GERENTE";
    Rol["CAJERO"] = "CAJERO";
    Rol["VENDEDOR_MOVIL"] = "VENDEDOR_MOVIL";
})(Rol || (exports.Rol = Rol = {}));
var TipoMovimiento;
(function (TipoMovimiento) {
    TipoMovimiento["ENTRADA_COMPRA"] = "ENTRADA_COMPRA";
    TipoMovimiento["ENTRADA_TRASPASO"] = "ENTRADA_TRASPASO";
    TipoMovimiento["ENTRADA_DEVOLUCION"] = "ENTRADA_DEVOLUCION";
    TipoMovimiento["ENTRADA_AJUSTE"] = "ENTRADA_AJUSTE";
    TipoMovimiento["SALIDA_VENTA"] = "SALIDA_VENTA";
    TipoMovimiento["SALIDA_TRASPASO"] = "SALIDA_TRASPASO";
    TipoMovimiento["SALIDA_MERMA"] = "SALIDA_MERMA";
    TipoMovimiento["SALIDA_AJUSTE"] = "SALIDA_AJUSTE";
})(TipoMovimiento || (exports.TipoMovimiento = TipoMovimiento = {}));
var EstadoReserva;
(function (EstadoReserva) {
    EstadoReserva["ACTIVA"] = "ACTIVA";
    EstadoReserva["COMPLETADA"] = "COMPLETADA";
    EstadoReserva["EXPIRADA"] = "EXPIRADA";
    EstadoReserva["CANCELADA"] = "CANCELADA";
})(EstadoReserva || (exports.EstadoReserva = EstadoReserva = {}));
var EstadoTraspaso;
(function (EstadoTraspaso) {
    EstadoTraspaso["EN_TRANSITO"] = "EN_TRANSITO";
    EstadoTraspaso["COMPLETADO"] = "COMPLETADO";
    EstadoTraspaso["COMPLETADO_PARCIAL"] = "COMPLETADO_PARCIAL";
    EstadoTraspaso["CANCELADO"] = "CANCELADO";
})(EstadoTraspaso || (exports.EstadoTraspaso = EstadoTraspaso = {}));
var Giro;
(function (Giro) {
    Giro["ABARROTES"] = "ABARROTES";
    Giro["FARMACIA"] = "FARMACIA";
    Giro["FERRETERIA"] = "FERRETERIA";
    Giro["REFACCIONARIA"] = "REFACCIONARIA";
})(Giro || (exports.Giro = Giro = {}));
