import React from "react";

/**
 * CurrencyDisplay utility component for consistent ₹ formatting.
 * v2.0 - Migration from ? to ₹.
 */
const CurrencyDisplay = ({ value, className = "" }) => {
  const formattedValue = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value || 0);

  return <span className={className}>{formattedValue}</span>;
};

export default CurrencyDisplay;
