export interface Producto {
  id: number
  nombre: string
  categoria_id: number
  unidad_id: number
  stock_minimo: number
  activo: boolean
  notas?: string
  unidades?: Unidad
  categorias?: Categoria
}

export interface Unidad {
  id: number
  nombre: string
  simbolo: string
  tipo: string
}

export interface Categoria {
  id: number
  nombre: string
  icono: string
  orden: number
}

export interface ProductoVenta {
  id: number
  nombre: string
  variedad: string
  tamano: string | null
  categoria: string
  descripcion: string | null
  precio: number | null
  activo: boolean
}

export interface InventarioDiario {
  id: string
  producto_id: number
  fecha: string
  stock_apertura: number
  stock_cierre: number | null
  hora_cierre: string | null
  consumo: number | null
  registrado_por: string | null
  observaciones: string | null
  productos?: Producto
}

export interface VentaDiaria {
  id: string
  fecha: string
  producto_venta_id: number
  cantidad: number
  registrado_por: string | null
  productos_venta?: ProductoVenta
}

export interface AnalisisMerma {
  fecha: string
  ingrediente: string
  unidad: string
  stock_apertura: number
  compras_dia: number
  stock_cierre: number
  consumo_real: number
  consumo_teorico: number
  merma_cantidad: number
  merma_porcentaje: number
  semaforo: 'verde' | 'amarillo' | 'rojo' | 'sin_consumo'
}

export interface Compra {
  id: string
  producto_id: number
  fecha: string
  cantidad: number
  precio_unitario: number | null
  precio_total: number | null
  proveedor: string | null
  comprobante: string | null
  notas: string | null
  registrado_por: string | null
  productos?: Producto
}
