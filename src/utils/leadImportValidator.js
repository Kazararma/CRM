const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export const validateLeadRow = (lead, options = { aiOutreachEnabled: false }) => {
  const errors = {};
  
  if (!lead.projectTitle || String(lead.projectTitle).trim() === '') {
    errors.projectTitle = 'Required';
  }
  
  const validSources = ["Referral", "LinkedIn", "Cold Call", "Website", "Email Campaign", "Other"];
  if (!validSources.includes(lead.source)) {
    errors.source = 'Invalid Source';
  }
  
  const validCategories = ['hot', 'neutral', 'cold'];
  if (!validCategories.includes(lead.category)) {
    errors.category = 'Invalid (hot/neutral/cold)';
  }
  
  if (!lead.description || String(lead.description).trim() === '') {
    errors.description = 'Required';
  }
  if (!lead.clientName || String(lead.clientName).trim() === '') {
    errors.clientName = 'Required';
  }
  
  const phone = lead.phoneNumber ? String(lead.phoneNumber).trim() : '';
  if (!phone || phone.length < 5) {
    errors.phoneNumber = 'Invalid Phone';
  } else if (options.aiOutreachEnabled && !E164_REGEX.test(phone)) {
    errors.phoneNumber = `Format must be E.164 (e.g., +919876543210)`;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!lead.email || !emailRegex.test(String(lead.email))) {
    errors.email = 'Invalid Email';
  }
  
  if (lead.estimatedBilling === '' || isNaN(Number(lead.estimatedBilling))) {
    errors.estimatedBilling = 'Must be number';
  }
  if (lead.estimatedBudget === '' || isNaN(Number(lead.estimatedBudget))) {
    errors.estimatedBudget = 'Must be number';
  }
  
  return errors;
};
