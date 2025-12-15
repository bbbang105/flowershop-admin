'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const defaultCardSettings = [
  { id: '1', name: '신한카드', fee_rate: 2.0, deposit_days: 3 },
  { id: '2', name: '국민카드', fee_rate: 2.0, deposit_days: 3 },
  { id: '3', name: '삼성카드', fee_rate: 2.2, deposit_days: 2 },
  { id: '4', name: '현대카드', fee_rate: 2.1, deposit_days: 3 },
  { id: '5', name: '롯데카드', fee_rate: 2.0, deposit_days: 3 },
];

const defaultCategories = ['꽃다발', '꽃바구니', '화병', '화환', '기타'];

export default function SettingsPage() {
  const [cardSettings, setCardSettings] = useState(defaultCardSettings);
  const [categories, setCategories] = useState(defaultCategories);
  const [newCategory, setNewCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCategory = () => {
    if (newCategory.trim() && !categories.includes(newCategory.trim())) {
      setCategories([...categories, newCategory.trim()]);
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: 실제 저장 로직 구현 (Supabase 연동)
      await new Promise(resolve => setTimeout(resolve, 500)); // 시뮬레이션
      toast.success('설정이 저장되었습니다');
    } catch (error) {
      toast.error('설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 mt-1">카드 수수료율과 카테고리를 관리하세요</p>
      </div>
      
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">카드사별 수수료율</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cardSettings.map((card) => (
              <div key={card.id} className="flex items-center gap-4 flex-wrap">
                <span className="w-24 font-medium text-gray-700">{card.name}</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    value={card.fee_rate}
                    onChange={(e) => setCardSettings(cardSettings.map((c) => 
                      c.id === card.id ? { ...c, fee_rate: parseFloat(e.target.value) || 0 } : c
                    ))}
                    className="w-20 bg-white border-gray-200"
                  />
                  <span className="text-gray-500">%</span>
                </div>
                <span className="text-gray-500">입금 주기:</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={card.deposit_days}
                    onChange={(e) => setCardSettings(cardSettings.map((c) => 
                      c.id === card.id ? { ...c, deposit_days: parseInt(e.target.value) || 0 } : c
                    ))}
                    className="w-16 bg-white border-gray-200"
                  />
                  <span className="text-gray-500">영업일</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">상품 카테고리 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-sm py-1.5 px-3 bg-gray-100 text-gray-700 hover:bg-gray-200">
                  {cat}
                  <button onClick={() => handleRemoveCategory(cat)} className="ml-2 hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="새 카테고리 이름"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                className="max-w-xs bg-white border-gray-200"
              />
              <Button onClick={handleAddCategory} size="icon" className="bg-rose-500 hover:bg-rose-600">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="bg-rose-500 hover:bg-rose-600">
          {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isSaving ? '저장 중...' : '설정 저장'}
        </Button>
      </div>
    </div>
  );
}
