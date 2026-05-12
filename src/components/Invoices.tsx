import React, { useState, useEffect } from 'react';
import { 
  db, 
  collection, 
  onSnapshot, 
  serverTimestamp, 
  writeBatch, 
  doc, 
  addDoc,
  getDocs,
  query,
  where,
  increment,
  Timestamp,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { Invoice, InvoiceItem, Customer, Product } from '../types';
import { Plus, Search, FileText, ChevronRight, X, User, ShoppingBag, Terminal, Trash2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import ImportIntelligence from './ImportIntelligence';

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState<Invoice | null>(null);
  const [detailItems, setDetailItems] = useState<InvoiceItem[]>([]);

  const invoiceSchema = `
    - customerName (string, required): Existing partner entity name (e.g. "ST. LUKE'S")
    - type (string, optional): "Invoice" or "Delivery Receipt" (default: "Delivery Receipt")
    - totalAmount (number, required): Gross sales amount (e.g. 50000.00)
    - totalCost (number, optional): Total procurement cost for profit calc
    - status (string, optional): "Paid" or "Unpaid" (default: "Unpaid")
    - purchaseOrderNo (string, optional): PO reference
    - projectDescription (string, optional): Project notes
  `;

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceType, setInvoiceType] = useState<'Invoice' | 'Delivery Receipt'>('Delivery Receipt');
  const [poNumber, setPoNumber] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [lineItems, setLineItems] = useState<Partial<InvoiceItem>[]>([
    { productId: '', productNo: '', quantity: 1, unitPrice: 0, lineTotal: 0 }
  ]);

  useEffect(() => {
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
        setInvoices(items.sort((a, b) => {
          const dateA = a.date instanceof Timestamp ? a.date.seconds : 0;
          const dateB = b.date instanceof Timestamp ? b.date.seconds : 0;
          return dateB - dateA;
        }));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices')
    );
    const unsubCustomers = onSnapshot(collection(db, 'customers'), 
      (snapshot) => {
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'customers')
    );
    const unsubProducts = onSnapshot(collection(db, 'products'), 
      (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    return () => {
      unsubInvoices();
      unsubCustomers();
      unsubProducts();
    };
  }, []);

  useEffect(() => {
    if (showInvoiceDetails) {
      const itemsRef = collection(db, 'invoices', showInvoiceDetails.id, 'items');
      const unsubscribe = onSnapshot(itemsRef, 
        (snapshot) => {
          setDetailItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InvoiceItem)));
        },
        (error) => handleFirestoreError(error, OperationType.LIST, `invoices/${showInvoiceDetails.id}/items`)
      );
      return unsubscribe;
    } else {
      setDetailItems([]);
    }
  }, [showInvoiceDetails]);

  const addLineItem = () => {
    setLineItems([...lineItems, { productId: '', quantity: 1, unitPrice: 0, lineTotal: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const newItems = [...lineItems];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        item.unitPrice = product.sellingPrice;
        item.itemName = product.itemName;
        item.purchasePrice = product.purchasePrice;
        item.productNo = product.productNo || '';
      }
    }

    item.lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
    newItems[index] = item;
    setLineItems(newItems);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
  const totalCost = lineItems.reduce((sum, item) => {
    return sum + ((item.purchasePrice || 0) * (item.quantity || 0));
  }, 0);
  const totalProfit = totalAmount - totalCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || lineItems.some(i => !i.productId)) {
      alert("Please select a customer and products for all line items.");
      return;
    }

    const batch = writeBatch(db);
    const invoiceId = `INV-${Date.now()}`;
    const invoiceRef = doc(collection(db, 'invoices'));

    const invoiceData = {
      invoiceNumber: invoiceId,
      type: invoiceType,
      date: serverTimestamp(),
      customerId: selectedCustomerId,
      customerName: customers.find(c => c.id === selectedCustomerId)?.companyName || '',
      projectDescription,
      purchaseOrderNo: poNumber,
      totalAmount,
      totalCost,
      profit: totalProfit,
      status: 'Unpaid',
      createdAt: serverTimestamp()
    };

    try {
      // 1. Create Invoice
      batch.set(invoiceRef, invoiceData);

      // 2. Create Items and Update Inventory
      for (const item of lineItems) {
        if (!item.productId) continue;
        
        const itemRef = doc(collection(invoiceRef, 'items'));
        batch.set(itemRef, {
          productId: item.productId,
          productNo: item.productNo || '',
          itemName: item.itemName,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          purchasePrice: Number(item.purchasePrice),
          lineTotal: Number(item.lineTotal)
        });

        const productRef = doc(db, 'products', item.productId);
        // CRITICAL: Auto-deduct inventory
        batch.update(productRef, {
          currentStock: increment(-Number(item.quantity)),
          updatedAt: serverTimestamp()
        });
      }

      // 3. Create Delivery Tracker
      const deliveryRef = doc(collection(db, 'deliveries'));
      const customer = customers.find(c => c.id === selectedCustomerId);
      batch.set(deliveryRef, {
        invoiceId: invoiceRef.id,
        invoiceNumber: invoiceId,
        customerId: selectedCustomerId,
        customerName: customer?.companyName || 'UNKNOWN',
        status: 'Processing',
        location: 'Warehouse / Prep',
        updatedAt: serverTimestamp()
      });

      await batch.commit();
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'invoices');
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteInvoice = async (id: string) => {
    try {
      const batch = writeBatch(db);
      
      // 1. Delete the invoice document
      batch.delete(doc(db, 'invoices', id));

      // 2. Delete associated delivery records
      const q = query(collection(db, 'deliveries'), where('invoiceId', '==', id));
      const deliverySnap = await getDocs(q);
      deliverySnap.forEach(d => batch.delete(d.ref));

      // 3. Delete items subcollection
      const itemsSnap = await getDocs(collection(db, 'invoices', id, 'items'));
      itemsSnap.forEach(item => batch.delete(item.ref));

      await batch.commit();
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `invoices/${id}`);
    }
  };

  const resetForm = () => {
    setSelectedCustomerId('');
    setInvoiceType('Delivery Receipt');
    setPoNumber('');
    setProjectDescription('');
    setLineItems([{ productId: '', productNo: '', quantity: 1, unitPrice: 0, lineTotal: 0 }]);
  };

  return (
    <div className="space-y-6">
      <div className="p-8 border-b border-[#141414] bg-white flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase leading-none italic">04 / Sales & Billing</h2>
          <p className="text-[10px] font-mono mt-2 opacity-50 uppercase tracking-widest leading-none">Revenue Stream & Stock Reconcile</p>
        </div>
        <div className="flex gap-4">
          <ImportIntelligence 
            collectionName="invoices" 
            title="Bulk Invoices" 
            schemaDetails={invoiceSchema} 
          />
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-2 border-2 border-[#141414] bg-[#141414] px-4 py-2 text-[10px] font-bold uppercase text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] transition-all"
          >
            <Plus className="h-4 w-4" />
            Create New Invoice
          </button>
        </div>
      </div>

      <div className="p-8 space-y-6">
        <div className="grid gap-6">
          {invoices.map((invoice) => {
            const customer = customers.find(c => c.id === invoice.customerId);
            const isPaid = invoice.status === 'Paid';
            return (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-[#141414] p-6 transition-all hover:bg-[#E4E3E0]/30 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:shadow-none translate-x-[-2px] translate-y-[-2px] hover:translate-x-0 hover:translate-y-0 cursor-pointer"
                onClick={() => setShowInvoiceDetails(invoice)}
              >
                <div className="flex items-center gap-6 mb-4 sm:mb-0">
                  <div className={`flex h-12 w-12 items-center justify-center border border-[#141414] font-bold ${isPaid ? 'bg-emerald-500 text-white' : 'bg-[#141414] text-[#E4E3E0]'}`}>
                    {isPaid ? 'OK' : 'PD'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold uppercase tracking-tighter leading-none">{invoice.invoiceNumber}</p>
                      <span className="text-[8px] border border-[#141414] px-1 opacity-60 font-bold whitespace-nowrap">{invoice.type === 'Delivery Receipt' ? 'DR' : 'INV'}</span>
                    </div>
                    <p className="text-[10px] font-mono font-bold uppercase opacity-50">{customer?.companyName || 'TERMINATED ENTITY'}</p>
                  </div>
                </div>
                <div className="flex flex-row sm:flex-col items-end justify-between sm:justify-center gap-3 text-right">
                  <p className="text-lg font-bold font-mono tracking-tighter">₱{invoice.totalAmount.toLocaleString()}</p>
                  <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono opacity-40 uppercase">{invoice.date ? format(invoice.date.toDate(), 'yyyy-MM-dd') : 'PENDING'}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 border border-[#141414] uppercase leading-none ${isPaid ? 'bg-emerald-500 text-white' : 'bg-transparent text-[#141414]'}`}>
                          {invoice.status}
                      </span>
                      <div className="flex items-center gap-2">
                        {deletingId === invoice.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteInvoice(invoice.id);
                              }}
                              className="px-2 py-1 bg-red-600 text-white text-[8px] font-bold uppercase"
                            >
                              CONFIRM
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(null);
                              }}
                              className="px-2 py-1 border border-[#141414] text-[#141414] text-[8px] font-bold uppercase"
                            >
                              CANCEL
                            </button>
                          </div>
                        ) : (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setDeletingId(invoice.id);
                            }}
                            className="p-2 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-all sm:opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-sm"
                            title="Delete Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {invoices.length === 0 && (
          <div className="py-20 text-center border border-dashed border-[#141414]/20">
            <FileText className="mx-auto h-12 w-12 opacity-10" />
            <p className="mt-4 text-[10px] font-bold uppercase opacity-40 italic">System Idle: Waiting for transactional data...</p>
          </div>
        )}
      </div>

      {/* Slide-over Form */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="absolute inset-0 bg-[#E4E3E0]/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative flex h-full w-full max-w-2xl flex-col bg-white border-l border-[#141414] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#141414] bg-white p-8">
                <div>
                    <h3 className="text-2xl font-bold uppercase tracking-tighter">New Registry Entry</h3>
                    <p className="text-[10px] font-mono font-bold opacity-40">AUTOGEN ID: INV-{Date.now().toString().slice(-6)}</p>
                </div>
                <button onClick={() => setIsFormOpen(false)} className="border border-[#141414] p-1.5 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                {/* Header Info */}
                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Document Type</label>
                    <select 
                      value={invoiceType}
                      onChange={(e) => setInvoiceType(e.target.value as any)}
                      className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                    >
                      <option value="Delivery Receipt">Delivery Receipt</option>
                      <option value="Invoice">Official Invoice</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Customer / Facility</label>
                    <select 
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      required
                      className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                    >
                      <option value="">-- SELECT CLIENT ENTITY --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.companyName.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Purchase Order Ref #</label>
                    <input 
                      type="text"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                      placeholder="PO-XXXXX-2024"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Project Description / Notes</label>
                    <input 
                      type="text"
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      className="w-full border-2 border-[#141414] bg-white p-3 text-xs font-bold uppercase tracking-tight focus:outline-none focus:bg-[#E4E3E0]/20"
                      placeholder="HOSPITAL WING B SUPPLY..."
                    />
                  </div>
                </div>

                {/* Line Items */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                    <div>
                        <label className="text-[10px] font-mono font-bold uppercase opacity-50 block">Transaction Line Items</label>
                        {lineItems.length >= 25 && <span className="text-[8px] text-red-600 font-bold animate-pulse uppercase">Maximum capacity reached (25 Items)</span>}
                    </div>
                    <button 
                        type="button" 
                        onClick={addLineItem} 
                        disabled={lineItems.length >= 25}
                        className="text-[10px] font-mono font-bold text-[#141414] hover:underline flex items-center gap-1 uppercase disabled:opacity-20 disabled:no-underline"
                    >
                        <Plus className="h-3 w-3" /> Append Item
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-4 items-end bg-[#E4E3E0]/20 p-6 border-2 border-[#141414]">
                        <div className="col-span-12 lg:col-span-6">
                          <label className="text-[8px] font-mono font-bold uppercase opacity-40 mb-1 block">Inventory Asset</label>
                          <select 
                            value={item.productId}
                            onChange={(e) => updateLineItem(index, 'productId', e.target.value)}
                            required
                            className="w-full border border-[#141414] bg-white p-2 text-xs font-bold uppercase"
                          >
                            <option value="">CHOOSE ASSET...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id} disabled={p.currentStock <= 0}>
                                {p.itemName.toUpperCase()} / STOCK: {p.currentStock}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-4 lg:col-span-2">
                          <label className="text-[8px] font-mono font-bold uppercase opacity-40 mb-1 block">Unit(s)</label>
                          <input 
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                            className="w-full border border-[#141414] bg-white p-2 text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-5 lg:col-span-3">
                          <label className="text-[8px] font-mono font-bold uppercase opacity-40 mb-1 block">Calculated Line Total</label>
                          <p className="p-2 text-xs font-mono font-bold text-[#141414]">₱{item.lineTotal?.toLocaleString()}</p>
                        </div>
                        <div className="col-span-3 lg:col-span-1 flex justify-end pb-1.5">
                           <button type="button" onClick={() => removeLineItem(index)} className="p-2 border border-[#141414] hover:bg-red-500 hover:text-white transition-all">
                             <X className="h-3 w-3" />
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>

              <div className="border-t-2 border-[#141414] bg-[#141414] p-8 text-[#E4E3E0]">
                <div className="mb-8 space-y-3">
                  <div className="flex justify-between text-[10px] font-mono uppercase opacity-50">
                    <span>Gross Revenue Total</span>
                    <span>₱{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-mono uppercase text-emerald-400">
                    <span>Projected Operational Profit</span>
                    <span className="font-bold underline underline-offset-4">₱{totalProfit.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2">
                    <span className="text-[12px] font-bold uppercase tracking-widest">Total Payable</span>
                    <span className="text-3xl font-bold font-mono tracking-tighter">₱{totalAmount.toLocaleString()}</span>
                  </div>
                </div>
                <button 
                  onClick={handleSubmit} 
                  className="w-full border-2 border-[#E4E3E0] bg-[#E4E3E0] py-4 text-center text-[10px] font-bold uppercase tracking-widest text-[#141414] hover:bg-transparent hover:text-[#E4E3E0] transition-all flex items-center justify-center gap-3"
                >
                  <FileText className="h-4 w-4" />
                  Execute Transaction & Reconcile Stock
                </button>
                <p className="mt-4 text-[8px] font-mono uppercase opacity-30 text-center leading-none tracking-tight">
                  BATCH STATUS: READY // ATOMIC WRITE ENABLED // FISCAL YEAR 2024
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Details Modal */}
      <AnimatePresence>
        {showInvoiceDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowInvoiceDetails(null)}
              className="absolute inset-0 bg-[#E4E3E0]/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl border-4 border-[#141414] bg-white shadow-[16px_16px_0px_0px_rgba(20,20,20,1)] overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b-2 border-[#141414] flex items-start justify-between bg-white text-[#141414]">
                <div className="space-y-1">
                  <h3 className="text-3xl font-bold uppercase tracking-tighter leading-none">MCKASY ENTERPRISE</h3>
                  <div className="text-[10px] font-mono uppercase opacity-60 leading-tight">
                    <p>31D Marinduque St., Quezon City</p>
                    <p>mckasyent@gmail.com</p>
                    <p>(02) 8376-7802 / 0960 867 0024</p>
                  </div>
                </div>
                <div className="text-right">
                  <h4 className="text-xl font-bold uppercase tracking-tighter leading-none mb-1">
                    {showInvoiceDetails.type || 'DELIVERY RECEIPT'}
                  </h4>
                  <div className="text-[10px] font-mono uppercase opacity-60">
                    <p>Receipt No: {showInvoiceDetails.invoiceNumber.slice(-6)}</p>
                    <p>Date: {showInvoiceDetails.date ? format(showInvoiceDetails.date.toDate(), 'MM/dd/yyyy') : '---'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowInvoiceDetails(null)} 
                  className="absolute top-4 right-4 border border-[#141414] p-1 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all print:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar">
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono font-bold uppercase opacity-40 border-b border-[#141414]/10 pb-1">TO:</h4>
                    <p className="text-lg font-bold uppercase tracking-tight leading-tight">
                      {customers.find(c => c.id === showInvoiceDetails.customerId)?.companyName || 'UNKNOWN ENTITY'}
                    </p>
                    <div className="text-[10px] font-mono opacity-50 uppercase leading-relaxed">
                      <p>Phone: {customers.find(c => c.id === showInvoiceDetails.customerId)?.phone || '---'}</p>
                      <p>Fax: {customers.find(c => c.id === showInvoiceDetails.customerId)?.fax || '---'}</p>
                      <p className="mt-2 text-[11px] font-bold text-[#141414]">{customers.find(c => c.id === showInvoiceDetails.customerId)?.address || 'NO ADDRESS RECORDED'}</p>
                      {showInvoiceDetails.projectDescription && (
                        <div className="mt-4 p-2 bg-[#E4E3E0]/30 border-l-2 border-[#141414]">
                          <p className="text-[8px] font-bold opacity-40">PROJECT DESC:</p>
                          <p className="text-[10px] font-bold text-[#141414]">{showInvoiceDetails.projectDescription}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-mono font-bold uppercase opacity-40 border-b border-[#141414]/10 pb-1">Reference Info</h4>
                    <div className="space-y-2 text-[11px] font-mono uppercase">
                      <div className="flex justify-between font-bold">
                        <span>PO Number:</span>
                        <span>{showInvoiceDetails.purchaseOrderNo || 'NONE'}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Payment Status:</span>
                        <span className={showInvoiceDetails.status === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}>
                          {showInvoiceDetails.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border-t-2 border-b-2 border-[#141414]">
                    <table className="w-full text-left text-[11px] font-mono">
                      <thead>
                        <tr className="font-bold uppercase border-b border-[#141414]">
                          <th className="px-4 py-2 border-r border-[#141414] w-24">Product No</th>
                          <th className="px-4 py-2 border-r border-[#141414]">Item Description</th>
                          <th className="px-4 py-2 border-r border-[#141414] text-center w-24">Quantity</th>
                          <th className="px-4 py-2 border-r border-[#141414] text-right w-32">Unit Price</th>
                          <th className="px-4 py-2 text-right w-32">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-[#141414]/10">
                            <td className="px-4 py-3 border-r border-[#141414]/10 uppercase">{item.productNo || '---'}</td>
                            <td className="px-4 py-3 border-r border-[#141414]/10 uppercase font-bold">{item.itemName}</td>
                            <td className="px-4 py-3 border-r border-[#141414]/10 text-center">{item.quantity}</td>
                            <td className="px-4 py-3 border-r border-[#141414]/10 text-right">₱{item.unitPrice.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">₱{item.lineTotal.toLocaleString()}</td>
                          </tr>
                        ))}
                        {detailItems.length === 0 && (
                          <tr className="border-b border-[#141414]/10">
                            <td className="px-4 py-3 border-r border-[#141414]/10">---</td>
                            <td className="px-4 py-3 border-r border-[#141414]/10">Loading line items...</td>
                            <td className="px-4 py-3 border-r border-[#141414]/10 text-center">---</td>
                            <td className="px-4 py-3 border-r border-[#141414]/10 text-right">---</td>
                            <td className="px-4 py-3 text-right">---</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-start pt-10">
                  <div className="w-64 space-y-8">
                     <div className="border-t border-[#141414] pt-2">
                        <p className="text-[10px] font-bold uppercase">Received By:</p>
                        <div className="h-10"></div>
                        <p className="text-[9px] font-mono opacity-50">Signature / Printed Name / Date</p>
                     </div>
                  </div>
                  <div className="text-right space-y-2">
                    <div className="flex justify-between gap-20 text-[10px] font-mono uppercase opacity-60">
                      <span>Total Sales</span>
                      <span>₱{showInvoiceDetails.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-20 text-[10px] font-mono uppercase opacity-60">
                      <span>Percentage Tax (1%)</span>
                      <span>₱{(showInvoiceDetails.totalAmount * 0.01).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-20 text-[10px] font-mono uppercase opacity-60 italic">
                      <span>Amount: Net of Tax</span>
                      <span>₱{(showInvoiceDetails.totalAmount * 0.99).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-20 text-sm border-t border-[#141414] pt-2 mt-2 font-bold">
                      <span className="uppercase">Total Amount Due</span>
                      <span className="font-mono">₱{(showInvoiceDetails.totalAmount).toLocaleString()}</span>
                    </div>
                    {showInvoiceDetails.depositReceived ? (
                      <div className="flex justify-between gap-20 text-[10px] font-mono uppercase text-emerald-600">
                        <span>Deposit Received</span>
                        <span>-₱{showInvoiceDetails.depositReceived.toLocaleString()}</span>
                      </div>
                    ) : (
                       <div className="flex justify-between gap-20 text-[10px] font-mono uppercase opacity-40">
                         <span>Deposit Received</span>
                         <span>₱0.00</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-[#E4E3E0] flex justify-between print:hidden">
                 <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase">
                    Print Document
                 </button>
                 <button onClick={() => setShowInvoiceDetails(null)} className="px-4 py-2 border border-[#141414] text-[10px] font-bold uppercase transition-all hover:bg-white">
                    Close Record
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
