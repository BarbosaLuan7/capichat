import * as React from 'react';
import { Input } from '@/components/ui/input';
import { formatPhone, formatCPF } from '@/lib/masks';

type MaskType = 'phone' | 'cpf';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  mask: MaskType;
  value: string;
  onChange: (value: string) => void;
}

const maskFunctions: Record<MaskType, (value: string) => string> = {
  phone: formatPhone,
  cpf: formatCPF,
};

const maxLengths: Record<MaskType, number> = {
  phone: 15, // (00) 00000-0000
  cpf: 14, // 000.000.000-00
};

export const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, ...props }, ref) => {
    const formatFn = maskFunctions[mask];
    const maxLength = maxLengths[mask];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const formattedValue = formatFn(rawValue);
      onChange(formattedValue);
    };

    return (
      <Input ref={ref} value={value} onChange={handleChange} maxLength={maxLength} {...props} />
    );
  }
);

MaskedInput.displayName = 'MaskedInput';
