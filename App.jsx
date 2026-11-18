import { useState, useEffect, useCallback, useRef } from 'react';
import { ESCUDO, FACHADA } from './assets';
import { CLUB, WHATSAPP, WHATSAPP_VISIBLE, ALIAS, CVU, TITULAR, SECRETARIA, ACTIVIDADES, CATEGORIAS, MEDIOS, HORARIOS, MESES, MESES_LARGO } from './config';
import { hoyInfo, hoyISO, fechaAR, dinero, precio, pagoDe, estadoMes, adeudados, alDia, deuda, proxVenc, pagosDelMes, csvCierre, parseCSV } from './logic';
import { cargar, guardar, reiniciar, escuchar, ultimoEstado, modoActual, alCambiarModo } from './db';
import { hash } from './seed';

/* ---------- piezas comunes ---------- */
function Modal({ titulo, children, onClose }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="modal">
        <h2>{titulo}</h2>
        {children}
        {onClose && <button className="btn ghost full" onClick={onClose}>Cerrar</button>}
      </div>
    </div>
  );
}
const Tag = ({ ok, children }) => <span className={'tag ' + (ok ? 'ok' : 'bad')}>{children}</span>;

function QR({ seed }) {
  const N = 21;
  let x = 0; for (const c of seed) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
  const cells = [];
  const finder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= N - 7) || (r >= N - 7 && c < 7);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    let on;
    if (finder(r, c)) {
      const lr = r >= N - 7 ? r - (N - 7) : r, lc = c >= N - 7 ? c - (N - 7) : c;
      on = lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4);
    } else on = rnd() > 0.5;
    if (on) cells.push(<rect key={r + '-' + c} x={c} y={r} width="1" height="1" />);
  }
  return <svg className="qr" viewBox={`-1 -1 ${N + 2} ${N + 2}`} role="img" aria-label="QR de ejemplo"><rect x="-1" y="-1" width={N + 2} height={N + 2} fill="#fff" />{cells}</svg>;
}

function PagarModal({ socio, onClose }) {
  return (
    <Modal titulo="¿Cómo pagar la cuota?" onClose={null}>
      <p className="muted">Esta app no procesa pagos. Elegí una de estas opciones y el club registrará tu pago:</p>
      <div className="box"><b>Transferencia / Mercado Pago</b>
        <div>Alias: <b>{ALIAS}</b></div>
        <div>CVU: <b>{CVU}</b></div>
        <div>Titular: {TITULAR}</div>
        <div className="qrwrap"><QR seed={ALIAS} /><small>QR de ejemplo (demo)</small></div>
        <small>Indicá en el concepto: N° {socio.num} · {socio.apellido}</small>
      </div>
      <div className="box"><b>Efectivo en secretaría</b><div>{SECRETARIA}</div></div>
      <button className="btn full" onClick={onClose}>Entendido</button>
    </Modal>
  );
}

/* ---------- login ---------- */
function Login({ estado, onLogin }) {
  const [user, setUser] = useState(''), [clave, setClave] = useState(''), [err, setErr] = useState('');
  const enviar = async () => {
    const h = await hash(clave.trim().toLowerCase());
    const u = estado.usuarios.find((x) => x.user === user.trim().toLowerCase() && x.hash === h);
    if (!u) { setErr('Usuario o contraseña incorrectos.'); return; }
    onLogin({ user: u.user, rol: u.rol, socioId: u.socioId });
  };
  return (
    <div className="login">
      <img className="fachada" src={FACHADA} alt="Fachada del club" />
      <div className="card center">
        <img className="escudo" src={ESCUDO} alt="Escudo Bristol" />
        <h1>{CLUB}</h1>
        <p className="muted">Cuotas y carnet digital</p>
        <div onKeyDown={(e) => e.key === 'Enter' && enviar()}>
          <label>Usuario<input autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" value={user} onChange={(e) => { setUser(e.target.value); setErr(''); }} placeholder="soc01" /></label>
          <label>Contraseña<input type="password" autoComplete="current-password" autoCapitalize="none" autoCorrect="off" value={clave} onChange={(e) => { setClave(e.target.value); setErr(''); }} placeholder="••••••" /></label>
          {err && <div className="error" role="alert">{err}</div>}
          <button className="btn full" type="button" onClick={enviar}>Ingresar</button>
        </div>
        <div className="demo"><b>Credenciales de prueba (demo)</b><br />Socio: <code>soc01</code> / <code>soc01</code><br />Administración: <code>admin01</code> / <code>admin01</code></div>
      </div>
    </div>
  );
}

