function numberToWords(amount) {
  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) return 'Invalid Amount';
  if (amount === 0) return 'Rupees Zero Only';

  const MAX_LIMIT = 999999999;
  if (amount > MAX_LIMIT) return 'Amount exceeds supported range';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  function convertHundreds(num) {
    let str = '';
    if (num > 99) {
      str += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num > 9 && num < 20) {
      str += teens[num - 10] + ' ';
    } else {
      if (num > 19) {
        str += tens[Math.floor(num / 10)] + ' ';
        num %= 10;
      }
      if (num > 0) {
        str += ones[num] + ' ';
      }
    }
    return str.trim();
  }

  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let str = '';
  let n = integerPart;

  if (n === 0) {
    str = 'Zero ';
  } else {
    const crores = Math.floor(n / 10000000);
    if (crores > 0) {
      str += convertHundreds(crores) + ' Crore ';
      n %= 10000000;
    }
    const lakhs = Math.floor(n / 100000);
    if (lakhs > 0) {
      str += convertHundreds(lakhs) + ' Lakh ';
      n %= 100000;
    }
    const thousands = Math.floor(n / 1000);
    if (thousands > 0) {
      str += convertHundreds(thousands) + ' Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      str += convertHundreds(n) + ' ';
    }
  }

  str = str.trim();

  if (decimalPart > 0) {
    str += ` and ${convertHundreds(decimalPart)} Paise`;
  }

  return `Rupees ${str} Only`;
}

module.exports = { numberToWords };
