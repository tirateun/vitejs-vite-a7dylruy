import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MessageSquare, Printer, CheckCircle, ChefHat, RefreshCw, Send, Bell } from 'lucide-react'

const WHATSAPP_TOKEN = 'EAAuhJL2hSGcBRhTXPcZASZCzGp90ieskpdvQpZBSaaRyE7RFe9R7FDxiRZBi1wbdjtcGwjx1L0hmkeAtVfS9hHMplRTPldVbhoLAevdKEjfDz7i7V5RdfSThAIxN4DOGyZCiazENO0Pnstf1AoDgNVBy9ZCHIbYLPvW1cZC1EFEn5PnR76C54zPcN57tuzl0gZDZD'
const PHONE_NUMBER_ID = '1138917629305752'
const GOOGLE_MAPS_KEY = 'AIzaSyC1R4KX6wZ6C0t8vcrt3eN2RBNaXx_-TPM'

type EstadoPedido = 'nuevo' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
type TabDetalle = 'conversacion' | 'detalle' | 'mapa'

interface ItemPedido { descripcion: string; precio?: number; mitad?: string }

interface Pedido {
  id: string; telefono: string; nombre_cliente: string
  items: ItemPedido[]; subtotal: number; costo_delivery: number; total: number
  tipo_entrega: string; direccion: string; medio_pago: string
  observaciones: string; estado: EstadoPedido; notas: string; created_at: string
  comprobante_tipo: string; comprobante_dni: string; comprobante_ruc: string
}

interface Mensaje {
  id: string; telefono: string; nombre_cliente: string
  rol: 'user' | 'assistant'; mensaje: string; created_at: string
}

interface Conversacion {
  telefono: string; nombre: string
  ultimoMensaje: string; ultimoRol: 'user' | 'assistant'
  ultimoAt: string; noLeidos: number
  pedido?: Pedido
}

const ESTADOS = [
  { key: 'nuevo' as EstadoPedido,          label: 'Nuevo',     color: '#f59e0b', icon: Bell },
  { key: 'en_preparacion' as EstadoPedido, label: 'En cocina', color: '#8b5cf6', icon: ChefHat },
  { key: 'entregado' as EstadoPedido,      label: 'Entregado', color: '#6b7280', icon: CheckCircle },
]

const R = '#b91c1c'

function hora(iso: string) {
  const d = new Date(iso)
  const hoy = new Date()
  const esHoy = d.toDateString() === hoy.toDateString()
  if (esHoy) return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' })
}

