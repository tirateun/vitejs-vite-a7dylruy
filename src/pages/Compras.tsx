import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { ShoppingCart, Plus, Trash2, Save, CheckCircle, Loader, Package } from 'lucide-react'
import { Producto } from '../types'
import { useAuth } from '../context/AuthContext'

interface LineaCompra { producto_id: number; cantidad: string; precio_unitario: string; proveedor: string; comprobante: string }
const LINEA_VACIA: LineaCompra = { producto_id: 0, cantidad: '', precio_unitario: '', proveedor: '', comprobante: '' }
const RED = '#b91c1c'
const C = { bg: '#f8f8f8', card: '#fff', border: '#e5e7eb', text: '#111827', muted: '#6b7280', light: '#f9fafb' }

const inp = { width: '100%', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: C.text, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }

export default function Compras() {
  const { user } = useAuth()
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [productos, setProductos] = useState<(Producto & { simbolo: string })[]>([])
  const [lineas, setLineas] = useState<LineaCompra[]>([{ ...LINEA_VACIA }])
  const [historial, setHistorial] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function cargar() {
      const [{ data: prods }, { data: hist }] = await Promise.all([
        supabase.from('productos').select('*, unidades(simbolo)').eq('activo', true).order('nombre'),
        supabase.from('compras').select('*, productos(nombre, unidades(simbolo))').order('created_at', { ascending: false }).limit(20),
      ])
      setProductos((prods ?? []).map((p: any) => ({ ...p, simbolo: p.unidades?.simbolo ?? 'unid' })))
      setHistorial(hist ?? [])
      setLoading(false)
    }
    cargar()
  }, [saved])

  const actualizarLinea = (i: number, campo: keyof LineaCompra, val: string) => {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [campo]: val } : l))
    setSaved(false)
  }

  const guardar = async () => {
    const validas = lineas.filter(l => l.producto_id > 0 && parseFloat(l.cantidad) > 0)
    if (validas.length === 0) return
    setSaving(true)
    await supabase.from('compras').insert(validas.map(l => ({
      producto_id: l.producto_id, fecha,
      cantidad: parseFloat(l.cantidad),
      precio_unitario: l.precio_unitario ? parseFloat(l.precio_unitario) : null,
      proveedor: l.proveedor || null,
      comprobante: l.comprobante || null,
      registrado_por: user?.email ?? 'sistema',
    })))
    setSaving(false)
    setSaved(true)
    setLineas([{ ...LINEA_VACIA }])
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div style={{ padding: '24px 20px', background: C.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <ShoppingCart size={20} color={RED} />
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.text }}>Registrar Compra</h1>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '12px', color: C.muted, fontFamily: 'monospace' }}>Ingresar productos que llegaron hoy</p>

      {/* Fecha */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ fontSize: '12px', color: C.muted, fontFamily: 'monospace', flexShrink: 0 }}>FECHA</label>
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, flex: 1, padding: '6px 10px' }} />
      </div>

      {/* Lineas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
        {lineas.map((linea, i) => {
          const prod = productos.find(p => p.id === Number(linea.producto_id))
          const simbolo = prod?.simbolo ?? 'unid'
          return (
            <div key={i} style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `4px solid ${RED}`, borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: C.muted, fontWeight: 600 }}>LÍNEA {i + 1}</span>
                {lineas.length > 1 && (
                  <button onClick={() => setLineas(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}><Trash2 size={14} /></button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select value={linea.producto_id} onChange={e => actualizarLinea(i, 'producto_id', e.target.value)} style={{ ...inp }}>
                  <option value={0}>Seleccionar producto...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.simbolo})</option>)}
                </select>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '10px', fontFamily: 'monospace', color: C.muted, textTransform: 'uppercase' }}>Cantidad ({simbolo})</p>
                    <input type="number" value={linea.cantidad} onChange={e => actualizarLinea(i, 'cantidad', e.target.value)} placeholder="0" min={0} style={{ ...inp, fontFamily: 'monospace' }} />
                  </div>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '10px', fontFamily: 'monospace', color: C.muted, textTransform: 'uppercase' }}>Precio (S/)</p>
                    <input type="number" value={linea.precio_unitario} onChange={e => actualizarLinea(i, 'precio_unitario', e.target.value)} placeholder="0.00" min={0} step={0.01} style={{ ...inp, fontFamily: 'monospace' }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input type="text" value={linea.proveedor} onChange={e => actualizarLinea(i, 'proveedor', e.target.value)} placeholder="Proveedor" style={{ ...inp }} />
                  <input type="text" value={linea.comprobante} onChange={e => actualizarLinea(i, 'comprobante', e.target.value)} placeholder="Nro. boleta" style={{ ...inp, fontFamily: 'monospace' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={() => setLineas(prev => [...prev, { ...LINEA_VACIA }])} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '10px', border: `2px dashed ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', marginBottom: '16px' }}>
        <Plus size={16} /> Agregar otro producto
      </button>

      <button onClick={guardar} disabled={saving || saved} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '12px', background: saved ? '#22c55e' : RED, border: 'none', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', marginBottom: '24px', boxShadow: '0 4px 16px rgba(185,28,28,0.25)', fontFamily: 'inherit' }}>
        {saving ? <><Loader size={18} /> Guardando...</> : saved ? <><CheckCircle size={18} /> ¡Compra registrada!</> : <><Save size={18} /> Guardar compra</>}
      </button>

      {/* Historial */}
      {!loading && historial.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Package size={14} color={C.muted} />
            <p style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Compras recientes</p>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            {historial.map((c: any, i: number) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < historial.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShoppingCart size={16} color={RED} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '13px', color: C.text }}>{c.productos?.nombre ?? '—'}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{c.fecha} · {c.proveedor ?? 'sin proveedor'}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: C.text }}>{c.cantidad.toLocaleString()} {c.productos?.unidades?.simbolo ?? ''}</p>
                  {c.precio_total && <p style={{ margin: 0, fontSize: '11px', color: RED, fontFamily: 'monospace' }}>S/ {c.precio_total.toFixed(2)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
