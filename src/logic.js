import { PRECIOS, VENCIMIENTO_DIA } from './config';

export const hoyInfo = () => {
  const n = new Date();
  return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
};
const p2 = (n) => String(n).padStart(2, '0');
export const iso = (y, m, d) => `${y}-${p2(m)}-${p2(d)}`;
export const hoyISO = () => { const h = hoyInfo(); return iso(h.y, h.m, h.d); };
export const fechaAR = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
export const dinero = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR');
export const precio = (act) => PRECIOS[act] || 0;

export const pagoDe = (e, socioId, mes) => e.pagos.find((p) => p.socioId === socioId && p.anio === e.anio && p.mes === mes);

// 'pagado' | 'adeudado' | 'futuro' | 'noaplica'
export function estadoMes(e, s, mes) {
  const h = hoyInfo();
  if (mes < s.alta) return 'noaplica';
  if (pagoDe(e, s.id, mes)) return 'pagado';
  return mes <= h.m ? 'adeudado' : 'futuro';
}
export function adeudados(e, s) {
  const out = [];
  for (let m = 1; m <= 12; m++) if (estadoMes(e, s, m) === 'adeudado') out.push(m);
  return out;
}
export const alDia = (e, s) => adeudados(e, s).length === 0;
export const deuda = (e, s) => adeudados(e, s).length * precio(s.actividad);

// próximo vencimiento: primer mes sin pagar (desde el alta) o, si está al día, el mes siguiente
export function proxVenc(e, s) {
  const h = hoyInfo();
  for (let m = Math.max(1, s.alta); m <= 12; m++) {
    if (!pagoDe(e, s.id, m)) {
      const fecha = iso(e.anio, m, VENCIMIENTO_DIA);
      return { mes: m, monto: precio(s.actividad), fecha, vencida: fecha < iso(h.y, h.m, h.d) };
    }
  }
  return null;
}

export function pagosDelMes(e, ym) {
  return e.pagos.filter((p) => p.fecha.startsWith(ym));
}

export function csvCierre(e, ym) {
  const rows = pagosDelMes(e, ym).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const L = [['Fecha', 'N° socio', 'Apellido', 'Nombre', 'Actividad', 'Mes abonado', 'Medio de pago', 'Monto'].map(q).join(';')];
  const tot = {};
  rows.forEach((p) => {
    const s = e.socios.find((x) => x.id === p.socioId);
    tot[p.medio] = (tot[p.medio] || 0) + p.monto;
    L.push([fechaAR(p.fecha), s?.num, s?.apellido, s?.nombre, s?.actividad, p.mes + '/' + p.anio, p.medio, p.monto].map(q).join(';'));
  });
  L.push('');
  L.push(['SUBTOTALES POR MEDIO DE PAGO'].map(q).join(';'));
  Object.keys(tot).forEach((k) => L.push([k, '', '', '', '', '', '', tot[k]].map(q).join(';')));
  L.push(['TOTAL DEL MES', '', '', '', '', '', '', Object.values(tot).reduce((a, b) => a + b, 0)].map(q).join(';'));
  return '﻿' + L.join('\r\n');
}

export function parseCSV(text, actividades, categorias) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = [], errores = [];
  lines.forEach((l, i) => {
    const c = l.split(/[;,]/).map((x) => x.replace(/^"|"$/g, '').trim());
    if (i === 0 && /nombre/i.test(c[0])) return;
    const [nombre, apellido, actividad, categoria] = c;
    const act = actividades.find((a) => a.toLowerCase() === (actividad || '').toLowerCase());
    const cat = categorias.find((a) => a.toLowerCase() === (categoria || '').toLowerCase());
    if (nombre && apellido && act && cat) out.push({ nombre, apellido, actividad: act, categoria: cat });
    else errores.push(i + 1);
  });
  return { out, errores };
}
