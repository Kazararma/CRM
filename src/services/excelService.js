import * as XLSX from 'xlsx';
import { LEAD_EXCEL_COLUMNS } from '../config/leadImportExportConfig';
import { validateLeadRow } from '../utils/leadImportValidator';

export const downloadSkeletonSheet = () => {
  const ws = XLSX.utils.aoa_to_sheet([LEAD_EXCEL_COLUMNS]);
  
  // Set decent column widths
  const wscols = LEAD_EXCEL_COLUMNS.map(col => ({ wch: Math.max(col.length + 5, 20) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Leads Import Template");
  
  XLSX.writeFile(wb, "Lead_Import_Template.xlsx");
};

export const exportLeadsToExcel = (leadsArray) => {
  const data = leadsArray.map(lead => [
    lead.name || '',
    lead.place || '',
    lead.email || '',
    lead.phone || '',
    lead.linkedin || '',
    lead.instagram || '',
    lead.serviceDescription || '',
    lead.category || ''
  ]);

  // Insert headers at the top
  data.unshift(LEAD_EXCEL_COLUMNS);

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wscols = LEAD_EXCEL_COLUMNS.map(col => ({ wch: Math.max(col.length + 5, 20) }));
  ws['!cols'] = wscols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Exported Leads");
  
  XLSX.writeFile(wb, "Exported_Leads.xlsx");
};

export const parseLeadsFromExcel = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        // The first row is headers, slice it off
        const rows = rawRows.slice(1);
        
        const mappedLeads = rows.map((row, index) => {
          const lead = {
            id: `temp_${index}_${Date.now()}`,
            name: String(row[0] || ''),
            place: String(row[1] || ''),
            email: String(row[2] || ''),
            phone: String(row[3] || ''),
            linkedin: String(row[4] || ''),
            instagram: String(row[5] || ''),
            serviceDescription: String(row[6] || ''),
            category: String(row[7] || '')
          };
          
          lead._errors = validateLeadRow(lead);
          return lead;
        });
        
        // Only return rows that have at least some data
        const nonEmptyLeads = mappedLeads.filter(lead => 
          lead.name || lead.email || lead.phone
        );
        
        resolve(nonEmptyLeads);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
