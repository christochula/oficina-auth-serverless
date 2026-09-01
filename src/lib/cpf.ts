const CPF_LENGTH = 11;

export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

function checkDigit(base: string, initialWeight: number): number {
  const sum = [...base].reduce((total, digit, index) => {
    return total + Number(digit) * (initialWeight - index);
  }, 0);
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

export function isValidCpf(value: string): boolean {
  const normalized = normalizeCpf(value);
  if (normalized.length !== CPF_LENGTH || /^(\d)\1{10}$/.test(normalized)) {
    return false;
  }

  const firstNineDigits = normalized.slice(0, 9);
  const firstDigit = checkDigit(firstNineDigits, 10);
  const secondDigit = checkDigit(`${firstNineDigits}${firstDigit}`, 11);
  return normalized.endsWith(`${firstDigit}${secondDigit}`);
}
