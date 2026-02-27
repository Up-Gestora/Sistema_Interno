export function parseDecimalInput(value: string): number {
  if (!value) return 0;

  let normalized = value.trim();
  if (!normalized) return 0;

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  normalized = normalized.replace(/\s/g, '');

  if (hasComma && hasDot) {
    // Assume dots are thousands separators and comma is decimal.
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  } else if (hasDot) {
    const dotCount = (normalized.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Likely thousands separators.
      normalized = normalized.replace(/\./g, '');
    }
  }

  normalized = normalized.replace(/[^\d.-]/g, '');

  const numero = Number(normalized);
  return Number.isFinite(numero) ? numero : 0;
}

export function formatDecimalInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const normalizado = Number(value.toFixed(6));
  return String(normalizado).replace('.', ',');
}
