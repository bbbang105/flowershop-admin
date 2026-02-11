import { getCustomers } from '@/lib/actions/customers';
import { getSaleCategories } from '@/lib/actions/sale-settings';
import { CustomersClient } from './customers-client';

export default async function CustomersPage() {
  const [customers, categories] = await Promise.all([
    getCustomers(),
    getSaleCategories(),
  ]);

  return (
    <CustomersClient
      initialCustomers={customers}
      initialCategories={categories}
    />
  );
}
