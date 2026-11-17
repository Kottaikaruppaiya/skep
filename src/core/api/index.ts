/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { authApi } from './auth.api.ts';
import { complianceApi } from './compliance.api.ts';
import { ApiError, http } from './http.ts';
import { shipmentsApi } from './operations.api.ts';

export { ApiError, http };

export const api = {
  getToken: () => http.getToken(),
  setToken: (token: string) => http.setToken(token),
  clearToken: () => http.clearToken(),
  request: <T>(endpoint: string, options?: RequestInit) => http.request<T>(endpoint, options),
  downloadBlob: (endpoint: string, fallbackFilename: string) => http.downloadBlob(endpoint, fallbackFilename),
  ...authApi,
  ...shipmentsApi,
  ...complianceApi,
};
