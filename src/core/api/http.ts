/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const TOKEN_KEY = 'ske_auth_token';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const http = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`/api${endpoint}`, {
      ...options,
      headers,
    });

    const text = await response.text();

    if (!response.ok) {
      let errMsg = `Error ${response.status}: ${response.statusText}`;
      let errCode: string | undefined;
      try {
        const errorJson = JSON.parse(text);
        if (errorJson.error) errMsg = errorJson.error;
        if (errorJson.code) errCode = errorJson.code;
      } catch {
        // non-JSON response
      }
      throw new ApiError(errMsg, response.status, errCode);
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new ApiError(`Unexpected non-JSON response from server for /api${endpoint}`, response.status);
    }
  },

  /**
   * Downloads protected files strictly via Authorization: Bearer headers (zero ?token= query strings).
   */
  async downloadBlob(endpoint: string, fallbackFilename: string): Promise<void> {
    const token = this.getToken();
    const headers = new Headers();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`/api${endpoint}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let errMsg = `Download failed (${response.status})`;
      let errCode: string | undefined;
      try {
        const json = JSON.parse(text);
        if (json.error) errMsg = json.error;
        if (json.code) errCode = json.code;
      } catch {
        // ignore parse error
      }
      throw new ApiError(errMsg, response.status, errCode);
    }

    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const filename = match?.[1] ? decodeURIComponent(match[1]) : fallbackFilename;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  },
};
