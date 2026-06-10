import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const batchWriteLeads = async (validLeads, userId) => {
  const batch = writeBatch(db);
  const leadsRef = collection(db, 'leads');
  
  const importedLeadIds = [];
  let successCount = 0;

  validLeads.forEach(lead => {
    const newDocRef = doc(leadsRef);
    importedLeadIds.push(newDocRef.id);
    const { _errors, id, ...cleanLead } = lead;
    
    batch.set(newDocRef, {
      ...cleanLead,
      estimatedBilling: Number(cleanLead.estimatedBilling),
      estimatedBudget: Number(cleanLead.estimatedBudget),
      phase: 'open',
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      isConvertedToOpportunity: false,
      isDeleted: false
    });
    successCount++;
  });
  
  await batch.commit();
  return { success: successCount, failed: 0, importedLeadIds };
};
