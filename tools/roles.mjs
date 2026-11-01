/** Account roles. admin/gm can open /admin. staff and mod are chat badges (staff can run raids). */
export const ROLES = {
  admin: { gm: true, cargo: 'staff' },
  gm: { gm: true, cargo: 'staff' },
  staff: { gm: false, cargo: 'staff' },
  mod: { gm: false, cargo: 'mod' },
  player: { gm: false, cargo: null },
};

export function applyRole(conta, role) {
  const spec = ROLES[role];
  if (!spec) throw new Error('role must be admin, staff, mod, or player');
  if (spec.gm) conta.gm = true;
  else delete conta.gm;
  if (spec.cargo) conta.cargo = spec.cargo;
  else delete conta.cargo;
  return { gm: !!conta.gm, cargo: conta.cargo || null };
}
