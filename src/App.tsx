/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './components/AuthContext';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import CRM from './components/CRM';
import Suppliers from './components/Suppliers';
import Inventory from './components/Inventory';
import Invoices from './components/Invoices';
import Deliveries from './components/Deliveries';
import Purchases from './components/Purchases';
import UserManagement from './components/UserManagement';
import ErrorBoundary from './components/ErrorBoundary';
import { Stethoscope, LogIn, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

function AppContent() {
  const { user, signIn, loading, isAuthorized } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E4E3E0]">
        <div className="h-10 w-10 animate-spin border-4 border-[#141414] border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#E4E3E0] p-4 text-[#141414]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md border-4 border-[#141414] bg-white p-12 text-center shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
        >
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center border-4 border-[#141414] bg-[#141414] text-[#E4E3E0]">
            <Stethoscope className="h-12 w-12" />
          </div>
          <h1 className="mb-2 text-3xl font-bold uppercase tracking-tighter italic">Mckasy Enterprise</h1>
          <p className="mb-10 text-[10px] uppercase font-bold opacity-50 tracking-widest">Medical Supply Distribution System</p>
          
          <button 
            onClick={() => signIn()}
            className="flex w-full items-center justify-center gap-3 border-4 border-[#141414] bg-[#141414] px-6 py-4 text-xs font-bold uppercase text-[#E4E3E0] transition-all hover:bg-white hover:text-[#141414] active:scale-[0.98]"
          >
            <LogIn className="h-5 w-5" />
            Authenticate via Google
          </button>
        </motion.div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full border-4 border-[#141414] bg-white p-12 text-center shadow-[16px_16px_0px_0px_rgba(20,20,20,1)]"
        >
          <div className="flex justify-center mb-8">
            <div className="bg-red-50 p-4 border-2 border-red-500 rounded-full">
                <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
          </div>
          <h2 className="text-3xl font-bold uppercase tracking-tighter mb-4 italic">Access Denied</h2>
          <p className="text-xs font-bold uppercase opacity-50 mb-8 leading-relaxed">
            Your account is currently pending authorization. The master administrator must grant you access before you can proceed.
          </p>
          <div className="bg-[#141414] text-[#E4E3E0] p-4 text-[10px] font-mono font-bold uppercase overflow-hidden text-ellipsis border-2 border-red-500">
            SEC_ERROR: UNAUTHORIZED_IDENTITY
          </div>
        </motion.div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'customers': return <CRM />;
      case 'suppliers': return <Suppliers />;
      case 'inventory': return <Inventory />;
      case 'invoices': return <Invoices />;
      case 'deliveries': return <Deliveries />;
      case 'purchases': return <Purchases />;
      case 'users': return <UserManagement />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <ErrorBoundary>
        {renderContent()}
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
