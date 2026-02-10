import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  saleSchema,
  customerSchema,
  expenseSchema,
  reservationSchema,
  uuidSchema,
  dateSchema,
  phoneSchema,
  colorSchema,
  idsSchema,
  searchQuerySchema,
  monthSchema,
  photoTagSchema,
  cardCompanySettingSchema,
} from '../validations'

// =============================================
// Zod 검증 스키마 테스트 (보안 입력 검증)
// =============================================

describe('UUID Schema', () => {
  it('유효한 UUID는 통과한다', () => {
    fc.assert(
      fc.property(fc.uuid(), (uuid) => {
        return uuidSchema.safeParse(uuid).success
      }),
      { numRuns: 100 }
    )
  })

  it('잘못된 UUID는 거부한다', () => {
    const invalidUuids = ['', 'not-a-uuid', '12345', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz']
    invalidUuids.forEach((id) => {
      expect(uuidSchema.safeParse(id).success).toBe(false)
    })
  })

  it('SQL 인젝션 페이로드를 거부한다', () => {
    const injections = [
      "'; DROP TABLE customers; --",
      "1' OR '1'='1",
      "admin'--",
      '"><script>alert(1)</script>',
    ]
    injections.forEach((payload) => {
      expect(uuidSchema.safeParse(payload).success).toBe(false)
    })
  })
})

describe('Date Schema', () => {
  it('YYYY-MM-DD 형식만 통과한다', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          return dateSchema.safeParse(dateStr).success
        }
      ),
      { numRuns: 100 }
    )
  })

  it('잘못된 날짜 형식은 거부한다', () => {
    // 2024-13-01은 regex 패턴상 유효 (실제 날짜 검증은 DB 레벨)
    const invalidDates = ['2024/01/01', '01-01-2024', '2024-1-1', '', 'not-a-date']
    invalidDates.forEach((d) => {
      expect(dateSchema.safeParse(d).success).toBe(false)
    })
  })
})

describe('Phone Schema', () => {
  it('유효한 한국 전화번호를 통과한다', () => {
    const validPhones = ['010-1234-5678', '01012345678', '011-123-4567', '016-1234-5678']
    validPhones.forEach((phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(true)
    })
  })

  it('잘못된 전화번호를 거부한다', () => {
    const invalidPhones = ['', '123', '02-1234-5678', 'abcdefghijk', '010-1234-567890']
    invalidPhones.forEach((phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(false)
    })
  })
})

describe('Color Schema', () => {
  it('유효한 hex 색상 코드를 통과한다', () => {
    // fast-check v4에서는 array + map으로 hex 문자열 생성
    const hexChar = fc.constantFrom(
      '0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f'
    )
    fc.assert(
      fc.property(
        fc.tuple(hexChar, hexChar, hexChar, hexChar, hexChar, hexChar)
          .map(chars => chars.join('')),
        (hex) => {
          return colorSchema.safeParse(`#${hex}`).success
        }
      ),
      { numRuns: 50 }
    )
  })

  it('잘못된 색상 코드를 거부한다', () => {
    const invalidColors = ['', '#fff', 'red', '#gggggg', '123456', '#12345']
    invalidColors.forEach((color) => {
      expect(colorSchema.safeParse(color).success).toBe(false)
    })
  })
})

describe('Month Schema', () => {
  it('YYYY-MM 형식만 통과한다', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2030 }),
        fc.integer({ min: 1, max: 12 }),
        (year, month) => {
          const monthStr = `${year}-${String(month).padStart(2, '0')}`
          return monthSchema.safeParse(monthStr).success
        }
      ),
      { numRuns: 50 }
    )
  })

  it('잘못된 월 형식을 거부한다', () => {
    const invalid = ['2024', '2024-1', '2024-001', '2024/01', '']
    invalid.forEach((m) => {
      expect(monthSchema.safeParse(m).success).toBe(false)
    })
  })
})

