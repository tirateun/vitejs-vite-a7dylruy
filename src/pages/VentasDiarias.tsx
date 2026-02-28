import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'

const RED = '#b91c1c'
const C = { bg: '#f8f8f8', card: '#fff', border: '#e5e7eb', text: '#111827', muted: '#6b7280' }

export default function VentasDiarias() {
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filas, setFilas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const { data } = await supabase
        .from('inventario_diario')
        .select('producto_id, stock_apertura, stock_cierre, productos(nombre, categorias(nombre, icono), unidades(simbolo))')
        .eq('fecha', fecha)
        .order('producto_id')
      setFilas(data ?? [])
      setLoading(false)
    }
    cargar()
  }, [fecha])

  const cambiarFecha = (dias: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + dias)
    if (d <= new Date()) setFecha(format(d, 'yyyy-MM-dd'))
  }

  const fechaLabel = format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
  const conCierre = filas.filter(f => f.stock_cierre !== null)
  const sinCierre = filas.filter(f => f.stock_cierre === null)
  const totalVendido = conCierre.reduce((acc, f) => acc + (f.stock_apertura - f.stock_cierre), 0)
  const porCategoria = conCierre.reduce((acc: any, f) => {
    const cat = f.productos?.categorias?.nombre ?? 'Otros'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(f)
    return acc
  }, {})

  return (
    <div style={{ padding: '24px 20px', background: C.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <TrendingUp size={20} color={RED} />
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.text }}>Ventas del Día</h1>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '12px', color: C.muted, fontFamily: 'monospace' }}>Calculado desde apertura − cierre de inventario</p>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={() => cambiarFecha(-1)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><ChevronLeft size={20} /></button>
        <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{fechaLabel}</p>
        <button onClick={() => cambiarFecha(1)} disabled={fecha >= format(new Date(), 'yyyy-MM-dd')} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, opacity: fecha >= format(new Date(), 'yyyy-MM-dd') ? 0.3 : 1 }}><ChevronRight size={20} /></button>
      </div>

      {loading ? <p style={{ textAlign: 'center', padding: '40px', color: C.muted }}>Cargando...</p>
      : filas.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '36px', margin: '0 0 8px' }}>📦</p>
          <p style={{ fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Sin inventario para esta fecha</p>
          <p style={{ fontSize: '13px', color: C.muted, margin: 0 }}>Primero completa el cierre de inventario</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: `3px solid ${RED}`, borderRadius: '12px', padding: '16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: C.muted }}>Total vendido</p>
              <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: RED, fontFamily: 'monospace' }}>{totalVendido.toLocaleString()}</p>
              <p style={{ margin: 0, fontSize: '11px', color: C.muted }}>unidades</p>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: '3px solid #22c55e', borderRadius: '12px', padding: '16px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: C.muted }}>Con cierre</p>
              <p style={{ margin: 0, fontSize: '28px', fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>{conCierre.length}/{filas.length}</p>
              <p style={{ margin: 0, fontSize: '11px', color: C.muted }}>productos</p>
            </div>
          </div>

          {sinCierre.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#92400e' }}>⚠️ {sinCierre.length} producto(s) sin cierre registrado</p>
            </div>
          )}

          {Object.entries(porCategoria).map(([cat, items]: any) => (
            <div key={cat} style={{ marginBottom: '16px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '11px', fontFamily: 'monospace', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{cat}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {items.map((f: any) => {
                  const vendidas = f.stock_cierre !== null ? f.stock_apertura - f.stock_cierre : null
                  const simbolo = f.productos?.unidades?.simbolo ?? 'unid'
                  return (
                    <div key={f.producto_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${RED}`, borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: C.text }}>{f.productos?.nombre}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{f.stock_apertura} → {f.stock_cierre ?? '?'} {simbolo}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: RED, fontFamily: 'monospace' }}>{vendidas ?? '—'}</p>
                        <p style={{ margin: 0, fontSize: '10px', color: C.muted }}>vendidas</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
