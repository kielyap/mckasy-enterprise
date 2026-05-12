import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { Supplier } from '../types';
import { Plus, Search, Edit2, Trash2, Truck, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import ImportIntelligence from './ImportIntelligence';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof Supplier>('supplierName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const supplierSchema = `
    - supplierName (string, required): Official name of the medical supplier/distributor
    - contactInfo (string, optional): General contact information, notes, or branch details
  `;

  const { register, handleSubmit, reset, setValue } = useForm<Partial<Supplier>>();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'suppliers'), 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'suppliers')
    );
    return unsubscribe;
  }, []);

  const onSubmit = async (data: any) => {
    try {
      if (editingSupplier) {
        await updateDoc(doc(db, 'suppliers', editingSupplier.id), data);
      } else {
        await addDoc(collection(db, 'suppliers'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving supplier:", error);
    }
  };

  const openModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setValue('supplierName', supplier.supplierName);
      setValue('contactInfo', supplier.contactInfo);
    } else {
      setEditingSupplier(null);
      reset();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    reset();
    setEditingSupplier(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this supplier?")) {
      await deleteDoc(doc(db, 'suppliers', id));
    }
  };

  const handleSort = (field: keyof Supplier) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredSuppliers = suppliers
    .filter(s => s.supplierName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (aStr < bStr) return sortOrder === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-6">
      <div className="p-8 border-b border-[#141414] bg-white flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase leading-none italic">Sourcing Registry</h2>
          <p className="text-[10px] font-mono mt-2 opacity-50 uppercase tracking-widest leading-none">Medical Supply Chain Partners</p>
        </div>
        <div className="flex gap-4">
          <ImportIntelligence 
            collectionName="suppliers" 
            title="Suppliers" 
            schemaDetails={supplierSchema} 
          />
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 border-2 border-[#141414] bg-[#141414] px-4 py-2 text-[10px] font-bold uppercase text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] transition-all"
          >
            <Plus className="h-4 w-4" />
            Register Supplier
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#141414] opacity-40" />
          <input
            type="text"
            placeholder="SEARCH SUPPLIERS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-b-2 border-[#141414] bg-transparent py-4 pl-12 pr-4 text-sm font-bold uppercase tracking-tight focus:outline-none"
          />
        </div>

        <div className="border border-[#141414] bg-white">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-4 border-r border-[#E4E3E0]/10 cursor-pointer hover:bg-[#141414]/80 transition-colors" onClick={() => handleSort('supplierName')}>
                    <div className="flex items-center gap-1">
                        Entity Name {sortField === 'supplierName' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                </th>
                <th className="px-6 py-4 border-r border-[#E4E3E0]/10">Registry Records / Contact Details</th>
                <th className="px-6 py-4 text-center">Utility</th>
              </tr>
            </thead>
            <tbody className="text-[11px] font-mono font-medium divide-y divide-[#141414]">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-[#E4E3E0]/30 transition-colors">
                  <td className="px-6 py-8 border-r border-[#141414] align-top">
                    <p className="text-lg font-bold text-[#141414] uppercase tracking-tighter leading-none mb-2">{supplier.supplierName}</p>
                    <p className="text-[9px] uppercase font-bold opacity-30">Registered Entity ID: {supplier.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-6 py-8 border-r border-[#141414]">
                    <div className="text-xs uppercase font-bold text-[#141414]/70 leading-relaxed whitespace-pre-wrap">
                      {supplier.contactInfo}
                    </div>
                  </td>
                  <td className="px-6 py-8 align-top">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => openModal(supplier)} className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(supplier.id)} className="p-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="py-20 text-center border-t border-[#141414]/10 mx-8">
          <Truck className="mx-auto h-12 w-12 text-[#141414] opacity-10" />
          <p className="mt-4 text-[10px] font-bold uppercase opacity-40">No records found within active registry.</p>
        </div>
      )}

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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md border-4 border-[#141414] bg-white p-8 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="mb-8 flex items-center justify-between border-b border-[#141414] pb-4">
                <h3 className="text-xl font-bold uppercase tracking-tighter">
                   {editingSupplier ? 'Modify Registry' : 'Register Supplier'}
                </h3>
                <button onClick={closeModal} className="border border-[#141414] p-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                  <Plus className="h-4 w-4 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Supplier / Brand Name</label>
                  <input 
                    {...register('supplierName', { required: true })} 
                    placeholder="E.G. MED-LINE PHILS"
                    className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Contact Protocols / Info</label>
                  <textarea 
                    {...register('contactInfo')} 
                    rows={4} 
                    placeholder="E-MAIL, PHONE, BRANCH ADDRESS..."
                    className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20 resize-none" 
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={closeModal} 
                    className="flex-1 border-2 border-[#141414] py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-[#E4E3E0] transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 border-2 border-[#141414] bg-[#141414] py-3 text-[10px] font-bold uppercase tracking-widest text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] transition-all"
                  >
                    {editingSupplier ? 'Confirm Changes' : 'Register Source'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