describe('Sale Schema (매출)', () => {
  const validSale = {
    date: '2024-01-15',
    product_category: '미니 꽃다발',
    amount: 50000,
    payment_method: 'card' as const,
    card_company: '신한카드',
    note: '테스트',
  }

  it('유효한 매출 데이터를 통과한다', () => {
    expect(saleSchema.safeParse(validSale).success).toBe(true)
  })

  it('결제방식 enum 외 값을 거부한다', () => {
    expect(
      saleSchema.safeParse({ ...validSale, payment_method: 'bitcoin' }).success
    ).toBe(false)
  })

  it('음수 금액을 거부한다', () => {
    expect(
      saleSchema.safeParse({ ...validSale, amount: -1000 }).success
    ).toBe(false)
  })

  it('1억 초과 금액을 거부한다', () => {
    expect(
      saleSchema.safeParse({ ...validSale, amount: 100_000_001 }).success
    ).toBe(false)
  })

  it('빈 상품 카테고리를 거부한다', () => {
    expect(
      saleSchema.safeParse({ ...validSale, product_category: '' }).success
    ).toBe(false)
  })

  it('임의의 유효한 매출 데이터를 통과한다 (PBT)', () => {
    const arbitraryDate = fc.tuple(
      fc.integer({ min: 2024, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    ).map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)

    fc.assert(
      fc.property(
        arbitraryDate,
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.constantFrom('cash', 'card', 'transfer', 'naverpay', 'kakaopay'),
        (date, category, amount, method) => {
          return saleSchema.safeParse({
            date,
            product_category: category,
            amount,
            payment_method: method,
          }).success
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Customer Schema (고객)', () => {
  it('유효한 고객 데이터를 통과한다', () => {
    expect(
      customerSchema.safeParse({
        name: '홍길동',
        phone: '010-1234-5678',
        grade: 'regular',
      }).success
    ).toBe(true)
  })

  it('빈 이름을 거부한다', () => {
    expect(
      customerSchema.safeParse({ name: '', phone: '010-1234-5678' }).success
    ).toBe(false)
  })

  it('100자 초과 이름을 거부한다', () => {
    expect(
      customerSchema.safeParse({
        name: 'a'.repeat(101),
        phone: '010-1234-5678',
      }).success
    ).toBe(false)
  })

  it('잘못된 등급을 거부한다', () => {
    expect(
      customerSchema.safeParse({
        name: '홍길동',
        phone: '010-1234-5678',
        grade: 'platinum',
      }).success
    ).toBe(false)
  })

  it('XSS 페이로드가 포함된 노트는 길이 제한 내에서 통과 (서버에서 이스케이프)', () => {
    const xssNote = '<script>alert("xss")</script>'
    const result = customerSchema.safeParse({
      name: '홍길동',
      phone: '010-1234-5678',
      note: xssNote,
    })
    // 문자열 자체는 통과하지만 렌더링 시 React가 이스케이프 처리
    expect(result.success).toBe(true)
  })

  it('1000자 초과 노트를 거부한다', () => {
    expect(
      customerSchema.safeParse({
        name: '홍길동',
        phone: '010-1234-5678',
        note: 'a'.repeat(1001),
      }).success
    ).toBe(false)
  })
})

describe('Expense Schema (지출)', () => {
  const validExpense = {
    date: '2024-01-15',
    item_name: '장미 100송이',
    category: 'flower_purchase',
    unit_price: 50000,
    quantity: 2,
    payment_method: 'card' as const,
  }

  it('유효한 지출 데이터를 통과한다', () => {
    expect(expenseSchema.safeParse(validExpense).success).toBe(true)
  })

  it('수량 0을 거부한다', () => {
    expect(
      expenseSchema.safeParse({ ...validExpense, quantity: 0 }).success
    ).toBe(false)
  })

  it('빈 품명을 거부한다', () => {
    expect(
      expenseSchema.safeParse({ ...validExpense, item_name: '' }).success
    ).toBe(false)
  })

  it('음수 단가를 거부한다', () => {
    expect(
      expenseSchema.safeParse({ ...validExpense, unit_price: -100 }).success
    ).toBe(false)
  })
})

describe('Reservation Schema (예약)', () => {
  const validReservation = {
    date: '2024-01-15',
    customer_name: '홍길동',
    title: '프로포즈 꽃다발',
    estimated_amount: 100000,
    status: 'pending' as const,
  }

  it('유효한 예약 데이터를 통과한다', () => {
    expect(reservationSchema.safeParse(validReservation).success).toBe(true)
  })

  it('빈 고객명을 거부한다', () => {
    expect(
      reservationSchema.safeParse({ ...validReservation, customer_name: '' }).success
    ).toBe(false)
  })

  it('빈 제목을 거부한다', () => {
    expect(
      reservationSchema.safeParse({ ...validReservation, title: '' }).success
    ).toBe(false)
  })

  it('잘못된 상태값을 거부한다', () => {
    expect(
      reservationSchema.safeParse({ ...validReservation, status: 'unknown' }).success
    ).toBe(false)
  })
})

describe('IDs Schema (ID 배열)', () => {
  it('유효한 UUID 배열을 통과한다', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 100 }),
        (ids) => {
          return idsSchema.safeParse(ids).success
        }
      ),
      { numRuns: 50 }
    )
  })

  it('빈 배열을 거부한다', () => {
    expect(idsSchema.safeParse([]).success).toBe(false)
  })

  it('잘못된 UUID가 포함된 배열을 거부한다', () => {
    expect(idsSchema.safeParse(['not-a-uuid']).success).toBe(false)
  })

  it('100개 초과를 거부한다', () => {
    const ids = Array.from({ length: 101 }, () => '00000000-0000-0000-0000-000000000000')
    expect(idsSchema.safeParse(ids).success).toBe(false)
  })
})

describe('Photo Tag Schema', () => {
  it('유효한 태그를 통과한다', () => {
    expect(photoTagSchema.safeParse({ name: '핑크', color: '#ec4899' }).success).toBe(true)
  })

  it('빈 태그명을 거부한다', () => {
    expect(photoTagSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('50자 초과 태그명을 거부한다', () => {
    expect(photoTagSchema.safeParse({ name: 'a'.repeat(51) }).success).toBe(false)
  })
})

describe('Card Company Setting Schema', () => {
  it('유효한 카드사 설정을 통과한다', () => {
    expect(
      cardCompanySettingSchema.safeParse({
        name: '신한카드',
        fee_rate: 2.0,
        deposit_days: 3,
      }).success
    ).toBe(true)
  })

  it('100% 초과 수수료를 거부한다', () => {
    expect(
      cardCompanySettingSchema.safeParse({
        name: '신한카드',
        fee_rate: 101,
        deposit_days: 3,
      }).success
    ).toBe(false)
  })

  it('음수 수수료를 거부한다', () => {
    expect(
      cardCompanySettingSchema.safeParse({
        name: '신한카드',
        fee_rate: -1,
        deposit_days: 3,
      }).success
    ).toBe(false)
  })
})

describe('Search Query Schema', () => {
  it('유효한 검색어를 통과한다', () => {
    expect(searchQuerySchema.safeParse('홍길동').success).toBe(true)
  })

  it('빈 검색어를 거부한다', () => {
    expect(searchQuerySchema.safeParse('').success).toBe(false)
  })

  it('100자 초과 검색어를 거부한다', () => {
    expect(searchQuerySchema.safeParse('a'.repeat(101)).success).toBe(false)
  })
})

// =============================================
// 보안 관련 경계값 테스트
// =============================================

describe('Security: Input boundary tests', () => {
  it('매우 큰 문자열 입력을 거부한다', () => {
    const hugeString = 'x'.repeat(10000)
    expect(customerSchema.safeParse({ name: hugeString, phone: '010-1234-5678' }).success).toBe(false)
    expect(saleSchema.safeParse({ date: '2024-01-01', product_category: hugeString, amount: 1000, payment_method: 'cash' }).success).toBe(false)
  })

  it('소수점 금액을 거부한다 (정수만 허용)', () => {
    expect(
      saleSchema.safeParse({
        date: '2024-01-01',
        product_category: 'test',
        amount: 1000.5,
        payment_method: 'cash',
      }).success
    ).toBe(false)
  })

  it('null 타입 입력을 거부한다', () => {
    expect(customerSchema.safeParse(null).success).toBe(false)
    expect(saleSchema.safeParse(null).success).toBe(false)
  })

  it('undefined 타입 입력을 거부한다', () => {
    expect(customerSchema.safeParse(undefined).success).toBe(false)
    expect(saleSchema.safeParse(undefined).success).toBe(false)
  })
})
