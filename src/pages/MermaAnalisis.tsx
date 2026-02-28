import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, TrendingDown } from 'lucide-react'
import { AnalisisMerma } from '../types'

const RED = '#b91c1c'
const C = { bg: '#f8f8f8', card: '#fff', border: '#e5e7eb', text: '#111827', muted: '#6b7280' }

const SEM = {
  rojo:     { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', dot: '#ef4444', label: 'Alta' },
  amarillo: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', dot: '#f59e0b', label: 'Media' },
  verde:    { bg: '#f0fdf4', border: '#86efac', text: '#166534', dot: '#22c55e', label: 'Normal' },
  gris:     { bg: '#f9fafb', border: '#d1d5db', text: '#6b7280', dot: '#9ca3af', label: 'Sin cierre' },
}

export default function MermaAnalisis() {
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [datos, setDatos] = useState<AnalisisMerma[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'rojo' | 'amarillo' | 'verde' | 'gris'>('todos')

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const { data } = await supabase
        .from('analisis_merma')
        .select('*')
        .eq('fecha', fecha)
        .order('merma_porcentaje', { ascending: false, nullsFirst: false })
      setDatos(data ?? [])
      setLoading(false)
    }
    cargar()
  }, [fecha])

  const cambiarFecha = (dias: number) => {
    const d = new Date(fecha + 'T12:00:00')
    d.setDate(d.getDate() + dias)
    if (d <= new Date()) setFecha(format(d, 'yyyy-MM-dd'))
  }

  const filtrados = filtro === 'todos' ? datos : datos.filter(d => (d.semaforo ?? 'gris') === filtro)
  const fechaLabel = format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })
  const counts = {
    rojo:     datos.filter(d => d.semaforo === 'rojo').length,
    amarillo: datos.filter(d => d.semaforo === 'amarillo').length,
    verde:    datos.filter(d => d.semaforo === 'verde').length,
    gris:     datos.filter(d => !d.semaforo || d.semaforo === 'gris').length,
  }

  const totalTeorico = datos.filter(d => d.semaforo !== 'gris').reduce((a, d: any) => a + (d.consumo_teorico ?? 0), 0)
  const conMermaAlta = counts.rojo

  return (
    <div style={{ padding: '24px 20px', background: C.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <TrendingDown size={20} color={RED} />
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: C.text }}>Análisis de Merma</h1>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '12px', color: C.muted, fontFamily: 'monospace' }}>Consumo real vs consumo teórico por ingrediente</p>

      {/* Selector fecha */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={() => cambiarFecha(-1)} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}><ChevronLeft size={20} /></button>
        <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{fechaLabel}</p>
        <button onClick={() => cambiarFecha(1)} disabled={fecha >= format(new Date(), 'yyyy-MM-dd')} style={{ padding: '6px', background: 'none', border: 'none', cursor: 'pointer', color: C.muted, opacity: fecha >= format(new Date(), 'yyyy-MM-dd') ? 0.3 : 1 }}><ChevronRight size={20} /></button>
      </div>

      {/* Resumen semáforo */}
      {!loading && datos.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {(['rojo', 'amarillo', 'verde', 'gris'] as const).map(s => (
              <button key={s} onClick={() => setFiltro(filtro === s ? 'todos' : s)}
                style={{ background: filtro === s ? SEM[s].bg : C.card, border: `1px solid ${filtro === s ? SEM[s].border : C.border}`, borderRadius: '10px', padding: '10px 6px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: 800, fontFamily: 'monospace', color: SEM[s].dot }}>{counts[s]}</p>
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: SEM[s].text, fontFamily: 'monospace' }}>● {SEM[s].label}</p>
              </button>
            ))}
          </div>

          {/* Info merma alta */}
          {conMermaAlta > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>
                ⚠️ {conMermaAlta} ingrediente{conMermaAlta > 1 ? 's' : ''} con merma alta (&gt;15%)
              </p>
            </div>
          )}

          {/* Info sin cierre */}
          {counts.gris > 0 && (
            <div style={{ background: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: C.muted }}>
                ⏳ {counts.gris} ingrediente{counts.gris > 1 ? 's' : ''} sin cierre de inventario registrado
              </p>
            </div>
          )}
        </>
      )}

      {/* Lista */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '40px', color: C.muted }}>Cargando...</p>
      ) : filtrados.length === 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '36px', margin: '0 0 8px' }}>📊</p>
          <p style={{ fontWeight: 600, color: C.text, margin: '0 0 4px' }}>Sin datos para esta fecha</p>
          <p style={{ fontSize: '13px', color: C.muted, margin: 0 }}>Registra ventas y completa el cierre de inventario</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map((d: any, i: number) => {
            const sem = SEM[d.semaforo as keyof typeof SEM] ?? SEM.gris
            const sinCierre = !d.semaforo || d.semaforo === 'gris'
            return (
              <div key={i} style={{ background: C.card, border: `1px solid ${sem.border}`, borderLeft: `4px solid ${sem.dot}`, borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: sinCierre ? 0 : '10px' }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: C.text }}>{d.ingrediente_nombre}</p>
                  {sinCierre ? (
                    <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace', background: '#f3f4f6', padding: '2px 8px', borderRadius: '20px' }}>Sin cierre</span>
                  ) : (
                    <span style={{ background: sem.bg, color: sem.text, border: `1px solid ${sem.border}`, fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, padding: '2px 10px', borderRadius: '20px' }}>
                      {d.merma_porcentaje > 0 ? '+' : ''}{d.merma_porcentaje?.toFixed(1)}%
                    </span>
                  )}
                </div>

                {!sinCierre && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '10px', color: C.muted, fontFamily: 'monospace' }}>TEÓRICO</p>
                      <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{d.consumo_teorico?.toFixed(1)}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: C.muted }}>{d.unidad}</p>
                    </div>
                    <div style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '10px', color: C.muted, fontFamily: 'monospace' }}>REAL</p>
                      <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{d.consumo_real?.toFixed(1)}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: C.muted }}>{d.unidad}</p>
                    </div>
                    <div style={{ background: sem.bg, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '10px', color: sem.text, fontFamily: 'monospace' }}>DIFERENCIA</p>
                      <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 700, color: sem.dot, fontFamily: 'monospace' }}>
                        {d.diferencia > 0 ? '+' : ''}{d.diferencia?.toFixed(1)}
                      </p>
                      <p style={{ margin: 0, fontSize: '10px', color: sem.text }}>{d.unidad}</p>
                    </div>
                  </div>
                )}

                {/* Teórico siempre visible para sin cierre */}
                {sinCierre && (
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: C.muted, fontFamily: 'monospace' }}>
                    Consumo teórico: {d.consumo_teorico?.toFixed(1)} {d.unidad}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
