import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  formatAmountInput,
  parseAmountInput,
  filterNumericInput,
  filterSalesByYearMonth,
  filterSalesByCategory,
  calculateSalesSummary,
} from '../utils'
import type { Sale, ProductCategory, PaymentMethod } from '@/types/database'
import { PRODUCT_CATEGORIES, PAYMENT_METHODS } from '@/types/database'

// Helper to generate arbitrary Sale objects
const arbitrarySale = (): fc.Arbitrary<Sale> => {
  const paymentMethods: PaymentMethod[] = ['card', 'naverpay', 'transfer', 'cash']
  const categories: ProductCategory[] = PRODUCT_CATEGORIES.map(c => c.value as ProductCategory)
  
  // Generate date as YYYY-MM-DD string directly
  const arbitraryDateString = fc.tuple(
    fc.integer({ min: 2024, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  ).map(([year, month, day]) => 
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  )
  
  return fc.record({
    id: fc.uuid(),
    date: arbitraryDateString,
    product_name: fc.string({ minLength: 1, maxLength: 50 }),
    product_category: fc.constantFrom(...categories),
    amount: fc.integer({ min: 1, max: 10000000 }),
    payment_method: fc.constantFrom(...paymentMethods),
    deposit_status: fc.constantFrom('pending', 'completed', 'not_applicable') as fc.Arbitrary<'pending' | 'completed' | 'not_applicable'>,
    reservation_channel: fc.constantFrom('phone', 'kakaotalk', 'naver_booking', 'road', 'other') as fc.Arbitrary<'phone' | 'kakaotalk' | 'naver_booking' | 'road' | 'other'>,
    has_review: fc.boolean(),
    created_at: fc.constant(new Date().toISOString()),
    updated_at: fc.constant(new Date().toISOString()),
  })
}

describe('Amount Formatting', () => {
  // **Feature: sales-page-improvements, Property 1: Amount formatting round-trip**
  it('Property 1: formatting then parsing should return the original number', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999999999 }),
        (amount) => {
          const formatted = formatAmountInput(amount)
          const parsed = parseAmountInput(formatted)
          return parsed === amount
        }
      ),
      { numRuns: 100 }
    )
  })

  // **Feature: sales-page-improvements, Property 2: Non-numeric character filtering**
  it('Property 2: filterNumericInput should only retain numeric characters', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const filtered = filterNumericInput(input)
          return /^[0-9]*$/.test(filtered)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 2 (extended): filtering should preserve all numeric characters in order', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (input) => {
          const filtered = filterNumericInput(input)
          const expectedDigits = input.replace(/[^0-9]/g, '')
          return filtered === expectedDigits
        }
      ),
      { numRuns: 100 }
    )
  })
})


describe('Sales Summary Calculation', () => {
  // **Feature: sales-page-improvements, Property 4: Summary calculation correctness**
  it('Property 4: summary totals should equal sum of amounts by payment method', () => {
    fc.assert(
      fc.property(
        fc.array(arbitrarySale(), { minLength: 0, maxLength: 50 }),
        (sales) => {
          const summary = calculateSalesSummary(sales)
          
          // Calculate expected values manually
          const expectedTotal = sales.reduce((sum, s) => sum + s.amount, 0)
          const expectedCard = sales.filter(s => s.payment_method === 'card').reduce((sum, s) => sum + s.amount, 0)
          const expectedNaverpay = sales.filter(s => s.payment_method === 'naverpay').reduce((sum, s) => sum + s.amount, 0)
          const expectedTransfer = sales.filter(s => s.payment_method === 'transfer').reduce((sum, s) => sum + s.amount, 0)
          const expectedCash = sales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + s.amount, 0)
          
          return (
            summary.total === expectedTotal &&
            summary.card === expectedCard &&
            summary.naverpay === expectedNaverpay &&
            summary.transfer === expectedTransfer &&
            summary.cash === expectedCash &&
            summary.count === sales.length
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 4 (invariant): sum of payment methods should equal total', () => {
    fc.assert(
      fc.property(
        fc.array(arbitrarySale(), { minLength: 0, maxLength: 50 }),
        (sales) => {
          const summary = calculateSalesSummary(sales)
          const sumOfMethods = summary.card + summary.naverpay + summary.transfer + summary.cash
          return sumOfMethods === summary.total
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Year/Month Filtering', () => {
  // **Feature: sales-page-improvements, Property 5: Year/Month filtering correctness**
  it('Property 5: filtered sales should only contain records from selected year and month', () => {
    fc.assert(
      fc.property(
        fc.array(arbitrarySale(), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (sales, year, month) => {
          const filtered = filterSalesByYearMonth(sales, year, month)
          
          return filtered.every(sale => {
            const saleDate = new Date(sale.date)
            return saleDate.getFullYear() === year && saleDate.getMonth() + 1 === month
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5 (completeness): all matching sales should be included', () => {
    fc.assert(
      fc.property(
        fc.array(arbitrarySale(), { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 2024, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (sales, year, month) => {
          const filtered = filterSalesByYearMonth(sales, year, month)
          
          const expectedCount = sales.filter(sale => {
            const saleDate = new Date(sale.date)
            return saleDate.getFullYear() === year && saleDate.getMonth() + 1 === month
          }).length
          
          return filtered.length === expectedCount
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Category Filtering', () => {
  // **Feature: sales-page-improvements, Property 6: Category filtering correctness**
  it('Property 6: filtered sales should only contain records with selected category', () => {
    const categories: ProductCategory[] = PRODUCT_CATEGORIES.map(c => c.value as ProductCategory)
    
    fc.assert(
      fc.property(
        fc.array(arbitrarySale(), { minLength: 0, maxLength: 50 }),
        fc.constantFrom(...categories),
        (sales, category) => {
          const filtered = filterSalesByCategory(sales, category)
          return filtered.every(sale => sale.product_category === category)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6 (all filter): selecting "all" should return all sales', () => {
    fc.assert(
      fc.property(
        fc.array(arbitrarySale(), { minLength: 0, maxLength: 50 }),
        (sales) => {
          const filtered = filterSalesByCategory(sales, 'all')
          return filtered.length === sales.length
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 6 (completeness): all matching sales should be included', () => {
    const categories: ProductCategory[] = PRODUCT_CATEGORIES.map(c => c.value as ProductCategory)
    
    fc.assert(
      fc.property(
        fc.array(arbitrarySale(), { minLength: 0, maxLength: 50 }),
        fc.constantFrom(...categories),
        (sales, category) => {
          const filtered = filterSalesByCategory(sales, category)
          const expectedCount = sales.filter(s => s.product_category === category).length
          return filtered.length === expectedCount
        }
      ),
      { numRuns: 100 }
    )
  })
})
