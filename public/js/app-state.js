export const state = {
  currentAgent: { id: 1, name: 'Agente 1' },
  agents: [],
  currentPage: 'dashboard',
  currentUser: null,
};

export function can(permission) {
  const user = state.currentUser;
  if (!user) return false;
  return user.permissions.includes('full') || user.permissions.includes(permission);
}

export function firstAccessibleHash() {
  if (can('metrics:read'))       return '#dashboard';
  if (can('tickets:read'))       return '#tickets';
  if (can('tech-requests:read')) return '#tech-requests';
  if (can('faqs:read'))          return '#faqs';
  if (can('sedes:read'))         return '#sedes';
  if (can('reuniones:read'))     return '#reuniones';
  if (can('despacho:read'))      return '#despacho';
  if (can('audit:read'))         return '#audit';
  if (can('inventario:read'))    return '#inventario';
  if (can('employees:read'))     return '#employees';
  return '#settings';
}
