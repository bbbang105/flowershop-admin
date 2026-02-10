import { getExpenses, getExpenseById } from '@/lib/actions/expenses';
import { getExpenseCategories, getExpensePaymentMethods } from '@/lib/actions/expense-settings';
import { ExpensesClient } from './expenses-client';

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; expenseId?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  
  const currentYear = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const currentMonth = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;
  
  const monthParam = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  
  const [expenses, categories, payments] = await Promise.all([
    getExpenses(monthParam),
    getExpenseCategories(),
    getExpensePaymentMethods(),
  ]);
  
  const initialSelectedExpense = params.expenseId ? await getExpenseById(params.expenseId) : null;
  
  return (
    <ExpensesClient 
      initialExpenses={expenses} 
      currentYear={currentYear}
      currentMonth={currentMonth}
      initialCategories={categories}
      initialPayments={payments}
      initialSelectedExpense={initialSelectedExpense}
    />
  );
}
