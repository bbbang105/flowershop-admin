'use client';

import * as React from 'react';
import { Input } from './input';
import { formatAmountInput, parseAmountInput, filterNumericInput } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  name: string;
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
}

export function AmountInput({
  name,
  value,
  onChange,
  className,
  placeholder = '0',
  ...props
}: AmountInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() => 
    value ? formatAmountInput(value) : ''
  );

  React.useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(value ? formatAmountInput(value) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericOnly = filterNumericInput(rawValue);
    const numericValue = numericOnly ? parseInt(numericOnly, 10) : 0;
    
    setDisplayValue(numericValue ? formatAmountInput(numericValue) : '');
    onChange?.(numericValue);
  };

  return (
    <>
      <Input
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn(className)}
        {...props}
      />
      <input type="hidden" name={name} value={parseAmountInput(displayValue)} />
    </>
  );
}
