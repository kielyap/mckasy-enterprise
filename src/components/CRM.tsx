import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { Customer } from '../types';
import { Plus, Search, Edit2, Trash2, Users, Mail, Phone, MapPin, X, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import ImportIntelligence from './ImportIntelligence';

export default function CRM() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const customerSchema = `
    - companyName (string, required): Full legal name of the hospital, clinic, or business
    - contactName (string, required): Primary contact person at the company
    - address (string, optional): Full physical address
    - phone (string, optional): Primary telephone or mobile number
    - email (string, optional): Official email address for billing/comms
    - fax (string, optional): Fax number if available
  `;

  const { register, handleSubmit, reset, setValue } = useForm<Partial<Customer>>();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'customers'), 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        setCustomers(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    );
    return unsubscribe;
  }, []);

  const onSubmit = async (data: any) => {
    try {
      if (editingCustomer) {
        await updateDoc(doc(db, 'customers', editingCustomer.id), data);
      } else {
        await addDoc(collection(db, 'customers'), {
          ...data,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving customer:", error);
    }
  };

  const openModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setValue('companyName', customer.companyName);
      setValue('contactName', customer.contactName);
      setValue('address', customer.address);
      setValue('phone', customer.phone);
      setValue('fax', customer.fax || '');
      setValue('email', customer.email);
    } else {
      setEditingCustomer(null);
      reset();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    reset();
    setEditingCustomer(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this customer?")) {
      await deleteDoc(doc(db, 'customers', id));
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contactName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="p-8 border-b border-[#141414] bg-white flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase leading-none italic">03 / CRM Database</h2>
          <p className="text-[10px] font-mono mt-2 opacity-50 uppercase tracking-widest leading-none">Hospital & Clinic Partner Registry</p>
        </div>
        <div className="flex gap-4">
          <ImportIntelligence 
            collectionName="customers" 
            title="Partners" 
            schemaDetails={customerSchema} 
          />
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 border-2 border-[#141414] bg-[#141414] px-4 py-2 text-[10px] font-bold uppercase text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] transition-all"
          >
            <Plus className="h-4 w-4" />
            Add New Partner
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#141414] opacity-40" />
          <input
            type="text"
            placeholder="SEARCH PARTNERS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-b-2 border-[#141414] bg-transparent py-4 pl-12 pr-4 text-sm font-bold uppercase tracking-tight focus:outline-none"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <motion.div
              key={customer.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative flex flex-col justify-between h-full bg-white border border-[#141414] p-6 transition-all hover:bg-[#E4E3E0]/30 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:shadow-none translate-x-[-2px] translate-y-[-2px] hover:translate-x-0 hover:translate-y-0"
            >
              <div>
                <div className="mb-6 flex items-start justify-between">
                  <div className="h-10 w-10 border border-[#141414] bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-bold text-sm">
                    {customer.companyName.charAt(0)}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openModal(customer)} className="p-1.5 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDelete(customer.id)} className="p-1.5 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-[#141414] uppercase tracking-tighter leading-tight mb-1">{customer.companyName}</h3>
                <p className="text-[10px] font-mono font-bold uppercase opacity-40 mb-6">{customer.contactName}</p>

                <div className="space-y-3 text-[11px] font-mono font-medium">
                  {customer.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-3 w-3 opacity-40 shrink-0" />
                      <span className="truncate">{customer.email.toLowerCase()}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-3 w-3 opacity-40 shrink-0" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.fax && (
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-bold opacity-40 shrink-0">FAX</span>
                      <span>{customer.fax}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-3 w-3 opacity-40 shrink-0 mt-0.5" />
                      <span className="line-clamp-2 uppercase leading-tight">{customer.address}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-8 pt-4 border-t border-[#141414]/10 flex justify-between items-center text-[9px] font-mono opacity-40 uppercase">
                 <span>ID: {customer.id.slice(0, 8)}</span>
                 <span>Active Partner</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {filteredCustomers.length === 0 && (
        <div className="py-20 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-200" />
          <p className="mt-4 text-slate-500">No customers found.</p>
        </div>
      )}

      {/* Modal code similar to Inventory */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg border-4 border-[#141414] bg-white p-8 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="mb-8 flex items-center justify-between border-b border-[#141414] pb-4">
                <h3 className="text-xl font-bold uppercase tracking-tighter">
                  {editingCustomer ? 'Modify Partner' : 'Register New Partner'}
                </h3>
                <button onClick={closeModal} className="border border-[#141414] p-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Company Name</label>
                      <input
                        {...register('companyName', { required: true })}
                        placeholder="E.G. ST. LUKE'S MEDICAL"
                        className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Contact Person</label>
                      <input
                        {...register('contactName', { required: true })}
                        placeholder="E.G. DR. JANE SMITH"
                        className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">E-mail Address</label>
                      <input
                        type="email"
                        {...register('email')}
                        placeholder="CONTACT@PARTNER.COM"
                        className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Phone Number</label>
                      <input
                        {...register('phone')}
                        placeholder="+63 9XX XXX XXXX"
                        className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Fax Line (Optional)</label>
                      <input
                        {...register('fax')}
                        placeholder="E.G. 8376-XXXX"
                        className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Registered Address</label>
                    <textarea
                      {...register('address')}
                      rows={3}
                      placeholder="COMPLETE FACILITY ADDRESS"
                      className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20 resize-none"
                    />
                  </div>
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
                    {editingCustomer ? 'Confirm Changes' : 'Register Partner'}
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
