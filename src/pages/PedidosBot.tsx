import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { MessageSquare, Printer, CheckCircle, ChefHat, Bike, XCircle, RefreshCw, Send, Bell } from 'lucide-react'

const WHATSAPP_TOKEN = 'EAAuhJL2hSGcBRhTXPcZASZCzGp90ieskpdvQpZBSaaRyE7RFe9R7FDxiRZBi1wbdjtcGwjx1L0hmkeAtVfS9hHMplRTPldVbhoLAevdKEjfDz7i7V5RdfSThAIxN4DOGyZCiazENO0Pnstf1AoDgNVBy9ZCHIbYLPvW1cZC1EFEn5PnR76C54zPcN57tuzl0gZDZD'
const PHONE_NUMBER_ID = '1138917629305752'
const GOOGLE_MAPS_KEY = 'AIzaSyC1R4KX6wZ6C0t8vcrt3eN2RBNaXx_-TPM'

type EstadoPedido = 'nuevo' | 'confirmado' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado'
type TabPrincipal = 'activos' | 'historial'
type TabDetalle = 'conversacion' | 'detalle' | 'mapa'

interface ItemPedido {
  descripcion: string
  precio?: number
  mitad?: string
}

interface Pedido {
  id: string
  telefono: string
  nombre_cliente: string
  items: ItemPedido[]
  subtotal: number
  costo_delivery: number
  total: number
  tipo_entrega: string
  direccion: string
  medio_pago: string
  observaciones: string
  estado: EstadoPedido
  notas: string
  created_at: string
  comprobante_tipo: string
  comprobante_dni: string
  comprobante_ruc: string
}

interface Mensaje {
  id: string
  telefono: string
  nombre_cliente: string
  rol: 'user' | 'assistant'
  mensaje: string
  created_at: string
}

const ESTADOS: { key: EstadoPedido; label: string; color: string; icon: React.ElementType }[] = [
  { key: 'nuevo',          label: 'Nuevo',      color: '#f59e0b', icon: Bell },
  { key: 'en_preparacion', label: 'En cocina',  color: '#8b5cf6', icon: ChefHat },
  { key: 'entregado',      label: 'Entregado',  color: '#6b7280', icon: CheckCircle },
]

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

