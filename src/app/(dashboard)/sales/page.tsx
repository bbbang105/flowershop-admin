import { getSales, getSaleById } from '@/lib/actions/sales';
import { getSaleCategories, getPaymentMethods } from '@/lib/actions/sale-settings';
import { getCardCompanySettings } from '@/lib/actions/settings';
import { SalesClient } from './sales-client';

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; saleId?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  
  const currentYear = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const currentMonth = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  
  // Format for getSales: "YYYY-MM"
  const monthParam = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  
  const [sales, categories, payments, cardCompanies] = await Promise.all([
    getSales(monthParam),
    getSaleCategories(),
    getPaymentMethods(),
    getCardCompanySettings(),
  ]);
  
  // saleId가 있으면 해당 매출 정보 가져오기
  const initialSelectedSale = params.saleId ? await getSaleById(params.saleId) : null;
  
  return (
    <SalesClient 
      initialSales={sales} 
      currentYear={currentYear}
      currentMonth={currentMonth}
      initialCategories={categories}
      initialPayments={payments}
      initialCardCompanies={cardCompanies}
      initialSelectedSale={initialSelectedSale}
    />
  );
}
