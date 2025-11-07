import { validateFiscalDocument } from '../src/lib/taxReports';

describe('validateFiscalDocument', () => {
  test('valid CPF (Brazil)', () => {
    expect(validateFiscalDocument('CPF', '123.456.789-09', 'BR')).toBe(true); // CPF válido
  });

  test('invalid CPF (Brazil)', () => {
    expect(validateFiscalDocument('CPF', '123.456.789-00', 'BR')).toBe(false);
  });

  test('valid CNPJ (Brazil)', () => {
    expect(validateFiscalDocument('CNPJ', '12.345.678/0001-95', 'BR')).toBe(true); // CNPJ válido
  });

  test('invalid CNPJ (Brazil)', () => {
    expect(validateFiscalDocument('CNPJ', '12.345.678/0001-00', 'BR')).toBe(false);
  });

  test('valid SSN (US)', () => {
    expect(validateFiscalDocument('SSN', '123-45-6789', 'US')).toBe(true);
  });

  test('invalid SSN (US)', () => {
    expect(validateFiscalDocument('SSN', '123-45-0000', 'US')).toBe(false);
  });

  test('valid Steuer-ID (Germany)', () => {
    expect(validateFiscalDocument('Steuer-ID', '12345678901', 'DE')).toBe(true);
  });

  test('invalid Steuer-ID (Germany)', () => {
    expect(validateFiscalDocument('Steuer-ID', '1234567890', 'DE')).toBe(false);
  });

  test('unsupported country', () => {
    expect(() => validateFiscalDocument('CPF', '123.456.789-09', 'FR')).toThrow('Validação para o país FR não implementada.');
  });
});