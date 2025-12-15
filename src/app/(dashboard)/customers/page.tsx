'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Customer } from '@/types/database';

const gradeLabels: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  new: { label: '신규', icon: '', color: 'text-gray-600', bg: 'bg-gray-100' },
  regular: { label: '단골', icon: '🌟', color: 'text-yellow-600', bg: 'bg-yellow-50' },
  vip: { label: 'VIP', icon: '👑', color: 'text-purple-600', bg: 'bg-purple-50' },
  blacklist: { label: '블랙', icon: '⚠️', color: 'text-red-600', bg: 'bg-red-50' },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchCustomers() {
      setIsLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('customers')
        .select('*')
        .order('total_purchase_amount', { ascending: false });
      setCustomers(data || []);
      setIsLoading(false);
    }
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c => gradeFilter === 'all' || c.grade === gradeFilter)
      .filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.phone.includes(q);
      });
  }, [customers, gradeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = customers.length;
    const regular = customers.filter(c => c.grade === 'regular' || c.grade === 'vip').length;
    return { total, regular };
  }, [customers]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">고객 관리</h1>
        <p className="text-gray-500 mt-1">고객 정보와 구매 이력을 관리하세요</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">전체 고객</p>
                <p className="text-xl font-bold text-gray-900">{stats.total}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center">
                <span className="text-lg">🌟</span>
              </div>
              <div>
                <p className="text-sm text-gray-500">단골/VIP</p>
                <p className="text-xl font-bold text-gray-900">{stats.regular}명</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[120px] bg-white border-gray-200"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="new">신규</SelectItem>
            <SelectItem value="regular">단골</SelectItem>
            <SelectItem value="vip">VIP</SelectItem>
            <SelectItem value="blacklist">블랙리스트</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="이름/연락처 검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-white border-gray-200" />
        </div>
      </div>
      
      {/* Desktop Table */}
      <Card className="border-0 shadow-sm overflow-hidden hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/80">
                <TableHead className="font-semibold text-gray-700">고객명</TableHead>
                <TableHead className="font-semibold text-gray-700 hidden lg:table-cell">연락처</TableHead>
                <TableHead className="font-semibold text-gray-700 w-[100px]">등급</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right w-[80px]">구매횟수</TableHead>
                <TableHead className="font-semibold text-gray-700 text-right">총구매액</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-gray-500">로딩 중...</TableCell></TableRow>
              ) : filteredCustomers.length > 0 ? filteredCustomers.map((c) => {
                const grade = gradeLabels[c.grade];
                return (
                  <TableRow key={c.id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => window.location.href = `/customers/${c.id}`}>
                    <TableCell>
                      <span className="font-medium text-gray-900">{c.name}</span>
                    </TableCell>
                    <TableCell className="text-gray-500 hidden lg:table-cell">{c.phone}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded-md ${grade.bg} ${grade.color}`}>
                        {grade.icon} {grade.label}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-gray-600">{c.total_purchase_count}회</TableCell>
                    <TableCell className="text-right font-semibold text-gray-900">{formatCurrency(c.total_purchase_amount)}</TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-16 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <Users className="w-6 h-6 text-gray-400" />
                      </div>
                      <p>등록된 고객이 없습니다</p>
                      <p className="text-sm">매출 등록 시 고객이 자동으로 추가됩니다</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <Card className="border-0 shadow-sm p-8 text-center text-gray-500">로딩 중...</Card>
        ) : filteredCustomers.length > 0 ? filteredCustomers.map((c) => {
          const grade = gradeLabels[c.grade];
          return (
            <Link key={c.id} href={`/customers/${c.id}`}>
              <Card className="border-0 shadow-sm p-4 hover:shadow-md active:bg-gray-50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{c.name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${grade.bg} ${grade.color}`}>
                        {grade.icon} {grade.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{c.phone}</span>
                      <span>구매 {c.total_purchase_count}회</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="font-bold text-gray-900">{formatCurrency(c.total_purchase_amount)}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        }) : (
          <Card className="border-0 shadow-sm p-8 text-center text-gray-500">
            <div className="flex flex-col items-center gap-2">
              <Users className="w-8 h-8 text-gray-400" />
              <p>등록된 고객이 없습니다</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
