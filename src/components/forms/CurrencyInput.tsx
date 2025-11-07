import React from 'react'
import { Input } from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PatternFormat, OnValueChange } from 'react-number-format'
import {
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form'

interface CurrencyInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName
  label: string
  placeholder?: string
  description?: string
  // Permite passar props do Controller
  field: ControllerRenderProps<TFieldValues, TName>
}

/**
 * Componente de Input de Moeda controlado e integrado ao React Hook Form.
 * Este componente lida automaticamente com a conversão entre
 * centavos (BIGINT, ex: 10050) no estado do formulário e
 * valor formatado (string, ex: R$ 100,50) na UI.
 */
export function CurrencyInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  label,
  placeholder,
  description,
  field,
}: CurrencyInputProps<TFieldValues, TName>) {
  // Converte centavos (ex: 10050) para float (ex: 100.50) para o input
  const displayValue =
    typeof field.value === 'number' ? field.value / 100 : undefined

  // Converte o valor do input (float) para centavos (int) para o form state
  const handleValueChange: OnValueChange = (values) => {
    // Arredonda para o inteiro mais próximo para evitar problemas de float
    const centsValue = Math.round(Number(values.floatValue) * 100)
    field.onChange(centsValue)
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <PatternFormat
          customInput={Input}
          name={name}
          ref={field.ref}
          value={displayValue}
          onValueChange={handleValueChange}
          onBlur={field.onBlur}
          format="R$ #,##0.00"
          mask="_"
          thousandSeparator="."
          decimalSeparator=","
          prefix="R$ "
          placeholder={placeholder || 'R$ 0,00'}
          allowNegative={false}
        />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  )
}