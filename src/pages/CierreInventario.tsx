import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Save, ChevronLeft, ChevronRight, CheckCircle, Loader, Scale, Info, ShoppingCart, Lock, X, Pencil } from 'lucide-react'
import { Producto, InventarioDiario } from '../types'
import { useAuth } from '../context/AuthContext'

type CierreMap = Record<number, { valor: string; obs: string }>

const RED = '#b91c1c'
const C = { bg: '#f8f8f8', card: '#ffffff', border: '#e5e7eb', text: '#111827', muted: '#6b7280' }

function ModalPin({ productoNombre, onConfirm, onCancel }: { productoNombre: string; onConfirm: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const verificar = async () => {
    if (pin.length !== 4) return
    setLoading(true)
    const { data } = await supabase.from('configuracion').select('valor').eq('clave', 'pin_supervisor').single()
    setLoading(false)
    if (data?.valor === pin) { onConfirm() }
    else { setError('PIN incorrecto'); setPin('') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', width: '100%', maxWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Lock size={20} color={RED} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: C.text }}>PIN de supervisor</p>
              <p style={{ margin: 0, fontSize: '11px', color: C.muted }}>Corregir: {productoNombre}</p>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><X size={18} /></button>
        </div>

        <input type="password" inputMode="numeric" maxLength={4} value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
          onKeyDown={e => e.key === 'Enter' && verificar()}
          placeholder="• • • •" autoFocus
          style={{ width: '100%', textAlign: 'center', fontSize: '28px', letterSpacing: '12px', padding: '14px', border: `2px solid ${error ? '#ef4444' : C.border}`, borderRadius: '12px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box', marginBottom: '8px' }} />

        {error && <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#ef4444', textAlign: 'center' }}>⚠️ {error}</p>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
            <button key={i} onClick={() => {
              if (n === '⌫') { setPin(p => p.slice(0,-1)); setError('') }
              else if (n !== '' && pin.length < 4) { setPin(p => p + n); setError('') }
            }} style={{ padding: '13px', borderRadius: '10px', border: `1px solid ${C.border}`, background: n === '' ? 'transparent' : '#f9fafb', cursor: n === '' ? 'default' : 'pointer', fontSize: '18px', fontWeight: 600, color: C.text, fontFamily: 'monospace' }}>
              {n}
            </button>
          ))}
        </div>

        <button onClick={verificar} disabled={loading || pin.length !== 4}
          style={{ width: '100%', padding: '13px', borderRadius: '10px', background: pin.length === 4 ? RED : '#e5e7eb', border: 'none', color: pin.length === 4 ? '#fff' : C.muted, fontWeight: 700, fontSize: '14px', cursor: pin.length === 4 ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
          {loading ? 'Verificando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

export default function CierreInventario() {
  const { user } = useAuth()
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [productos, setProductos] = useState<(Producto & { simbolo: string; categoria_nombre: string; icono: string })[]>([])
  const [cierres, setCierres] = useState<CierreMap>({})
  const [aperturas, setAperturas] = useState<Record<number, number>>({})
  const [comprasHoy, setComprasHoy] = useState<Record<number, number>>({})
  // IDs que ya tienen cierre guardado en BD → bloqueados hasta PIN
  const [bloqueados, setBloqueados] = useState<Set<number>>(new Set())
  // ID del producto que está pidiendo PIN ahora
  const [pinParaId, setPinParaId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [catActiva, setCatActiva] = useState<string>('todas')

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const ayer = format(subDays(new Date(fecha + 'T12:00:00'), 1), 'yyyy-MM-dd')

      const [{ data: prods }, { data: invHoy }, { data: invAyer }, { data: comprasData }] = await Promise.all([
        supabase.from('productos').select('*, unidades(simbolo), categorias(nombre, icono)').eq('activo', true).order('categoria_id').order('nombre'),
        supabase.from('inventario_diario').select('*').eq('fecha', fecha),
        supabase.from('inventario_diario').select('producto_id, stock_cierre').eq('fecha', ayer),
        supabase.from('compras').select('producto_id, cantidad').eq('fecha', fecha),
      ])

      const mapped = (prods ?? []).map((p: any) => ({
        ...p, simbolo: p.unidades?.simbolo ?? 'unid',
        categoria_nombre: p.categorias?.nombre ?? 'Otros',
        icono: p.categorias?.icono ?? '📋',
      }))
      setProductos(mapped)

      const compraMap: Record<number, number> = {}
      for (const c of comprasData ?? []) compraMap[c.producto_id] = (compraMap[c.producto_id] ?? 0) + c.cantidad
      setComprasHoy(compraMap)

      const cierreAyer: Record<number, number> = {}
      for (const inv of invAyer ?? []) if (inv.stock_cierre !== null) cierreAyer[inv.producto_id] = inv.stock_cierre

      const aperturaMap: Record<number, number> = {}
      for (const p of mapped) aperturaMap[p.id] = (cierreAyer[p.id] ?? 0) + (compraMap[p.id] ?? 0)

      const cierreMap: CierreMap = {}
      const bloqueadosSet = new Set<number>()
      if (invHoy) {
        for (const inv of invHoy as InventarioDiario[]) {
          if (inv.stock_cierre !== null) {
            cierreMap[inv.producto_id] = { valor: String(inv.stock_cierre), obs: inv.observaciones ?? '' }
            bloqueadosSet.add(inv.producto_id) // ya guardado → bloqueado
          }
        }
      }

      setBloqueados(bloqueadosSet)
      setCierres(cierreMap)
      setAperturas(aperturaMap)
      setLoading(false)
      setSaved(false)
    }
    cargar()
  }, [fecha])

  const cambiarFecha = (dias: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + dias)
    if (d <= new Date()) setFecha(format(d, 'yyyy-MM-dd'))
  }

  const actualizarCierre = (id: number, campo: 'valor' | 'obs', val: string) => {
    setCierres(prev => ({ ...prev, [id]: { ...(prev[id] ?? { valor: '', obs: '' }), [campo]: val } }))
    setSaved(false)
  }

  // Al confirmar PIN para un item → desbloquearlo
  const desbloquearItem = (id: number) => {
    setBloqueados(prev => { const s = new Set(prev); s.delete(id); return s })
    setPinParaId(null)
  }

  const guardar = async () => {
    setSaving(true)
    const registros = productos
      .filter(p => cierres[p.id]?.valor !== undefined && cierres[p.id]?.valor !== '')
      .map(p => ({
        producto_id: p.id, fecha,
        stock_apertura: aperturas[p.id] ?? 0,
        stock_cierre: parseFloat(cierres[p.id].valor),
        observaciones: cierres[p.id].obs || null,
        registrado_por: user?.email ?? 'sistema',
      }))
    if (registros.length > 0)
      await supabase.from('inventario_diario').upsert(registros, { onConflict: 'producto_id,fecha' })
    setSaving(false)
    setSaved(true)
    // Re-bloquear todo lo guardado
    setBloqueados(new Set(registros.map(r => r.producto_id)))
    setTimeout(() => setSaved(false), 3000)
  }

  const categorias = ['todas', ...Array.from(new Set(productos.map(p => p.categoria_nombre)))]
  const productosFiltrados = catActiva === 'todas' ? productos : productos.filter(p => p.categoria_nombre === catActiva)
  const pendientes = productos.filter(p => !cierres[p.id]?.valor).length
  const fechaLabel = format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
  const pinProd = productos.find(p => p.id === pinParaId)

  return (
    <div style={{ padding: '24px 20px', background: C.bg, minHeight: '100%' }}>
      {pinParaId !== null && pinProd && (
        <ModalPin
          productoNombre={pinProd.nombre}
          onConfirm={() => desbloquearItem(pinParaId)}
          onCancel={() => setPinParaId(null)}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <Scale size={20} color={RED} />
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.text }}>Cierre de Inventario</h1>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '12px', color: C.muted, fontFamily: 'monospace' }}>Stock apertura = cierre de ayer + compras del día</p>

      {/* Selector fecha */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={() => cambiarFecha(-1)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><ChevronLeft size={20} /></button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{fechaLabel}</p>
          <p style={{ margin: 0, fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{fecha}</p>
        </div>
        <button onClick={() => cambiarFecha(1)} disabled={fecha >= format(new Date(), 'yyyy-MM-dd')} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, opacity: fecha >= format(new Date(), 'yyyy-MM-dd') ? 0.3 : 1 }}><ChevronRight size={20} /></button>
      </div>

      {/* Progreso */}
      {!loading && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', color: C.muted }}>Progreso de cierre</span>
            <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: C.text }}>{productos.length - pendientes}/{productos.length}</span>
          </div>
          <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: RED, borderRadius: '99px', transition: 'width 0.5s', width: `${productos.length > 0 ? ((productos.length - pendientes) / productos.length) * 100 : 0}%` }} />
          </div>
          {pendientes > 0 && <p style={{ margin: '6px 0 0', fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>{pendientes} productos sin registrar</p>}
        </div>
      )}

      {/* Info */}
      <div style={{ display: 'flex', gap: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px', marginBottom: '16px' }}>
        <Info size={16} color="#3b82f6" style={{ flexShrink: 0, marginTop: '1px' }} />
        <p style={{ margin: 0, fontSize: '12px', color: '#1e40af' }}>
          Items ya guardados muestran 🔒. Para corregirlos presiona <strong>Editar</strong> e ingresa el PIN de supervisor.
        </p>
      </div>

      {/* Filtros */}
      {!loading && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', paddingBottom: '4px' }}>
          {categorias.map(cat => (
            <button key={cat} onClick={() => setCatActiva(cat)} style={{ flexShrink: 0, fontSize: '12px', fontFamily: 'monospace', padding: '6px 12px', borderRadius: '20px', border: `1px solid ${catActiva === cat ? RED : C.border}`, background: catActiva === cat ? RED : C.card, color: catActiva === cat ? '#fff' : C.muted, cursor: 'pointer' }}>
              {cat === 'todas' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(5)].map((_, i) => <div key={i} style={{ height: '100px', background: '#e5e7eb', borderRadius: '12px' }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '100px' }}>
          {productosFiltrados.map(p => {
            const apertura = aperturas[p.id] ?? 0
            const compra = comprasHoy[p.id] ?? 0
            const cierreVal = parseFloat(cierres[p.id]?.valor ?? '')
            const consumo = !isNaN(cierreVal) ? apertura - cierreVal : null
            const registrado = cierres[p.id]?.valor !== undefined && cierres[p.id]?.valor !== ''
            const bloqueado = bloqueados.has(p.id)

            return (
              <div key={p.id} style={{ background: C.card, border: `1px solid ${registrado ? '#86efac' : C.border}`, borderLeft: `4px solid ${registrado ? '#22c55e' : '#d1d5db'}`, borderRadius: '10px', padding: '14px 16px', transition: 'all 0.15s', opacity: bloqueado ? 0.85 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>{p.icono}</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: C.text }}>{p.nombre}</p>
                      {compra > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <ShoppingCart size={11} color="#16a34a" />
                          <span style={{ fontSize: '11px', color: '#16a34a', fontFamily: 'monospace' }}>+{compra} {p.simbolo} comprado hoy</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {registrado && <CheckCircle size={16} color="#22c55e" />}
                    {/* Botón editar si está bloqueado */}
                    {bloqueado && (
                      <button onClick={() => setPinParaId(p.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', border: `1px solid #fcd34d`, background: '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit' }}>
                        <Lock size={11} /> Editar
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ flex: 1, background: '#f9fafb', border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '10px', fontFamily: 'monospace', color: C.muted, marginBottom: '4px' }}>APERTURA</p>
                    <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{apertura.toLocaleString()} <span style={{ fontSize: '11px', color: C.muted }}>{p.simbolo}</span></p>
                  </div>
                  <span style={{ color: C.muted }}>→</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontSize: '10px', fontFamily: 'monospace', color: bloqueado ? C.muted : RED, textAlign: 'center' }}>CIERRE</p>
                    <input type="number" value={cierres[p.id]?.valor ?? ''} onChange={e => actualizarCierre(p.id, 'valor', e.target.value)}
                      placeholder="0" min={0} disabled={bloqueado}
                      style={{ width: '100%', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, fontSize: '16px', background: bloqueado ? '#f3f4f6' : '#fff', border: `2px solid ${registrado ? '#86efac' : C.border}`, borderRadius: '10px', padding: '8px', color: bloqueado ? C.muted : C.text, outline: 'none', boxSizing: 'border-box', cursor: bloqueado ? 'not-allowed' : 'text' }}
                      onFocus={e => { if (!bloqueado) e.target.style.borderColor = RED }}
                      onBlur={e => e.target.style.borderColor = registrado ? '#86efac' : C.border} />
                  </div>
                  {consumo !== null && (
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '10px', fontFamily: 'monospace', color: C.muted }}>CONSUMO</p>
                      <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: consumo < 0 ? '#ef4444' : C.text }}>{consumo.toLocaleString()} <span style={{ fontSize: '10px', color: C.muted }}>{p.simbolo}</span></p>
                    </div>
                  )}
                </div>

                {registrado && !bloqueado && (
                  <input type="text" value={cierres[p.id]?.obs ?? ''} onChange={e => actualizarCierre(p.id, 'obs', e.target.value)} placeholder="Observaciones (opcional)"
                    style={{ marginTop: '10px', width: '100%', fontSize: '12px', background: '#f9fafb', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '8px 12px', color: C.muted, outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Botón guardar */}
      <div style={{ position: 'fixed', bottom: '24px', left: '16px', right: '16px', zIndex: 30 }}>
        <button onClick={guardar} disabled={saving || saved}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '14px', borderRadius: '12px', background: saved ? '#22c55e' : RED, border: 'none', color: '#fff', fontWeight: 700, fontSize: '15px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(185,28,28,0.3)', fontFamily: 'inherit' }}>
          {saving ? <><Loader size={18} /> Guardando...</>
          : saved ? <><CheckCircle size={18} /> ¡Cierre guardado!</>
          : <><Save size={18} /> Guardar cierre de inventario</>}
        </button>
      </div>
    </div>
  )
}