function imprimirTicket(pedido: Pedido) {
  const hora = new Date(pedido.created_at).toLocaleString('es-PE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const itemsHtml = pedido.items && pedido.items.length > 0
    ? pedido.items.map(item => {
        let html = '<div class="item">'
        html += '<span>' + (item.descripcion || '') + '</span>'
        if (item.mitad) html += '<div class="obs">&#9654; Mitad y mitad: ' + item.mitad + '</div>'
        if (item.precio) html += '<span class="precio">S/' + Number(item.precio).toFixed(2) + '</span>'
        html += '</div>'
        return html
      }).join('')
    : '<div class="item"><span>Ver conversacion</span></div>'

  const medioPago = pedido.medio_pago
    ? pedido.medio_pago.charAt(0).toUpperCase() + pedido.medio_pago.slice(1)
    : 'No especificado'

  const comprobanteHtml = (() => {
    const tipo = pedido.comprobante_tipo
    if (!tipo || tipo === 'ninguno') return ''
    let label = ''
    let detalle = ''
    if (tipo === 'boleta_simple') label = 'BOLETA DE VENTA SIMPLE'
    else if (tipo === 'boleta_dni') {
      label = 'BOLETA DE VENTA'
      detalle = pedido.comprobante_dni ? 'DNI: ' + pedido.comprobante_dni : ''
    } else if (tipo === 'factura') {
      label = 'FACTURA'
      detalle = pedido.comprobante_ruc ? 'RUC: ' + pedido.comprobante_ruc : ''
    }
    return `
      <div class="linea"></div>
      <div class="alerta">📄 COMPROBANTE: ${label}</div>
      ${detalle ? '<div class="centro negrita">' + detalle + '</div>' : ''}
    `
  })()

  const contenido = `
    <html><head><style>
      @page { margin: 0; size: 80mm auto; }
      * { box-sizing: border-box; }
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 76mm; margin: 2mm 2mm; color: #000; }
      .centro { text-align: center; }
      .linea { border-top: 1px dashed #000; margin: 5px 0; }
      .negrita { font-weight: bold; }
      .grande { font-size: 18px; font-weight: bold; }
      .pequeño { font-size: 10px; }
      .fila { display: flex; justify-content: space-between; align-items: flex-start; margin: 2px 0; }
      .item { display: flex; justify-content: space-between; align-items: flex-start; margin: 3px 0; }
      .item span:first-child { flex: 1; padding-right: 4px; }
      .precio { white-space: nowrap; font-weight: bold; }
      .obs { font-size: 10px; color: #333; padding-left: 8px; }
      .alerta { font-weight: bold; font-size: 13px; border: 2px solid #000; padding: 4px; margin: 4px 0; text-align: center; }
      .total-box { border: 1px solid #000; padding: 4px; margin: 4px 0; }
    </style></head>
    <body>
      <div class="centro">
        <div class="grande">PIZZA ESTEFANO</div>
        <div class="pequeño">Av. Pacifico 107, La Perla - Callao</div>
        <div class="pequeño">Tel: 939 688 141 | WhatsApp Bot</div>
      </div>
      <div class="linea"></div>

      <div class="fila">
        <span class="negrita">PEDIDO WhatsApp</span>
        <span class="pequeño">${hora}</span>
      </div>
      <div class="linea"></div>

      <div class="negrita">CLIENTE: ${pedido.nombre_cliente || 'Sin nombre'}</div>
      <div>TEL: +${pedido.telefono}</div>
      <div class="linea"></div>

      <div class="alerta">${pedido.tipo_entrega === 'delivery' ? '🛵 DELIVERY' : '🏠 RECOJO EN TIENDA'}</div>
      ${pedido.direccion ? '<div class="negrita">DIR: ' + pedido.direccion + '</div>' : ''}
      <div class="linea"></div>

      <div class="negrita">DETALLE DEL PEDIDO:</div>
      <div style="margin: 4px 0">${itemsHtml}</div>
      <div class="linea"></div>

      ${pedido.observaciones && pedido.observaciones.toLowerCase() !== 'no' && pedido.observaciones.toLowerCase() !== 'ninguna' ? `
      <div class="alerta">⚠ OBSERVACIONES COCINA:</div>
      <div style="margin: 3px 0; font-size: 12px">${pedido.observaciones}</div>
      <div class="linea"></div>
      ` : ''}

      <div class="total-box">
        ${pedido.subtotal ? '<div class="fila"><span>Subtotal:</span><span>S/' + Number(pedido.subtotal).toFixed(2) + '</span></div>' : ''}
        ${pedido.costo_delivery ? '<div class="fila"><span>Delivery:</span><span>S/' + Number(pedido.costo_delivery).toFixed(2) + '</span></div>' : ''}
        ${pedido.total ? '<div class="fila negrita" style="font-size:14px"><span>TOTAL:</span><span>S/' + Number(pedido.total).toFixed(2) + '</span></div>' : ''}
        <div class="fila"><span>Pago:</span><span class="negrita">${medioPago}</span></div>
      </div>

      <div class="linea"></div>
      <div class="centro pequeño">*** Gracias por su pedido ***</div>
      ${comprobanteHtml}
      <br/><br/><br/>
    </body></html>
  `

  const ventana = window.open('', '_blank', 'width=420,height=700')
  if (ventana) {
    ventana.document.write(contenido)
    ventana.document.close()
    ventana.focus()
    setTimeout(() => { ventana.print(); ventana.close() }, 600)
  }
}

export default function PedidosBot() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [mensajeTexto, setMensajeTexto] = useState('')
  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>('activos')
  const [tabDetalle, setTabDetalle] = useState<TabDetalle>('conversacion')
  const [enviando, setEnviando] = useState(false)
  const mensajesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if ('Notification' in window) Notification.requestPermission()
    cargarPedidos()
    cargarMensajes()

    const chanPedidos = supabase
      .channel('pedidos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_pedidos' }, (payload) => {
        const nuevo = payload.new as Pedido
        setPedidos(prev => [nuevo, ...prev])
        if (Notification.permission === 'granted') {
          new Notification('Nuevo pedido 🍕', { body: (nuevo.nombre_cliente || 'Cliente') + ' - ' + (nuevo.tipo_entrega === 'delivery' ? 'Delivery' : 'Recojo') })
        }
        imprimirTicket(nuevo)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'whatsapp_pedidos' }, (payload) => {
        setPedidos(prev => prev.map(p => p.id === payload.new.id ? payload.new as Pedido : p))
        if (pedidoSeleccionado?.id === payload.new.id) setPedidoSeleccionado(payload.new as Pedido)
      })
      .subscribe()

    const chanMensajes = supabase
      .channel('mensajes-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_conversaciones' }, (payload) => {
        const nuevo = payload.new as Mensaje
        setMensajes(prev => [...prev, nuevo])
        if (nuevo.rol === 'user' && Notification.permission === 'granted') {
          new Notification('Mensaje de ' + (nuevo.nombre_cliente || nuevo.telefono), { body: nuevo.mensaje })
        }
        setTimeout(() => {
          mensajesRef.current?.scrollTo({ top: mensajesRef.current.scrollHeight, behavior: 'smooth' })
        }, 100)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(chanPedidos)
      supabase.removeChannel(chanMensajes)
    }
  }, [])

  async function cargarPedidos() {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const { data } = await supabase
      .from('whatsapp_pedidos')
      .select('*')
      .gte('created_at', hoy.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)
    if (data) setPedidos(data)
  }

  async function cargarMensajes(telefono?: string) {
    let query = supabase.from('whatsapp_conversaciones').select('*').order('created_at', { ascending: true }).limit(100)
    if (telefono) query = query.eq('telefono', telefono)
    const { data } = await query
    if (data) {
      setMensajes(data)
      setTimeout(() => { mensajesRef.current?.scrollTo({ top: mensajesRef.current.scrollHeight, behavior: 'smooth' }) }, 100)
    }
  }

  async function cambiarEstado(pedido: Pedido, estado: EstadoPedido) {
    await supabase.from('whatsapp_pedidos').update({ estado, updated_at: new Date().toISOString() }).eq('id', pedido.id)
  }

  async function enviarMensajeManual() {
    if (!pedidoSeleccionado || !mensajeTexto.trim()) return
    setEnviando(true)
    try {
      await fetch('https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: pedidoSeleccionado.telefono, type: 'text', text: { body: mensajeTexto } })
      })
      await supabase.from('whatsapp_conversaciones').insert({
        telefono: pedidoSeleccionado.telefono, rol: 'assistant',
        mensaje: mensajeTexto, nombre_cliente: 'Pizza Estefano (manual)'
      })
      setMensajeTexto('')
    } finally {
      setEnviando(false)
    }
  }

  function seleccionarPedido(pedido: Pedido) {
    setPedidoSeleccionado(pedido)
    cargarMensajes(pedido.telefono)
    setTabDetalle('conversacion')
  }

  const pedidosActivos = pedidos.filter(p => !['entregado', 'cancelado'].includes(p.estado))
  const pedidosHistorial = pedidos.filter(p => ['entregado', 'cancelado'].includes(p.estado))
  const listaMostrada = tabPrincipal === 'activos' ? pedidosActivos : pedidosHistorial

  return (
    <div style={{ display: 'flex', height: 'calc(100dvh - 56px)', overflow: 'hidden', background: '#f8f8f8' }}>

      {/* Panel izquierdo */}
      <div style={{ width: '340px', flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', background: '#b91c1c' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 700 }}>Panel de Pedidos</h2>
              <p style={{ margin: 0, color: '#fecaca', fontSize: '11px' }}>WhatsApp Bot en vivo</p>
            </div>
            <button onClick={cargarPedidos} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', padding: '8px', cursor: 'pointer', color: '#fff' }}>
              <RefreshCw size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
  {(['nuevo', 'en_preparacion', 'entregado'] as EstadoPedido[]).map(estadoKey => {
    const count = pedidos.filter(p => p.estado === estadoKey).length
    const e = ESTADOS.find(est => est.key === estadoKey) || ESTADOS[0]
    return (
      <div key={estadoKey} style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
        <div style={{ color: e.color, fontWeight: 700, fontSize: '20px' }}>{count}</div>
        <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>{e.label}</div>
      </div>
    )
  })}
</div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {([{ key: 'activos', label: 'Activos (' + pedidosActivos.length + ')' }, { key: 'historial', label: 'Historial' }] as { key: TabPrincipal; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setTabPrincipal(t.key)}
              style={{ flex: 1, padding: '10px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tabPrincipal === t.key ? 700 : 400, borderBottom: tabPrincipal === t.key ? '2px solid #b91c1c' : '2px solid transparent', color: tabPrincipal === t.key ? '#b91c1c' : '#6b7280' }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {listaMostrada.map(pedido => {
            const estado = ESTADOS.find(e => e.key === pedido.estado) || ESTADOS[0]
            const isSelected = pedidoSeleccionado?.id === pedido.id
            return (
              <div key={pedido.id} onClick={() => seleccionarPedido(pedido)}
                style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', background: isSelected ? '#fef2f2' : '#fff', borderLeft: isSelected ? '3px solid #b91c1c' : '3px solid transparent', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: '#1a1a1a' }}>{pedido.nombre_cliente || 'Cliente'}</span>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>{formatHora(pedido.created_at)}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pedido.items?.[0]?.descripcion || 'Sin detalle'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: estado.color + '20', color: estado.color, fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px' }}>
                    <estado.icon size={11} />
                    {estado.label}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {pedido.total && <span style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>S/{Number(pedido.total).toFixed(2)}</span>}
                    <button onClick={e => { e.stopPropagation(); imprimirTicket(pedido) }}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: '6px', padding: '5px', cursor: 'pointer', color: '#374151' }}>
                      <Printer size={13} />
                    </button>
                  </div>
                </div>
                {pedido.observaciones && pedido.observaciones.toLowerCase() !== 'no' && pedido.observaciones.toLowerCase() !== 'ninguna' && (
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#d97706', background: '#fef3c7', padding: '3px 8px', borderRadius: '4px' }}>
                    ⚠ {pedido.observaciones}
                  </div>
                )}
              </div>
            )
          })}
          {listaMostrada.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af' }}>
              <MessageSquare size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
              <p style={{ margin: 0, fontSize: '13px' }}>No hay pedidos {tabPrincipal === 'activos' ? 'activos' : 'en el historial'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel derecho */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {pedidoSeleccionado ? (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{pedidoSeleccionado.nombre_cliente || 'Cliente'}</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>+{pedidoSeleccionado.telefono} · {pedidoSeleccionado.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Recojo'}</p>
                {pedidoSeleccionado.direccion && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>📍 {pedidoSeleccionado.direccion}</p>}
                {pedidoSeleccionado.total && <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 700, color: '#b91c1c' }}>S/{Number(pedidoSeleccionado.total).toFixed(2)} · {pedidoSeleccionado.medio_pago || 'Sin medio de pago'}</p>}
              </div>
              <button onClick={() => imprimirTicket(pedidoSeleccionado)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                <Printer size={14} /> Imprimir
              </button>
            </div>

            {pedidoSeleccionado.observaciones && pedidoSeleccionado.observaciones.toLowerCase() !== 'no' && pedidoSeleccionado.observaciones.toLowerCase() !== 'ninguna' && (
              <div style={{ padding: '10px 20px', background: '#fef3c7', borderBottom: '1px solid #fcd34d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>⚠️</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>Cocina: {pedidoSeleccionado.observaciones}</span>
              </div>
            )}

            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#6b7280', alignSelf: 'center', marginRight: '4px' }}>Estado:</span>
              {ESTADOS.map(e => (
                <button key={e.key} onClick={() => cambiarEstado(pedidoSeleccionado, e.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '20px', border: '1.5px solid ' + e.color, background: pedidoSeleccionado.estado === e.key ? e.color : 'transparent', color: pedidoSeleccionado.estado === e.key ? '#fff' : e.color, cursor: 'pointer', fontSize: '12px', fontWeight: 600, transition: 'all 0.15s' }}>
                  <e.icon size={12} />
                  {e.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
              {([{ key: 'conversacion', label: 'Conversación' }, { key: 'detalle', label: 'Detalle pedido' }, { key: 'mapa', label: '📍 Mapa' }] as { key: TabDetalle; label: string }[]).map(t => (
                <button key={t.key} onClick={() => setTabDetalle(t.key)}
                  style={{ padding: '10px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: tabDetalle === t.key ? 700 : 400, borderBottom: tabDetalle === t.key ? '2px solid #b91c1c' : '2px solid transparent', color: tabDetalle === t.key ? '#b91c1c' : '#6b7280' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tabDetalle === 'conversacion' ? (
              <>
                <div ref={mensajesRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f0f0f0' }}>
                {mensajes.filter(m => m.telefono === pedidoSeleccionado.telefono).map(msg => (
  <div key={msg.id} style={{ display: 'flex', justifyContent: msg.rol === 'user' ? 'flex-start' : 'flex-end' }}>
    <div style={{ maxWidth: '75%', background: msg.rol === 'user' ? '#fff' : '#dcf8c6', padding: '10px 14px', borderRadius: msg.rol === 'user' ? '0 12px 12px 12px' : '12px 0 12px 12px', fontSize: '13px', color: '#1a1a1a', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
      {msg.mensaje.startsWith('[QR Yape enviado - ') ? (
        <img src={msg.mensaje.slice(19, -1)} alt="QR Yape" style={{ width: '150px', borderRadius: '8px' }} />
      ) : msg.mensaje.startsWith('[COMPROBANTE:') ? (
        <div>
          <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#6b7280' }}>📸 Comprobante de pago:</p>
          <img src={msg.mensaje.slice(13, -1)} alt="Comprobante" style={{ width: '200px', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(msg.mensaje.slice(13, -1), '_blank')} />
        </div>
      ) : msg.mensaje.startsWith('[UBICACION compartida:') ? (() => {
        const coords = msg.mensaje.match(/\[UBICACION compartida: ([-\d.]+),([-\d.]+)\]/)
        if (!coords) return <div style={{ whiteSpace: 'pre-wrap' }}>{msg.mensaje}</div>
        const lat = coords[1], lng = coords[2]
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
        const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${lat},${lng}&zoom=16`
        return (
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#6b7280' }}>📍 Ubicación compartida por el cliente:</p>
            <iframe
              src={embedUrl}
              width="220" height="150"
              style={{ border: 0, borderRadius: '8px', display: 'block' }}
              loading="lazy"
              allowFullScreen
            />
            <a href={mapsUrl} target="_blank" rel="noreferrer"
              style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}>
              🗺 Abrir en Google Maps
            </a>
          </div>
        )
      })() : msg.mensaje.startsWith('[ZONA DETECTADA POR GPS:') ? (() => {
        const match = msg.mensaje.match(/Zona (\d+) - S\/([\d.]+) - distancia: ([\d.]+)km/)
        if (!match) return <div style={{ whiteSpace: 'pre-wrap' }}>{msg.mensaje}</div>
        return (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 10px' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#15803d' }}>✅ Zona detectada por GPS</p>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#166534' }}>Zona {match[1]} · S/{match[2]} · {match[3]}km</p>
          </div>
        )
      })() : msg.mensaje === '[INICIO NUEVA SESION]' ? (
        <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>— Nuevo pedido —</div>
      ) : (
        <div style={{ whiteSpace: 'pre-wrap' }}>{msg.mensaje}</div>
      )}
      <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px', textAlign: 'right' }}>{formatHora(msg.created_at)}</div>
    </div>
  </div>
))}
                  {mensajes.filter(m => m.telefono === pedidoSeleccionado.telefono).length === 0 && (
                    <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px' }}>
                      <p style={{ fontSize: '13px' }}>No hay mensajes registrados</p>
                    </div>
                  )}
                </div>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '24px', padding: '10px 16px' }}>
                    <textarea value={mensajeTexto} onChange={e => setMensajeTexto(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensajeManual() } }}
                      placeholder="Escribir mensaje manual... (Enter para enviar)"
                      style={{ width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: '13px', fontFamily: 'inherit', color: '#1a1a1a', maxHeight: '80px' }}
                      rows={1} />
                  </div>
                  <button onClick={enviarMensajeManual} disabled={enviando || !mensajeTexto.trim()}
                    style={{ background: '#b91c1c', border: 'none', borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, opacity: (!mensajeTexto.trim() || enviando) ? 0.5 : 1 }}>
                    <Send size={16} color="#fff" />
                  </button>
                </div>
              </>
            ) : tabDetalle === 'mapa' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {pedidoSeleccionado.direccion ? (
                  <>
                    {/* Info barra superior */}
                    <div style={{ padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>📍 {pedidoSeleccionado.direccion}</p>
                        {pedidoSeleccionado.costo_delivery ? (
                          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>🛵 Delivery: S/{Number(pedidoSeleccionado.costo_delivery).toFixed(2)}</p>
                        ) : null}
                      </div>
                      <a
                        href={`https://www.google.com/maps/dir/-12.0710922,-77.1163076/${encodeURIComponent(pedidoSeleccionado.direccion + ', La Perla, Callao, Peru')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ background: '#b91c1c', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                        Abrir en Maps
                      </a>
                    </div>

                    {/* Mapa embed */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      <iframe
                        title="Ubicación del cliente"
                        width="100%"
                        height="100%"
                        style={{ border: 0, display: 'block' }}
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_KEY}&origin=${encodeURIComponent('Av. Pacífico 107, La Perla, Callao, Peru')}&destination=${encodeURIComponent(pedidoSeleccionado.direccion + ', La Perla, Callao, Peru')}&mode=driving&language=es`}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '12px' }}>
                    <span style={{ fontSize: '48px' }}>📍</span>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Sin dirección registrada</p>
                    <p style={{ margin: 0, fontSize: '12px' }}>
                      {pedidoSeleccionado.tipo_entrega === 'delivery'
                        ? 'La dirección aún no fue confirmada por el cliente'
                        : 'Este pedido es para recoger en tienda'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Detalle del pedido</h4>

                  {/* Items */}
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Items</p>
                    {pedidoSeleccionado.items && pedidoSeleccionado.items.length > 0
                      ? pedidoSeleccionado.items.map((item, i) => (
                          <div key={i} style={{ marginBottom: '8px', paddingBottom: '8px', borderBottom: i < pedidoSeleccionado.items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '14px' }}>{item.descripcion}</span>
                              {item.precio && <span style={{ fontSize: '14px', fontWeight: 600 }}>S/{Number(item.precio).toFixed(2)}</span>}
                            </div>
                            {item.mitad && <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>↳ Mitad y mitad: {item.mitad}</div>}
                          </div>
                        ))
                      : <p style={{ margin: 0, fontSize: '14px', color: '#9ca3af' }}>Ver conversación</p>
                    }
                  </div>

                  {/* Observaciones */}
                  {pedidoSeleccionado.observaciones && pedidoSeleccionado.observaciones.toLowerCase() !== 'no' && pedidoSeleccionado.observaciones.toLowerCase() !== 'ninguna' && (
                    <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>⚠ Observaciones cocina</p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#78350f' }}>{pedidoSeleccionado.observaciones}</p>
                    </div>
                  )}

                  {/* Totales */}
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Resumen de cobro</p>
                    {pedidoSeleccionado.subtotal && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>Subtotal</span>
                        <span style={{ fontSize: '13px' }}>S/{Number(pedidoSeleccionado.subtotal).toFixed(2)}</span>
                      </div>
                    )}
                    {pedidoSeleccionado.costo_delivery ? (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280' }}>Delivery</span>
                        <span style={{ fontSize: '13px' }}>S/{Number(pedidoSeleccionado.costo_delivery).toFixed(2)}</span>
                      </div>
                    ) : null}
                    {pedidoSeleccionado.total && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid #e5e7eb', marginTop: '4px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>TOTAL</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#b91c1c' }}>S/{Number(pedidoSeleccionado.total).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Entrega */}
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Entrega</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>{pedidoSeleccionado.tipo_entrega === 'delivery' ? '🛵 Delivery' : '🏠 Recojo en tienda'}</p>
                    {pedidoSeleccionado.direccion && <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>{pedidoSeleccionado.direccion}</p>}
                  </div>

                  {/* Medio de pago */}
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Medio de pago</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                      {pedidoSeleccionado.medio_pago === 'yape' ? '📱 Yape' :
                       pedidoSeleccionado.medio_pago === 'tarjeta' ? '💳 Tarjeta' :
                       pedidoSeleccionado.medio_pago === 'efectivo' ? '💵 Efectivo' :
                       pedidoSeleccionado.medio_pago || 'No especificado'}
                    </p>
                  </div>

                  {/* Comprobante */}
                  {pedidoSeleccionado.comprobante_tipo && pedidoSeleccionado.comprobante_tipo !== 'ninguno' && (
                    <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>📄 Comprobante</p>
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
                        {pedidoSeleccionado.comprobante_tipo === 'boleta_simple' ? 'Boleta simple' :
                         pedidoSeleccionado.comprobante_tipo === 'boleta_dni' ? 'Boleta con DNI' :
                         pedidoSeleccionado.comprobante_tipo === 'factura' ? 'Factura' : ''}
                      </p>
                      {pedidoSeleccionado.comprobante_dni && (
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#78350f' }}>DNI: {pedidoSeleccionado.comprobante_dni}</p>
                      )}
                      {pedidoSeleccionado.comprobante_ruc && (
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#78350f' }}>RUC: {pedidoSeleccionado.comprobante_ruc}</p>
                      )}
                    </div>
                  )}

                  {/* Hora */}
                  <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Hora del pedido</p>
                    <p style={{ margin: 0, fontSize: '14px' }}>{new Date(pedidoSeleccionado.created_at).toLocaleString('es-PE')}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '12px' }}>
            <MessageSquare size={48} style={{ opacity: 0.2 }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Selecciona un pedido para ver el detalle</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db' }}>Los pedidos nuevos aparecen automáticamente</p>
          </div>
        )}
      </div>
    </div>
  )
}
///