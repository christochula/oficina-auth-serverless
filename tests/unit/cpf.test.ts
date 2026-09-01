import { isValidCpf, normalizeCpf } from '../../src/lib/cpf';

describe('CPF validation', () => {
  it.each([
    '529.982.247-25',
    '52998224725',
    '111.444.777-35',
  ])('accepts a valid CPF: %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(true);
  });

  it.each([
    '',
    '123',
    '111.111.111-11',
    '529.982.247-24',
    'abcdefghijk',
  ])('rejects an invalid CPF: %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false);
  });

  it('normalizes punctuation before querying', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
  });
});
