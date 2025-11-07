import { validateFiscalDocument } from '../taxReports';

describe('validateFiscalDocument', () => {
  test('validates Brazilian CPF correctly', () => {
    expect(validateFiscalDocument('CPF', '123.456.789-09', 'BR')).toBe(true); // CPF válido
    expect(validateFiscalDocument('CPF', '111.444.777-35', 'BR')).toBe(true);  // CPF válido
  });

  test('validates Brazilian CNPJ correctly', () => {
    expect(validateFiscalDocument('CNPJ', '12.345.678/0001-95', 'BR')).toBe(true); // CNPJ válido
    expect(validateFiscalDocument('CNPJ', '45.543.520/0001-10', 'BR')).toBe(false);  // CNPJ inválido
  });

  test('validates US SSN correctly', () => {
    expect(validateFiscalDocument('SSN', '123-45-6789', 'US')).toBe(true);  // Valid SSN
    expect(validateFiscalDocument('SSN', '123-45-678', 'US')).toBe(false); // Invalid SSN
  });

  test('validates German Steuer-ID correctly', () => {
    expect(validateFiscalDocument('Steuer-ID', '12345678901', 'DE')).toBe(true);  // Valid Steuer-ID
    expect(validateFiscalDocument('Steuer-ID', '1234567890', 'DE')).toBe(false); // Invalid Steuer-ID
  });

  test('throws error for unsupported country', () => {
    expect(() => validateFiscalDocument('CPF', '123.456.789-09', 'FR')).toThrow('Validação para o país FR não implementada.');
  });
});