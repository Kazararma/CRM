import React from 'react';
import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './pdfStyles';

export const InvoicePDFTemplate = ({ invoice }) => {
  // Format dates securely
  const formatInvoiceDate = (timestamp) => {
    if (!timestamp) return '';
    // Handle both JS Date objects and Firestore Timestamps
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const formattedDate = formatInvoiceDate(invoice.invoiceDate);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header Section */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>Invoice Number: #{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>Invoice Date: {formattedDate}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Image src="/wavelet-logo.png" style={styles.logo} />
          </View>
        </View>

        {/* Company & Bill To Section */}
        <View style={styles.billingRow}>
          {/* Company Info */}
          <View style={styles.billingColumn}>
            <Text style={styles.sectionLabel}>COMPANY INFO</Text>
            {invoice.company?.name && <Text style={styles.bodyText}>{invoice.company?.name}</Text>}
            {invoice.company?.addressLine1 && <Text style={styles.bodyText}>{invoice.company?.addressLine1}</Text>}
            {invoice.company?.addressLine2 && <Text style={styles.bodyText}>{invoice.company?.addressLine2}</Text>}
            
            {(invoice.company?.city || invoice.company?.pincode) && (
              <Text style={styles.bodyText}>
                {[invoice.company?.city, invoice.company?.pincode].filter(Boolean).join(', ')}
              </Text>
            )}
            
            {invoice.company?.phoneNumbers && <Text style={styles.bodyText}>Phone: {invoice.company?.phoneNumbers}</Text>}
            {invoice.company?.website && <Text style={styles.bodyText}>Web: {invoice.company?.website}</Text>}
            {invoice.company?.gstNumber && <Text style={styles.bodyText}>GST No.: {invoice.company?.gstNumber}</Text>}
          </View>
          
          {/* Bill To */}
          <View style={styles.billingColumn}>
            <Text style={styles.sectionLabel}>BILL TO</Text>
            <Text style={styles.bodyText}>{invoice.client?.name}</Text>
            {invoice.client?.phoneNumber && <Text style={styles.bodyText}>{invoice.client.phoneNumber}</Text>}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Item & Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colUnitPrice]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>
          
          {/* Table Rows */}
          {invoice.items?.map((item, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={[styles.bodyText, styles.colDescription]}>{item.description}</Text>
              <Text style={[styles.bodyText, styles.colUnitPrice]}>Rs {item.unitPrice}</Text>
              <Text style={[styles.bodyText, styles.colQty]}>{item.qty}</Text>
              <Text style={[styles.bodyText, styles.colAmount]}>Rs {item.amount}</Text>
            </View>
          ))}
        </View>

        {/* Totals Section */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsInner}>
            <View style={styles.totalsRow}>
              <Text style={styles.bodyText}>Sub-Total</Text>
              <Text style={styles.bodyText}>Rs {invoice.subTotal}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.bodyText}>Tax (18%)</Text>
              <Text style={styles.bodyText}>Rs {invoice.taxAmount}</Text>
            </View>
            <View style={styles.totalsTotal}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Total</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Rs {invoice.total}</Text>
            </View>
          </View>
        </View>

        {/* Footer Section */}
        <View style={styles.footerWrapper}>
          {/* LEFT COLUMN */}
          <View style={styles.footerLeft}>
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.sectionLabel}>NOTES / TERMS</Text>
              <Text style={styles.bodyText}>{invoice.notesTerms}</Text>
            </View>
            <View>
              <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
              {invoice.payment?.bankName && <Text style={styles.bodyText}>Bank: {invoice.payment.bankName}</Text>}
              {invoice.payment?.accountName && <Text style={styles.bodyText}>Acc Name: {invoice.payment.accountName}</Text>}
              {invoice.payment?.accountNumber && <Text style={styles.bodyText}>Account No.: {invoice.payment.accountNumber}</Text>}
              {invoice.payment?.ifscCode && <Text style={styles.bodyText}>IFSC: {invoice.payment.ifscCode}</Text>}
              {invoice.payment?.upiNumber && <Text style={styles.bodyText}>UPI: {invoice.payment.upiNumber}</Text>}
            </View>
          </View>

          {/* RIGHT COLUMN */}
          <View style={styles.footerRight}>
            {invoice.preparedBy && (
              <View>
                <Text style={styles.sectionLabel}>PREPARED BY</Text>
                {typeof invoice.preparedBy === 'string' ? (
                  <Text style={[styles.bodyText, { marginTop: 5 }]}>{invoice.preparedBy}</Text>
                ) : invoice.preparedBy.text ? (
                  <Text style={[styles.bodyText, { marginTop: 5 }]}>{invoice.preparedBy.text}</Text>
                ) : (
                  <>
                    <Text style={[styles.bodyText, { marginTop: 5 }]}>{invoice.preparedBy.name}</Text>
                    <Text style={styles.bodyText}>{invoice.preparedBy.designation}</Text>
                  </>
                )}
              </View>
            )}
          </View>
        </View>

      </Page>
    </Document>
  );
};
