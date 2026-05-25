import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const getInvoiceSettings = async () => {
  const docRef = doc(db, 'settings', 'invoice');
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
};

export const saveInvoiceSettings = async (data) => {
  const docRef = doc(db, 'settings', 'invoice');
  await setDoc(docRef, data, { merge: true });
};
