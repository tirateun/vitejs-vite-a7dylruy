import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Save, ChevronLeft, ChevronRight, CheckCircle, Loader, Scale, Info } from 'lucide-react'
import { Producto, InventarioDiario } from '../types'
import { useAuth } from '../context/AuthContext'

type CierreMap = Record<number, { valor: string; obs: string }>

export default function CierreInventario() {
  const { user } = useAuth()
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [productos, setProductos] = useState<(Producto & { simbolo: string; categoria_nombre: string; icono: string })[]>([])
  const [cierres, setCierres] = useState<CierreMap>({})
  const [aperturas, setAperturas] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [catActiva, setCatActiva] = useState<string>('todas')

  useEffect(() => {
    async function cargar() {
      setLoading(true)

      const [{ data: prods }, { data: invHoy }] = await Promise.all([
        supabase.from('productos')
          .select(`*, unidades(simbolo), categorias(nombre, icono)`)
          .eq('activo', true)
          .order('categoria_id')
          .order('nombre'),
        supabase.from('inventario_diario').select('*').eq('fecha', fecha),
      ])

      const mapped = (prods ?? []).map((p: any) => ({
        ...p,
        simbolo: p.unidades?.simbolo ?? 'unid',
        categoria_nombre: p.categorias?.nombre ?? 'Otros',
        icono: p.categorias?.icono ?? '📋',
      }))

      setProductos(mapped)

      // Armar mapa de cierres e inventarios existentes
      const cierreMap: CierreMap = {}
      const aperturaMap: Record<number, number> = {}

      if (invHoy) {
        for (const inv of invHoy as InventarioDiario[]) {
          aperturaMap[inv.producto_id] = inv.stock_apertura
          if (inv.stock_cierre !== null) {
            cierreMap[inv.producto_id] = {
              valor: String(inv.stock_cierre),
              obs: inv.observaciones ?? ''
            }
          }
        }
      }

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
    setCierres(prev => ({
      ...prev,
      [id]: { ...( prev[id] ?? { valor: '', obs: '' }), [campo]: val }
    }))
    setSaved(false)
  }

  const guardar = async () => {
    setSaving(true)
    const registros = productos
      .filter(p => cierres[p.id]?.valor !== undefined && cierres[p.id]?.valor !== '')
      .map(p => ({
        producto_id: p.id,
        fecha,
        stock_apertura: aperturas[p.id] ?? 0,
        stock_cierre: parseFloat(cierres[p.id].valor) || 0,
        hora_cierre: format(new Date(), 'HH:mm:ss'),
        registrado_por: user?.email ?? 'sistema',
        observaciones: cierres[p.id].obs || null,
      }))

    if (registros.length > 0) {
      await supabase.from('inventario_diario').upsert(registros, {
        onConflict: 'producto_id,fecha',
      })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // Categorías únicas
  const categorias = ['todas', ...new Set(productos.map(p => p.categoria_nombre))]

  const productosFiltrados = (catActiva === 'todas'
    ? productos
    : productos.filter(p => p.categoria_nombre === catActiva))
    .slice()
    .sort((a, b) => (aperturas[b.id] ?? 0) - (aperturas[a.id] ?? 0))

  const pendientes = productos.filter(p => !cierres[p.id]?.valor).length
  const fechaLabel = format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM", { locale: es })

  return (
    <div className="px-4 py-6 space-y-5 fade-up">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Scale className="w-5 h-5 text-brand-500" />
          <h1 className="font-display text-2xl font-black text-[var(--text)]">Cierre Inventario</h1>
        </div>
        <p className="text-xs text-[var(--text-muted)] font-mono">
          Ingresa el stock físico al cerrar la noche
        </p>
      </div>

      {/* Selector de fecha */}
      <div className="card p-3 flex items-center justify-between gap-3">
        <button onClick={() => cambiarFecha(-1)} className="p-2 rounded-lg hover:bg-surface-600 transition-all text-[var(--text-dim)]">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="font-mono text-sm font-semibold text-[var(--text)] capitalize">{fechaLabel}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{fecha}</p>
        </div>
        <button
          onClick={() => cambiarFecha(1)}
          disabled={fecha >= format(new Date(), 'yyyy-MM-dd')}
          className="p-2 rounded-lg hover:bg-surface-600 transition-all text-[var(--text-dim)] disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Progreso */}
      {!loading && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--text-dim)]">Progreso de cierre</span>
            <span className="font-mono text-sm font-bold text-[var(--text)]">
              {productos.length - pendientes}/{productos.length}
            </span>
          </div>
          <div className="h-2 bg-surface-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${((productos.length - pendientes) / productos.length) * 100}%` }}
            />
          </div>
          {pendientes > 0 && (
            <p className="text-xs text-[var(--text-muted)] mt-1.5 font-mono">
              {pendientes} productos sin registrar
            </p>
          )}
        </div>
      )}

      {/* Filtro por categoría */}
      {!loading && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCatActiva(cat)}
              className={`shrink-0 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all
                ${catActiva === cat
                  ? 'bg-brand-500 border-brand-500 text-white'
                  : 'bg-surface-700 border-surface-500 text-[var(--text-dim)] hover:border-surface-400'
                }`}
            >
              {cat === 'todas' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-2.5 bg-surface-700/50 border border-surface-500 rounded-xl p-3">
        <Info className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
        <p className="text-xs text-[var(--text-muted)]">
          El <span className="text-[var(--text-dim)]">stock apertura</span> se calcula automáticamente.
          Solo ingresa el <span className="text-brand-500 font-semibold">stock cierre</span> (lo que físicamente queda).
        </p>
      </div>

      {/* Lista de productos */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-surface-700" />)}
        </div>
      ) : (
        <div className="space-y-2 pb-2">
          {productosFiltrados.map(p => {
            const apertura = aperturas[p.id] ?? 0
            const cierreVal = parseFloat(cierres[p.id]?.valor ?? '')
            const consumo = !isNaN(cierreVal) ? apertura - cierreVal : null
            const registrado = cierres[p.id]?.valor !== undefined && cierres[p.id]?.valor !== ''

            return (
              <div key={p.id} className={`card overflow-hidden border transition-all
                ${registrado ? 'border-green-700/30 bg-green-900/5' : 'border-surface-600'}`}>
                <div className="px-4 py-3">
                  {/* Nombre + badge registrado */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{p.icono}</span>
                      <p className="font-semibold text-sm text-[var(--text)] truncate">{p.nombre}</p>
                    </div>
                    {registrado && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                  </div>

                  {/* Apertura + cierre */}
                  <div className="flex items-center gap-3">
                    {/* Apertura (solo lectura) */}
                    <div className="flex-1 bg-surface-700 rounded-xl p-2.5 text-center">
                      <p className="text-[10px] font-mono text-[var(--text-muted)] mb-0.5">APERTURA</p>
                      <p className="font-mono font-bold text-[var(--text)]">
                        {apertura.toLocaleString()} <span className="text-xs text-[var(--text-muted)]">{p.simbolo}</span>
                      </p>
                    </div>

                    <span className="text-[var(--text-muted)] text-lg">→</span>

                    {/* Cierre (editable) */}
                    <div className="flex-1">
                      <p className="text-[10px] font-mono text-brand-500 mb-1 text-center">CIERRE</p>
                      <div className="relative">
                        <input
                          type="number"
                          value={cierres[p.id]?.valor ?? ''}
                          onChange={e => actualizarCierre(p.id, 'valor', e.target.value)}
                          placeholder="0"
                          min={0}
                          className="w-full text-center font-mono font-bold text-lg bg-surface-700 border-2 border-brand-500/50 rounded-xl py-2 text-[var(--text)] focus:outline-none focus:border-brand-500 placeholder-surface-500"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] font-mono">
                          {p.simbolo}
                        </span>
                      </div>
                    </div>

                    {/* Consumo calculado */}
                    {consumo !== null && (
                      <div className="flex-1 text-center">
                        <p className="text-[10px] font-mono text-[var(--text-muted)] mb-0.5">CONSUMO</p>
                        <p className={`font-mono font-bold text-sm ${consumo < 0 ? 'text-red-400' : 'text-[var(--text)]'}`}>
                          {consumo.toLocaleString()} <span className="text-xs text-[var(--text-muted)]">{p.simbolo}</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Observaciones (expandible si hay cierre) */}
                  {registrado && (
                    <input
                      type="text"
                      value={cierres[p.id]?.obs ?? ''}
                      onChange={e => actualizarCierre(p.id, 'obs', e.target.value)}
                      placeholder="Observaciones (merma inusual, vencimiento...)"
                      className="mt-2.5 w-full text-xs bg-surface-700 border border-surface-500 rounded-lg px-3 py-2 text-[var(--text-muted)] placeholder-surface-500 focus:outline-none focus:border-brand-500/50 font-mono"
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Botón guardar flotante */}
      <div className="fixed bottom-20 left-4 right-4 z-30">
        <button onClick={guardar} disabled={saving || saved} className="btn-primary shadow-2xl shadow-brand-500/30">
          {saving ? (
            <><Loader className="w-4 h-4 animate-spin" /> Guardando...</>
          ) : saved ? (
            <><CheckCircle className="w-4 h-4" /> ¡Cierre guardado!</>
          ) : (
            <><Save className="w-4 h-4" /> Guardar cierre de inventario</>
          )}
        </button>
      </div>
    </div>
  )
}
