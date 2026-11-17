/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AppSettings,
  B2bDashboardMetrics,
  B2bImportPreview,
  B2bInvoice,
  B2bMonthlySummary,
  BankMaster,
  ConsigneeMaster,
  DashboardMetrics,
  FinancialYear,
  GstEntry,
  GstResult,
  GstSummary,
  ImportBatch,
  Supplier,
} from '../../shared/types/index.ts';
import { http } from './http.ts';

export const complianceApi = {
  // Financial Years & Dashboard
  async getFinancialYears(): Promise<FinancialYear[]> {
    return http.request<FinancialYear[]>('/financial-years');
  },

  async getDashboardMetrics(financialYearId?: string): Promise<DashboardMetrics> {
    const q = financialYearId ? `?financialYearId=${encodeURIComponent(financialYearId)}` : '';
    return http.request<DashboardMetrics>(`/dashboard${q}`);
  },

  // Masters
  async getConsignees(): Promise<ConsigneeMaster[]> {
    return http.request<ConsigneeMaster[]>('/masters/consignees');
  },

  async createConsignee(data: any): Promise<ConsigneeMaster> {
    return http.request<ConsigneeMaster>('/masters/consignees', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateConsignee(id: string, data: any): Promise<ConsigneeMaster> {
    return http.request<ConsigneeMaster>(`/masters/consignees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteConsignee(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/masters/consignees/${id}`, {
      method: 'DELETE',
    });
  },

  async getBanks(): Promise<BankMaster[]> {
    return http.request<BankMaster[]>('/masters/banks');
  },

  async createBank(data: any): Promise<BankMaster> {
    return http.request<BankMaster>('/masters/banks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBank(id: string, data: any): Promise<BankMaster> {
    return http.request<BankMaster>(`/masters/banks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBank(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/masters/banks/${id}`, {
      method: 'DELETE',
    });
  },

  // Excel & CSV Reports (Bearer-authenticated Blob downloads)
  async downloadExportWorkbook(financialYearId?: string): Promise<void> {
    const q = new URLSearchParams();
    if (financialYearId) q.append('financialYearId', financialYearId);
    const qs = q.toString();
    return http.downloadBlob(
      `/excel/export${qs ? `?${qs}` : ''}`,
      `SKE_Export_Realisation_Tracker_${financialYearId || 'All'}.xlsx`
    );
  },

  async downloadExportCsv(sheetName: string, financialYearId?: string, fallbackFilename?: string): Promise<void> {
    const q = new URLSearchParams();
    q.append('sheet', sheetName);
    if (financialYearId) q.append('financialYearId', financialYearId);
    return http.downloadBlob(
      `/excel/export-csv?${q.toString()}`,
      fallbackFilename || `SKE_${sheetName.replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`
    );
  },

  async importExcel(formData: FormData): Promise<any> {
    return http.request<any>('/excel/import', {
      method: 'POST',
      body: formData,
    });
  },

  // GST Entries
  async getGstEntries(params?: {
    consigneeId?: string;
    result?: GstResult | string;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ entries: GstEntry[]; total: number; summary: GstSummary }> {
    const q = new URLSearchParams();
    if (params?.consigneeId) q.set('consigneeId', params.consigneeId);
    if (params?.result) q.set('result', params.result);
    if (params?.search) q.set('search', params.search);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.sortBy) q.set('sortBy', params.sortBy);
    if (params?.sortOrder) q.set('sortOrder', params.sortOrder);

    const queryString = q.toString();
    return http.request<{ entries: GstEntry[]; total: number; summary: GstSummary }>(
      `/gst-entries${queryString ? `?${queryString}` : ''}`
    );
  },

  async getGstSummary(params?: { consigneeId?: string; startDate?: string; endDate?: string }): Promise<GstSummary> {
    const q = new URLSearchParams();
    if (params?.consigneeId) q.set('consigneeId', params.consigneeId);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    const queryString = q.toString();
    return http.request<GstSummary>(`/gst-entries/summary${queryString ? `?${queryString}` : ''}`);
  },

  async downloadGstExport(params?: {
    consigneeId?: string;
    result?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<void> {
    const q = new URLSearchParams();
    if (params?.consigneeId && params.consigneeId !== 'ALL') q.set('consigneeId', params.consigneeId);
    if (params?.result && params.result !== 'ALL') q.set('result', params.result);
    if (params?.search) q.set('search', params.search);
    if (params?.startDate) q.set('startDate', params.startDate);
    if (params?.endDate) q.set('endDate', params.endDate);
    const queryString = q.toString();
    return http.downloadBlob(
      `/gst-entries/export${queryString ? `?${queryString}` : ''}`,
      'SKE_GST_Entries.xlsx'
    );
  },

  async createGstEntry(data: {
    entryDate: string;
    consigneeId: string;
    igst: number;
    cgst: number;
    sgst: number;
    refundEligible: number;
    remarks?: string;
  }): Promise<GstEntry> {
    return http.request<GstEntry>('/gst-entries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateGstEntry(
    id: string,
    data: Partial<{
      entryDate: string;
      consigneeId: string;
      igst: number;
      cgst: number;
      sgst: number;
      refundEligible: number;
      remarks?: string;
    }>
  ): Promise<GstEntry> {
    return http.request<GstEntry>(`/gst-entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteGstEntry(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/gst-entries/${id}`, {
      method: 'DELETE',
    });
  },

  // B2B GST Management Module
  async getB2bDashboard(financialYear?: string): Promise<B2bDashboardMetrics> {
    const query = financialYear ? `?financialYear=${encodeURIComponent(financialYear)}` : '';
    return http.request<B2bDashboardMetrics>(`/b2b/dashboard${query}`);
  },

  async getB2bMonthlySummaries(financialYear?: string): Promise<B2bMonthlySummary[]> {
    const query = financialYear ? `?financialYear=${encodeURIComponent(financialYear)}` : '';
    return http.request<B2bMonthlySummary[]>(`/b2b/monthly${query}`);
  },

  async getB2bMonthDetail(periodKey: string): Promise<{
    summary: B2bMonthlySummary;
    invoices: B2bInvoice[];
    topSuppliers: Array<{
      gstin: string;
      name: string;
      invoiceCount: number;
      invoiceValue: number;
      taxableValue: number;
      totalGst: number;
    }>;
  }> {
    return http.request(`/b2b/monthly/${encodeURIComponent(periodKey)}`);
  },

  async getB2bInvoices(filters?: {
    periodKey?: string;
    financialYear?: string;
    supplierGstin?: string;
    invoiceType?: string;
    reverseCharge?: string;
    itcAvailability?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: B2bInvoice[];
    total: number;
    page: number;
    limit: number;
    totalTaxableValue: number;
    totalGst: number;
    totalInvoiceValue: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.periodKey && filters.periodKey !== 'ALL') params.set('periodKey', filters.periodKey);
    if (filters?.financialYear && filters.financialYear !== 'ALL') params.set('financialYear', filters.financialYear);
    if (filters?.supplierGstin && filters.supplierGstin !== 'ALL') params.set('supplierGstin', filters.supplierGstin);
    if (filters?.invoiceType && filters.invoiceType !== 'ALL') params.set('invoiceType', filters.invoiceType);
    if (filters?.reverseCharge && filters.reverseCharge !== 'ALL') params.set('reverseCharge', filters.reverseCharge);
    if (filters?.itcAvailability && filters.itcAvailability !== 'ALL') params.set('itcAvailability', filters.itcAvailability);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.page) params.set('page', String(filters.page));
    if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

    const qs = params.toString() ? `?${params.toString()}` : '';
    return http.request(`/b2b/invoices${qs}`);
  },

  async getB2bInvoiceById(id: string): Promise<B2bInvoice> {
    return http.request<B2bInvoice>(`/b2b/invoices/${id}`);
  },

  async createB2bInvoice(data: any): Promise<B2bInvoice> {
    return http.request<B2bInvoice>('/b2b/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateB2bInvoice(id: string, data: any): Promise<B2bInvoice> {
    return http.request<B2bInvoice>(`/b2b/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteB2bInvoice(id: string): Promise<{ success: boolean; message: string }> {
    return http.request<{ success: boolean; message: string }>(`/b2b/invoices/${id}`, {
      method: 'DELETE',
    });
  },

  async getB2bSuppliers(search?: string): Promise<Supplier[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    return http.request<Supplier[]>(`/b2b/suppliers${query}`);
  },

  async getB2bSupplierById(id: string): Promise<Supplier> {
    return http.request<Supplier>(`/b2b/suppliers/${id}`);
  },

  async createB2bSupplier(data: {
    gstin: string;
    legalName: string;
    tradeName?: string;
    address?: string;
    state?: string;
  }): Promise<Supplier> {
    return http.request<Supplier>('/b2b/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateB2bSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
    return http.request<Supplier>(`/b2b/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteB2bSupplier(id: string): Promise<{ success: boolean; message: string }> {
    return http.request<{ success: boolean; message: string }>(`/b2b/suppliers/${id}`, {
      method: 'DELETE',
    });
  },

  async previewB2bImport(file: File): Promise<B2bImportPreview> {
    const formData = new FormData();
    formData.append('file', file);
    return http.request<B2bImportPreview>('/b2b/import/preview', {
      method: 'POST',
      body: formData,
    });
  },

  async commitB2bImport(
    previewData: B2bImportPreview,
    mode: 'SKIP_EXISTING' | 'OVERWRITE_EXISTING' | 'INSERT_ALL',
    fileName: string,
    fileSizeBytes?: number
  ): Promise<{ batchId: string; totalProcessed: number; inserted: number; updated: number; skipped: number; failed?: number }> {
    return http.request('/b2b/import/commit', {
      method: 'POST',
      body: JSON.stringify({ previewData, mode, fileName, fileSizeBytes }),
    });
  },

  async getB2bImportBatches(): Promise<ImportBatch[]> {
    return http.request<ImportBatch[]>('/b2b/import/batches');
  },

  async downloadB2bExport(params?: {
    reportType?: string;
    periodKey?: string;
    financialYear?: string;
    supplierGstin?: string;
  }): Promise<void> {
    const qs = new URLSearchParams();
    if (params?.reportType) qs.set('reportType', params.reportType);
    if (params?.periodKey && params.periodKey !== 'ALL') qs.set('periodKey', params.periodKey);
    if (params?.financialYear && params.financialYear !== 'ALL') qs.set('financialYear', params.financialYear);
    if (params?.supplierGstin && params.supplierGstin !== 'ALL') qs.set('supplierGstin', params.supplierGstin);
    const queryStr = qs.toString();
    const fallback =
      params?.reportType === 'monthly_summary'
        ? `SKE_B2B_Monthly_Summary_${params?.financialYear || 'All'}.xlsx`
        : `SKE_B2B_Register_${params?.periodKey || params?.financialYear || 'All'}.xlsx`;
    return http.downloadBlob(`/b2b/export${queryStr ? `?${queryStr}` : ''}`, fallback);
  },

  // Settings & System
  async getSettings(): Promise<AppSettings> {
    return http.request<AppSettings>('/settings');
  },

  async updateSettings(data: Partial<AppSettings>): Promise<AppSettings> {
    return http.request<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async clearAllRecords(): Promise<{ success: boolean; cleared: Record<string, number> }> {
    return http.request<{ success: boolean; cleared: Record<string, number> }>('/system/clear-records', {
      method: 'POST',
    });
  },
};
