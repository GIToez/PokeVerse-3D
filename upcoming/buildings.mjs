const FAMILIAS = /^41[12]\d{4}$/;
export const PREDIOS_GRANDES = Object.freeze({
  2100001: 'Pokémon Tower',
  2100009: 'Companhia Silph',
  2100013: 'Pokémon Mansion',
  2100010: 'Edifício de Celadon',
  2100005: 'Esconderijo da Equipe Rocket',
  2100002: 'Usina Elétrica Abandonada',
  2540002: 'Team Rocket Warehouse',
});
const AVULSOS = new Set(['2540001', 'habitat', ...Object.keys(PREDIOS_GRANDES)]);
export function ehPredio(a) {
  const c = String(a ?? '').split('#')[0];
  return FAMILIAS.test(c) || AVULSOS.has(c);
}
