import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CalendarDays, Printer, Pencil, X, Plus } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// CALENDARIO DE ACTIVIDADES DE LOS HIJOS
// Cada hijo tiene su propio calendario independiente (tab). Los datos se
// guardan en Supabase (tabla: hijos_actividades) — ver SQL en la entrega.
// Cambia los nombres aquí:
const HIJOS = ['Diego', 'Marcelo', 'Fabiano']
// ─────────────────────────────────────────────────────────────────────────────

const BASE_HOUR = 6
const LAST_HOUR = 20
const DAY_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DAY_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

const CAT_COLOR: Record<string, string> = {
  colegio: '#5b6cf0',
  terapia: '#28a97a',
  piano: '#a05bd6',
  deporte: '#e08a2e',
  otro: '#8a8f98',
}
const CAT_LABEL: Record<string, string> = {
  colegio: 'Colegio', terapia: 'Terapia', piano: 'Piano/Música', deporte: 'Deporte', otro: 'Otro',
}
const COLOR_HIJO = ['#5b6cf0', '#28a97a', '#e08a2e']

interface Actividad {
  id: string
  hijo: number            // 0, 1, 2
  nombre: string
  categoria: string
  dias: number[]          // 0=Lunes ... 6=Domingo
  hora_inicio: string     // "08:00"
  hora_fin: string        // "09:00"
  lugar: string | null
}

