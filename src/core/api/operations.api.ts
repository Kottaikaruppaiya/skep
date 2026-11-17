/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BrcRecord, DocumentRecord, IncentiveRecord, OcrJob, Payment, PaymentAllocation, Shipment } from '../../shared/types/index.ts';
import { http } from './http.ts';

export const shipmentsApi = {
  async getShipments(params?: {
    financialYearId?: string;
    consigneeId?: string;
    paymentStatus?: string;
    reviewStatus?: string;
    search?: string;
  }): Promise<Shipment[]> {
    const q = new URLSearchParams();
    if (params?.financialYearId) q.append('financialYearId', params.financialYearId);
    if (params?.consigneeId) q.append('consigneeId', params.consigneeId);
    if (params?.paymentStatus) q.append('paymentStatus', params.paymentStatus);
    if (params?.reviewStatus) q.append('reviewStatus', params.reviewStatus);
    if (params?.search) q.append('search', params.search);
    return http.request<Shipment[]>(`/shipments?${q.toString()}`);
  },

  async getShipmentById(id: string): Promise<Shipment> {
    return http.request<Shipment>(`/shipments/${id}`);
  },

  async lookupShipments(query: string, financialYearId?: string): Promise<{ normalizedQueryKey: string; matches: Shipment[] }> {
    const q = new URLSearchParams({ q: query });
    if (financialYearId) q.append('financialYearId', financialYearId);
    return http.request<{ normalizedQueryKey: string; matches: Shipment[] }>(`/shipments/lookup?${q.toString()}`);
  },

  async checkInvoiceUnique(
    invoiceNumber: string,
    financialYearId: string
  ): Promise<{ isUnique: boolean; normalizedKey: string; existingInvoiceNumber?: string }> {
    const q = new URLSearchParams({ invoiceNumber, financialYearId });
    return http.request<{ isUnique: boolean; normalizedKey: string; existingInvoiceNumber?: string }>(
      `/shipments/check-unique?${q.toString()}`
    );
  },

  async createShipmentWithDocuments(formData: FormData): Promise<Shipment> {
    return http.request<Shipment>('/shipments/create-with-documents', {
      method: 'POST',
      body: formData,
    });
  },

  async createShipment(data: any): Promise<Shipment> {
    return http.request<Shipment>('/shipments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateShipment(
    id: string,
    updates: { [K in keyof Shipment]?: Shipment[K] | null } & Record<string, any>
  ): Promise<Shipment> {
    return http.request<Shipment>(`/shipments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteShipment(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/shipments/${id}`, {
      method: 'DELETE',
    });
  },

  async archiveShipment(id: string, reason?: string): Promise<Shipment> {
    return http.request<Shipment>(`/shipments/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async restoreShipment(id: string): Promise<Shipment> {
    return http.request<Shipment>(`/shipments/${id}/restore`, {
      method: 'POST',
    });
  },

  async getPayments(): Promise<Payment[]> {
    return http.request<Payment[]>('/payments');
  },

  async getPaymentById(id: string): Promise<Payment> {
    return http.request<Payment>(`/payments/${id}`);
  },

  async createPayment(data: any): Promise<Payment> {
    return http.request<Payment>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment> {
    return http.request<Payment>(`/payments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deletePayment(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/payments/${id}`, {
      method: 'DELETE',
    });
  },

  async allocatePayment(data: {
    paymentId: string;
    shipmentId: string;
    allocatedAmountUsd: number;
    notes?: string;
  }): Promise<PaymentAllocation> {
    return http.request<PaymentAllocation>('/allocations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deallocatePayment(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/allocations/${id}`, {
      method: 'DELETE',
    });
  },

  async createIncentive(data: any): Promise<IncentiveRecord> {
    return http.request<IncentiveRecord>('/incentives', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateIncentive(id: string, data: any): Promise<IncentiveRecord> {
    return http.request<IncentiveRecord>(`/incentives/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteIncentive(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/incentives/${id}`, {
      method: 'DELETE',
    });
  },

  async updateBrc(id: string, data: any): Promise<BrcRecord> {
    return http.request<BrcRecord>(`/brc/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async resetBrc(id: string): Promise<BrcRecord> {
    return http.request<BrcRecord>(`/brc/${id}/reset`, {
      method: 'POST',
    });
  },

  async uploadDocument(formData: FormData): Promise<{ document: DocumentRecord; extraction: any }> {
    return http.request<{ document: DocumentRecord; extraction: any }>('/documents/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async downloadDocument(id: string, fallbackFilename = 'document.pdf'): Promise<void> {
    return http.downloadBlob(`/documents/${encodeURIComponent(id)}/download`, fallbackFilename);
  },

  async reviewDocument(id: string, reviewStatus: string): Promise<DocumentRecord> {
    return http.request<DocumentRecord>(`/documents/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ reviewStatus }),
    });
  },

  async deleteDocument(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/documents/${id}`, {
      method: 'DELETE',
    });
  },

  async extractDocumentsBatch(formData: FormData): Promise<{
    success: boolean;
    totalFilesParsed: number;
    mergedDraft: any;
    extractions: Record<string, any>;
    conflicts?: any[];
  }> {
    return http.request<any>('/documents/extract-batch', {
      method: 'POST',
      body: formData,
    });
  },

  async getOcrJobs(status?: string, category?: string): Promise<{ jobs: OcrJob[]; concurrency: { activeJobs: number; maxConcurrency: number } }> {
    const q = new URLSearchParams();
    if (status) q.append('status', status);
    if (category) q.append('category', category);
    return http.request<{ jobs: OcrJob[]; concurrency: { activeJobs: number; maxConcurrency: number } }>(`/ocr/jobs?${q.toString()}`);
  },

  async getOcrJob(id: string): Promise<OcrJob> {
    return http.request<OcrJob>(`/ocr/jobs/${id}`);
  },

  async queueOcrJob(formData: FormData): Promise<{ success: boolean; message: string; job: OcrJob }> {
    return http.request<{ success: boolean; message: string; job: OcrJob }>('/ocr/jobs', {
      method: 'POST',
      body: formData,
    });
  },

  async retryOcrJob(id: string): Promise<OcrJob> {
    return http.request<OcrJob>(`/ocr/jobs/${id}/retry`, {
      method: 'POST',
    });
  },

  async deleteOcrJob(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/ocr/jobs/${id}`, {
      method: 'DELETE',
    });
  },

  async approveOcrJob(
    id: string,
    reviewedValues: Record<string, any>
  ): Promise<{ success: boolean; message: string; shipment?: Shipment; payment?: Payment; job: OcrJob }> {
    return http.request(`/ocr/jobs/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewedValues }),
    });
  },
};
