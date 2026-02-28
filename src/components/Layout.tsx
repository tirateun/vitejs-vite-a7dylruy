import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, Scale, ShoppingCart, BarChart3, LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

interface LayoutProps { children: ReactNode }

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas',    icon: ClipboardList,   label: 'Ventas'    },
  { to: '/cierre',   icon: Scale,           label: 'Inventario'},
  { to: '/compras',  icon: ShoppingCart,    label: 'Compras'   },
  { to: '/merma',    icon: BarChart3,       label: 'Merma'     },
]

const RED = '#b91c1c'

export default function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.png" alt="Pizza Estefano" style={{ width: '56px', height: '56px', objectFit: 'contain', flexShrink: 0, mixBlendMode: "screen" }} />
          <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: '16px', color: '#fff', lineHeight: 1.1 }}>Pizza Estefano</p>
            <p style={{ margin: 0, fontWeight: 400, fontSize: '11px', color: '#fecaca', lineHeight: 1.4 }}>Sistema de Inventario</p>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <p style={{ fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '4px 8px 10px', margin: 0 }}>Módulos</p>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '10px',
              textDecoration: 'none', transition: 'all 0.15s',
              background: isActive ? 'rgba(0,0,0,0.3)' : 'transparent',
              color: '#fff', fontWeight: isActive ? 700 : 400,
            })}>
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <span style={{ fontSize: '14px' }}>{label}</span>
                {isActive && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.25)' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
          <p style={{ margin: 0, fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Sesión activa</p>
          <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#fecaca', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
        </div>
        <button onClick={handleSignOut} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 12px', borderRadius: '10px', fontFamily: 'inherit',
          background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)',
          color: '#fff', cursor: 'pointer', fontSize: '13px',
        }}><LogOut size={15} /> Cerrar sesión</button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ width: '240px', flexShrink: 0, background: RED, position: 'sticky', top: 0, height: '100dvh', overflowY: 'auto', display: 'none' }} className="sidebar-desktop">
        <SidebarContent />
      </aside>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />}
      <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: '240px', background: RED, zIndex: 50, transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease', overflowY: 'auto' }}>
        <SidebarContent />
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#fff', color: '#1a1a1a' }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 30, background: RED, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '56px' }}>
          <button onClick={() => setOpen(!open)} style={{ padding: '8px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: '8px' }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src="/logo.png" alt="Pizza Estefano" style={{ width: '28px', height: '28px', objectFit: 'contain', mixBlendMode: "screen" }} />
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>Pizza Estefano</span>
          </div>
          <div style={{ width: '36px' }} />
        </header>
        <main style={{ flex: 1, overflowY: 'auto' }}>{children}</main>
      </div>
      <style>{`
        @media (min-width: 768px) { .sidebar-desktop { display: block !important; } header { display: none !important; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.2); border-radius: 2px; }
        a { text-decoration: none; } button { font-family: inherit; }
      `}</style>
    </div>
  )
}
