import React, { useState, useEffect } from 'react';
import { Users, PlusCircle, ShieldAlert, ShieldCheck, UserCheck, Edit, Lock, Trash2 } from 'lucide-react';
import { User, Role } from '../types/index.ts';
import { api } from '../api/client.ts';
import { ConfirmationModal } from '../components/ConfirmationModal.tsx';

export const UserManagementView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('ADMIN');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load user list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const openCreate = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setRole('ADMIN');
    setPassword('');
    setError(null);
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setName(u.name);
    setEmail(u.email);
    setRole(u.role);
    setPassword('');
    setError(null);
    setShowModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name,
          role,
          ...(password ? { password } : {}),
        });
        setActionSuccess(`User account "${name}" updated successfully.`);
      } else {
        await api.createUser({
          name,
          email,
          role,
          password,
        });
        setActionSuccess(`User account "${name}" created successfully.`);
      }
      setShowModal(false);
      setTimeout(() => setActionSuccess(null), 4000);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Error saving user.');
    }
  };

  const toggleActive = async (u: User) => {
    setError(null);
    try {
      await api.updateUser(u.id, { isActive: !u.isActive });
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status.');
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteTargetUser) return;
    setDeletingId(deleteTargetUser.id);
    setError(null);
    try {
      await api.deleteUser(deleteTargetUser.id);
      setActionSuccess(`User "${deleteTargetUser.name}" deleted successfully.`);
      setDeleteTargetUser(null);
      setTimeout(() => setActionSuccess(null), 4000);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user.');
      throw err;
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users size={20} className="text-indigo-600" />
            <span>User Management & Role Permissions (Super Admin Access)</span>
          </h2>
          <p className="text-xs text-slate-500">
            Provision and manage Super Admin, Admin, and Viewer access credentials
          </p>
        </div>

        <button
          onClick={openCreate}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
        >
          <PlusCircle size={15} />
          <span>Create User</span>
        </button>
      </div>

      {error && !showModal && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-bold text-red-600 hover:text-red-900">×</button>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold text-slate-500 hover:text-slate-800">×</button>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-semibold">
            <tr>
              <th className="p-3">User Name</th>
              <th className="p-3">Email Address</th>
              <th className="p-3">Role</th>
              <th className="p-3">Created</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400 animate-pulse">
                  Querying security credentials...
                </td>
              </tr>
            )}

            {!loading &&
              users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{u.name}</td>
                  <td className="p-3 font-mono text-slate-700">{u.email}</td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-800'
                          : u.role === 'ADMIN'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {u.role === 'SUPER_ADMIN' ? 'Super Admin' : u.role === 'ADMIN' ? 'Admin' : 'Viewer'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">{u.createdAt.split('T')[0]}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.isActive
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-1.5">
                      <button
                        onClick={() => openEdit(u)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetUser(u)}
                        disabled={deletingId === u.id}
                        className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[11px] font-semibold transition-colors disabled:opacity-50"
                        title="Delete User Account"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingUser ? 'Edit User Credentials' : 'Provision User Account'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 text-xs">
              {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg">{error}</div>}

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-semibold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono disabled:bg-slate-100"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Authorised Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="SUPER_ADMIN">Super Admin / Owner (Full System Control)</option>
                  <option value="ADMIN">Admin (Full Operational Records Access)</option>
                  <option value="VIEWER">Viewer (Strict Read-Only Access)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {editingUser ? 'Change Password (Leave blank to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="h-9 px-4 border border-slate-300 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-sm transition-colors cursor-pointer"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(deleteTargetUser)}
        title="Delete User Account"
        itemName={deleteTargetUser ? `${deleteTargetUser.name} (${deleteTargetUser.email})` : ''}
        itemType="User Account"
        message={`Permanently delete user account "${deleteTargetUser?.name || ''}" (${deleteTargetUser?.email || ''})? This action cannot be undone.`}
        isLoading={Boolean(deleteTargetUser && deletingId === deleteTargetUser.id)}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setDeleteTargetUser(null)}
      />
    </div>
  );
};
