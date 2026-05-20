/**
 * CURRENCY UTILITY: formatINR
 * Formats monetary values into the Indian Rupee (INR) system.
 * 
 * Rules from Blueprint Section 1.3:
 * - Style: currency
 * - Currency: INR
 * - Fixed 2 decimal places.
 */

export const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount ?? 0);
