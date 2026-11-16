// Configuración editable del club (datos de ejemplo para la demo)
export const CLUB = 'Bristol F.C.';
// Número de prueba: reemplazar por el WhatsApp real de administración (formato internacional sin + ni espacios)
export const WHATSAPP = '5491100000000';
export const WHATSAPP_VISIBLE = '+54 9 11 0000-0000';
export const ALIAS = 'bristol.fc.cuotas';
export const CVU = '0000003100012345678901';
export const TITULAR = 'Bristol F.C. (datos de ejemplo)';
export const VENCIMIENTO_DIA = 10;

export const ACTIVIDADES = ['Baby Fútbol', 'Fútbol', 'Taekwondo', 'Patín'];
export const CATEGORIAS = ['Infantil', 'Juvenil', 'Adulto'];
export const MEDIOS = ['Efectivo', 'Transferencia', 'Mercado Pago'];
export const PRECIOS = { 'Baby Fútbol': 18000, 'Fútbol': 20000, 'Taekwondo': 22000, 'Patín': 19000 };

export const HORARIOS = [
  { act: 'Baby Fútbol', dias: 'Lunes y miércoles', hora: '17:30 a 18:30' },
  { act: 'Fútbol', dias: 'Martes y jueves', hora: '19:00 a 20:30' },
  { act: 'Taekwondo', dias: 'Lunes, miércoles y viernes', hora: '18:30 a 19:30' },
  { act: 'Patín', dias: 'Sábados', hora: '10:00 a 12:00' },
];
export const SECRETARIA = 'Secretaría: lunes a viernes de 17 a 20 h';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Base de datos en la nube (Supabase). La clave "publishable" está pensada para ir en el navegador.
// Si estos datos están vacíos o Supabase no responde, la app funciona en modo local (datos en el navegador).
export const SUPABASE_URL = (typeof window !== 'undefined' && window.__SB_URL) || 'https://yxeyyetwuwtrotidffyv.supabase.co';
export const SUPABASE_KEY = (typeof window !== 'undefined' && window.__SB_KEY) || 'sb_publishable_XQPfdyomtsz-Q5ccbFdheA_M3NlYuLD';
export const POLL_MS = 3000;
