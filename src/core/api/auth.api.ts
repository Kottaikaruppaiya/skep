/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { User } from '../../shared/types/index.ts';
import { http } from './http.ts';

export const authApi = {
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const res = await http.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    http.setToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await http.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session token even if backend session already expired
    }
    http.clearToken();
  },

  async getCurrentUser(): Promise<User> {
    const res = await http.request<{ user: User }>('/auth/me');
    return res.user;
  },

  async getUsers(): Promise<User[]> {
    return http.request<User[]>('/users');
  },

  async createUser(data: any): Promise<User> {
    return http.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(id: string, data: any): Promise<User> {
    return http.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return http.request<{ success: boolean }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};
