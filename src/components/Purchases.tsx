import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, handleFirestoreError, OperationType, Timestamp, deleteDoc, doc } from '../lib/firebase';
import { Purchase, Supplier } from '../types';
import { Plus, Search, ShoppingBag, Trash2, Calendar, FileText, Hash, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useForm } from 'react-hook-form';
import ImportIntelligence from './ImportIntelligence';

export default function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const purchaseSchema = `
    - date (string, required): Transaction date in YYYY-MM-DD or standard format
    - supplierName (string, required): Name of the supplier (e.g. "ALTCARE")
    - amount (number, required): Total purchase amount in PHP (e.g. 1500.25)
    - orNo (string, optional): Official Receipt Number (e.g. "OR-1234")
    - invoiceNo (string, optional): Supplier's Invoice Number (e.g. "INV-5678")
    - memo (string, optional): Additional details or items list
  `;

  const { register, handleSubmit, reset } = useForm<Partial<Purchase>>();

  useEffect(() => {
    // Fetch suppliers for the dropdown
    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });

    // Fetch purchases
    const qPurchases = query(collection(db, 'purchases'), orderBy('date', 'desc'));
    const unsubPurchases = onSnapshot(qPurchases, 
      (snapshot) => {
        setPurchases(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Purchase)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'purchases')
    );

    return () => {
      unsubSuppliers();
      unsubPurchases();
    };
  }, []);

  const onSubmit = async (data: any) => {
    try {
      const supplier = suppliers.find(s => s.id === data.supplierId);
      if (!supplier) return;

      const payload = {
        date: Timestamp.fromDate(new Date(data.date)),
        supplierId: data.supplierId,
        supplierName: supplier.supplierName,
        orNo: data.orNo || '',
        invoiceNo: data.invoiceNo || '',
        amount: Number(data.amount),
        memo: data.memo || '',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'purchases'), payload);
      closeModal();
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'purchases');
    }
  };

  const deletePurchase = async (id: string) => {
    if (!window.confirm('Delete this purchase record?')) return;
    try {
      await deleteDoc(doc(db, 'purchases', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `purchases/${id}`);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    reset();
  };

  const filteredPurchases = purchases.filter(p => 
    p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.orNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPurchaseAmount = filteredPurchases.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="p-8 border-b border-[#141414] bg-white flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase leading-none italic">03 / Purchase History</h2>
          <p className="text-[10px] font-mono mt-2 opacity-50 uppercase tracking-widest leading-none">Supplier Acquisitions & Expense Ledger</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="px-4 py-2 border-2 border-[#141414] bg-[#E4E3E0] flex flex-col justify-center">
                <span className="text-[8px] font-bold opacity-50 uppercase">Total Procurement</span>
                <span className="text-sm font-mono font-bold">₱{totalPurchaseAmount.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
                <ImportIntelligence 
                    collectionName="purchases" 
                    title="Ledger" 
                    schemaDetails={purchaseSchema} 
                />
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center justify-center gap-2 border-2 border-[#141414] bg-[#141414] px-6 py-2 text-[10px] font-bold uppercase text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] transition-all"
                >
                    <Plus className="h-4 w-4" />
                    Record Purchase
                </button>
            </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#141414] opacity-40" />
          <input
            type="text"
            placeholder="FILTER BY SUPPLIER, OR#, OR INVOICE#..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-b-2 border-[#141414] bg-transparent py-4 pl-12 pr-4 text-sm font-bold uppercase tracking-tight focus:outline-none"
          />
        </div>

        <div className="border border-[#141414] bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-4 border-r border-[#E4E3E0]/10">Date</th>
                <th className="px-6 py-4 border-r border-[#E4E3E0]/10">Supplier / Vendor</th>
                <th className="px-6 py-4 border-r border-[#E4E3E0]/10 text-center">OR NO.</th>
                <th className="px-6 py-4 border-r border-[#E4E3E0]/10 text-center">Inv No.</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center w-16"></th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-mono font-medium divide-y divide-[#141414]">
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="hover:bg-[#E4E3E0]/30 transition-colors group">
                  <td className="px-6 py-4 border-r border-[#141414]">
                    {purchase.date ? format(purchase.date.toDate(), 'yyyy-MM-dd') : '---'}
                  </td>
                  <td className="px-6 py-4 border-r border-[#141414]">
                    <p className="text-xs font-bold uppercase tracking-tighter">{purchase.supplierName}</p>
                    {purchase.memo && <p className="text-[9px] opacity-40 mt-1 uppercase">{purchase.memo}</p>}
                  </td>
                  <td className="px-6 py-4 border-r border-[#141414] text-center font-bold">
                    {purchase.orNo || '---'}
                  </td>
                  <td className="px-6 py-4 border-r border-[#141414] text-center font-bold">
                    {purchase.invoiceNo || '---'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-bold">
                    ₱{purchase.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                        onClick={() => deletePurchase(purchase.id)}
                        className="p-1.5 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPurchases.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center uppercase opacity-30 font-bold tracking-widest">
                        No purchase records found
                    </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-[#E4E3E0]/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md border-4 border-[#141414] bg-white p-8 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="mb-8 flex items-center justify-between border-b border-[#141414] pb-4">
                <h3 className="text-xl font-bold uppercase tracking-tighter">Record Supplier Purchase</h3>
                <button onClick={closeModal} className="p-1 hover:bg-[#E4E3E0]"><Plus className="h-5 w-5 rotate-45" /></button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Procurement Date
                        </label>
                        <input 
                            type="date" 
                            {...register('date', { required: true })}
                            className="w-full border-2 border-[#141414] p-3 text-xs font-bold uppercase focus:bg-[#E4E3E0]/30 focus:outline-none" 
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1">
                            <ShoppingBag className="h-3 w-3" /> Supplier
                        </label>
                        <select 
                            {...register('supplierId', { required: true })}
                            className="w-full border-2 border-[#141414] p-3 text-xs font-bold uppercase focus:bg-[#E4E3E0]/30 focus:outline-none"
                        >
                            <option value="">SELECT...</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1">
                            <Hash className="h-3 w-3" /> Official Receipt #
                        </label>
                        <input 
                            {...register('orNo')}
                            className="w-full border-2 border-[#141414] p-3 text-xs font-bold uppercase focus:bg-[#E4E3E0]/30 focus:outline-none" 
                            placeholder="OR-XXXXXX"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1">
                            <FileText className="h-3 w-3" /> Supplier Invoice #
                        </label>
                        <input 
                            {...register('invoiceNo')}
                            className="w-full border-2 border-[#141414] p-3 text-xs font-bold uppercase focus:bg-[#E4E3E0]/30 focus:outline-none" 
                            placeholder="INV-XXXXXX"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1">
                        Amount Paid (PHP)
                    </label>
                    <input 
                        type="number" 
                        step="0.01"
                        {...register('amount', { required: true })}
                        className="w-full border-2 border-[#141414] p-3 text-sm font-mono font-bold uppercase focus:bg-[#E4E3E0]/30 focus:outline-none" 
                        placeholder="0.00"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[9px] font-bold uppercase opacity-50 flex items-center gap-1">
                        Memo / Details
                    </label>
                    <textarea 
                        {...register('memo')}
                        className="w-full border-2 border-[#141414] p-3 text-xs font-bold uppercase focus:bg-[#E4E3E0]/30 focus:outline-none resize-none" 
                        placeholder="ITEMS PURCHASED OR NOTES..."
                        rows={2}
                    />
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 border-2 border-[#141414] py-3 text-[10px] font-bold uppercase hover:bg-[#E4E3E0] transition-all">Cancel</button>
                  <button type="submit" className="flex-1 border-2 border-[#141414] bg-[#141414] text-[#E4E3E0] py-3 text-[10px] font-bold uppercase hover:opacity-90 transition-all">Commit Record</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
