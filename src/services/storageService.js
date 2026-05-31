import {
  ref, uploadBytesResumable, getDownloadURL
} from 'firebase/storage';
import { storage } from '../firebase/config';

/**
 * Uploads a worklog attachment to Firebase Storage.
 * Returns the permanent download URL and file metadata on completion.
 *
 * @param {File}     file       - The File object from the file input (PDF or PNG)
 * @param {string}   projectId  - Firestore project document ID
 * @param {string}   workerId   - Firestore user document ID (the uploader)
 * @param {Function} onProgress - Optional callback: (percent: number) => void
 * @returns {Promise<{ downloadUrl: string, attachmentType: string, attachmentFileName: string }>}
 */
export async function uploadWorklogAttachment(file, projectId, workerId, onProgress) {
  // ── 1. Client-side validation (mirrors Storage rules as a fast UX check) ──
  const ALLOWED_TYPES = ['application/pdf', 'image/png'];
  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only PDF and PNG files are allowed.');
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error('File size must be 5MB or less.');
  }

  // ── 2. Build the unique storage path ──────────────────────────────────────
  const timestamp    = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_'); // sanitize
  const storagePath  = `worklogs/${projectId}/${workerId}/${timestamp}_${safeFilename}`;
  const storageRef   = ref(storage, storagePath);

  // ── 3. Upload with progress reporting ────────────────────────────────────
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      uploadedBy: workerId,
      projectId,
      originalFilename: file.name,
    },
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const percent = Math.round(
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        );
        onProgress?.(percent);
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({
          downloadUrl,
          attachmentType:     file.type === 'application/pdf' ? 'pdf' : 'png',
          attachmentFileName: file.name,
        });
      }
    );
  });
}
