import { collection, writeBatch, doc, serverTimestamp, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';

export const createStagingBatch = async (tenantId, importMode, records, autonomousOutreachEnabled, outreachChannel, campaignContext, userId) => {
  const batchId = doc(collection(db, 'staging')).id;
  const batchRef = doc(db, 'staging', batchId);
  const writeBatchOp = writeBatch(db);

  let validCount = 0;
  let errorCount = 0;
  let garbageCount = 0;

  records.forEach((record) => {
    const isGarbage = record.garbageScore >= 0.8;
    const isValid = Object.keys(record._errors || {}).length === 0 && !isGarbage;

    if (isGarbage) garbageCount++;
    else if (isValid) validCount++;
    else errorCount++;

    const recordRef = doc(collection(batchRef, 'records'));
    writeBatchOp.set(recordRef, {
      recordId: recordRef.id,
      batchId,
      rawData: record,
      garbageScore: record.garbageScore || 0,
      garbageReason: record.garbageReason || null,
      isDiscarded: isGarbage,
      name: record.name,
      place: record.place,
      email: record.email,
      phone: record.phone,
      linkedin: record.linkedin || null,
      instagram: record.instagram || null,
      serviceDescription: record.serviceDescription,
      category: record.category,
      validationErrors: Object.entries(record._errors || {}).map(([field, message]) => ({ field, message })),
      isValid,
      isManuallyEdited: false,
      status: isGarbage ? 'discarded' : 'pending'
    });
  });

  const batchStatus = (importMode === 'automatic' && errorCount === 0) ? 'auto_commit_requested' : 'staging';

  writeBatchOp.set(batchRef, {
    batchId,
    tenantId,
    importedAt: serverTimestamp(),
    importSource: 'excel_upload',
    totalRecords: records.length,
    validCount,
    errorCount,
    garbageDiscardedCount: garbageCount,
    importMode,
    autonomousOutreachEnabled,
    outreachChannel: outreachChannel || null,
    campaignContext: campaignContext || null,
    status: batchStatus,
    importedBy: userId
  });

  await writeBatchOp.commit();
  return batchId;
};

export const commitManualStagingBatch = async (batchId, tenantId, userId) => {
  const batchRef = doc(db, 'staging', batchId);
  const recordsRef = collection(batchRef, 'records');
  const q = query(recordsRef, where('isDiscarded', '==', false), where('isValid', '==', true), where('status', '==', 'pending'));
  const recordsSnap = await getDocs(q);

  if (recordsSnap.empty) {
    await updateDoc(batchRef, { status: 'committed', committedAt: serverTimestamp(), committedBy: userId });
    return { success: 0, failed: 0, importedLeadIds: [] };
  }

  const writeBatchOp = writeBatch(db);
  const leadsRef = collection(db, 'leads');
  const importedLeadIds = [];

  recordsSnap.docs.forEach((recordDoc) => {
    const record = recordDoc.data();
    const newLeadRef = doc(leadsRef);
    importedLeadIds.push(newLeadRef.id);

    writeBatchOp.set(newLeadRef, {
      tenantId,
      name: record.name,
      place: record.place,
      email: record.email,
      phone: record.phone,
      linkedin: record.linkedin ?? null,
      instagram: record.instagram ?? null,
      serviceDescription: record.serviceDescription,
      category: record.category,
      phase: 'initial',
      executionMode: 'manual', 
      contactCycles: [],
      currentCycleIndex: 0,
      chatHistory: [],
      manualInstructionHistory: [],
      closureSignal: null,
      closureNote: null,
      convertedToOpportunityId: null,
      isConverted: false,
      isDeleted: false,
      importedFromBatch: batchId,
      importSource: 'excel_upload',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    });

    writeBatchOp.update(recordDoc.ref, {
      status: 'committed',
      committedLeadId: newLeadRef.id,
    });
  });

  writeBatchOp.update(batchRef, {
    status: 'committed',
    committedAt: serverTimestamp(),
    committedBy: userId,
  });

  await writeBatchOp.commit();
  return { success: importedLeadIds.length, failed: 0, importedLeadIds };
};