function timeParts(t: string) {
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

function formatDias(dias: number[]): string {
  const s = [...dias].sort((a, b) => a - b)
  const eq = (t: number[]) => s.length === t.length && s.every((v, i) => v === t[i])
  if (eq([0, 1, 2, 3, 4])) return 'Lunes a Viernes'
  if (eq([5, 6])) return 'Fin de semana'
  if (eq([0, 1, 2, 3, 4, 5, 6])) return 'Todos los días'
  let consec = s.length > 1
  for (let i = 1; i < s.length; i++) if (s[i] !== s[i - 1] + 1) { consec = false; break }
  if (consec) return DAY_LABEL[s[0]] + ' a ' + DAY_LABEL[s[s.length - 1]]
  return s.map(d => DAY_LABEL[d]).join(', ')
}

export default function CalendarioHijos() {
  const [hijoActivo, setHijoActivo] = useState(0)
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [cargando, setCargando] = useState(true)

  // Formulario
  const [fNombre, setFNombre] = useState('')
  const [fCat, setFCat] = useState('colegio')
  const [fDias, setFDias] = useState<Set<number>>(new Set())
  const [fInicio, setFInicio] = useState('08:00')
  const [fFin, setFFin] = useState('09:00')
  const [fLugar, setFLugar] = useState('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data, error } = await supabase
      .from('hijos_actividades')
      .select('*')
      .order('hora_inicio', { ascending: true })
    if (!error && data) setActividades(data as Actividad[])
    setCargando(false)
  }

  const delHijo = useMemo(
    () => actividades.filter(a => a.hijo === hijoActivo),
    [actividades, hijoActivo]
  )

  function resetForm() {
    setEditandoId(null)
    setFNombre(''); setFCat('colegio'); setFDias(new Set())
    setFInicio('08:00'); setFFin('09:00'); setFLugar('')
  }

  function toggleDia(d: number) {
    setFDias(prev => {
      const n = new Set(prev)
      if (n.has(d)) n.delete(d); else n.add(d)
      return n
    })
  }

  function preset(tipo: string) {
    if (tipo === 'semana') setFDias(new Set([0, 1, 2, 3, 4]))
    else if (tipo === 'finde') setFDias(new Set([5, 6]))
    else if (tipo === 'todos') setFDias(new Set([0, 1, 2, 3, 4, 5, 6]))
    else setFDias(new Set())
  }

  async function guardar() {
    const nombre = fNombre.trim()
    const dias = Array.from(fDias).sort((a, b) => a - b)
    if (!nombre) { alert('Ponle un nombre a la actividad.'); return }
    if (dias.length === 0) { alert('Selecciona al menos un día.'); return }
    const s = timeParts(fInicio), e = timeParts(fFin)
    if (e.h * 60 + e.m <= s.h * 60 + s.m) { alert('La hora de fin debe ser posterior a la de inicio.'); return }

    setGuardando(true)
    const fila = {
      hijo: hijoActivo, nombre, categoria: fCat, dias,
      hora_inicio: fInicio, hora_fin: fFin, lugar: fLugar.trim() || null,
    }
    if (editandoId) {
      const { error } = await supabase.from('hijos_actividades').update(fila).eq('id', editandoId)
      if (error) alert('No se pudo guardar: ' + error.message)
    } else {
      const { error } = await supabase.from('hijos_actividades').insert(fila)
      if (error) alert('No se pudo guardar: ' + error.message)
    }
    setGuardando(false)
    resetForm()
    cargar()
  }

  function editar(a: Actividad) {
    setEditandoId(a.id)
    setFNombre(a.nombre); setFCat(a.categoria); setFDias(new Set(a.dias))
    setFInicio(a.hora_inicio); setFFin(a.hora_fin); setFLugar(a.lugar || '')
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta actividad?')) return
    await supabase.from('hijos_actividades').delete().eq('id', id)
    if (editandoId === id) resetForm()
    cargar()
  }

  // Grilla: celdas[dia][hora-BASE_HOUR] = actividades que caen ahí (con flag de primera hora)
  const grilla = useMemo(() => {
    const g: { a: Actividad; primera: boolean }[][][] =
      Array.from({ length: 7 }, () => Array.from({ length: LAST_HOUR - BASE_HOUR + 1 }, () => []))
    delHijo.forEach(a => {
      const s = timeParts(a.hora_inicio), e = timeParts(a.hora_fin)
      let fh = Math.max(s.h, BASE_HOUR)
      let lh = Math.min(e.m > 0 ? e.h : e.h - 1, LAST_HOUR)
      if (lh < fh) lh = fh
      a.dias.forEach(d => {
        for (let h = fh; h <= lh; h++) g[d][h - BASE_HOUR].push({ a, primera: h === fh })
      })
    })
    return g
  }, [delHijo])

  // Impresión por iframe oculto (mismo patrón del ticket del panel: no lo bloquea el navegador)
  function imprimir() {
    const filas: string[] = []
    for (let h = BASE_HOUR; h <= LAST_HOUR; h++) {
      const celdas = DAY_LABEL.map((_, d) => {
        const chips = grilla[d][h - BASE_HOUR].map(({ a, primera }) =>
          `<div style="background:${CAT_COLOR[a.categoria] || CAT_COLOR.otro};border-radius:4px;padding:2px 4px;margin-bottom:1px;color:#fff;font-size:9.5px;overflow:hidden;">${
            primera ? `<b>${a.nombre}</b><br/><span style="font-size:8.5px;">${a.hora_inicio}–${a.hora_fin}${a.lugar ? ' · ' + a.lugar : ''}</span>` : '&nbsp;'
          }</div>`).join('')
        return `<td style="border:1px solid #dcdce3;height:26px;padding:1px;vertical-align:top;">${chips}</td>`
      }).join('')
      filas.push(`<tr><td style="border:1px solid #dcdce3;background:#fafafb;font-size:9.5px;color:#7a7a85;text-align:right;padding:0 5px;white-space:nowrap;">${h < 10 ? '0' + h : h}:00</td>${celdas}</tr>`)
    }
    const html = `<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:9mm}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b33;margin:0;padding:10px}</style></head><body>
      <h2 style="margin:0 0 2px;font-size:17px;">Calendario semanal — ${HIJOS[hijoActivo]}</h2>
      <div style="font-size:11px;color:#7a7a85;margin-bottom:8px;">Impreso: ${new Date().toLocaleDateString('es-PE')}</div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <thead><tr><th style="border:1px solid #dcdce3;width:46px;"></th>${DAY_LABEL.map(d => `<th style="border:1px solid #dcdce3;background:#fafafb;padding:5px;font-size:10.5px;">${d}</th>`).join('')}</tr></thead>
        <tbody>${filas.join('')}</tbody>
      </table></body></html>`
    try {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) { document.body.removeChild(iframe); return }
      doc.open(); doc.write(html); doc.close()
      setTimeout(() => {
        try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch { }
        setTimeout(() => { try { document.body.removeChild(iframe) } catch { } }, 1500)
      }, 350)
    } catch (e) { console.error('No se pudo imprimir:', e) }
  }

  const inputStyle: React.CSSProperties = {
    border: '1px solid #dcdce3', borderRadius: '8px', padding: '8px 9px',
    fontSize: '13.5px', fontFamily: 'inherit', color: '#2b2b33', background: '#fff', width: '100%',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '11.5px', color: '#7a7a85', textTransform: 'uppercase', letterSpacing: '.04em',
    display: 'block', marginBottom: '4px',
  }

  return (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', marginTop: '24px', boxShadow: '0 1px 3px rgba(20,20,30,.08), 0 6px 18px rgba(20,20,30,.05)' }}>

      {/* Encabezado + tabs de hijos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarDays size={18} color="#5b6cf0" />
          <h2 style={{ margin: 0, fontSize: '16px' }}>Calendario de los chicos</h2>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f4f4f7', borderRadius: '10px', padding: '4px' }}>
            {HIJOS.map((nombre, i) => (
              <button key={i} onClick={() => { setHijoActivo(i); resetForm() }}
                style={{
                  border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px',
                  fontWeight: 600, cursor: 'pointer',
                  background: hijoActivo === i ? COLOR_HIJO[i] : 'transparent',
                  color: hijoActivo === i ? '#fff' : '#7a7a85',
                }}>
                {nombre}
              </button>
            ))}
          </div>
          <button onClick={imprimir} title="Imprimir calendario"
            style={{ border: '1px solid #dcdce3', background: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <Printer size={14} /> Imprimir
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 1fr', gap: '18px', alignItems: 'start' }}>

        {/* ── Formulario ── */}
        <div style={{ border: '1px solid #ececf1', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>
            {editandoId ? 'Editando actividad' : 'Agregar actividad'} — {HIJOS[hijoActivo]}
          </h3>

          <div style={{ marginBottom: '11px' }}>
            <label style={labelStyle}>Actividad</label>
            <input style={inputStyle} value={fNombre} onChange={e => setFNombre(e.target.value)}
              placeholder="Ej. Piano, Terapia, Colegio" />
          </div>

          <div style={{ marginBottom: '11px' }}>
            <label style={labelStyle}>Categoría</label>
            <select style={inputStyle} value={fCat} onChange={e => setFCat(e.target.value)}>
              {Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '11px' }}>
            <label style={labelStyle}>Día(s)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
              {[['semana', 'Lun a Vie'], ['finde', 'Fin de semana'], ['todos', 'Todos'], ['ninguno', 'Ninguno']].map(([t, l]) => (
                <button key={t} onClick={() => preset(t)}
                  style={{ border: '1px solid #dcdce3', background: '#fafafb', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', color: '#7a7a85' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {DAY_SHORT.map((l, d) => (
                <button key={d} onClick={() => toggleDia(d)}
                  style={{
                    border: '1px solid', borderColor: fDias.has(d) ? COLOR_HIJO[hijoActivo] : '#dcdce3',
                    background: fDias.has(d) ? COLOR_HIJO[hijoActivo] : '#fff',
                    color: fDias.has(d) ? '#fff' : '#2b2b33',
                    borderRadius: '999px', padding: '6px 11px', fontSize: '12px', cursor: 'pointer',
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '11px' }}>
            <div>
              <label style={labelStyle}>Hora inicio</label>
              <input type="time" style={inputStyle} value={fInicio} onChange={e => setFInicio(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Hora fin</label>
              <input type="time" style={inputStyle} value={fFin} onChange={e => setFFin(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Lugar (opcional)</label>
            <input style={inputStyle} value={fLugar} onChange={e => setFLugar(e.target.value)}
              placeholder="Ej. Clínica, casa de la profesora" />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={guardar} disabled={guardando}
              style={{ flex: 1, background: COLOR_HIJO[hijoActivo], color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 12px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: guardando ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={15} /> {editandoId ? 'Guardar cambios' : 'Agregar'}
            </button>
            {editandoId && (
              <button onClick={resetForm}
                style={{ border: '1px solid #dcdce3', background: '#fff', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
            )}
          </div>

          {/* Leyenda */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #ececf1' }}>
            {Object.entries(CAT_LABEL).map(([v, l]) => (
              <span key={v} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: CAT_COLOR[v] }} />{l}
              </span>
            ))}
          </div>

          {/* Lista de actividades del hijo activo */}
          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #ececf1' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '13px' }}>Actividades de {HIJOS[hijoActivo]}</h3>
            {cargando ? (
              <p style={{ fontSize: '12.5px', color: '#7a7a85', fontStyle: 'italic', margin: 0 }}>Cargando…</p>
            ) : delHijo.length === 0 ? (
              <p style={{ fontSize: '12.5px', color: '#7a7a85', fontStyle: 'italic', margin: 0 }}>Aún no hay actividades.</p>
            ) : (
              [...delHijo].sort((a, b) => Math.min(...a.dias) - Math.min(...b.dias) || a.hora_inicio.localeCompare(b.hora_inicio))
                .map(a => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', padding: '7px 0', borderBottom: '1px solid #f1f1f4', fontSize: '12.5px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: CAT_COLOR[a.categoria] || CAT_COLOR.otro, marginRight: '6px' }} />
                        {a.nombre}
                      </div>
                      <div style={{ color: '#7a7a85', fontSize: '11.5px', marginTop: '1px' }}>
                        {formatDias(a.dias)} · {a.hora_inicio}–{a.hora_fin}{a.lugar ? ' · ' + a.lugar : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button onClick={() => editar(a)} title="Editar"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: '5px', color: '#7a7a85' }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => eliminar(a.id)} title="Eliminar"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: '5px', color: '#7a7a85' }}>
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* ── Grilla semanal ── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #dcdce3', width: '52px', background: '#fff' }}></th>
                {DAY_LABEL.map(d => (
                  <th key={d} style={{ border: '1px solid #dcdce3', background: '#fafafb', padding: '7px 4px', fontSize: '12px', fontWeight: 600 }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: LAST_HOUR - BASE_HOUR + 1 }, (_, i) => BASE_HOUR + i).map(h => (
                <tr key={h}>
                  <td style={{ border: '1px solid #dcdce3', background: '#fafafb', fontSize: '11px', color: '#7a7a85', textAlign: 'right', padding: '0 6px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                    {h < 10 ? '0' + h : h}:00
                  </td>
                  {DAY_LABEL.map((_, d) => (
                    <td key={d} style={{ border: '1px solid #dcdce3', height: '30px', padding: '1px', verticalAlign: 'top' }}>
                      {grilla[d][h - BASE_HOUR].map(({ a, primera }, k) => (
                        <div key={a.id + k} title={`${a.nombre} (${a.hora_inicio}–${a.hora_fin})${a.lugar ? ' · ' + a.lugar : ''}`}
                          style={{ background: CAT_COLOR[a.categoria] || CAT_COLOR.otro, borderRadius: '5px', padding: '2px 5px', marginBottom: '1px', fontSize: '10.5px', lineHeight: 1.2, color: '#fff', overflow: 'hidden' }}>
                          {primera ? (
                            <>
                              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre}</div>
                              <div style={{ fontSize: '9.5px', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {a.hora_inicio}–{a.hora_fin}{a.lugar ? ' · ' + a.lugar : ''}
                              </div>
                            </>
                          ) : <span>&nbsp;</span>}
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}