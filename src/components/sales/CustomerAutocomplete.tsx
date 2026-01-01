'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { searchCustomersByName } from '@/lib/actions/customers';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { User, Plus } from 'lucide-react';

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  grade: string;
}

interface CustomerAutocompleteProps {
  value: string;
  onChange: (name: string, customerId: string | null, phone: string | null) => void;
  placeholder?: string;
  className?: string;
}

const gradeLabels: Record<string, { label: string; icon: string }> = {
  new: { label: '신규', icon: '' },
  regular: { label: '단골', icon: '🌟' },
  vip: { label: 'VIP', icon: '👑' },
  blacklist: { label: '블랙', icon: '⚠️' },
};

export function CustomerAutocomplete({ 
  value, 
  onChange, 
  placeholder = '고객명 입력',
  className 
}: CustomerAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 검색 디바운스
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    if (!inputValue || inputValue.length < 1) {
      setOptions([]);
      setIsOpen(false);
      return;
    }

    // 이미 선택된 상태면 검색 안함
    if (selectedId) return;

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await searchCustomersByName(inputValue);
        setOptions(results);
        setIsOpen(results.length > 0 || inputValue.length > 0);
      } catch (error) {
        console.error('Customer search failed:', error);
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, selectedId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedId(null);
    onChange(newValue, null, null);
  };

  const handleSelect = (customer: CustomerOption) => {
    setInputValue(customer.name);
    setSelectedId(customer.id);
    setIsOpen(false);
    onChange(customer.name, customer.id, formatPhoneNumber(customer.phone));
  };

  const handleNewCustomer = () => {
    setIsOpen(false);
    setSelectedId(null);
    onChange(inputValue, null, null);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => inputValue && !selectedId && setIsOpen(true)}
        placeholder={placeholder}
        className={cn('bg-gray-50', className)}
        autoComplete="off"
      />
      
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="customer_name" value={inputValue} />
      <input type="hidden" name="customer_id" value={selectedId || ''} />
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500">검색 중...</div>
          ) : (
            <>
              {options.map((customer) => {
                const grade = gradeLabels[customer.grade] || gradeLabels.new;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 border-b border-gray-100 last:border-0"
                    onClick={() => handleSelect(customer)}
                  >
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        {grade.icon && <span className="text-xs">{grade.icon}</span>}
                      </div>
                      <span className="text-xs text-gray-500">{customer.phone}</span>
                    </div>
                  </button>
                );
              })}
              
              {inputValue && (
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-600"
                  onClick={handleNewCustomer}
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">"{inputValue}" 새 고객으로 등록</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
