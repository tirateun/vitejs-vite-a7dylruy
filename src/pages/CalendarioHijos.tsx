import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CalendarDays, Printer, Pencil, X, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// CALENDARIO DE ACTIVIDADES DE LOS HIJOS — vista semanal con fechas reales.
// Series repetidas (con fecha de fin) + excepciones por día (mover o cancelar
// una sola fecha). Cada serie puede tener la MISMA hora todos los días que se
// repite, o una hora DISTINTA por cada día (ideal para actividades como
// "Práctica Piano" que cambian de horario según el día). Datos en Supabase:
// hijos_series + hijos_excepciones.
// ⚠️ Requiere la migración de Supabase que agrega las columnas `modo` y
// `horarios_por_dia` a hijos_series (ver mensaje / SQL adjunto).
// Cambia los nombres aquí:
const HIJOS = ['Diego', 'Marcelo', 'Fabiano']
// ─────────────────────────────────────────────────────────────────────────────

const BASE_HOUR = 6
const LAST_HOUR = 21
const DAY_LABEL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DAY_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const CAT_COLOR: Record<string, string> = {
  colegio: '#5b6cf0', terapia: '#28a97a', piano: '#a05bd6', deporte: '#e08a2e', otro: '#8a8f98',
}
const CAT_LABEL: Record<string, string> = {
  colegio: 'Colegio', terapia: 'Terapia', piano: 'Piano/Música', deporte: 'Deporte', otro: 'Otro',
}
const COLOR_HIJO = ['#5b6cf0', '#28a97a', '#e08a2e']

type ModoHorario = 'uniforme' | 'por_dia'

interface HorarioDia { inicio: string; fin: string }

interface Serie {
  id: string
  hijo: number
  nombre: string
  categoria: string
  dias: number[]
  modo: ModoHorario
  hora_inicio: string
  hora_fin: string
  horarios_por_dia: Record<string, HorarioDia> | null
  lugar: string | null
  fecha_desde: string
  fecha_hasta: string
}
interface Excepcion {
  id: string
  serie_id: string
  fecha: string
  tipo: 'cancelada' | 'movida'
  nombre: string | null
  categoria: string | null
  hora_inicio: string | null
  hora_fin: string | null
  lugar: string | null
}
interface Ocurrencia {
  serieId: string
  excId: string | null
  fechaISO: string
  diaSemana: number
  nombre: string
  categoria: string
  hora_inicio: string
  hora_fin: string
  lugar: string | null
}

