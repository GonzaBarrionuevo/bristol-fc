import { MEDIOS } from './config';
import { hoyInfo, iso, precio } from './logic';

export async function hash(txt) {
  const s = 'bristol:' + txt;
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  }
}

// [id, nombre, apellido, actividad, categoría, meses de atraso]
const BASE = [
  [1, 'Mateo', 'González', 'Baby Fútbol', 'Infantil', 0],
  [2, 'Valentina', 'Ruiz', 'Taekwondo', 'Juvenil', 0],
  [3, 'Lucas', 'Fernández', 'Fútbol', 'Juvenil', 2],
  [4, 'Sofía', 'Martínez', 'Patín', 'Infantil', 0],
  [5, 'Tomás', 'Benítez', 'Fútbol', 'Adulto', 3],
  [6, 'Camila', 'Rojas', 'Taekwondo', 'Infantil', 1],
  [7, 'Joaquín', 'Pereyra', 'Baby Fútbol', 'Infantil', 2],
];

export async function buildSeed() {
  const h = hoyInfo();
  const socios = [], pagos = [];
  let pid = 1;
  BASE.forEach(([id, nombre, apellido, actividad, categoria, atraso], i) => {
    socios.push({ id, num: 1000 + id, nombre, apellido, actividad, categoria, alta: 1 });
    const hasta = h.m - Math.min(atraso, h.m); // último mes pagado
    for (let m = 1; m <= hasta; m++) {
      const dia = m < h.m ? 3 + (i % 5) : Math.min(h.d, 1 + (i % 3));
      pagos.push({ id: pid++, socioId: id, anio: h.y, mes: m, monto: precio(actividad), medio: MEDIOS[(id + m) % 3], fecha: iso(h.y, m, dia) });
    }
  });
  const asistencia = [];
  socios.forEach((s) => {
    for (let k = 1; k <= 6; k++) {
      const f = new Date(h.y, h.m - 1, h.d - k * 3);
      asistencia.push({ socioId: s.id, fecha: iso(f.getFullYear(), f.getMonth() + 1, f.getDate()), actividad: s.actividad, presente: (s.id * 7 + k) % 5 !== 0 });
    }
  });
  return {
    version: 2,
    anio: h.y,
    socios, pagos, asistencia,
    avisos: [
      { id: 1, titulo: 'Inscripciones abiertas', texto: 'Podés pasar por secretaría a anotar a un nuevo integrante de la familia.', fecha: iso(h.y, h.m, Math.max(1, h.d - 4)) },
      { id: 2, titulo: 'Cuota del mes', texto: 'Recordá que el vencimiento es el día 10. Podés pagar en efectivo o por transferencia/Mercado Pago.', fecha: iso(h.y, h.m, 1) },
    ],
    tos: {},
    usuarios: [
      { user: 'soc01', hash: await hash('soc01'), rol: 'socio', socioId: 1 },
      { user: 'admin01', hash: await hash('admin01'), rol: 'admin' },
    ],
  };
}
