// src/utils/leadPhaseNormalizer.js

/**
 * Normalizes a lead phase value from legacy to current naming.
 * Called at read time on every lead document — never writes to Firestore.
 *
 * @param {string} phase - Raw phase value from Firestore
 * @returns {string}     - Normalized phase value
 */
export const PHASE_LEGACY_MAP = {
  initial:     'open',
  negotiation: 'contacted',
  final:       'qualified',
  failed:      'unqualified',
};

export function normalizeLeadPhase(phase) {
  return PHASE_LEGACY_MAP[phase] ?? phase;
  // If the phase is already new (e.g. "open"), the map returns undefined
  // and we fall through to the original value — safe for both old and new docs.
}

/**
 * Apply normalization to a full lead document object.
 * Use this in onSnapshot handlers before setting state.
 */
export function normalizeLead(leadDoc) {
  return {
    ...leadDoc,
    phase: normalizeLeadPhase(leadDoc.phase),
  };
}
