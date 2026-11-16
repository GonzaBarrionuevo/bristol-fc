// Persistencia: Supabase (nube, compartida entre dispositivos) con respaldo local (IndexedDB / localStorage).
import { buildSeed } from './seed';
import { hoyInfo } from './logic';
import { SUPABASE_URL, SUPABASE_KEY, POLL_MS } from './config';

const KEY = 'estado-v2', DBN = 'bristol-fc', STORE = 'kv';
let canal = null;
try { canal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bristol-fc') : null; } catch (e) { canal = null; }

/* ---------- local ---------- */
function abrir() {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('sin idb'));
    const r = indexedDB.open(DBN, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function leerLocal() {
  try {
    const db = await abrir();
    return await new Promise((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(KEY);
      q.onsuccess = () => res(q.result || null);
      q.onerror = () => rej(q.error);
    });
  } catch (e) {
    try { return JSON.parse(localStorage.getItem(KEY)); } catch (e2) { return null; }
  }
}
async function guardarLocal(estado) {
  try {
    const db = await abrir();
    await new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(estado, KEY);
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
  } catch (e) {
    try { localStorage.setItem(KEY, JSON.stringify(estado)); } catch (e2) { /* sin almacenamiento */ }
  }
}

/* ---------- remoto (Supabase REST, sin librerías) ---------- */
const hayRemoto = !!(SUPABASE_URL && SUPABASE_KEY);
const H = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
const TABLA = SUPABASE_URL + '/rest/v1/estado';
let modo = 'local';           // 'nube' | 'local'
let ultimaVersion = null;     // updated_at del último estado conocido en la nube
const oyentes = new Set();
const avisarModo = () => oyentes.forEach((f) => f({ modo }));

async function pedir(url, opts = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 6000);
  try {
    const r = await fetch(url, { ...opts, headers: { ...H, ...(opts.headers || {}) }, signal: c.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  } finally { clearTimeout(t); }
}
async function leerNube() {
  const r = await pedir(TABLA + '?id=eq.1&select=data,updated_at');
  const filas = await r.json();
  return filas[0] || null;
}
async function escribirNube(estado) {
  const ahora = new Date().toISOString();
  await pedir(TABLA, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ id: 1, data: estado, updated_at: ahora }) });
  ultimaVersion = ahora;
}

// Último estado de la nube (para aplicar cada cambio sobre lo más reciente y no pisar a otro dispositivo)
export async function ultimoEstado() {
  if (modo !== 'nube') return null;
  try {
    const fila = await leerNube();
    if (fila && fila.data && fila.data.version === 2) return fila.data;
  } catch (e) { /* se usa el estado local */ }
  return null;
}

export const modoActual = () => modo;
export function alCambiarModo(cb) { oyentes.add(cb); return () => oyentes.delete(cb); }

export async function guardar(estado, avisar = true) {
  await guardarLocal(estado);
  if (modo === 'nube') {
    try { await escribirNube(estado); } catch (e) { modo = 'local'; avisarModo(); }
  }
  if (avisar && canal) canal.postMessage('cambio');
}

export async function cargar() {
  let e = null;
  if (hayRemoto) {
    try {
      const fila = await leerNube();
      modo = 'nube';
      if (fila && fila.data && fila.data.version === 2 && fila.data.anio === hoyInfo().y) { e = fila.data; ultimaVersion = fila.updated_at; }
      else { e = await buildSeed(); await escribirNube(e); }
      await guardarLocal(e);
      avisarModo();
      return e;
    } catch (err) { modo = 'local'; avisarModo(); }
  }
  e = await leerLocal();
  if (!e || e.version !== 2 || e.anio !== hoyInfo().y) { e = await buildSeed(); await guardarLocal(e); }
  return e;
}
export async function reiniciar() {
  const e = await buildSeed();
  await guardar(e);
  return e;
}

// Avisa cuando hay cambios: de otra pestaña (BroadcastChannel) o de otro dispositivo (consulta cada POLL_MS a la nube)
export function escuchar(cb) {
  const f = () => cb();
  if (canal) canal.addEventListener('message', f);
  let activo = true;
  const t = hayRemoto ? setInterval(async () => {
    if (!activo || document.hidden) return;
    try {
      const fila = await leerNube();
      if (modo !== 'nube') { modo = 'nube'; avisarModo(); }
      if (fila && fila.updated_at !== ultimaVersion) { ultimaVersion = fila.updated_at; cb(fila.data); }
    } catch (e) { if (modo !== 'local') { modo = 'local'; avisarModo(); } }
  }, POLL_MS) : null;
  return () => { activo = false; if (t) clearInterval(t); if (canal) canal.removeEventListener('message', f); };
}
