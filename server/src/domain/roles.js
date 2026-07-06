// Organisationstypen, Rollen und Zugriffsregeln (RBAC) — eine einzige Quelle
// der Wahrheit, die spaeter serverseitig bei jeder Aktion geprueft wird.

export const ORG_TYPES = Object.freeze({ PHARMACY: 'pharmacy', SUPPLIER: 'supplier' });

// Rollen in einer Apotheke + die externe Firmenrolle Pharmareferent.
export const ROLES = Object.freeze({
  ADMIN: 'admin',
  APOTHEKER: 'apotheker',
  PTA: 'pta',
  LEHRLING: 'lehrling',
  PHARMAREFERENT: 'pharmareferent', // gehoert zu einer 'supplier'-Org
});

export const PHARMACY_ROLES = Object.freeze([
  ROLES.ADMIN, ROLES.APOTHEKER, ROLES.PTA, ROLES.LEHRLING,
]);

// Welche Rolle darf in welchem Org-Typ existieren?
export function roleAllowedForOrgType(role, orgType) {
  if (orgType === ORG_TYPES.PHARMACY) return PHARMACY_ROLES.includes(role);
  if (orgType === ORG_TYPES.SUPPLIER) return role === ROLES.PHARMAREFERENT;
  return false;
}

// Grobe Faehigkeiten pro Rolle (wird pro Modul verfeinert). Bewusst als
// Whitelist — Least Privilege, v.a. fuer Lehrling.
const CAPS = {
  [ROLES.ADMIN]:          ['manage_org', 'manage_users', 'collab', 'assign_tasks', 'market', 'network_post', 'network_dm', 'manage_network'],
  [ROLES.APOTHEKER]:      ['collab', 'assign_tasks', 'market', 'network_post', 'network_dm', 'manage_network'],
  [ROLES.PTA]:            ['collab', 'assign_tasks', 'market'],
  [ROLES.LEHRLING]:       ['collab_assigned', 'market'],
  [ROLES.PHARMAREFERENT]: ['market', 'network_post', 'network_dm', 'manage_network'], // nur als Firma, nie Apotheken-intern
};

export function can(role, capability) {
  return (CAPS[role] || []).includes(capability);
}
