export const validateLeadRow = (lead) => {
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
  
  if (!lead.phoneNumber || String(lead.phoneNumber).trim().length < 5) {
    errors.phoneNumber = 'Invalid Phone';
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
