// Sales
export {
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  confirmDeposits,
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
} from './dashboard';
export type { DashboardSummary } from './dashboard';

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
} from './photo-cards';
export type { PhotoCardsResponse } from './photo-cards';
