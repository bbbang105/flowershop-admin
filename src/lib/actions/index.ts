// Sales
export {
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  uploadSalePhotos,
  deleteSalePhoto,
} from './sales';

// Expenses
export {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from './expenses';

// Customers
export {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  updateCustomerGrade,
  deleteCustomer,
  findOrCreateCustomer,
  getCustomerSales,
} from './customers';

// Dashboard
export {
  getTodaySummary,
  getRecentSales,
  getMonthSummary,
  getDashboardTodayData,
  getDashboardMonthData,
} from './dashboard';
export type { DashboardSummary, DashboardTodayData, DashboardMonthData } from './dashboard';

// Deposits
export {
  getDeposits,
  getPendingDeposits,
  getCompletedDeposits,
  confirmDeposit,
  confirmMultipleDeposits,
  revertDeposit,
  getDepositsSummary,
} from './deposits';
export type { DepositsFilter, DepositsSummary } from './deposits';

// Settings
export {
  getCardCompanySettings,
  updateCardCompanySetting,
  createCardCompanySetting,
  deleteCardCompanySetting,
  getProductCategories,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  saveAllSettings,
} from './settings';
export type { ProductCategory } from './settings';

// Sale Settings
export {
  getSaleCategories,
  createSaleCategory,
  updateSaleCategory,
  deleteSaleCategory,
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from './sale-settings';
export type { SaleCategory, PaymentMethod } from './sale-settings';

// Expense Settings
export {
  getExpenseCategories,
  getExpensePaymentMethods,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from './expense-settings';
export type { ExpenseCategory, ExpensePaymentMethod } from './expense-settings';

// Statistics
export {
  getCategoryStats,
  getPaymentMethodStats,
  getChannelStats,
  getCustomerStats,
  getExpenseCategoryStats,
  getMonthlySalesTrend,
  getDailySalesTrend,
} from './statistics';
export type {
  CategoryStat,
  PaymentMethodStat,
  ChannelStat,
  CustomerStat,
  ExpenseCategoryStat,
  MonthlySalesTrend,
  DailySalesTrend,
} from './statistics';

// Photo Tags
export {
  getPhotoTags,
  createPhotoTag,
  updatePhotoTag,
  deletePhotoTag,
} from './photo-tags';

// Photo Cards
export {
  getPhotoCards,
  getPhotoCardById,
  createPhotoCard,
  updatePhotoCard,
  deletePhotoCard,
  uploadPhotos,
  deletePhoto,
  deletePhotosFromStorage,
  downloadPhoto,
  downloadAllPhotos,
  reorderPhotos,
  getPhotoCardBySaleId,
  createOrUpdatePhotoCardForSale,
} from './photo-cards';
export type { PhotoCardsResponse } from './photo-cards';

// Reservations
export {
  getReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  convertReservationToSale,
} from './reservations';

// Push Notifications
export {
  subscribeToPush,
  unsubscribeFromPush,
  getPushSubscriptionStatus,
  sendPushToUser,
  sendPushToAllUsers,
  sendTestNotification,
} from './push';
export type { PushSubscriptionData } from './push';
