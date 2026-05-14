import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, query, orderBy, doc, updateDoc, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { Delivery, Customer, Invoice } from '../types';
import { Truck, CheckCircle, Clock, MapPin, Search, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function Deliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const dQuery = query(collection(db, 'deliveries'), orderBy('updatedAt', 'desc'));
    const unsubscribeDeliveries = onSnapshot(dQuery, 
      (snapshot) => {
        setDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'deliveries')
    );

    const unsubscribeCustomers = onSnapshot(collection(db, 'customers'), 
      (snapshot) => {
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    );

    const unsubscribeInvoices = onSnapshot(collection(db, 'invoices'), 
      (snapshot) => {
        setInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );

    return () => {
      unsubscribeDeliveries();
      unsubscribeCustomers();
      unsubscribeInvoices();
    };
  }, []);

  const updateStatus = async (id: string, newStatus: Delivery['status']) => {
    try {
      const deliveryRef = doc(db, 'deliveries', id);
      await updateDoc(deliveryRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const filteredDeliveries = deliveries.filter(d => 
    d.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: Delivery['status']) => {
    switch (status) {
      case 'Processing': return 'bg-slate-100 text-slate-600 border-slate-300';
      case 'Dispensing': return 'bg-blue-50 text-blue-600 border-blue-200';
      case 'In Transit': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'Delivered': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-8 border-b border-[#141414] bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold uppercase tracking-tighter leading-none mb-2">Hospital Deliveries</h2>
            <p className="text-[10px] font-mono uppercase opacity-50 tracking-widest">Active Logistics // Real-time Tracking</p>
          </div>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
            <input 
              type="text"
              placeholder="SEARCH BY INVOICE OR HOSPITAL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-[#141414] text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
            />
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 grid gap-6 grid-cols-1 xl:grid-cols-2">
        {filteredDeliveries.map((delivery) => (
          <div key={delivery.id} className="border-4 border-[#141414] bg-white shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] p-6 transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className={`text-[9px] font-bold uppercase px-2 py-1 border-2 mb-2 inline-block ${getStatusColor(delivery.status)}`}>
                  {delivery.status}
                </span>
                <h3 className="text-xl font-bold uppercase tracking-tighter">{delivery.customerName}</h3>
                <p className="text-[10px] font-mono opacity-50 uppercase mt-1">Ref: {delivery.invoiceNumber}</p>
              </div>
              <div className="p-3 bg-[#141414] text-[#E4E3E0]">
                <Truck className="h-5 w-5" />
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 text-[11px] font-mono uppercase">
                <MapPin className="h-4 w-4 opacity-40 shrink-0" />
                <span className="opacity-70">{delivery.location || 'Pending Dispatch Location'}</span>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-mono uppercase">
                <Clock className="h-4 w-4 opacity-40 shrink-0" />
                <span className="opacity-70">Updated: {delivery.updatedAt ? format(delivery.updatedAt.toDate(), 'HH:mm | MMM dd') : '---'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-[#141414]/10">
              {(['Processing', 'Dispensing', 'In Transit', 'Delivered'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(delivery.id, s)}
                  className={`text-[8px] font-bold uppercase py-2 border-2 transition-all ${
                    delivery.status === s 
                      ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' 
                      : 'border-[#141414]/10 hover:border-[#141414] opacity-40 hover:opacity-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ))}

        {filteredDeliveries.length === 0 && (
          <div className="col-span-full py-20 text-center border-4 border-dashed border-[#141414]/10">
            <p className="text-[10px] font-mono uppercase opacity-30">No active deliveries tracked in this view.</p>
          </div>
        )}
      </div>
    </div>
  );
}
