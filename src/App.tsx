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
import { Stethoscope, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

function AppContent() {
  const { user, signIn, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
            <Stethoscope className="h-12 w-12" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Mckasy Enterprise</h1>
          <p className="mb-8 text-slate-500">Inventory & Invoicing Management System</p>
          
          <button 
            onClick={() => signIn()}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-6 py-4 font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            <LogIn className="h-5 w-5" />
            Sign in with Google
          </button>
          
          <div className="mt-8 rounded-2xl bg-blue-50 p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">Developer Mode</p>
            <p className="text-xs text-blue-700 leading-relaxed">
              This system is built for B2B medical supply distribution. Use your Google account to access the dashboard.
            </p>
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
      default: return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
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
