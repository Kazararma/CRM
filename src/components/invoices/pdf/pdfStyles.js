import { StyleSheet } from '@react-pdf/renderer';

const COLORS = {
  black:      '#000000',
  darkGrey:   '#333333',
  mediumGrey: '#666666',
  lightGrey:  '#f2f2f2',
  headerBg:   '#1a1a2e',   
  headerText: '#ffffff',
  accent:     '#e8b84b',   
  border:     '#dddddd',
};

export const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: COLORS.darkGrey,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  invoiceTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.black,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: 'contain',
  },
  invoiceMeta: {
    fontSize: 10,
    color: COLORS.mediumGrey,
    marginTop: 4,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `1pt solid ${COLORS.border}`,
  },
  billingColumn: { width: '48%' },
  sectionLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    color: COLORS.black,
    textTransform: 'uppercase',
  },
  bodyText: { fontSize: 10, lineHeight: 1.5, color: COLORS.darkGrey },
  table: { width: '100%', marginBottom: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.headerBg,
    padding: '6pt 8pt',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.headerText,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${COLORS.border}`,
    padding: '5pt 8pt',
  },
  tableRowAlt: {
    backgroundColor: COLORS.lightGrey,
  },
  colDescription: { width: '50%' },
  colUnitPrice: { width: '20%', textAlign: 'right' },
  colQty: { width: '10%', textAlign: 'right' },
  colAmount: { width: '20%', textAlign: 'right' },
  totalsBlock: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  totalsInner: {
    width: '40%',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalsTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTop: `1pt solid ${COLORS.border}`,
    marginTop: 4,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.black,
  },
  footerWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    alignItems: 'flex-start',
    borderTop: `1pt solid ${COLORS.border}`,
    paddingTop: 16,
  },
  footerLeft: {
    width: '60%',
  },
  footerRight: {
    width: '35%',
    textAlign: 'right',
  }
});