/* ---------- socio ---------- */
function Socio({ estado, sesion, mutate, salir }) {
  const s = estado.socios.find((x) => x.id === sesion.socioId);
  const [tab, setTab] = useState('inicio');
  const [pagar, setPagar] = useState(false);
  const h = hoyInfo();
  const aceptado = estado.tos[s.id];
  const deb = adeudados(estado, s);
  const venc = proxVenc(estado, s);
  const asist = estado.asistencia.filter((a) => a.socioId === s.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const pct = asist.length ? Math.round((asist.filter((a) => a.presente).length / asist.length) * 100) : 0;
  const pagadas = [1,2,3,4,5,6,7,8,9,10,11,12].filter((m) => estadoMes(estado, s, m) === 'pagado').length;

  const Estado = () => (
    <div className={'estado ' + (deb.length ? 'mal' : 'bien')}>
      {deb.length ? <><Tag>Adeudado</Tag><b>{deb.length} {deb.length === 1 ? 'cuota pendiente' : 'cuotas pendientes'}</b><span>{dinero(deb.length * precio(s.actividad))}</span></>
        : <><Tag ok>Al día</Tag><b>Cuotas pagadas hasta {MESES_LARGO[h.m - 1]}</b></>}
    </div>
  );
  const Venc = () => venc ? (
    <div className="box"><small>Próximo vencimiento</small>
      <div className="big">{fechaAR(venc.fecha)} <span className="muted">· {MESES_LARGO[venc.mes - 1]}</span></div>
      <div>Monto: <b>{dinero(venc.monto)}</b> {venc.vencida && <Tag>Vencida</Tag>}</div></div>
  ) : <div className="box">No hay vencimientos pendientes este año.</div>;

  return (
    <div className="app socio">
      <header className="top"><img src={ESCUDO} alt="" /><div><b>{CLUB}</b><small>Hola, {s.nombre}</small></div><button className="link" onClick={salir}>Salir</button></header>
      <main>
        {tab === 'inicio' && <>
          <div className="card"><h2>Ficha del socio</h2>
            <dl className="ficha"><dt>Nombre</dt><dd>{s.nombre}</dd><dt>Apellido</dt><dd>{s.apellido}</dd><dt>Categoría</dt><dd>{s.categoria}</dd><dt>Actividad</dt><dd>{s.actividad}</dd><dt>N° de socio</dt><dd>{s.num}</dd></dl></div>
          <div className="card"><h2>Estado de cuotas</h2><Estado /><Venc />
            <button className="btn full" onClick={() => setPagar(true)}>Pagar</button></div>
        </>}
        {tab === 'cuotas' && <div className="card"><h2>Mis cuotas {h.y}</h2><Estado /><Venc />
          <ul className="lista">{[...Array(12)].map((_, i) => i + 1).filter((m) => estadoMes(estado, s, m) !== 'noaplica' && (estadoMes(estado, s, m) !== 'futuro' || pagoDe(estado, s.id, m))).map((m) => {
            const p = pagoDe(estado, s.id, m);
            return <li key={m}><span>{MESES_LARGO[m - 1]}</span>{p ? <span><small>{fechaAR(p.fecha)} · {p.medio} · {dinero(p.monto)}</small> <Tag ok>Pagado</Tag></span> : <Tag>Adeudado</Tag>}</li>;
          })}</ul>
          <button className="btn full" onClick={() => setPagar(true)}>Pagar</button></div>}
        {tab === 'carnet' && <div className="card"><h2>Carnet digital</h2>
          <div className="carnet">
            <div className="carnet-head"><img src={ESCUDO} alt="" /><div><b>{CLUB}</b><small>Carnet de socio {h.y}</small></div></div>
            <div className="carnet-body"><div className="nombre">{s.nombre} {s.apellido}</div>
              <div>N° {s.num}</div><div>{s.actividad} · {s.categoria}</div></div>
            <div className="grilla">{MESES.map((n, i) => { const st = estadoMes(estado, s, i + 1); return <div key={n} className={'mes ' + st}><small>{n}</small><b>{st === 'pagado' ? '✓' : st === 'adeudado' ? '✗' : '·'}</b></div>; })}</div>
            <div className="leyenda"><span className="pagado">✓ Pago</span><span className="adeudado">✗ Impago</span><span>· Sin vencer</span></div>
          </div><p className="muted">Reemplaza al carnet físico de cartón. {pagadas} de 12 meses pagados.</p></div>}
        {tab === 'club' && <>
          <div className="card"><h2>Días y horarios</h2><ul className="lista">{HORARIOS.map((x) => <li key={x.act}><b>{x.act}</b><span>{x.dias}<br /><small>{x.hora} h</small></span></li>)}</ul><small className="muted">Horarios de ejemplo para la demo.</small></div>
          <div className="card"><h2>Avisos del club</h2>{estado.avisos.length === 0 && <p className="muted">No hay avisos.</p>}
            {[...estado.avisos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).map((a) => <div className="aviso" key={a.id}><b>{a.titulo}</b><small>{fechaAR(a.fecha)}</small><p>{a.texto}</p></div>)}</div>
          <div className="card"><h2>Contacto</h2><p>Administración: {WHATSAPP_VISIBLE} <small className="muted">(número de prueba)</small></p><a className="btn full wa" href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola, soy ' + s.nombre + ' ' + s.apellido + ' (socio N° ' + s.num + '). Tengo una consulta.')}`} target="_blank" rel="noreferrer">Escribir por WhatsApp</a></div>
        </>}
        {tab === 'asist' && <div className="card"><h2>Mi asistencia · {s.actividad}</h2><p>Asistencia: <b>{pct}%</b> <small className="muted">({asist.filter((a) => a.presente).length} de {asist.length} clases)</small></p>
          <ul className="lista">{asist.slice(0, 10).map((a) => <li key={a.fecha}><span>{fechaAR(a.fecha)}<br /><small>{a.actividad || s.actividad}</small></span><Tag ok={a.presente}>{a.presente ? 'Presente' : 'Ausente'}</Tag></li>)}</ul></div>}
      </main>
      <a className="fab" aria-label="WhatsApp del club" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp</a>
      <nav className="bottom">{[['inicio', 'Inicio'], ['cuotas', 'Cuotas'], ['carnet', 'Carnet'], ['club', 'Club'], ['asist', 'Asistencia']].map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</nav>
      {pagar && <PagarModal socio={s} onClose={() => setPagar(false)} />}
      {!aceptado && <Modal titulo="Bienvenido/a a Bristol F.C.">
        <p>Para usar la app tratamos tus datos personales (y los de menores de edad) <b>solo para gestionar cuotas, carnet y comunicación del club</b>, conforme a la Ley 25.326 de Protección de Datos Personales. No pedimos fotos de DNI ni documentos.</p>
        <p className="muted">Si el socio es menor, aceptá como su adulto responsable.</p>
        <button className="btn full" onClick={() => mutate((e) => { e.tos[s.id] = hoyISO(); })}>Aceptar y continuar</button>
      </Modal>}
    </div>
  );
}

/* ---------- admin ---------- */
function PagoForm({ estado, inicial, onClose, mutate, aviso }) {
  const h = hoyInfo();
  const primero = (sid) => { const s = estado.socios.find((x) => x.id === sid); const d = adeudados(estado, s); if (d.length) return d[0]; for (let m = 1; m <= 12; m++) if (estadoMes(estado, s, m) === 'futuro') return m; return h.m; };
  const [sid, setSid] = useState(inicial || estado.socios[0].id);
  const [mes, setMes] = useState(primero(sid));
  const [monto, setMonto] = useState(precio(estado.socios.find((x) => x.id === sid).actividad));
  const [medio, setMedio] = useState(MEDIOS[0]);
  const [err, setErr] = useState('');
  const socio = estado.socios.find((x) => x.id === sid);
  const cambiar = (v) => { const id = Number(v); const s = estado.socios.find((x) => x.id === id); setSid(id); setMes(primero(id)); setMonto(precio(s.actividad)); setErr(''); };
  const guardarPago = () => {
    if (!(Number(monto) > 0)) { setErr('Ingresá un monto mayor a 0.'); return; }
    if (pagoDe(estado, sid, mes)) { setErr('Ese mes ya figura como pagado.'); return; }
    mutate((e) => { e.pagos.push({ id: Math.max(0, ...e.pagos.map((p) => p.id)) + 1, socioId: sid, anio: e.anio, mes, monto: Number(monto), medio, fecha: hoyISO() }); });
    aviso(`Pago registrado: ${socio.apellido}, ${socio.nombre} · ${MESES_LARGO[mes - 1]} · ${dinero(monto)} (${medio})`);
    onClose();
  };
  return (
    <Modal titulo="Registrar pago" onClose={onClose}>
      <label>Socio<select value={sid} onChange={(e) => cambiar(e.target.value)}>{estado.socios.map((s) => <option key={s.id} value={s.id}>N° {s.num} · {s.apellido}, {s.nombre}</option>)}</select></label>
      <label>Mes que abona<select value={mes} onChange={(e) => { setMes(Number(e.target.value)); setErr(''); }}>{MESES_LARGO.map((n, i) => { const st = estadoMes(estado, socio, i + 1); return <option key={n} value={i + 1} disabled={st === 'pagado' || st === 'noaplica'}>{n}{st === 'pagado' ? ' (pagado)' : st === 'adeudado' ? ' (adeudado)' : ''}</option>; })}</select></label>
      <label>Monto ($)<input type="number" min="1" value={monto} onChange={(e) => { setMonto(e.target.value); setErr(''); }} /></label>
      <label>Medio de pago<select value={medio} onChange={(e) => setMedio(e.target.value)}>{MEDIOS.map((m) => <option key={m}>{m}</option>)}</select></label>
      {err && <div className="error" role="alert">{err}</div>}
      <button className="btn full" onClick={guardarPago}>Guardar</button>
    </Modal>
  );
}

function ImportModal({ estado, mutate, onClose, aviso }) {
  const [filas, setFilas] = useState(null), [errores, setErrores] = useState([]);
  const EJ = 'nombre;apellido;actividad;categoria\nAgustina;Silva;Patín;Infantil\nBruno;Acosta;Fútbol;Juvenil\nMartina;Luna;Taekwondo;Infantil';
  const procesar = (txt) => { const r = parseCSV(txt, ACTIVIDADES, CATEGORIAS); setFilas(r.out); setErrores(r.errores); };
  const archivo = (ev) => { const f = ev.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => procesar(String(rd.result)); rd.readAsText(f); };
  const importar = () => {
    const h = hoyInfo();
    mutate((e) => { let id = Math.max(0, ...e.socios.map((s) => s.id)); filas.forEach((f) => { id++; e.socios.push({ id, num: 1000 + id, ...f, alta: h.m }); }); });
    aviso(`Se importaron ${filas.length} socios (simulación de carga masiva).`); onClose();
  };
  return (
    <Modal titulo="Importar desde Excel/CSV" onClose={onClose}>
      <p className="muted">Demostración de carga masiva. Columnas: nombre, apellido, actividad, categoría.</p>
      <input type="file" accept=".csv,text/csv" onChange={archivo} />
      <button className="btn ghost full" onClick={() => procesar(EJ)}>Usar archivo de ejemplo</button>
      {filas && <div className="box"><b>{filas.length} socios listos para importar</b>
        <ul className="lista">{filas.map((f, i) => <li key={i}><span>{f.apellido}, {f.nombre}</span><small>{f.actividad} · {f.categoria}</small></li>)}</ul>
        {errores.length > 0 && <div className="error">Filas con errores (omitidas): {errores.join(', ')}</div>}
        <button className="btn full" disabled={!filas.length} onClick={importar}>Importar</button></div>}
    </Modal>
  );
}

function Admin({ estado, mutate, salir, aviso, onReset }) {
  const [tab, setTab] = useState('cuotas');
  const [modalPago, setModalPago] = useState(null);
  const [importar, setImportar] = useState(false);
  return (
    <div className="app admin">
      <header className="top"><img src={ESCUDO} alt="" /><div><b>{CLUB} · Administración</b><small>Gestión de cuotas</small></div>
        <button className="btn sm" onClick={() => setModalPago(true)}>+ Registrar Pago</button><button className="link" onClick={salir}>Salir</button></header>
      <nav className="tabs">{[['cuotas', 'Cuotas'], ['altas', 'Altas'], ['asist', 'Asistencia'], ['avisos', 'Avisos'], ['cierre', 'Cierre del mes']].map(([k, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{n}</button>)}</nav>
      <main>
        {tab === 'cuotas' && <Cuotas estado={estado} onPagar={(id) => setModalPago(id)} />}
        {tab === 'altas' && <Altas estado={estado} mutate={mutate} aviso={aviso} onImport={() => setImportar(true)} />}
        {tab === 'asist' && <AsistAdmin estado={estado} mutate={mutate} aviso={aviso} />}
        {tab === 'avisos' && <AvisosAdmin estado={estado} mutate={mutate} aviso={aviso} />}
        {tab === 'cierre' && <Cierre estado={estado} />}
        <div className="reset"><button className="link" onClick={onReset}>Reiniciar datos de demo</button></div>
      </main>
      {modalPago && <PagoForm estado={estado} inicial={modalPago === true ? null : modalPago} mutate={mutate} aviso={aviso} onClose={() => setModalPago(null)} />}
      {importar && <ImportModal estado={estado} mutate={mutate} aviso={aviso} onClose={() => setImportar(false)} />}
    </div>
  );
}

function Cuotas({ estado, onPagar }) {
  const [act, setAct] = useState('Todos'), [est, setEst] = useState('Todos'), [q, setQ] = useState('');
  const h = hoyInfo(); const ym = `${h.y}-${String(h.m).padStart(2, '0')}`;
  const filas = estado.socios.filter((s) => (act === 'Todos' || s.actividad === act) && (est === 'Todos' || (est === 'Al día') === alDia(estado, s)) &&
    (`${s.nombre} ${s.apellido} ${s.num}`.toLowerCase().includes(q.trim().toLowerCase())));
  const dia = estado.socios.filter((s) => alDia(estado, s)).length;
  const deudaTotal = estado.socios.reduce((t, s) => t + deuda(estado, s), 0);
  const cobradoAnio = estado.pagos.filter((p) => p.anio === estado.anio).reduce((t, p) => t + p.monto, 0);
  const deudaFiltrada = filas.reduce((t, s) => t + deuda(estado, s), 0);
  return (<>
    <div className="kpis"><div><b>{estado.socios.length}</b><small>Socios activos</small></div><div className="okk"><b>{dia}</b><small>Al día</small></div><div className="badk"><b>{estado.socios.length - dia}</b><small>Con atrasos</small></div><div><b>{dinero(pagosDelMes(estado, ym).reduce((a, p) => a + p.monto, 0))}</b><small>Cobrado {MESES[h.m - 1]}</small></div><div><b>{dinero(cobradoAnio)}</b><small>Cobrado en {h.y}</small></div><div className="badk"><b>{dinero(deudaTotal)}</b><small>Deuda total</small></div></div>
    <div className="filtros">
      <input placeholder="Buscar por nombre, apellido o N°" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
      <select value={act} onChange={(e) => setAct(e.target.value)} aria-label="Filtrar por actividad"><option>Todos</option>{ACTIVIDADES.map((a) => <option key={a}>{a}</option>)}</select>
      <select value={est} onChange={(e) => setEst(e.target.value)} aria-label="Filtrar por estado"><option>Todos</option><option>Al día</option><option>Con atrasos</option></select>
    </div>
    <div className="tablewrap"><table><thead><tr><th>N°</th><th>Socio</th><th>Actividad</th><th>Estado</th><th>Deuda</th><th></th></tr></thead>
      <tbody>{filas.map((s) => { const d = adeudados(estado, s); return <tr key={s.id}><td>{s.num}</td><td>{s.apellido}, {s.nombre}<br /><small>{s.categoria}</small></td><td>{s.actividad}</td>
        <td>{d.length ? <Tag>{d.length} {d.length === 1 ? 'mes' : 'meses'} adeudado{d.length === 1 ? '' : 's'}</Tag> : <Tag ok>Al día</Tag>}</td><td>{d.length ? dinero(deuda(estado, s)) : '-'}</td>
        <td><button className="btn sm" onClick={() => onPagar(s.id)}>Registrar pago</button></td></tr>; })}
        {!filas.length && <tr><td colSpan="6" className="muted">No hay socios con esos filtros.</td></tr>}</tbody>
      <tfoot><tr><td colSpan="4"><b>Total adeudado ({filas.length} {filas.length === 1 ? 'socio' : 'socios'} en la lista)</b></td><td colSpan="2"><b>{dinero(deudaFiltrada)}</b></td></tr></tfoot></table></div>
  </>);
}

function Altas({ estado, mutate, aviso, onImport }) {
  const vacio = { nombre: '', apellido: '', actividad: ACTIVIDADES[0], categoria: CATEGORIAS[0] };
  const [f, setF] = useState(vacio), [err, setErr] = useState('');
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(''); };
  const alta = () => {
    if (!f.nombre.trim() || !f.apellido.trim()) { setErr('Completá nombre y apellido.'); return; }
    const h = hoyInfo();
    mutate((e) => { const id = Math.max(0, ...e.socios.map((s) => s.id)) + 1; e.socios.push({ id, num: 1000 + id, nombre: f.nombre.trim(), apellido: f.apellido.trim(), actividad: f.actividad, categoria: f.categoria, alta: h.m }); });
    aviso(`Socio dado de alta: ${f.apellido.trim()}, ${f.nombre.trim()}.`); setF(vacio);
  };
  return <div className="card"><h2>Alta de socio</h2>
    <div>
      <label>Nombre<input value={f.nombre} onChange={set('nombre')} /></label>
      <label>Apellido<input value={f.apellido} onChange={set('apellido')} /></label>
      <label>Actividad<select value={f.actividad} onChange={set('actividad')}>{ACTIVIDADES.map((a) => <option key={a}>{a}</option>)}</select></label>
      <label>Categoría<select value={f.categoria} onChange={set('categoria')}>{CATEGORIAS.map((a) => <option key={a}>{a}</option>)}</select></label>
      {err && <div className="error" role="alert">{err}</div>}
      <button className="btn full" type="button" onClick={alta}>Dar de alta</button>
    </div>
    <button className="btn ghost full" onClick={onImport}>Importar desde Excel/CSV</button></div>;
}

function AsistAdmin({ estado, mutate, aviso }) {
  const [act, setAct] = useState(ACTIVIDADES[0]);
  const hoy = hoyISO();
  const socios = estado.socios.filter((s) => s.actividad === act);
  const [marcas, setMarcas] = useState({});
  const val = (id) => (id in marcas ? marcas[id] : !!estado.asistencia.find((a) => a.socioId === id && a.fecha === hoy)?.presente);
  const guardarAs = () => {
    mutate((e) => { socios.forEach((s) => { e.asistencia = e.asistencia.filter((a) => !(a.socioId === s.id && a.fecha === hoy)); e.asistencia.push({ socioId: s.id, fecha: hoy, actividad: act, presente: val(s.id) }); }); });
    aviso(`Asistencia de ${act} guardada (${fechaAR(hoy)}).`); setMarcas({});
  };
  return <div className="card"><h2>Asistencia de hoy · {fechaAR(hoy)}</h2>
    <label>Actividad<select value={act} onChange={(e) => { setAct(e.target.value); setMarcas({}); }}>{ACTIVIDADES.map((a) => <option key={a}>{a}</option>)}</select></label>
    <ul className="lista">{socios.map((s) => <li key={s.id}><label className="chk"><input type="checkbox" checked={val(s.id)} onChange={(e) => setMarcas({ ...marcas, [s.id]: e.target.checked })} /> {s.apellido}, {s.nombre}</label></li>)}
      {!socios.length && <li className="muted">Sin socios en esta actividad.</li>}</ul>
    <button className="btn full" disabled={!socios.length} onClick={guardarAs}>Guardar asistencia</button></div>;
}

function AvisosAdmin({ estado, mutate, aviso }) {
  const [t, setT] = useState(''), [x, setX] = useState('');
  const pub = () => { if (!t.trim() || !x.trim()) return; mutate((e) => { e.avisos.push({ id: Math.max(0, ...e.avisos.map((a) => a.id)) + 1, titulo: t.trim(), texto: x.trim(), fecha: hoyISO() }); }); aviso('Aviso publicado.'); setT(''); setX(''); };
  return <div className="card"><h2>Avisos a las familias</h2>
    <label>Título<input value={t} onChange={(e) => setT(e.target.value)} /></label>
    <label>Mensaje<textarea rows="3" value={x} onChange={(e) => setX(e.target.value)} /></label>
    <button className="btn full" onClick={pub}>Publicar</button>
    {[...estado.avisos].sort((a, b) => b.id - a.id).map((a) => <div className="aviso" key={a.id}><b>{a.titulo}</b><small>{fechaAR(a.fecha)}</small><p>{a.texto}</p>
      <button className="link" onClick={() => mutate((e) => { e.avisos = e.avisos.filter((y) => y.id !== a.id); })}>Eliminar</button></div>)}</div>;
}

function Cierre({ estado }) {
  const h = hoyInfo();
  const opciones = []; for (let m = 1; m <= h.m; m++) opciones.push(`${h.y}-${String(m).padStart(2, '0')}`);
  const [ym, setYm] = useState(`${h.y}-${String(h.m).padStart(2, '0')}`);
  const pagos = pagosDelMes(estado, ym).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const sub = MEDIOS.map((m) => [m, pagos.filter((p) => p.medio === m).reduce((a, p) => a + p.monto, 0)]);
  const total = sub.reduce((a, [, v]) => a + v, 0);
  const descargar = () => {
    const blob = new Blob([csvCierre(estado, ym)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cierre-${ym}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return <div className="card"><h2>Cierre del mes</h2>
    <label>Mes<select value={ym} onChange={(e) => setYm(e.target.value)}>{opciones.map((o) => <option key={o} value={o}>{MESES_LARGO[Number(o.slice(5)) - 1]} {o.slice(0, 4)}</option>)}</select></label>
    <div className="subs">{sub.map(([m, v]) => <div key={m}><small>{m}</small><b>{dinero(v)}</b></div>)}<div className="tot"><small>Total</small><b>{dinero(total)}</b></div></div>
    <div className="tablewrap"><table><thead><tr><th>Fecha</th><th>Socio</th><th>Mes</th><th>Medio</th><th>Monto</th></tr></thead>
      <tbody>{pagos.map((p) => { const s = estado.socios.find((x) => x.id === p.socioId); return <tr key={p.id}><td>{fechaAR(p.fecha)}</td><td>{s?.apellido}, {s?.nombre}</td><td>{MESES[p.mes - 1]}</td><td>{p.medio}</td><td>{dinero(p.monto)}</td></tr>; })}
        {!pagos.length && <tr><td colSpan="5" className="muted">No hay pagos registrados en este mes.</td></tr>}</tbody></table></div>
    <button className="btn full" disabled={!pagos.length} onClick={descargar}>Descargar cierre (CSV para Excel)</button></div>;
}

/* ---------- raíz ---------- */
export default function App() {
  const [estado, setEstado] = useState(null);
  const [sesion, setSesion] = useState(() => { try { return JSON.parse(sessionStorage.getItem('sesion')); } catch (e) { return null; } });
  const [msg, setMsg] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => { cargar().then(setEstado); }, []);
  const [modo, setModo] = useState(modoActual());
  useEffect(() => alCambiarModo((x) => setModo(x.modo)), []);
  useEffect(() => escuchar((nuevo) => { if (nuevo) setEstado(nuevo); else cargar().then(setEstado); }), []);
  const ref = useRef(null);
  const cola = useRef(Promise.resolve());
  useEffect(() => { ref.current = estado; }, [estado]);
  // Cada cambio parte del estado más reciente (nube si hay conexión) y se aplica en orden
  const mutate = useCallback((fn) => {
    cola.current = cola.current.then(async () => {
      const base = (await ultimoEstado()) || ref.current;
      const e = JSON.parse(JSON.stringify(base));
      fn(e);
      ref.current = e; setEstado(e);
      await guardar(e);
    });
  }, []);
  const aviso = (t) => { setMsg(t); setTimeout(() => setMsg(''), 4500); };
  const login = (s) => { try { sessionStorage.setItem('sesion', JSON.stringify(s)); } catch (e) { /* ok */ } setSesion(s); };
  const salir = () => { try { sessionStorage.removeItem('sesion'); } catch (e) { /* ok */ } setSesion(null); };
  if (!estado) return <div className="cargando">Cargando…</div>;
  return (<>
    {!sesion ? <Login estado={estado} onLogin={login} />
      : sesion.rol === 'admin' ? <Admin estado={estado} mutate={mutate} salir={salir} aviso={aviso} onReset={() => setConfirmar(true)} />
      : <Socio estado={estado} sesion={sesion} mutate={mutate} salir={salir} />}
    <div className={'modo ' + modo} title={modo === 'nube' ? 'Datos en la nube (Supabase): se comparten entre dispositivos' : 'Datos solo en este dispositivo'}>{modo === 'nube' ? '● En línea · datos compartidos' : '● Modo local · este dispositivo'}</div>
    {msg && <div className="toast" role="status">{msg}</div>}
    {confirmar && <Modal titulo="Reiniciar datos de demo"><p>Se borran los cambios hechos y vuelven los datos de ejemplo.</p>
      <button className="btn full" onClick={async () => { setEstado(await reiniciar()); setConfirmar(false); aviso('Datos de demo reiniciados.'); }}>Sí, reiniciar</button>
      <button className="btn ghost full" onClick={() => setConfirmar(false)}>Cancelar</button></Modal>}
  </>);
}
