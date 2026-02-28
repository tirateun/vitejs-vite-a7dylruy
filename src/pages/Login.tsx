import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'

const LOGO = 'data:image/png;base64,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'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError('Correo o contraseña incorrectos'); return }
    navigate('/dashboard')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Panel izquierdo */}
      <div style={{
        width: '420px', flexShrink: 0,
        background: 'linear-gradient(160deg, #7f1d1d 0%, #b91c1c 45%, #991b1b 100%)',
        display: 'flex', flexDirection: 'column',
        padding: '48px 40px', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src={LOGO} alt="Pizza Estefano" style={{ width: '88px', height: '88px', objectFit: 'contain', mixBlendMode: 'screen', marginBottom: '24px' }} />
          <h1 style={{ margin: '0 0 6px', fontSize: '32px', fontWeight: 900, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.5px' }}>Pizza Estefano</h1>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 400, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Restaurant · Callao</p>
        </div>

        <div style={{ width: '48px', height: '3px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', margin: '36px 0', position: 'relative', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
          <p style={{ margin: '0 0 32px', fontSize: '20px', fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>
            Sistema de Gestión de Inventario
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { icon: '📦', text: 'Control de stock diario' },
              { icon: '📊', text: 'Análisis de merma por ingrediente' },
              { icon: '🛒', text: 'Registro de compras y ventas' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: 'relative', zIndex: 1, margin: '40px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>
          © 2026 Pizza Estefano · Todos los derechos reservados
        </p>
      </div>

      {/* Panel derecho */}
      <div style={{ flex: 1, background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: '400px' }}>

          <div style={{ marginBottom: '40px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '11px', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Acceso al sistema
            </p>
            <h2 style={{ margin: '0 0 8px', fontSize: '28px', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
              Iniciar sesión
            </h2>
            <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
              Ingresa tus credenciales para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Correo electrónico
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#9ca3af" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com" required autoFocus
                  style={{ width: '100%', padding: '13px 14px 13px 42px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = '#b91c1c'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#9ca3af" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: '100%', padding: '13px 44px 13px 42px', border: '1.5px solid #e5e7eb', borderRadius: '10px', fontSize: '14px', color: '#111827', background: '#fff', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                  onFocus={e => e.target.style.borderColor = '#b91c1c'}
                  onBlur={e => e.target.style.borderColor = '#e5e7eb'} />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: '2px', display: 'flex' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '10px 14px' }}>
                <AlertCircle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? '#d1d5db' : '#b91c1c',
              border: 'none', borderRadius: '10px',
              color: '#fff', fontWeight: 700, fontSize: '15px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(185,28,28,0.3)',
              marginTop: '4px',
            }}>
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>

          <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #e5e7eb' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
              ¿Problemas para ingresar? Contacta al administrador del sistema
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left { display: none !important; }
        }
      `}</style>
    </div>
  )
}
