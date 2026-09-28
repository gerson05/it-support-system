export const state = {
  currentPage: 'dashboard',
  currentUser: null,
};

export function can(permission) {
  const user = state.currentUser;
  if (!user) return false;
  return user.permissions.includes('full') || user.permissions.includes(permission);
}

export function firstAccessibleHash() {
  if (can('full'))               return '#inicio';
  if (can('metrics:read'))       return '#inicio';
  if (can('tickets:read'))       return '#inicio';
  if (can('tech-requests:read')) return '#inicio';
  if (can('faqs:read'))          return '#inicio';
  if (can('sedes:read'))         return '#inicio';
  if (can('reuniones:read'))     return '#inicio';
  if (can('despacho:read'))      return '#inicio';
  if (can('audit:read'))         return '#inicio';
  if (can('inventario:read'))    return '#inicio';
  if (can('employees:read'))     return '#inicio';
  if (can('settings:read'))      return '#inicio';
  return '#inicio';
}
