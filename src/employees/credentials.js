/**
 * Usuario y clave para Mantis.
 *
 * Usuario (regla de Gestión Humana, sin tildes ni Ñ):
 *   1. inicial del primer nombre + inicial del primer apellido + segundo apellido
 *        GLADYS GARCIA OSORIO              → GGOSORIO
 *        ALBA LUCIA OSPINA CASTAÑEDA       → AOCASTANEDA
 *   2. si ya existe, el primer apellido pasa a ser el principal:
 *      inicial del primer nombre + inicial del segundo nombre (o del segundo apellido) + primer apellido
 *        LISETH DAYANA HERRERA ROSERO      → LDHERRERA
 *   3. si también existe, se agrega un número al usuario de la regla 1 (GGOSORIO2, GGOSORIO3…).
 *
 * Clave: los últimos 4 dígitos de la cédula (puede repetirse: el usuario siempre es distinto).
 */

export function nameWords(fullName) {
  return String(fullName || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Candidatos de usuario en orden de preferencia (sin sufijo numérico). */
export function usernameCandidates(fullName) {
  const w = nameWords(fullName);
  if (w.length === 0) return [];
  if (w.length === 1) return [w[0]];
  if (w.length === 2) return [w[0][0] + w[1], w[0].slice(0, 2) + w[1]];

  const first    = w[0];
  const surname1 = w[w.length - 2];
  const surname2 = w[w.length - 1];
  const second   = w.length >= 4 ? w[1] : null;

  const base = first[0] + surname1[0] + surname2;
  const alt  = first[0] + (second ? second[0] : surname2[0]) + surname1;
  return base === alt ? [base] : [base, alt];
}

/**
 * Primer usuario libre según la regla.
 * @param {(usuario: string) => Promise<boolean>} isTaken
 */
export async function suggestUsername(fullName, isTaken) {
  const candidates = usernameCandidates(fullName);
  if (!candidates.length) return '';
  for (const c of candidates) if (!(await isTaken(c))) return c;
  for (let n = 2; n < 1000; n++) {
    const c = `${candidates[0]}${n}`;
    if (!(await isTaken(c))) return c;
  }
  throw Object.assign(new Error('No se pudo generar un usuario disponible.'), { code: 'USERNAME_EXHAUSTED' });
}

/** Últimos 4 dígitos de la cédula (con ceros a la izquierda si tiene menos). */
export function claveDesdeCedula(cedula) {
  const d = String(cedula ?? '').replace(/\D/g, '');
  return d.length >= 4 ? d.slice(-4) : d.padStart(4, '0');
}
