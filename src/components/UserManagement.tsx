import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, updateDoc, doc, deleteDoc, handleFirestoreError, OperationType, serverTimestamp } from '../lib/firebase';
import { AppUser } from '../types';
import { ShieldCheck, UserMinus, ShieldAlert, BadgeCheck, UserCog, Mail } from 'lucide-react';
import { motion } from 'motion/react';

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        setUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'users')
    );
    return unsubscribe;
  }, []);

  const toggleAuthorization = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isAuthorized: !currentStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const changeRole = async (userId: string, newRole: 'admin' | 'staff') => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const removeUser = async (userId: string, email: string) => {
    if (email === 'kielyap15@gmail.com') {
        alert("Cannot remove the master administrator.");
        return;
    }
    if (!window.confirm(`Are you sure you want to remove access for ${email}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-8 border-b border-[#141414] bg-white flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase leading-none italic">08 / Access Control</h2>
          <p className="text-[10px] font-mono mt-2 opacity-50 uppercase tracking-widest leading-none">Security & Permissions Management</p>
        </div>
      </div>

      <div className="p-8">
        <div className="border-[4px] border-[#141414] bg-white overflow-hidden shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest text-left">
                <th className="px-6 py-5 border-r border-[#E4E3E0]/10">Access Profile</th>
                <th className="px-6 py-5 border-r border-[#E4E3E0]/10 text-center">Identity</th>
                <th className="px-6 py-5 border-r border-[#E4E3E0]/10 text-center">Auth Status</th>
                <th className="px-6 py-5 border-r border-[#E4E3E0]/10 text-center">System Role</th>
                <th className="px-6 py-5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-mono font-bold uppercase divide-y-2 divide-[#141414]">
              {users.map((userNode) => (
                <tr key={userNode.id} className="hover:bg-[#E4E3E0]/30 transition-colors">
                  <td className="px-6 py-4 border-r-2 border-[#141414]">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 border-2 border-[#141414] bg-[#E4E3E0] flex items-center justify-center">
                            <BadgeCheck className={`h-5 w-5 ${userNode.isAuthorized ? 'text-blue-600' : 'text-gray-400 opacity-30'}`} />
                        </div>
                        <div>
                            <p className="text-xs font-bold leading-tight">{userNode.displayName}</p>
                            <p className="text-[9px] opacity-40 mt-1 flex items-center gap-1"><Mail className="h-3 w-3" /> {userNode.email}</p>
                        </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-r-2 border-[#141414] text-center font-mono opacity-50">
                    {userNode.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 border-r-2 border-[#141414] text-center">
                    <button 
                        onClick={() => toggleAuthorization(userNode.id, userNode.isAuthorized)}
                        disabled={userNode.email === 'kielyap15@gmail.com'}
                        className={`px-3 py-1 border-2 border-[#141414] text-[9px] transition-all font-bold ${
                            userNode.isAuthorized 
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                        } disabled:opacity-50`}
                    >
                      {userNode.isAuthorized ? 'AUTHORIZED' : 'ACCESS REVOKED'}
                    </button>
                  </td>
                  <td className="px-6 py-4 border-r-2 border-[#141414] text-center">
                    <select
                        value={userNode.role}
                        onChange={(e) => changeRole(userNode.id, e.target.value as any)}
                        disabled={userNode.email === 'kielyap15@gmail.com'}
                        className="bg-transparent border-b-2 border-[#141414] py-1 text-[10px] font-bold focus:outline-none disabled:opacity-50"
                    >
                        <option value="staff">STAFF</option>
                        <option value="admin">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                        <button 
                            onClick={() => removeUser(userNode.id, userNode.email)}
                            className="p-2 border-2 border-[#141414] hover:bg-red-500 hover:text-white transition-all text-red-500"
                            title="Remove Record"
                        >
                            <UserMinus className="h-4 w-4" />
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                    <td colSpan={5} className="py-20 text-center opacity-20 select-none">
                        <ShieldAlert className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <span className="text-xl font-bold italic tracking-tighter">NO ACCESS LOGS RECORDED</span>
                    </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-12 bg-[#141414] p-8 text-[#E4E3E0]">
            <div className="flex items-start gap-4">
                <UserCog className="h-6 w-6 text-blue-400 shrink-0 mt-1" />
                <div>
                    <h4 className="text-lg font-bold tracking-tighter uppercase italic mb-2">Master Override Protocol</h4>
                    <p className="text-[10px] font-mono opacity-60 leading-relaxed uppercase">
                        The role "kielyap15@gmail.com" is hard-coded as the master system administrator. 
                        Authorization logic requires an existing record in the identity ledger for any user attempt. 
                        Revoking authorization immediately terminates all session data access for that unique identity node.
                    </p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
