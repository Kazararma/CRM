const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const validateLeadRow = (lead, options = { aiOutreachEnabled: false }) => {
  const errors = {};
  
  if (!lead.name || String(lead.name).trim() === '') {
    errors.name = 'Required';
  }

  if (!lead.place || String(lead.place).trim() === '') {
    errors.place = 'Required';
  }
  
  const validCategories = ['hot', 'neutral', 'cold'];
  if (!validCategories.includes(lead.category)) {
    errors.category = 'Invalid (hot/neutral/cold)';
  }
  
  if (!lead.serviceDescription || String(lead.serviceDescription).trim().length < 10) {
    errors.serviceDescription = 'Min 10 chars';
  }
  
  const phone = lead.phone ? String(lead.phone).trim() : '';
  if (!phone || phone.length < 5) {
    errors.phone = 'Invalid Phone';
  } else if (options.aiOutreachEnabled && !E164_REGEX.test(phone)) {
    errors.phone = `Format must be E.164 (e.g., +919876543210)`;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!lead.email || !emailRegex.test(String(lead.email))) {
    errors.email = 'Invalid Email';
  }

  if (lead.linkedin && lead.linkedin.trim() !== '') {
    if (!lead.linkedin.includes('linkedin.com')) {
      errors.linkedin = 'Invalid LinkedIn URL';
    }
  }
  
  return errors;
};
