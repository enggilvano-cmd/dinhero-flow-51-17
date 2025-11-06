import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Converte uma string de moeda (ex: "1.234,56") para centavos de forma segura, evitando erros de ponto flutuante.
 * @returns {number} O valor em centavos como um inteiro, ou NaN se a entrada for inválida.
 */
export function currencyStringToCents(value: string | number): number {
  if (typeof value === 'number') {
    // Converte para uma string com precisão fixa para evitar problemas de ponto flutuante.
    value = value.toFixed(2);
  }
  if (typeof value !== 'string' || value.trim() === '') return NaN;

  const sanitized = value.replace(/[^0-9,-]/g, '').replace(',', '.');
  const parts = sanitized.split('.');
  const integerPart = parts[0];
  const decimalPart = (parts[1] || '0').padEnd(2, '0').slice(0, 2);
  return parseInt(`${integerPart}${decimalPart}`, 10);
}
