import { getCustomers } from '@/lib/actions/customers';
import { getSaleCategories, getPaymentMethods } from '@/lib/actions/sale-settings';
import { CustomersClient } from './customers-client';

export default async function CustomersPage() {
  const [customers, categories, payments] = await Promise.all([
    getCustomers(),
    getSaleCategories(),
    getPaymentMethods()
  ]);
  
  return (
    <CustomersClient 
      initialCustomers={customers} 
      initialCategories={categories}
      initialPayments={payments}
    />
  );
}
