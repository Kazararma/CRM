import {
  collection, doc, addDoc, updateDoc, runTransaction,
  serverTimestamp, query, orderBy, limit, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase/config';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY: Compute all financial totals from a raw items array.
// Call before every create/update to ensure stored values are always correct.
// ─────────────────────────────────────────────────────────────────────────────
export function computeInvoiceTotals(items) {
  const subTotal  = items.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0);
  const taxRate   = 0.18;
  const taxAmount = parseFloat((subTotal * taxRate).toFixed(2));
  const total     = parseFloat((subTotal + taxAmount).toFixed(2));
  return { subTotal: parseFloat(subTotal.toFixed(2)), taxRate, taxAmount, total };
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE INVOICE
// Uses a Firestore transaction to safely generate the next sequential
// invoice number without race conditions.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {object} formData   - Validated form data from InvoiceFormModal
 * @param {string} adminUid
 * @param {string} adminName
 * @returns {Promise<string>} - New invoiceId
 */
export async function createInvoice(formData, adminUid, adminName) {
  const invoicesCol = collection(db, 'invoices');

  return await runTransaction(db, async (transaction) => {
    // Step 1: Determine the next invoice number
    // Query outside the transaction (read-only, acceptable for sequential IDs
    // with low concurrency). For high-concurrency, use a counter doc instead.
    const latestQ   = query(invoicesCol, orderBy('invoiceNumber', 'desc'), limit(1));
    const latestSnap = await getDocs(latestQ);
    const nextNumber = latestSnap.empty
      ? 1
      : (latestSnap.docs[0].data().invoiceNumber ?? 0) + 1;

    // Step 2: Compute financial totals
    const itemsWithAmounts = formData.items.map(item => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      qty:       Number(item.qty),
      amount:    parseFloat((Number(item.unitPrice) * Number(item.qty)).toFixed(2)),
    }));
    const totals = computeInvoiceTotals(itemsWithAmounts);

    // Step 3: Build the document payload
    const newDocRef = doc(invoicesCol);
    const payload = {
      invoiceId:     newDocRef.id,
      invoiceNumber: formData.invoiceNumber ?? nextNumber,
      invoiceDate:   formData.invoiceDate,          // Timestamp from form
      status:        'draft',
      projectId:     formData.projectId   ?? null,
      projectTitle:  formData.projectTitle ?? null,
      origin:        formData.projectId ? 'project' : 'scratch',
      company:       formData.company,
      client:        formData.client,
      clientBusinessName: formData.clientBusinessName || '',
      clientBusinessAddress: formData.clientBusinessAddress || '',
      clientTaxId:   formData.clientTaxId || '',
      clientEmail:   formData.clientEmail || '',
      items:         itemsWithAmounts,
      ...totals,
      notesTerms:    formData.notesTerms  ?? '',
      payment:       formData.payment,
      preparedBy:    formData.preparedBy,
      createdAt:     serverTimestamp(),
      createdBy:     adminUid,
      updatedAt:     serverTimestamp(),
      updatedBy:     adminUid,
      isDeleted:     false,
    };

    transaction.set(newDocRef, payload);
    return newDocRef.id;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE INVOICE
// Recalculates all financial totals on every update.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {string} invoiceId
 * @param {object} formData   - Partial or full form data to update
 * @param {string} adminUid
 */
export async function updateInvoice(invoiceId, formData, adminUid) {
  const invoiceRef = doc(db, 'invoices', invoiceId);

  const itemsWithAmounts = formData.items.map(item => ({
    ...item,
    unitPrice: Number(item.unitPrice),
    qty:       Number(item.qty),
    amount:    parseFloat((Number(item.unitPrice) * Number(item.qty)).toFixed(2)),
  }));
  const totals = computeInvoiceTotals(itemsWithAmounts);

  await updateDoc(invoiceRef, {
    ...formData,
    items:     itemsWithAmounts,
    ...totals,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE STATUS ONLY
// Lightweight update for status changes from the InvoiceCard.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateInvoiceStatus(invoiceId, newStatus, adminUid) {
  await updateDoc(doc(db, 'invoices', invoiceId), {
    status:    newStatus,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE INVOICE
// ─────────────────────────────────────────────────────────────────────────────
export async function deleteInvoice(invoiceId, adminUid) {
  await updateDoc(doc(db, 'invoices', invoiceId), {
    isDeleted: true,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}