function iniciales(nombre: string) {
  return (nombre || '?').trim().split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

function imprimirTicket(pedido: Pedido) {
  const h = new Date(pedido.created_at).toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
  const items = pedido.items?.length > 0
    ? pedido.items.map(i => `<div class="item"><span>${i.descripcion||''}</span>${i.mitad?`<div class="obs">&#9654; Mitad: ${i.mitad}</div>`:''}${i.precio?`<span class="precio">S/${Number(i.precio).toFixed(2)}</span>`:''}</div>`).join('')
    : '<div class="item"><span>Ver conversacion</span></div>'
  const comp = (() => {
    const t = pedido.comprobante_tipo
    if (!t || t==='ninguno') return ''
    const lbl = t==='boleta_simple'?'BOLETA SIMPLE':t==='boleta_dni'?'BOLETA CON DNI':'FACTURA'
    const det = t==='boleta_dni'&&pedido.comprobante_dni?`DNI: ${pedido.comprobante_dni}`:t==='factura'&&pedido.comprobante_ruc?`RUC: ${pedido.comprobante_ruc}`:''
    return `<div class="linea"></div><div class="alerta">📄 ${lbl}</div>${det?`<div class="centro negrita">${det}</div>`:''}`
  })()
  const html = `<html><head><style>
    body{font-family:monospace;font-size:12px;width:280px;margin:0;padding:8px}
    .centro{text-align:center}.negrita{font-weight:bold}.grande{font-size:16px}
    .linea{border-top:1px dashed #000;margin:6px 0}.item{display:flex;justify-content:space-between;margin:3px 0}
    .obs{font-size:11px;color:#555;margin-left:8px}.precio{font-weight:bold}
    .total{font-size:14px;font-weight:bold;display:flex;justify-content:space-between;margin-top:4px}
    .alerta{background:#000;color:#fff;text-align:center;padding:3px;font-weight:bold;font-size:11px}
  </style></head><body>
    <div class="centro negrita grande">PIZZA ESTEFANO</div>
    <div class="centro">Av. Pacífico 107, La Perla - Callao</div>
    <div class="centro">939 688 141</div>
    <div class="linea"></div>
    <div class="centro negrita">${h}</div>
    <div class="linea"></div>
    <div><b>Cliente:</b> ${pedido.nombre_cliente||'Sin nombre'}</div>
    <div><b>Tel:</b> ${pedido.telefono}</div>
    <div><b>Entrega:</b> ${pedido.tipo_entrega==='delivery'?'🛵 DELIVERY':'🏠 RECOJO'}</div>
    ${pedido.direccion?`<div><b>Dir:</b> ${pedido.direccion}</div>`:''}
    <div class="linea"></div>
    ${items}
    <div class="linea"></div>
    ${pedido.subtotal?`<div class="item"><span>Subtotal</span><span>S/${Number(pedido.subtotal).toFixed(2)}</span></div>`:''}
    ${pedido.costo_delivery?`<div class="item"><span>Delivery</span><span>S/${Number(pedido.costo_delivery).toFixed(2)}</span></div>`:''}
    <div class="total"><span>TOTAL</span><span>S/${Number(pedido.total||0).toFixed(2)}</span></div>
    <div class="linea"></div>
    <div><b>Pago:</b> ${pedido.medio_pago||'Sin especificar'}</div>
    ${pedido.observaciones&&pedido.observaciones.toLowerCase()!=='no'&&pedido.observaciones.toLowerCase()!=='ninguna'?`<div class="linea"></div><div class="alerta">⚠ COCINA: ${pedido.observaciones}</div>`:''}
    ${comp}
    <div class="linea"></div>
    <div class="centro">*** Gracias por su pedido ***</div>
    <br/><br/><br/>
  </body></html>`
  const w = window.open('','_blank','width=420,height=700')
  if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(()=>{w.print();w.close()},600) }
}

export default function PedidosBot() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([])
  const [convSeleccionada, setConvSeleccionada] = useState<Conversacion | null>(null)
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [tab, setTab] = useState<'chats'|'historial'>('chats')
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('conversacion')
  const [enviando, setEnviando] = useState(false)
  const [botPausado, setBotPausado] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const convSeleccionadaRef = useRef<Conversacion | null>(null)

  // Mantener ref sincronizado con el estado
  useEffect(() => { convSeleccionadaRef.current = convSeleccionada }, [convSeleccionada])

  // Sonido de notificación
  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      // Dos beeps cortos
      ;[0, 0.15].forEach(delay => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 1000
        gain.gain.setValueAtTime(0.4, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.12)
        osc.start(ctx.currentTime + delay)
        osc.stop(ctx.currentTime + delay + 0.12)
      })
    } catch(e) { console.log('Audio error:', e) }
  }

  // Tracking de último mensaje para detectar nuevos
  const ultimoMensajeId = useRef<string>('')
  const ultimoPedidoId = useRef<string>('')

  useEffect(() => {
    if ('Notification' in window) Notification.requestPermission()
    cargarTodo()

    // Polling cada 3 segundos para mensajes
    const intervalMensajes = setInterval(async () => {
      const hoy = new Date(); hoy.setHours(0,0,0,0)
      const { data } = await supabase
        .from('whatsapp_conversaciones')
        .select('telefono,nombre_cliente,mensaje,rol,created_at,id')
        .gte('created_at', hoy.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (!data || data.length === 0) return
      const ultimo = data[0]

      // Si hay un mensaje nuevo del cliente
      if (ultimo.id !== ultimoMensajeId.current) {
        ultimoMensajeId.current = ultimo.id

        if (ultimo.rol === 'user') {
          playSound()
          if (Notification.permission === 'granted')
            new Notification(`Mensaje de ${ultimo.nombre_cliente || ultimo.telefono}`, { body: ultimo.mensaje })
        }

        // Actualizar conversaciones
        setConversaciones(prev => {
          const existe = prev.find(c => c.telefono === ultimo.telefono)
          const noLeidos = ultimo.rol === 'user' && convSeleccionadaRef.current?.telefono !== ultimo.telefono ? 1 : 0
          if (existe) {
            return [
              { ...existe, ultimoMensaje: ultimo.mensaje, ultimoRol: ultimo.rol, ultimoAt: ultimo.created_at, noLeidos: noLeidos ? existe.noLeidos + 1 : existe.noLeidos, nombre: ultimo.nombre_cliente || existe.nombre },
              ...prev.filter(c => c.telefono !== ultimo.telefono)
            ]
          } else {
            return [{ telefono: ultimo.telefono, nombre: ultimo.nombre_cliente || ultimo.telefono, ultimoMensaje: ultimo.mensaje, ultimoRol: ultimo.rol, ultimoAt: ultimo.created_at, noLeidos }, ...prev]
          }
        })

        // Si es la conversación activa, recargar mensajes
        if (convSeleccionadaRef.current?.telefono === ultimo.telefono) {
          cargarMensajes(ultimo.telefono)
        }
      }
    }, 3000)

    // Polling cada 5 segundos para pedidos
    const intervalPedidos = setInterval(async () => {
      const hoy = new Date(); hoy.setHours(0,0,0,0)
      const { data } = await supabase
        .from('whatsapp_pedidos')
        .select('*')
        .gte('created_at', hoy.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)

      if (!data || data.length === 0) return
      const ultimo = data[0]

      if (ultimo.id !== ultimoPedidoId.current && ultimoPedidoId.current !== '') {
        ultimoPedidoId.current = ultimo.id
        setPedidos(prev => [ultimo, ...prev.filter(p => p.id !== ultimo.id)])
        playSound()
        if (Notification.permission === 'granted')
          new Notification('Nuevo pedido 🍕', { body: `${ultimo.nombre_cliente || 'Cliente'} - ${ultimo.tipo_entrega === 'delivery' ? 'Delivery' : 'Recojo'}` })
        imprimirTicket(ultimo)
      } else if (ultimoPedidoId.current === '') {
        ultimoPedidoId.current = ultimo.id
      }
    }, 5000)

    return () => {
      clearInterval(intervalMensajes)
      clearInterval(intervalPedidos)
    }
  }, [])

  async function cargarTodo() {
    await Promise.all([cargarPedidos(), cargarConversaciones()])
  }

  async function cargarPedidos() {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const { data } = await supabase.from('whatsapp_pedidos').select('*').gte('created_at', hoy.toISOString()).order('created_at', { ascending:false }).limit(100)
    if (data) setPedidos(data)
  }

  async function cargarConversaciones() {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const { data } = await supabase.from('whatsapp_conversaciones').select('telefono,nombre_cliente,mensaje,rol,created_at').gte('created_at', hoy.toISOString()).order('created_at', { ascending:false }).limit(1000)
    if (!data) return

    const map = new Map<string, Conversacion>()
    for (const m of data) {
      if (!map.has(m.telefono)) {
        map.set(m.telefono, {
          telefono: m.telefono,
          nombre: m.nombre_cliente || m.telefono,
          ultimoMensaje: m.mensaje,
          ultimoRol: m.rol,
          ultimoAt: m.created_at,
          noLeidos: m.rol==='user' ? 1 : 0,
        })
      } else if (m.rol==='user') {
        map.get(m.telefono)!.noLeidos++
      }
    }
    const lista = Array.from(map.values()).sort((a,b) => new Date(b.ultimoAt).getTime() - new Date(a.ultimoAt).getTime())
    setConversaciones(lista)
  }

  async function cargarMensajes(telefono: string) {
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const { data } = await supabase.from('whatsapp_conversaciones').select('*').eq('telefono', telefono).gte('created_at', hoy.toISOString()).order('created_at', { ascending:true }).limit(200)
    if (data) {
      setMensajes(data)
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior:'smooth' }), 100)
    }
  }

  function seleccionar(conv: Conversacion) {
    setConvSeleccionada(conv)
    const p = pedidos.find(x => x.telefono===conv.telefono) || null
    setPedidoSeleccionado(p)
    cargarMensajes(conv.telefono)
    setTabDetalle('conversacion')
    setConversaciones(prev => prev.map(c => c.telefono===conv.telefono ? {...c, noLeidos:0} : c))
  }

  async function enviar() {
    if (!convSeleccionada || !texto.trim()) return
    setEnviando(true)
    try {
      await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
        method:'POST',
        headers:{ 'Authorization':'Bearer '+WHATSAPP_TOKEN, 'Content-Type':'application/json' },
        body: JSON.stringify({ messaging_product:'whatsapp', to:convSeleccionada.telefono, type:'text', text:{ body:texto } })
      })
      await supabase.from('whatsapp_conversaciones').insert({ telefono:convSeleccionada.telefono, rol:'assistant', mensaje:texto, nombre_cliente:'Pizza Estefano (manual)' })
      setTexto('')
      await cargarMensajes(convSeleccionada.telefono)
    } finally { setEnviando(false) }
  }

  async function cambiarEstado(pedido: Pedido, estado: EstadoPedido) {
    await supabase.from('whatsapp_pedidos').update({ estado, updated_at:new Date().toISOString() }).eq('id', pedido.id)
  }

  const historial = pedidos.filter(p => ['entregado','cancelado'].includes(p.estado))
  const totalNoLeidos = conversaciones.reduce((s,c) => s+c.noLeidos, 0)

  // Preview del último mensaje
  function preview(msg: string) {
    if (!msg) return ''
    if (msg.startsWith('[QR Yape')) return '📷 QR Yape'
    if (msg.startsWith('[COMPROBANTE')) return '📸 Comprobante'
    if (msg.startsWith('[UBICACION')) return '📍 Ubicación compartida'
    if (msg.startsWith('[ZONA DETECTADA')) return '✅ Zona detectada'
    if (msg === '[INICIO NUEVA SESION]') return '— Nueva sesión —'
    if (msg.startsWith('*CARTA PIZZA')) return '📋 Carta enviada'
    if (msg.startsWith('*PROMOCIONES')) return '🔥 Promos enviadas'
    return msg.length > 42 ? msg.slice(0,42)+'…' : msg
  }

  return (
    <div style={{ display:'flex', height:'calc(100dvh - 56px)', overflow:'hidden', fontFamily:'system-ui,sans-serif' }}>

      {/* ── PANEL IZQUIERDO ── */}
      <div style={{ width:'340px', flexShrink:0, display:'flex', flexDirection:'column', background:'#fff', borderRight:'1px solid #e5e7eb' }}>

        {/* Header */}
        <div style={{ padding:'14px 16px', background:R, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:'15px' }}>Pizza Estefano</div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:'11px' }}>Panel de pedidos · Bot en vivo</div>
          </div>
          <button onClick={cargarTodo} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:'8px', padding:'7px', cursor:'pointer', color:'#fff', display:'flex' }}>
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb' }}>
          <button onClick={() => setTab('chats')}
            style={{ flex:1, padding:'10px', background:'none', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:tab==='chats'?700:500, borderBottom:tab==='chats'?`2px solid ${R}`:'2px solid transparent', color:tab==='chats'?R:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
            Chats ({conversaciones.length})
            {totalNoLeidos > 0 && <span style={{ background:R, color:'#fff', borderRadius:'10px', padding:'0 6px', fontSize:'10px', fontWeight:700 }}>{totalNoLeidos}</span>}
          </button>
          <button onClick={() => setTab('historial')}
            style={{ flex:1, padding:'10px', background:'none', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:tab==='historial'?700:500, borderBottom:tab==='historial'?`2px solid ${R}`:'2px solid transparent', color:tab==='historial'?R:'#6b7280' }}>
            Historial ({historial.length})
          </button>
        </div>

        {/* Lista */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {tab === 'chats' ? (
            conversaciones.length === 0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center', color:'#9ca3af' }}>
                <MessageSquare size={32} style={{ opacity:0.3, display:'block', margin:'0 auto 8px' }} />
                <p style={{ margin:0, fontSize:'13px' }}>Sin conversaciones hoy</p>
              </div>
            ) : conversaciones.map(conv => {
              const ped = pedidos.find(p => p.telefono===conv.telefono)
              const est = ped ? (ESTADOS.find(e=>e.key===ped.estado)||ESTADOS[0]) : null
              const sel = convSeleccionada?.telefono === conv.telefono
              const hayNoLeidos = conv.noLeidos > 0
              const prev = preview(conv.ultimoMensaje)
              const esUser = conv.ultimoRol === 'user'

              return (
                <div key={conv.telefono} onClick={() => seleccionar(conv)}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderBottom:'1px solid #f3f4f6', cursor:'pointer', background: sel ? '#fef2f2' : '#fff', borderLeft: sel ? `3px solid ${R}` : '3px solid transparent', transition:'background 0.1s' }}>

                  {/* Avatar */}
                  <div style={{ width:'44px', height:'44px', borderRadius:'50%', flexShrink:0, background: ped ? R : '#6b7280', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700, color:'#fff', letterSpacing:'-0.5px' }}>
                    {iniciales(conv.nombre)}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    {/* Fila 1: nombre + hora */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:'2px' }}>
                      <span style={{ fontWeight: hayNoLeidos ? 700 : 500, fontSize:'13px', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'165px' }}>
                        {conv.nombre}
                      </span>
                      <span style={{ fontSize:'11px', color: hayNoLeidos ? R : '#9ca3af', flexShrink:0, marginLeft:'4px' }}>
                        {hora(conv.ultimoAt)}
                      </span>
                    </div>
                    {/* Fila 2: preview + badges */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:'12px', color: hayNoLeidos ? '#374151' : '#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'185px', fontWeight: hayNoLeidos ? 500 : 400 }}>
                        {!esUser && <span style={{ color:'#9ca3af', marginRight:'2px' }}>✓</span>}
                        {prev}
                      </span>
                      <div style={{ display:'flex', gap:'4px', alignItems:'center', flexShrink:0, marginLeft:'4px' }}>
                        {est && (
                          <span style={{ fontSize:'10px', background:est.color+'22', color:est.color, padding:'1px 5px', borderRadius:'8px', fontWeight:600, whiteSpace:'nowrap' }}>
                            {est.label}
                          </span>
                        )}
                        {conv.noLeidos > 0 && (
                          <span style={{ background:R, color:'#fff', borderRadius:'50%', minWidth:'18px', height:'18px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, padding:'0 3px' }}>
                            {conv.noLeidos > 9 ? '9+' : conv.noLeidos}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            // Historial
            historial.length === 0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center', color:'#9ca3af' }}>
                <MessageSquare size={32} style={{ opacity:0.3, display:'block', margin:'0 auto 8px' }} />
                <p style={{ margin:0, fontSize:'13px' }}>Sin historial hoy</p>
              </div>
            ) : historial.map(p => {
              const sel = pedidoSeleccionado?.id === p.id
              return (
                <div key={p.id} onClick={() => { setPedidoSeleccionado(p); setConvSeleccionada(null); cargarMensajes(p.telefono); setTabDetalle('conversacion') }}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderBottom:'1px solid #f3f4f6', cursor:'pointer', background: sel ? '#fef2f2' : '#fff', borderLeft: sel ? `3px solid ${R}` : '3px solid transparent' }}>
                  <div style={{ width:'44px', height:'44px', borderRadius:'50%', flexShrink:0, background:'#6b7280', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700, color:'#fff' }}>
                    {iniciales(p.nombre_cliente)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
                      <span style={{ fontWeight:600, fontSize:'13px', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'170px' }}>{p.nombre_cliente||'Cliente'}</span>
                      <span style={{ fontSize:'11px', color:'#9ca3af' }}>{hora(p.created_at)}</span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'12px', color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'165px' }}>{p.items?.[0]?.descripcion||'Sin detalle'}</span>
                      {p.total && <span style={{ fontSize:'12px', fontWeight:700, color:'#6b7280' }}>S/{Number(p.total).toFixed(2)}</span>}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── PANEL DERECHO ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, background:'#f0f0f0' }}>
        {convSeleccionada || pedidoSeleccionado ? (() => {
          const p = pedidoSeleccionado
          const conv = convSeleccionada
          const nombre = p?.nombre_cliente || conv?.nombre || 'Cliente'
          const telefono = p?.telefono || conv?.telefono || ''
          const msgsFiltrados = mensajes.filter(m => m.telefono === telefono)

          return (
            <>
              {/* Header conversación */}
              <div style={{ padding:'12px 16px', background:'#fff', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', minWidth:0 }}>
                  <div style={{ width:'38px', height:'38px', borderRadius:'50%', background: p ? R : '#6b7280', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, color:'#fff' }}>
                    {iniciales(nombre)}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:'14px', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nombre}</div>
                    <div style={{ fontSize:'11px', color:'#6b7280' }}>
                      +{telefono}
                      {p && ` · ${p.tipo_entrega==='delivery'?'🛵 Delivery':'🏠 Recojo'}`}
                      {p?.total && ` · S/${Number(p.total).toFixed(2)}`}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', flexShrink:0, alignItems:'center' }}>
                  {/* Botón Tomar control / Bot activo */}
                  <button onClick={() => setBotPausado(!botPausado)}
                    style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', borderRadius:'20px', border:`1.5px solid ${botPausado?'#f59e0b':'#10b981'}`, background: botPausado?'#fef3c7':'#ecfdf5', color: botPausado?'#92400e':'#065f46', cursor:'pointer', fontSize:'11px', fontWeight:700 }}>
                    {botPausado ? '⏸ Bot pausado' : '🤖 Bot activo'}
                  </button>
                  {p && (
                    <button onClick={() => imprimirTicket(p)}
                      style={{ display:'flex', alignItems:'center', gap:'5px', background:'#1a1a1a', color:'#fff', border:'none', borderRadius:'8px', padding:'7px 12px', cursor:'pointer', fontSize:'12px', fontWeight:600 }}>
                      <Printer size={13} /> Imprimir
                    </button>
                  )}
                </div>
              </div>

              {/* Alerta observaciones */}
              {p?.observaciones && p.observaciones.toLowerCase()!=='no' && p.observaciones.toLowerCase()!=='ninguna' && (
                <div style={{ padding:'8px 16px', background:'#fef3c7', borderBottom:'1px solid #fcd34d', fontSize:'12px', fontWeight:600, color:'#92400e', display:'flex', alignItems:'center', gap:'6px' }}>
                  ⚠️ Cocina: {p.observaciones}
                </div>
              )}

              {/* Estados + Tabs */}
              {p && (
                <div style={{ padding:'8px 16px', borderBottom:'1px solid #e5e7eb', background:'#fff', display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'11px', color:'#6b7280', marginRight:'2px' }}>Estado:</span>
                  {ESTADOS.map(e => (
                    <button key={e.key} onClick={() => cambiarEstado(p, e.key)}
                      style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', borderRadius:'16px', border:`1.5px solid ${e.color}`, background: p.estado===e.key ? e.color : 'transparent', color: p.estado===e.key ? '#fff' : e.color, cursor:'pointer', fontSize:'11px', fontWeight:600, transition:'all 0.15s' }}>
                      <e.icon size={11} /> {e.label}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', background:'#fff' }}>
                {[{ k:'conversacion' as TabDetalle, l:'Conversación' }, { k:'detalle' as TabDetalle, l:'Detalle' }, { k:'mapa' as TabDetalle, l:'📍 Mapa' }].map(t => (
                  <button key={t.k} onClick={() => setTabDetalle(t.k)}
                    style={{ padding:'9px 18px', background:'none', border:'none', cursor:'pointer', fontSize:'12px', fontWeight:tabDetalle===t.k?700:400, borderBottom:tabDetalle===t.k?`2px solid ${R}`:'2px solid transparent', color:tabDetalle===t.k?R:'#6b7280' }}>
                    {t.l}
                  </button>
                ))}
              </div>

              {/* Tab conversación */}
              {tabDetalle === 'conversacion' && (
                <>
                  <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:'8px' }}>
                    {msgsFiltrados.length === 0 && (
                      <div style={{ textAlign:'center', color:'#9ca3af', marginTop:'40px', fontSize:'13px' }}>Sin mensajes hoy</div>
                    )}
                    {msgsFiltrados.map(msg => (
                      <div key={msg.id} style={{ display:'flex', justifyContent: msg.rol==='user'?'flex-start':'flex-end' }}>
                        <div style={{ maxWidth:'75%', background: msg.rol==='user'?'#fff':'#dcf8c6', padding:'9px 13px', borderRadius: msg.rol==='user'?'0 12px 12px 12px':'12px 0 12px 12px', fontSize:'13px', color:'#1a1a1a', boxShadow:'0 1px 2px rgba(0,0,0,0.08)', lineHeight:'1.45' }}>
                          {msg.mensaje.startsWith('[QR Yape enviado - ') ? (
                            <img src={msg.mensaje.slice(19,-1)} alt="QR Yape" style={{ width:'140px', borderRadius:'8px' }} />
                          ) : msg.mensaje.startsWith('[COMPROBANTE:') ? (
                            <div>
                              <p style={{ margin:'0 0 5px', fontSize:'11px', color:'#6b7280' }}>📸 Comprobante:</p>
                              <img src={msg.mensaje.slice(13,-1)} alt="Comprobante" style={{ width:'190px', borderRadius:'8px', cursor:'pointer' }} onClick={() => window.open(msg.mensaje.slice(13,-1),'_blank')} />
                            </div>
                          ) : msg.mensaje.startsWith('[UBICACION compartida:') ? (() => {
                            const c = msg.mensaje.match(/\[UBICACION compartida: ([-\d.]+),([-\d.]+)\]/)
                            if (!c) return <div style={{ whiteSpace:'pre-wrap' }}>{msg.mensaje}</div>
                            return (
                              <div>
                                <p style={{ margin:'0 0 5px', fontSize:'11px', color:'#6b7280' }}>📍 Ubicación del cliente:</p>
                                <iframe src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${c[1]},${c[2]}&zoom=16`} width="200" height="140" style={{ border:0, borderRadius:'8px', display:'block' }} loading="lazy" allowFullScreen />
                                <a href={`https://www.google.com/maps?q=${c[1]},${c[2]}`} target="_blank" rel="noreferrer" style={{ display:'inline-block', marginTop:'5px', fontSize:'11px', color:'#2563eb', fontWeight:600 }}>🗺 Abrir en Maps</a>
                              </div>
                            )
                          })() : msg.mensaje.startsWith('[ZONA DETECTADA POR GPS:') ? (() => {
                            const m = msg.mensaje.match(/Zona (\d+) - S\/([\d.]+) - distancia: ([\d.]+)km/)
                            if (!m) return <div style={{ whiteSpace:'pre-wrap' }}>{msg.mensaje}</div>
                            return (
                              <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'7px 10px' }}>
                                <p style={{ margin:0, fontSize:'12px', fontWeight:700, color:'#15803d' }}>✅ Zona detectada por GPS</p>
                                <p style={{ margin:'2px 0 0', fontSize:'12px', color:'#166534' }}>Zona {m[1]} · S/{m[2]} · {m[3]}km</p>
                              </div>
                            )
                          })() : msg.mensaje === '[INICIO NUEVA SESION]' ? (
                            <div style={{ textAlign:'center', fontSize:'11px', color:'#9ca3af', fontStyle:'italic' }}>— Nuevo pedido —</div>
                          ) : (
                            <div style={{ whiteSpace:'pre-wrap' }}>{msg.mensaje}</div>
                          )}
                          <div style={{ fontSize:'10px', color:'#9ca3af', marginTop:'3px', textAlign:'right' }}>{hora(msg.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input mensaje */}
                  <div style={{ padding:'10px 14px', borderTop:'1px solid #e5e7eb', background:'#fff', display:'flex', gap:'10px', alignItems:'flex-end' }}>
                    {botPausado && (
                      <div style={{ position:'absolute', fontSize:'10px', color:'#92400e', background:'#fef3c7', padding:'2px 8px', borderRadius:'8px', marginBottom:'4px' }}>
                        Bot pausado · Modo manual
                      </div>
                    )}
                    <div style={{ flex:1, background:'#f3f4f6', borderRadius:'22px', padding:'9px 15px' }}>
                      <textarea value={texto} onChange={e => setTexto(e.target.value)}
                        onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                        placeholder="Mensaje manual... (Enter para enviar)"
                        style={{ width:'100%', background:'none', border:'none', outline:'none', resize:'none', fontSize:'13px', fontFamily:'inherit', color:'#1a1a1a', maxHeight:'80px' }}
                        rows={1} />
                    </div>
                    <button onClick={enviar} disabled={enviando || !texto.trim()}
                      style={{ background:R, border:'none', borderRadius:'50%', width:'40px', height:'40px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, opacity:(!texto.trim()||enviando)?0.45:1 }}>
                      <Send size={15} color="#fff" />
                    </button>
                  </div>
                </>
              )}

              {/* Tab detalle */}
              {tabDetalle === 'detalle' && p && (
                <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
                  <div style={{ background:'#fff', borderRadius:'12px', padding:'18px', border:'1px solid #e5e7eb', display:'flex', flexDirection:'column', gap:'12px' }}>
                    {/* Items */}
                    <div style={{ padding:'12px', background:'#f9fafb', borderRadius:'8px' }}>
                      <p style={{ margin:'0 0 8px', fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Items</p>
                      {p.items?.length > 0 ? p.items.map((item,i) => (
                        <div key={i} style={{ marginBottom:'6px', paddingBottom:'6px', borderBottom: i < p.items.length-1 ? '1px solid #e5e7eb' : 'none' }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ fontSize:'13px' }}>{item.descripcion}</span>
                            {item.precio && <span style={{ fontSize:'13px', fontWeight:600 }}>S/{Number(item.precio).toFixed(2)}</span>}
                          </div>
                          {item.mitad && <div style={{ fontSize:'11px', color:'#6b7280' }}>↳ {item.mitad}</div>}
                        </div>
                      )) : <p style={{ margin:0, fontSize:'13px', color:'#9ca3af' }}>Ver conversación</p>}
                    </div>
                    {/* Totales */}
                    <div style={{ padding:'12px', background:'#f9fafb', borderRadius:'8px' }}>
                      {p.subtotal && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}><span style={{ fontSize:'13px', color:'#6b7280' }}>Subtotal</span><span>S/{Number(p.subtotal).toFixed(2)}</span></div>}
                      {p.costo_delivery ? <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}><span style={{ fontSize:'13px', color:'#6b7280' }}>Delivery</span><span>S/{Number(p.costo_delivery).toFixed(2)}</span></div> : null}
                      {p.total && <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'6px', borderTop:'1px solid #e5e7eb' }}><span style={{ fontSize:'15px', fontWeight:700 }}>TOTAL</span><span style={{ fontSize:'15px', fontWeight:700, color:R }}>S/{Number(p.total).toFixed(2)}</span></div>}
                    </div>
                    {/* Entrega */}
                    <div style={{ padding:'12px', background:'#f9fafb', borderRadius:'8px' }}>
                      <p style={{ margin:'0 0 4px', fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Entrega</p>
                      <p style={{ margin:0, fontSize:'13px', fontWeight:600 }}>{p.tipo_entrega==='delivery'?'🛵 Delivery':'🏠 Recojo'}</p>
                      {p.direccion && <p style={{ margin:'3px 0 0', fontSize:'12px', color:'#6b7280' }}>{p.direccion}</p>}
                    </div>
                    {/* Pago */}
                    <div style={{ padding:'12px', background:'#f9fafb', borderRadius:'8px' }}>
                      <p style={{ margin:'0 0 4px', fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Pago</p>
                      <p style={{ margin:0, fontSize:'13px', fontWeight:600 }}>{p.medio_pago==='yape'?'📱 Yape':p.medio_pago==='tarjeta'?'💳 Tarjeta':p.medio_pago==='efectivo'?'💵 Efectivo':p.medio_pago||'Sin especificar'}</p>
                    </div>
                    {/* Comprobante */}
                    {p.comprobante_tipo && p.comprobante_tipo!=='ninguno' && (
                      <div style={{ padding:'12px', background:'#fffbeb', borderRadius:'8px', border:'1px solid #fcd34d' }}>
                        <p style={{ margin:'0 0 4px', fontSize:'11px', color:'#92400e', textTransform:'uppercase', fontWeight:600 }}>📄 Comprobante</p>
                        <p style={{ margin:0, fontSize:'13px', fontWeight:600 }}>{p.comprobante_tipo==='boleta_simple'?'Boleta simple':p.comprobante_tipo==='boleta_dni'?'Boleta con DNI':'Factura'}</p>
                        {p.comprobante_dni && <p style={{ margin:'3px 0 0', fontSize:'12px', color:'#78350f' }}>DNI: {p.comprobante_dni}</p>}
                        {p.comprobante_ruc && <p style={{ margin:'3px 0 0', fontSize:'12px', color:'#78350f' }}>RUC: {p.comprobante_ruc}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab mapa */}
              {tabDetalle === 'mapa' && (
                <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                  {p?.direccion ? (
                    <>
                      <div style={{ padding:'10px 16px', background:'#fff', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <p style={{ margin:0, fontSize:'13px', fontWeight:600 }}>📍 {p.direccion}</p>
                          {p.costo_delivery ? <p style={{ margin:'2px 0 0', fontSize:'12px', color:'#6b7280' }}>🛵 Delivery: S/{Number(p.costo_delivery).toFixed(2)}</p> : null}
                        </div>
                        <a href={`https://www.google.com/maps/dir/-12.0710922,-77.1163076/${encodeURIComponent(p.direccion+', La Perla, Callao, Peru')}`} target="_blank" rel="noreferrer"
                          style={{ background:R, color:'#fff', padding:'6px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600, textDecoration:'none' }}>
                          Abrir en Maps
                        </a>
                      </div>
                      <div style={{ flex:1 }}>
                        <iframe title="Mapa" width="100%" height="100%" style={{ border:0, display:'block' }} loading="lazy" allowFullScreen
                          src={`https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_KEY}&origin=${encodeURIComponent('Av. Pacífico 107, La Perla, Callao, Peru')}&destination=${encodeURIComponent(p.direccion+', La Perla, Callao, Peru')}&mode=driving&language=es`} />
                      </div>
                    </>
                  ) : (
                    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#9ca3af', gap:'12px' }}>
                      <span style={{ fontSize:'48px' }}>📍</span>
                      <p style={{ margin:0, fontSize:'14px', fontWeight:600 }}>Sin dirección registrada</p>
                      <p style={{ margin:0, fontSize:'12px' }}>{p?.tipo_entrega==='delivery'?'Dirección aún no confirmada':'Pedido para recoger en tienda'}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )
        })() : (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#9ca3af', gap:'12px' }}>
            <MessageSquare size={48} style={{ opacity:0.2 }} />
            <p style={{ margin:0, fontSize:'14px' }}>Selecciona una conversación</p>
            <p style={{ margin:0, fontSize:'12px', color:'#d1d5db' }}>Todas las conversaciones del día aparecen en la lista</p>
          </div>
        )}
      </div>
    </div>
  )
}