function toISO(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function lunesDeLaSemana(d: Date): Date {
  const r = new Date(d)
  const js = r.getDay()
  const offset = js === 0 ? -6 : 1 - js
  r.setDate(r.getDate() + offset)
  r.setHours(0, 0, 0, 0)
  return r
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}
function timeParts(t: string) { const [h, m] = t.split(':').map(Number); return { h, m } }

function formatDias(dias: number[]): string {
  const s = [...dias].sort((a, b) => a - b)
  const eq = (t: number[]) => s.length === t.length && s.every((v, i) => v === t[i])
  if (eq([0, 1, 2, 3, 4])) return 'Lun a Vie'
  if (eq([5, 6])) return 'Fin de semana'
  if (eq([0, 1, 2, 3, 4, 5, 6])) return 'Todos los días'
  return s.map(d => DAY_SHORT[d]).join(', ')
}

// Resuelve la hora "base" de una serie para un día de la semana dado,
// según su modo (uniforme = misma hora siempre; por_dia = hora propia).
function horarioDeSerieParaDia(s: Serie, idxDia: number): HorarioDia | null {
  if (s.modo === 'por_dia') {
    const h = s.horarios_por_dia?.[String(idxDia)]
    return h ? { inicio: h.inicio, fin: h.fin } : null
  }
  return { inicio: s.hora_inicio, fin: s.hora_fin }
}

function minutosA_HHMM(mins: number): string {
  const h = Math.floor(mins / 60), m = mins % 60
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
}

export default function CalendarioHijos() {
  const [hijoActivo, setHijoActivo] = useState(0)
  const [series, setSeries] = useState<Serie[]>([])
  const [excepciones, setExcepciones] = useState<Excepcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [lunesActual, setLunesActual] = useState(() => lunesDeLaSemana(new Date()))

  const [fNombre, setFNombre] = useState('')
  const [fCat, setFCat] = useState('colegio')
  const [fDias, setFDias] = useState<Set<number>>(new Set())
  const [fModo, setFModo] = useState<ModoHorario>('uniforme')
  const [fInicio, setFInicio] = useState('16:00')
  const [fFin, setFFin] = useState('17:00')
  const [fHorariosPorDia, setFHorariosPorDia] = useState<Record<number, HorarioDia>>({})
  const [fLugar, setFLugar] = useState('')
  const [fDesde, setFDesde] = useState(() => toISO(new Date()))
  const [fHasta, setFHasta] = useState('')
  const [editandoSerie, setEditandoSerie] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [ocSel, setOcSel] = useState<Ocurrencia | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const [s, e] = await Promise.all([
      supabase.from('hijos_series').select('*'),
      supabase.from('hijos_excepciones').select('*'),
    ])
    if (!s.error && s.data) setSeries(s.data as Serie[])
    if (!e.error && e.data) setExcepciones(e.data as Excepcion[])
    setCargando(false)
  }

  const diasSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(lunesActual, i)),
    [lunesActual]
  )
  const rangoLabel = useMemo(() => {
    const ini = diasSemana[0], fin = diasSemana[6]
    const mi = MESES[ini.getMonth()], mf = MESES[fin.getMonth()]
    if (ini.getMonth() === fin.getMonth())
      return `${ini.getDate()} – ${fin.getDate()} de ${mf} ${fin.getFullYear()}`
    return `${ini.getDate()} ${mi} – ${fin.getDate()} ${mf} ${fin.getFullYear()}`
  }, [diasSemana])

  const ocurrencias = useMemo<Ocurrencia[]>(() => {
    const out: Ocurrencia[] = []
    const excPorSerie = new Map<string, Map<string, Excepcion>>()
    excepciones.forEach(x => {
      if (!excPorSerie.has(x.serie_id)) excPorSerie.set(x.serie_id, new Map())
      excPorSerie.get(x.serie_id)!.set(x.fecha, x)
    })
    series.filter(s => s.hijo === hijoActivo).forEach(s => {
      const desde = fromISO(s.fecha_desde), hasta = fromISO(s.fecha_hasta)
      diasSemana.forEach((dia, idxDia) => {
        if (dia < desde || dia > hasta) return
        if (!s.dias.includes(idxDia)) return
        const horarioBase = horarioDeSerieParaDia(s, idxDia)
        if (!horarioBase) return
        const iso = toISO(dia)
        const exc = excPorSerie.get(s.id)?.get(iso)
        if (exc?.tipo === 'cancelada') return
        if (exc?.tipo === 'movida') {
          out.push({
            serieId: s.id, excId: exc.id, fechaISO: iso, diaSemana: idxDia,
            nombre: exc.nombre ?? s.nombre, categoria: exc.categoria ?? s.categoria,
            hora_inicio: exc.hora_inicio ?? horarioBase.inicio, hora_fin: exc.hora_fin ?? horarioBase.fin,
            lugar: exc.lugar ?? s.lugar,
          })
        } else {
          out.push({
            serieId: s.id, excId: null, fechaISO: iso, diaSemana: idxDia,
            nombre: s.nombre, categoria: s.categoria,
            hora_inicio: horarioBase.inicio, hora_fin: horarioBase.fin, lugar: s.lugar,
          })
        }
      })
    })
    return out
  }, [series, excepciones, hijoActivo, diasSemana])

  const grilla = useMemo(() => {
    const g: { oc: Ocurrencia; primera: boolean }[][][] =
      Array.from({ length: 7 }, () => Array.from({ length: LAST_HOUR - BASE_HOUR + 1 }, () => []))
    ocurrencias.forEach(oc => {
      const s = timeParts(oc.hora_inicio), e = timeParts(oc.hora_fin)
      let fh = Math.max(s.h, BASE_HOUR)
      let lh = Math.min(e.m > 0 ? e.h : e.h - 1, LAST_HOUR)
      if (lh < fh) lh = fh
      for (let h = fh; h <= lh; h++) g[oc.diaSemana][h - BASE_HOUR].push({ oc, primera: h === fh })
    })
    return g
  }, [ocurrencias])

  const seriesHijo = useMemo(() => series.filter(s => s.hijo === hijoActivo), [series, hijoActivo])

  function resetForm() {
    setEditandoSerie(null)
    setFNombre(''); setFCat('colegio'); setFDias(new Set())
    setFModo('uniforme'); setFHorariosPorDia({})
    setFInicio('16:00'); setFFin('17:00'); setFLugar('')
    setFDesde(toISO(new Date())); setFHasta('')
  }
  function toggleDia(d: number) {
    setFDias(prev => { const n = new Set(prev); if (n.has(d)) n.delete(d); else n.add(d); return n })
  }
  function preset(t: string) {
    if (t === 'semana') setFDias(new Set([0, 1, 2, 3, 4]))
    else if (t === 'finde') setFDias(new Set([5, 6]))
    else if (t === 'todos') setFDias(new Set([0, 1, 2, 3, 4, 5, 6]))
    else setFDias(new Set())
  }
  function setHorarioDia(d: number, campo: 'inicio' | 'fin', valor: string) {
    setFHorariosPorDia(prev => ({
      ...prev,
      [d]: { ...(prev[d] || { inicio: '16:00', fin: '17:00' }), [campo]: valor },
    }))
  }

  async function guardarSerie() {
    const nombre = fNombre.trim()
    const dias = Array.from(fDias).sort((a, b) => a - b)
    if (!nombre) { alert('Ponle un nombre a la actividad.'); return }
    if (dias.length === 0) { alert('Selecciona al menos un día.'); return }
    if (!fDesde || !fHasta) { alert('Indica desde y hasta qué fecha se repite.'); return }
    if (fromISO(fHasta) < fromISO(fDesde)) { alert('La fecha "hasta" debe ser posterior a "desde".'); return }

    let hora_inicio = fInicio
    let hora_fin = fFin
    let horarios_por_dia: Record<string, HorarioDia> | null = null

    if (fModo === 'uniforme') {
      const s = timeParts(fInicio), e = timeParts(fFin)
      if (e.h * 60 + e.m <= s.h * 60 + s.m) { alert('La hora de fin debe ser posterior a la de inicio.'); return }
    } else {
      const mapa: Record<string, HorarioDia> = {}
      for (const d of dias) {
        const h = fHorariosPorDia[d]
        if (!h || !h.inicio || !h.fin) { alert(`Falta el horario de ${DAY_LABEL[d]}.`); return }
        const s = timeParts(h.inicio), e = timeParts(h.fin)
        if (e.h * 60 + e.m <= s.h * 60 + s.m) { alert(`En ${DAY_LABEL[d]}, la hora de fin debe ser posterior a la de inicio.`); return }
        mapa[d] = { inicio: h.inicio, fin: h.fin }
      }
      horarios_por_dia = mapa
      // hora_inicio/hora_fin quedan como referencia (la más temprana y la más tardía)
      // solo para ordenar la lista y no rompen nada de lo existente.
      const inicios = dias.map(d => timeParts(mapa[d].inicio).h * 60 + timeParts(mapa[d].inicio).m)
      const fines = dias.map(d => timeParts(mapa[d].fin).h * 60 + timeParts(mapa[d].fin).m)
      hora_inicio = minutosA_HHMM(Math.min(...inicios))
      hora_fin = minutosA_HHMM(Math.max(...fines))
    }

    setGuardando(true)
    const fila = {
      hijo: hijoActivo, nombre, categoria: fCat, dias, modo: fModo,
      hora_inicio, hora_fin, horarios_por_dia,
      lugar: fLugar.trim() || null,
      fecha_desde: fDesde, fecha_hasta: fHasta,
    }
    const res = editandoSerie
      ? await supabase.from('hijos_series').update(fila).eq('id', editandoSerie)
      : await supabase.from('hijos_series').insert(fila)
    setGuardando(false)
    if (res.error) { alert('No se pudo guardar: ' + res.error.message); return }
    resetForm(); cargar()
  }

  function editarSerie(s: Serie) {
    setEditandoSerie(s.id)
    setFNombre(s.nombre); setFCat(s.categoria); setFDias(new Set(s.dias))
    setFModo(s.modo || 'uniforme')
    if (s.modo === 'por_dia' && s.horarios_por_dia) {
      const mapa: Record<number, HorarioDia> = {}
      Object.entries(s.horarios_por_dia).forEach(([d, h]) => { mapa[Number(d)] = h })
      setFHorariosPorDia(mapa)
    } else {
      setFHorariosPorDia({})
    }
    setFInicio(s.hora_inicio); setFFin(s.hora_fin); setFLugar(s.lugar || '')
    setFDesde(s.fecha_desde); setFHasta(s.fecha_hasta)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function eliminarSerie(id: string) {
    if (!confirm('¿Eliminar esta actividad y TODAS sus repeticiones?')) return
    await supabase.from('hijos_series').delete().eq('id', id)
    if (editandoSerie === id) resetForm()
    cargar()
  }

  function imprimirSemana() {
    const filas: string[] = []
    for (let h = BASE_HOUR; h <= LAST_HOUR; h++) {
      const celdas = DAY_LABEL.map((_, d) => {
        const chips = grilla[d][h - BASE_HOUR].map(({ oc, primera }) =>
          `<div style="background:${CAT_COLOR[oc.categoria] || CAT_COLOR.otro};border-radius:4px;padding:2px 4px;margin-bottom:1px;color:#fff;font-size:9.5px;overflow:hidden;">${primera ? `<b>${oc.nombre}</b><br/><span style="font-size:8.5px;">${oc.hora_inicio}–${oc.hora_fin}${oc.lugar ? ' · ' + oc.lugar : ''}</span>` : '&nbsp;'}</div>`).join('')
        return `<td style="border:1px solid #dcdce3;height:26px;padding:1px;vertical-align:top;">${chips}</td>`
      }).join('')
      filas.push(`<tr><td style="border:1px solid #dcdce3;background:#fafafb;font-size:9.5px;color:#7a7a85;text-align:right;padding:0 5px;white-space:nowrap;">${h < 10 ? '0' + h : h}:00</td>${celdas}</tr>`)
    }
    const heads = DAY_LABEL.map((_, i) => `<th style="border:1px solid #dcdce3;background:#fafafb;padding:5px;font-size:10.5px;">${DAY_SHORT[i]} ${diasSemana[i].getDate()}</th>`).join('')
    const html = `<html><head><meta charset="utf-8"><style>@page{size:landscape;margin:9mm}body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2b2b33;margin:0;padding:10px}</style></head><body>
      <h2 style="margin:0 0 2px;font-size:17px;">Calendario — ${HIJOS[hijoActivo]}</h2>
      <div style="font-size:11px;color:#7a7a85;margin-bottom:8px;text-transform:capitalize;">${rangoLabel}</div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
        <thead><tr><th style="border:1px solid #dcdce3;width:46px;"></th>${heads}</tr></thead>
        <tbody>${filas.join('')}</tbody>
      </table></body></html>`
    try {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (!doc) { document.body.removeChild(iframe); return }
      doc.open(); doc.write(html); doc.close()
      setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print() } catch { }; setTimeout(() => { try { document.body.removeChild(iframe) } catch { } }, 1500) }, 350)
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
  const hoyISO = toISO(new Date())

  return (
    <div style={{ padding: '20px', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: '14px', padding: '20px', boxShadow: '0 1px 3px rgba(20,20,30,.08), 0 6px 18px rgba(20,20,30,.05)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={18} color="#5b6cf0" />
            <h2 style={{ margin: 0, fontSize: '16px' }}>Calendario de los chicos</h2>
          </div>
          <div style={{ display: 'flex', gap: '4px', background: '#f4f4f7', borderRadius: '10px', padding: '4px' }}>
            {HIJOS.map((nombre, i) => (
              <button key={i} onClick={() => { setHijoActivo(i); resetForm() }}
                style={{
                  border: 'none', borderRadius: '8px', padding: '7px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: hijoActivo === i ? COLOR_HIJO[i] : 'transparent',
                  color: hijoActivo === i ? '#fff' : '#7a7a85',
                }}>{nombre}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #ececf1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={() => setLunesActual(addDays(lunesActual, -7))} title="Semana anterior" style={{ border: '1px solid #dcdce3', background: '#fff', borderRadius: '8px', padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronLeft size={16} /></button>
            <button onClick={() => setLunesActual(lunesDeLaSemana(new Date()))} style={{ border: '1px solid #dcdce3', background: '#fff', borderRadius: '8px', padding: '7px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>Hoy</button>
            <button onClick={() => setLunesActual(addDays(lunesActual, 7))} title="Semana siguiente" style={{ border: '1px solid #dcdce3', background: '#fff', borderRadius: '8px', padding: '7px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><ChevronRight size={16} /></button>
            <span style={{ fontSize: '15px', fontWeight: 700, marginLeft: '6px', textTransform: 'capitalize' }}>{rangoLabel}</span>
          </div>
          <button onClick={imprimirSemana} title="Imprimir esta semana" style={{ border: '1px solid #dcdce3', background: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}><Printer size={14} /> Imprimir</button>
        </div>

        <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(270px, 310px) 1fr', gap: '18px', alignItems: 'start' }}>

          <div style={{ border: '1px solid #ececf1', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>{editandoSerie ? 'Editando actividad' : 'Nueva actividad'} — {HIJOS[hijoActivo]}</h3>

            <div style={{ marginBottom: '11px' }}><label style={labelStyle}>Actividad</label><input style={inputStyle} value={fNombre} onChange={e => setFNombre(e.target.value)} placeholder="Ej. Piano, Terapia, Colegio" /></div>
            <div style={{ marginBottom: '11px' }}><label style={labelStyle}>Categoría</label>
              <select style={inputStyle} value={fCat} onChange={e => setFCat(e.target.value)}>{Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>

            <div style={{ marginBottom: '11px' }}>
              <label style={labelStyle}>Día(s) que se repite</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px' }}>
                {[['semana', 'Lun a Vie'], ['finde', 'Fin de semana'], ['todos', 'Todos'], ['ninguno', 'Ninguno']].map(([t, l]) => (
                  <button key={t} onClick={() => preset(t)} style={{ border: '1px solid #dcdce3', background: '#fafafb', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer', color: '#7a7a85' }}>{l}</button>
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
                    }}>{l}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '11px' }}>
              <label style={labelStyle}>Horario</label>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button onClick={() => setFModo('uniforme')} style={{
                  flex: 1, border: '1px solid', borderColor: fModo === 'uniforme' ? COLOR_HIJO[hijoActivo] : '#dcdce3',
                  background: fModo === 'uniforme' ? '#eef1fe' : '#fafafb', color: fModo === 'uniforme' ? COLOR_HIJO[hijoActivo] : '#7a7a85',
                  borderRadius: '8px', padding: '8px 6px', fontSize: '12px', fontWeight: fModo === 'uniforme' ? 600 : 400, cursor: 'pointer',
                }}>Misma hora todos los días</button>
                <button onClick={() => setFModo('por_dia')} style={{
                  flex: 1, border: '1px solid', borderColor: fModo === 'por_dia' ? COLOR_HIJO[hijoActivo] : '#dcdce3',
                  background: fModo === 'por_dia' ? '#eef1fe' : '#fafafb', color: fModo === 'por_dia' ? COLOR_HIJO[hijoActivo] : '#7a7a85',
                  borderRadius: '8px', padding: '8px 6px', fontSize: '12px', fontWeight: fModo === 'por_dia' ? 600 : 400, cursor: 'pointer',
                }}>Hora distinta por día</button>
              </div>

              {fModo === 'uniforme' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><label style={labelStyle}>Hora inicio</label><input type="time" style={inputStyle} value={fInicio} onChange={e => setFInicio(e.target.value)} /></div>
                  <div><label style={labelStyle}>Hora fin</label><input type="time" style={inputStyle} value={fFin} onChange={e => setFFin(e.target.value)} /></div>
                </div>
              ) : (
                fDias.size === 0 ? (
                  <p style={{ fontSize: '12px', color: '#a3a3ad', fontStyle: 'italic', margin: 0 }}>Elige al menos un día arriba.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Array.from(fDias).sort((a, b) => a - b).map(d => {
                      const h = fHorariosPorDia[d] || { inicio: '16:00', fin: '17:00' }
                      return (
                        <div key={d} style={{ display: 'grid', gridTemplateColumns: '30px 1fr 1fr', gap: '8px', alignItems: 'center' }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: '#7a7a85' }}>{DAY_SHORT[d]}</div>
                          <input type="time" style={inputStyle} value={h.inicio} onChange={e => setHorarioDia(d, 'inicio', e.target.value)} />
                          <input type="time" style={inputStyle} value={h.fin} onChange={e => setHorarioDia(d, 'fin', e.target.value)} />
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '11px' }}>
              <div><label style={labelStyle}>Se repite desde</label><input type="date" style={inputStyle} value={fDesde} onChange={e => setFDesde(e.target.value)} /></div>
              <div><label style={labelStyle}>Hasta</label><input type="date" style={inputStyle} value={fHasta} onChange={e => setFHasta(e.target.value)} /></div>
            </div>

            <div style={{ marginBottom: '12px' }}><label style={labelStyle}>Lugar (opcional)</label><input style={inputStyle} value={fLugar} onChange={e => setFLugar(e.target.value)} placeholder="Ej. Clínica, casa de la profesora" /></div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={guardarSerie} disabled={guardando} style={{ flex: 1, background: COLOR_HIJO[hijoActivo], color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 12px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: guardando ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Plus size={15} /> {editandoSerie ? 'Guardar cambios' : 'Agregar'}
              </button>
              {editandoSerie && <button onClick={resetForm} style={{ border: '1px solid #dcdce3', background: '#fff', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #ececf1' }}>
              {Object.entries(CAT_LABEL).map(([v, l]) => (
                <span key={v} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: CAT_COLOR[v] }} />{l}
                </span>
              ))}
            </div>

            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #ececf1' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: '13px' }}>Actividades de {HIJOS[hijoActivo]}</h3>
              {cargando ? (
                <p style={{ fontSize: '12.5px', color: '#7a7a85', fontStyle: 'italic', margin: 0 }}>Cargando…</p>
              ) : seriesHijo.length === 0 ? (
                <p style={{ fontSize: '12.5px', color: '#7a7a85', fontStyle: 'italic', margin: 0 }}>Aún no hay actividades.</p>
              ) : (
                [...seriesHijo].sort((a, b) => Math.min(...a.dias) - Math.min(...b.dias) || a.hora_inicio.localeCompare(b.hora_inicio)).map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', padding: '7px 0', borderBottom: '1px solid #f1f1f4', fontSize: '12.5px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', background: CAT_COLOR[s.categoria] || CAT_COLOR.otro, marginRight: '6px' }} />
                        {s.nombre}
                      </div>
                      <div style={{ color: '#7a7a85', fontSize: '11.5px', marginTop: '1px' }}>
                        {formatDias(s.dias)} · {s.modo === 'por_dia' ? 'horario variable' : `${s.hora_inicio}–${s.hora_fin}`}{s.lugar ? ' · ' + s.lugar : ''}
                      </div>
                      {s.modo === 'por_dia' && s.horarios_por_dia && (
                        <div style={{ color: '#a3a3ad', fontSize: '10.5px', marginTop: '1px' }}>
                          {Object.entries(s.horarios_por_dia)
                            .sort((a, b) => Number(a[0]) - Number(b[0]))
                            .map(([d, h]) => `${DAY_SHORT[Number(d)]} ${h.inicio}–${h.fin}`)
                            .join(' · ')}
                        </div>
                      )}
                      <div style={{ color: '#a3a3ad', fontSize: '10.5px', marginTop: '1px' }}>
                        {fromISO(s.fecha_desde).getDate()} {MESES[fromISO(s.fecha_desde).getMonth()].slice(0, 3)} → {fromISO(s.fecha_hasta).getDate()} {MESES[fromISO(s.fecha_hasta).getMonth()].slice(0, 3)} {fromISO(s.fecha_hasta).getFullYear()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button onClick={() => editarSerie(s)} title="Editar la serie" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: '5px', color: '#7a7a85' }}><Pencil size={13} /></button>
                      <button onClick={() => eliminarSerie(s.id)} title="Eliminar la serie" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: '5px', color: '#7a7a85' }}><X size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="cal-grid-table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '560px' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #dcdce3', width: '52px', background: '#fff' }}></th>
                  {DAY_LABEL.map((d, i) => {
                    const fecha = diasSemana[i]
                    const esHoy = toISO(fecha) === hoyISO
                    return (
                      <th key={d} style={{ border: '1px solid #dcdce3', background: esHoy ? '#eef1fe' : '#fafafb', padding: '6px 4px', fontSize: '12px', fontWeight: 600 }}>
                        <div>{DAY_SHORT[i]}</div>
                        <div style={{ fontSize: '13px', color: esHoy ? '#5b6cf0' : '#2b2b33', fontWeight: esHoy ? 800 : 600 }}>{fecha.getDate()}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: LAST_HOUR - BASE_HOUR + 1 }, (_, i) => BASE_HOUR + i).map(h => (
                  <tr key={h}>
                    <td style={{ border: '1px solid #dcdce3', background: '#fafafb', fontSize: '11px', color: '#7a7a85', textAlign: 'right', padding: '0 6px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{h < 10 ? '0' + h : h}:00</td>
                    {DAY_LABEL.map((_, d) => {
                      const esHoy = toISO(diasSemana[d]) === hoyISO
                      return (
                        <td key={d} style={{ border: '1px solid #dcdce3', height: '30px', padding: '1px', verticalAlign: 'top', background: esHoy ? '#f7f9ff' : '#fff' }}>
                          {grilla[d][h - BASE_HOUR].map(({ oc, primera }, k) => (
                            <div key={oc.serieId + oc.fechaISO + k} onClick={() => setOcSel(oc)}
                              title={`${oc.nombre} (${oc.hora_inicio}–${oc.hora_fin})${oc.lugar ? ' · ' + oc.lugar : ''} — clic para editar este día`}
                              style={{ background: CAT_COLOR[oc.categoria] || CAT_COLOR.otro, borderRadius: '5px', padding: '2px 5px', marginBottom: '1px', fontSize: '10.5px', lineHeight: 1.2, color: '#fff', overflow: 'hidden', cursor: 'pointer', border: oc.excId ? '1.5px dashed #fff' : 'none' }}>
                              {primera ? (
                                <>
                                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oc.nombre}</div>
                                  <div style={{ fontSize: '9.5px', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oc.hora_inicio}–{oc.hora_fin}{oc.lugar ? ' · ' + oc.lugar : ''}</div>
                                </>
                              ) : <span>&nbsp;</span>}
                            </div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: '11px', color: '#a3a3ad', marginTop: '8px' }}>
              Clic en una actividad para editar o cancelar <b>solo ese día</b>. Las de borde punteado ya fueron modificadas para esa fecha.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .cal-grid { grid-template-columns: 1fr !important; }
          .cal-grid-table-wrap { overflow-x: auto; }
        }
      `}</style>

      {ocSel && (
        <ModalOcurrencia
          oc={ocSel}
          onClose={() => setOcSel(null)}
          onHecho={() => { setOcSel(null); cargar() }}
        />
      )}
    </div>
  )
}

function ModalOcurrencia({ oc, onClose, onHecho }: {
  oc: Ocurrencia; onClose: () => void; onHecho: () => void
}) {
  const [modo, setModo] = useState<'menu' | 'editarDia'>('menu')
  const [nombre, setNombre] = useState(oc.nombre)
  const [cat, setCat] = useState(oc.categoria)
  const [ini, setIni] = useState(oc.hora_inicio)
  const [fin, setFin] = useState(oc.hora_fin)
  const [lugar, setLugar] = useState(oc.lugar || '')
  const [busy, setBusy] = useState(false)

  const fechaBonita = (() => {
    const d = fromISO(oc.fechaISO)
    return `${DAY_LABEL[oc.diaSemana]} ${d.getDate()} de ${MESES[d.getMonth()]}`
  })()

  async function cancelarSoloEsteDia() {
    setBusy(true)
    await supabase.from('hijos_excepciones').delete().eq('serie_id', oc.serieId).eq('fecha', oc.fechaISO)
    const { error } = await supabase.from('hijos_excepciones').insert({ serie_id: oc.serieId, fecha: oc.fechaISO, tipo: 'cancelada' })
    setBusy(false)
    if (error) { alert('No se pudo cancelar: ' + error.message); return }
    onHecho()
  }

  async function guardarSoloEsteDia() {
    const s = timeParts(ini), e = timeParts(fin)
    if (e.h * 60 + e.m <= s.h * 60 + s.m) { alert('La hora de fin debe ser posterior a la de inicio.'); return }
    setBusy(true)
    await supabase.from('hijos_excepciones').delete().eq('serie_id', oc.serieId).eq('fecha', oc.fechaISO)
    const { error } = await supabase.from('hijos_excepciones').insert({
      serie_id: oc.serieId, fecha: oc.fechaISO, tipo: 'movida',
      nombre, categoria: cat, hora_inicio: ini, hora_fin: fin, lugar: lugar.trim() || null,
    })
    setBusy(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    onHecho()
  }

  async function restaurarEsteDia() {
    setBusy(true)
    await supabase.from('hijos_excepciones').delete().eq('serie_id', oc.serieId).eq('fecha', oc.fechaISO)
    setBusy(false)
    onHecho()
  }

  const inputStyle: React.CSSProperties = { border: '1px solid #dcdce3', borderRadius: '8px', padding: '8px 9px', fontSize: '13.5px', fontFamily: 'inherit', width: '100%', background: '#fff' }
  const labelStyle: React.CSSProperties = { fontSize: '11.5px', color: '#7a7a85', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: '4px' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', padding: '20px', width: '100%', maxWidth: '420px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>{oc.nombre}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7a7a85' }}><X size={18} /></button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#7a7a85', textTransform: 'capitalize' }}>{fechaBonita} · {oc.hora_inicio}–{oc.hora_fin}</p>

        {modo === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={() => setModo('editarDia')} style={btnPrimary}>✏️ Editar solo este día</button>
            <button onClick={cancelarSoloEsteDia} disabled={busy} style={btnDanger}>🚫 Cancelar solo este día</button>
            {oc.excId && <button onClick={restaurarEsteDia} disabled={busy} style={btnGhost}>↩️ Restaurar este día (volver a la serie)</button>}
            <div style={{ borderTop: '1px solid #ececf1', margin: '6px 0' }} />
            <p style={{ fontSize: '11.5px', color: '#a3a3ad', margin: '0 0 4px' }}>Para cambiar TODA la serie (todos los días que se repite), usa el lápiz ✎ en la lista de la izquierda.</p>
          </div>
        )}

        {modo === 'editarDia' && (
          <div>
            <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Actividad</label><input style={inputStyle} value={nombre} onChange={e => setNombre(e.target.value)} /></div>
            <div style={{ marginBottom: '10px' }}><label style={labelStyle}>Categoría</label>
              <select style={inputStyle} value={cat} onChange={e => setCat(e.target.value)}>{Object.entries(CAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div><label style={labelStyle}>Hora inicio</label><input type="time" style={inputStyle} value={ini} onChange={e => setIni(e.target.value)} /></div>
              <div><label style={labelStyle}>Hora fin</label><input type="time" style={inputStyle} value={fin} onChange={e => setFin(e.target.value)} /></div>
            </div>
            <div style={{ marginBottom: '14px' }}><label style={labelStyle}>Lugar</label><input style={inputStyle} value={lugar} onChange={e => setLugar(e.target.value)} placeholder="Opcional" /></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={guardarSoloEsteDia} disabled={busy} style={{ ...btnPrimary, flex: 1 }}>Guardar solo este día</button>
              <button onClick={() => setModo('menu')} style={btnGhost}>Atrás</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = { background: '#5b6cf0', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 12px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnDanger: React.CSSProperties = { background: '#fff', color: '#b91c1c', border: '1px solid #f3c6c6', borderRadius: '8px', padding: '11px 12px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { background: '#fff', color: '#2b2b33', border: '1px solid #dcdce3', borderRadius: '8px', padding: '11px 12px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }