import { useEffect, useState, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TrendingDown, Package, AlertTriangle, CheckCircle, Clock, BarChart3, ShoppingCart, Scale, ClipboardList } from 'lucide-react'

const RED = '#b91c1c'
const C = {
  bg: '#f8f8f8',
  card: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  muted: '#6b7280',
  light: '#f3f4f6',
}

interface ResumenDia {
  productosConCierre: number
  totalProductos: number
  alertasStock: number
  mermaAlta: number
}

export default function Dashboard() {
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [loading, setLoading] = useState(true)
  const hoy = format(new Date(), 'yyyy-MM-dd')
  const hoySemana = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  const hora = format(new Date(), 'HH:mm')
  const esNoche = parseInt(hora) >= 17

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const [{ count: cierres }, { count: total }, mermaData] = await Promise.all([
        supabase.from('inventario_diario').select('*', { count: 'exact', head: true }).eq('fecha', hoy).not('stock_cierre', 'is', null),
        supabase.from('productos').select('*', { count: 'exact', head: true }).eq('activo', true),
        supabase.from('analisis_merma').select('semaforo').eq('fecha', hoy).eq('semaforo', 'rojo'),
      ])
      setResumen({
        productosConCierre: cierres ?? 0,
        totalProductos: total ?? 0,
        alertasStock: 0,
        mermaAlta: mermaData.data?.length ?? 0,
      })
      setLoading(false)
    }
    cargar()
  }, [hoy])

  return (
    <div style={{ padding: '24px 20px', background: C.bg, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontFamily: 'monospace', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
          {hoySemana}
        </p>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: C.text }}>
          {esNoche ? 'Buenas noches 🌙' : 'Buenos días ☀️'}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ fontSize: '12px', color: C.muted, fontFamily: 'monospace' }}>
            Turno activo · {hora}
          </span>
        </div>
      </div>

      {/* Stats */}
      {!loading && resumen && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
          <StatCard icon={<Package size={18} color={RED} />} label="Inventario hoy" value={`${resumen.productosConCierre}/${resumen.totalProductos}`} sub="productos con cierre" accent={RED} />
          <StatCard icon={<Clock size={18} color="#f59e0b" />} label="Hora actual" value={hora} sub="turno activo" accent="#f59e0b" />
          <StatCard icon={<AlertTriangle size={18} color="#ef4444" />} label="Stock bajo" value={resumen.alertasStock} sub="por revisar" accent="#ef4444" />
          <StatCard icon={<TrendingDown size={18} color="#8b5cf6" />} label="Merma alta" value={resumen.mermaAlta} sub="ingredientes hoy" accent="#8b5cf6" />
        </div>
      )}

      {/* Acciones rápidas */}
      <p style={{ margin: '0 0 12px', fontSize: '11px', fontFamily: 'monospace', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Acciones rápidas
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <AccionCard to="/ventas" icon={<ClipboardList size={20} color={RED} />} title="Ver ventas del día" desc="Calculado desde apertura − cierre de inventario" urgente={esNoche} />
        <AccionCard to="/cierre" icon={<Scale size={20} color={RED} />} title="Cierre de inventario" desc="Registrar stock final de cada producto" urgente={esNoche} />
        <AccionCard to="/compras" icon={<ShoppingCart size={20} color={RED} />} title="Registrar compra" desc="Ingresar productos que llegaron hoy" urgente={false} />
        <AccionCard to="/merma" icon={<BarChart3 size={20} color={RED} />} title="Ver análisis de merma" desc="Consumo real vs teórico por ingrediente" urgente={false} />
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, accent }: { icon: ReactNode, label: string, value: string | number, sub: string, accent: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px', borderTop: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        {icon}
        <span style={{ fontSize: '11px', color: C.muted, fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: C.text, fontFamily: 'monospace' }}>{value}</p>
      <p style={{ margin: '3px 0 0', fontSize: '11px', color: C.muted }}>{sub}</p>
    </div>
  )
}

function AccionCard({ to, icon, title, desc, urgente }: { to: string, icon: ReactNode, title: string, desc: string, urgente: boolean }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: '14px',
      background: C.card, border: `1px solid ${urgente ? '#fca5a5' : C.border}`,
      borderLeft: `4px solid ${urgente ? RED : '#d1d5db'}`,
      borderRadius: '10px', padding: '14px 16px',
      textDecoration: 'none', transition: 'all 0.15s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = RED; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 2px 8px rgba(185,28,28,0.1)' }}
    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = urgente ? RED : '#d1d5db'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none' }}
    >
      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: C.text }}>{title}</p>
          {urgente && <span style={{ fontSize: '10px', fontFamily: 'monospace', background: '#fee2e2', color: RED, border: '1px solid #fca5a5', padding: '1px 6px', borderRadius: '20px', fontWeight: 600 }}>HOY</span>}
        </div>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: C.muted }}>{desc}</p>
      </div>
      <span style={{ color: '#9ca3af', fontSize: '18px', flexShrink: 0 }}>›</span>
    </Link>
  )
}
