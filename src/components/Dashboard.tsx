import React, { useEffect, useState } from 'react';
import { db, collection, query, where, onSnapshot, auth, getDocs, addDoc, serverTimestamp, orderBy, limit, handleFirestoreError, OperationType, Timestamp } from '../lib/firebase';
import { Product, Invoice, Delivery } from '../types';
import { AlertTriangle, TrendingUp, ChevronRight, FileText, Truck } from 'lucide-react';
import { startOfMonth, format } from 'date-fns';
import { motion } from 'motion/react';

export default function Dashboard() {
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({
    revenue: 0,
    profit: 0,
    cost: 0,
    invoiceCount: 0
  });

  const [inventoryValue, setInventoryValue] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);

  useEffect(() => {
    // Total Purchases listener
    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snap) => {
      const total = snap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);
      setTotalPurchases(total);
    });

    const qLowStock = query(collection(db, 'products'), where('currentStock', '<', 10));
    const unsubscribeLowStock = onSnapshot(qLowStock, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setLowStockProducts(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products_low_stock')
    );

    const qAllProducts = collection(db, 'products');
    const unsubscribeAllProducts = onSnapshot(qAllProducts, 
      (snapshot) => {
        let totalVal = 0;
        snapshot.docs.forEach(doc => {
          const p = doc.data() as Product;
          totalVal += (p.currentStock || 0) * (p.purchasePrice || 0);
        });
        setInventoryValue(totalVal);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products_all')
    );

    const startOfCurrentMonth = startOfMonth(new Date());
    const qInvoices = query(
      collection(db, 'invoices'),
      where('date', '>=', startOfCurrentMonth)
    );

    const unsubscribeInvoices = onSnapshot(qInvoices, 
      (snapshot) => {
        let revenue = 0;
        let profit = 0;
        let cost = 0;
        snapshot.docs.forEach(doc => {
          const data = doc.data() as Invoice;
          revenue += data.totalAmount;
          profit += data.profit || 0;
          cost += data.totalCost || 0;
        });
        setMonthlyStats({
          revenue,
          profit,
          cost,
          invoiceCount: snapshot.docs.length
        });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices_monthly')
    );

    const qRecent = query(collection(db, 'invoices'), orderBy('date', 'desc'), limit(5));
    const unsubscribeRecent = onSnapshot(qRecent, 
      (snapshot) => {
        setRecentInvoices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices_recent')
    );

    const qDeliveries = query(collection(db, 'deliveries'), where('status', '!=', 'Delivered'), limit(4));
    const unsubscribeDeliveries = onSnapshot(qDeliveries, 
      (snapshot) => {
        setActiveDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'deliveries_active')
    );

    return () => {
      unsubPurchases();
      unsubscribeLowStock();
      unsubscribeAllProducts();
      unsubscribeInvoices();
      unsubscribeRecent();
      unsubscribeDeliveries();
    };
  }, []);

  const [isSeeding, setIsSeeding] = useState(false);

  const seedFromCSV = async () => {
    setIsSeeding(true);
    try {
      // 1. Seed Products
      const productRef = collection(db, 'products');
      const sampleProducts = [
        { productNo: '01', itemName: 'ALCOHOL SWAB', packaging: '300 PCS/BOX', purchasePrice: 35, sellingPrice: 69, currentStock: 300, minStock: 50, category: 'Medical Supply' },
        { productNo: '02', itemName: 'ASEPTO SYRINGE', packaging: '150 PCS', purchasePrice: 35, sellingPrice: 65, currentStock: 150, minStock: 20, category: 'Medical Supply' },
        { productNo: '04', itemName: 'COTTON BALLS', packaging: '70 PACKS', purchasePrice: 140, sellingPrice: 200, currentStock: 70, minStock: 15, category: 'Medical Supply' },
        { productNo: '05', itemName: 'EXAMINATION GLOVES LARGE', packaging: '90 BOXES', purchasePrice: 150, sellingPrice: 220, currentStock: 90, minStock: 25, category: 'Medical Supply' },
        { productNo: '06', itemName: 'EXAMINATION GLOVES MEDIUM', packaging: '930 BOXES', purchasePrice: 150, sellingPrice: 220, currentStock: 930, minStock: 100, category: 'Medical Supply' },
        { productNo: '09', itemName: 'FACEMASK', packaging: '200 BOXES', purchasePrice: 40, sellingPrice: 60, currentStock: 200, minStock: 50, category: 'Medical Supply' },
        { productNo: '25', itemName: 'STERILE SURGICAL GLOVES 6.0', packaging: '50 PAIRS/BOX', purchasePrice: 490, sellingPrice: 800, currentStock: 3, minStock: 10, category: 'Medical Supply' },
        { productNo: '26', itemName: 'STERILE SURGICAL GLOVES 6.5', packaging: '50 PAIRS/BOX', purchasePrice: 490, sellingPrice: 800, currentStock: 11, minStock: 10, category: 'Medical Supply' },
        { productNo: '27', itemName: 'STERILE SURGICAL GLOVES 7.0', packaging: '50 PAIRS/BOX', purchasePrice: 490, sellingPrice: 800, currentStock: 12, minStock: 10, category: 'Medical Supply' },
        { productNo: '66', itemName: 'LUBRICANT JELLY SACHET 5g', packaging: '100 PCS / BOX', purchasePrice: 450, sellingPrice: 595, currentStock: 100, minStock: 20, category: 'Medical Supply' },
        { productNo: '03', itemName: 'ADULT DIAPER MEDIUM', packaging: 'PACK', purchasePrice: 180, sellingPrice: 290, currentStock: 10, minStock: 5, category: 'Medical Supply' },
      ];

      const pMap: {[key: string]: string} = {};
      for (const p of sampleProducts) {
        const q = query(productRef, where('productNo', '==', p.productNo));
        const snap = await getDocs(q);
        if (snap.empty) {
          const doc = await addDoc(productRef, { ...p, createdAt: serverTimestamp() });
          pMap[p.productNo] = doc.id;
        } else {
          pMap[p.productNo] = snap.docs[0].id;
        }
      }

      // 2. Seed Customers
      const customerRef = collection(db, 'customers');
      const sampleCustomers = [
        { companyName: 'SAN JUAN DE DIOS HOSPITAL', contactName: 'Nanette', address: 'Roxa Blvd Pasay City', phone: '831-3459', email: 'procurement@sjddh.com' },
        { companyName: 'PROVIDENCE HOSPITAL', contactName: 'Lanie Aquino', address: '1515 QUEZON AVE, QC', phone: '02 85586999', email: 'purchasing@providencehospital.com.ph' },
        { companyName: 'QUEEN MARY HELP OF CHRISTIANS HOSPITAL', contactName: 'SIR JOEY', address: 'MANILA EAST ROAD, CARDONA, RIZAL', phone: '0917 5521500', email: 'qmhch@gmail.com' },
        { companyName: 'MORONG DOCTORS HOSPITAL', contactName: 'MAM ANGIE', address: 'GOV MARTINEZ ST, MORONG, RIZAL', phone: '', email: 'morongdoctors@gmail.com' },
        { companyName: 'MCU HOSPITAL', contactName: 'MAM CHARISSE', address: 'EDSA MONUMENTO, CALOOCAN CITY', phone: '8313459', email: 'info@mcuhospital.org' }
      ];

      const cMap: {[key: string]: string} = {};
      for (const c of sampleCustomers) {
        const q = query(customerRef, where('companyName', '==', c.companyName));
        const snap = await getDocs(q);
        if (snap.empty) {
          const doc = await addDoc(customerRef, { ...c, createdAt: serverTimestamp() });
          cMap[c.companyName] = doc.id;
        } else {
          cMap[c.companyName] = snap.docs[0].id;
        }
      }

      // 3. Seed Suppliers
      const supplierRef = collection(db, 'suppliers');
      const sampleSuppliers = ['ALTCARE', 'INDOPLAS', 'PAGODA PHILS', 'MEDILOVE', 'DAILY', 'HOSPITECH', 'MACTYCOON', 'IMPEXCOS', 'EMMAN MEDICAL SUPPLIES', 'MEDASIA MEDICAL PRODUCTS CORP', 'FELISHA MEDICAL SUPPLIES', 'APEX IMPORTS MARKETING CORP', 'STARCARE MEDICAL SUPPLIES', 'YANDC ENTERPRISE', 'GOLDENPACK PACKAGING SUPPLY INC'];
      const sMap: {[key: string]: string} = {};
      
      for (const sName of sampleSuppliers) {
        const q = query(supplierRef, where('supplierName', '==', sName));
        const snap = await getDocs(q);
        if (snap.empty) {
          const doc = await addDoc(supplierRef, { supplierName: sName, contactInfo: 'Imported from legacy records.', createdAt: serverTimestamp() });
          sMap[sName] = doc.id;
        } else {
          sMap[sName] = snap.docs[0].id;
        }
      }

      // 3b. Seed Purchases (History of purchases to suppliers)
      const purchaseRef = collection(db, 'purchases');
      const samplePurchases = [
        { date: new Date('2026-01-05'), supplier: 'MEDASIA MEDICAL PRODUCTS CORP', amount: 3500, or: '16378' },
        { date: new Date('2026-01-05'), supplier: 'EMMAN MEDICAL SUPPLIES', amount: 3500, or: '19637', inv: '53838' },
        { date: new Date('2026-01-06'), supplier: 'HOSPITECH MEDICAL SUPPLIES', amount: 5240, or: '2163' },
        { date: new Date('2026-01-15'), supplier: 'APEX IMPORTS MARKETING CORP', amount: 24960, or: '46273' },
        { date: new Date('2026-02-14'), supplier: 'EMMAN MEDICAL SUPPLIES', amount: 56580, or: '308', inv: '54989' },
      ];

      for (const p of samplePurchases) {
        const q = query(purchaseRef, where('orNo', '==', p.or));
        const snap = await getDocs(q);
        if (snap.empty && sMap[p.supplier]) {
           await addDoc(purchaseRef, {
             date: Timestamp.fromDate(p.date),
             supplierId: sMap[p.supplier],
             supplierName: p.supplier,
             amount: p.amount,
             orNo: p.or,
             invoiceNo: p.inv || '',
             createdAt: serverTimestamp()
           });
        }
      }

      // 4. Seed a few Invoices (DR 621 and INV 0806)
      const invoiceRef = collection(db, 'invoices');
      const sampleInvoices = [
        { invoiceNumber: 'DR-000621', customer: 'MCU HOSPITAL', type: 'Delivery Receipt', totalAmount: 595, profit: 145, projectDescription: 'URGENT LUBRICANT RESTOCK', items: [{ productNo: '66', qty: 1, up: 595, cp: 450, name: 'LUBRICANT JELLY SACHET 5g' }] },
        { invoiceNumber: 'INV-000806', customer: 'SAN JUAN DE DIOS HOSPITAL', type: 'Invoice', totalAmount: 117050, profit: 45000, projectDescription: 'PO 7067 - SURGICAL SUPPLIES', items: [
          { productNo: '27', qty: 50, up: 800, cp: 490, name: 'STERILE SURGICAL GLOVES 7.0' },
          { productNo: '06', qty: 40000, up: 2.2, cp: 1.5, name: 'EXAMINATION GLOVES MEDIUM' }
        ]}
      ];

      for (const inv of sampleInvoices) {
        const q = query(invoiceRef, where('invoiceNumber', '==', inv.invoiceNumber));
        const snap = await getDocs(q);
        if (snap.empty) {
          const docRef = await addDoc(invoiceRef, {
            invoiceNumber: inv.invoiceNumber,
            type: inv.type,
            customerId: cMap[inv.customer],
            customerName: inv.customer,
            projectDescription: inv.projectDescription,
            date: serverTimestamp(),
            status: 'Paid',
            totalAmount: inv.totalAmount,
            profit: inv.profit,
            totalCost: inv.totalAmount - inv.profit,
            createdAt: serverTimestamp()
          });

          for (const item of inv.items) {
            await addDoc(collection(db, 'invoices', docRef.id, 'items'), {
              productId: pMap[item.productNo],
              productNo: item.productNo,
              itemName: item.name,
              quantity: item.qty,
              unitPrice: item.up,
              lineTotal: item.qty * item.up,
              purchasePrice: item.cp
            });
          }

          // Also seed a delivery for sample
          await addDoc(collection(db, 'deliveries'), {
            invoiceId: docRef.id,
            invoiceNumber: inv.invoiceNumber,
            customerId: cMap[inv.customer],
            customerName: inv.customer,
            status: inv.invoiceNumber.includes('806') ? 'Delivered' : 'In Transit',
            location: inv.invoiceNumber.includes('806') ? 'Hospital Receiving' : 'En Route',
            updatedAt: serverTimestamp()
          });
        }
      }

      alert('CSV Data Synchronized successfully.');
    } catch (error) {
      console.error('Error seeding data:', error);
      handleFirestoreError(error, OperationType.WRITE, 'seeding_dashboard');
    } finally {
      setIsSeeding(false);
    }
  };

  const margin = monthlyStats.revenue > 0 ? (monthlyStats.profit / monthlyStats.revenue) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-min gap-0">
      {/* 01 / Analytics */}
      <section className="col-span-1 md:col-span-8 border-r border-b border-[#141414] p-8 flex flex-col justify-between bg-white min-h-[300px]">
        <div className="flex justify-between items-start">
          <h2 className="text-[11px] font-mono uppercase opacity-50 tracking-widest">01 / Monthly Profit Analytics</h2>
          <span className="text-[10px] bg-[#141414] text-[#E4E3E0] px-2 py-1 uppercase font-bold">Live Data</span>
        </div>
        
        <div className="flex flex-col gap-2 my-8">
          <span className="text-6xl md:text-8xl font-light tracking-tighter leading-none">
            ₱{monthlyStats.profit.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 text-xs font-mono font-bold uppercase tracking-tight">+ {margin.toFixed(1)}% MARGIN</span>
            <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Current Month</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-8 border-t border-[#141414] pt-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Revenue</span>
            <span className="font-mono text-sm font-bold">₱{monthlyStats.revenue.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Stock Value</span>
            <span className="font-mono text-sm font-bold text-blue-600">₱{inventoryValue.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Cost of Goods</span>
            <span className="font-mono text-sm font-bold">₱{monthlyStats.cost.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Total Purchases</span>
            <span className="font-mono text-sm font-bold text-red-600">₱{totalPurchases.toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Documents</span>
            <span className="font-mono text-sm font-bold">{monthlyStats.invoiceCount} Invoiced</span>
          </div>
        </div>
      </section>

      {/* 02 / Critical Alerts */}
      <section className="col-span-1 md:col-span-4 border-b border-[#141414] p-8 bg-[#141414] text-[#E4E3E0]">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-[11px] font-mono uppercase opacity-50 text-[#E4E3E0]">02 / Low Stock Alerts</h2>
          <span className="text-[10px] border border-[#E4E3E0] px-2 py-1 font-bold">CRITICAL</span>
        </div>
        
        <div className="space-y-6">
          {lowStockProducts.length === 0 ? (
            <p className="text-[11px] font-mono opacity-40 italic">Inventory levels remaining within safety margins.</p>
          ) : (
            lowStockProducts.slice(0, 4).map(product => (
              <div key={product.id} className="border-l-2 border-red-500 pl-4 py-1">
                <div className="flex justify-between text-sm font-bold uppercase tracking-tighter">
                  <span className="truncate max-w-[150px]">{product.itemName}</span>
                  <span className="text-red-500 font-mono">{product.currentStock} {product.packaging}</span>
                </div>
                <div className="text-[10px] opacity-40 font-mono mt-1">Ref: {product.id.slice(0, 8)}</div>
              </div>
            ))
          )}
        </div>

        <button className="w-full mt-12 border border-[#E4E3E0] py-3 text-[10px] uppercase font-bold hover:bg-[#E4E3E0] hover:text-[#141414] transition-all">
          Generate Supply Restock Report
        </button>
      </section>

      {/* 03 / Recent Invoices */}
      <section className="col-span-1 md:col-span-6 border-r border-[#141414] p-8 bg-white">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-[11px] font-mono uppercase opacity-50">03 / Recent Transaction History</h2>
          <FileText className="h-4 w-4 opacity-30" />
        </div>
        
        <div className="space-y-4">
          {recentInvoices.length === 0 ? (
            <p className="text-[11px] font-mono opacity-30 italic">No recent documents recorded.</p>
          ) : (
            recentInvoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-4 border-2 border-[#141414] group hover:bg-[#141414] hover:text-[#E4E3E0] transition-all cursor-pointer">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold uppercase tracking-tighter leading-none truncate">{inv.invoiceNumber}</span>
                    <span className="text-[8px] border border-current px-1 opacity-60 font-bold shrink-0">{inv.type === 'Invoice' ? 'INV' : 'DR'}</span>
                  </div>
                  <p className="text-[10px] font-mono opacity-50 uppercase">{inv.date ? format(inv.date.toDate(), 'MMM dd, yyyy') : '---'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold font-mono text-sm leading-none">₱{inv.totalAmount.toLocaleString()}</p>
                  <p className={`text-[9px] font-bold uppercase mt-1 ${inv.status === 'Paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {inv.status}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 04 / Delivery Tracker Preview */}
      <section className="col-span-1 md:col-span-6 p-8 bg-[#E4E3E0]">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-[11px] font-mono uppercase opacity-50 text-[#141414]">04 / Logistics Tracking Preview</h2>
          <Truck className="h-4 w-4 opacity-30" />
        </div>

        <div className="space-y-4">
          {activeDeliveries.length === 0 ? (
            <div className="p-10 border-2 border-dashed border-[#141414]/20 rounded text-center">
              <p className="text-[11px] font-mono opacity-30 italic">All shipments currently fulfilled.</p>
            </div>
          ) : (
            activeDeliveries.map((del) => (
              <div key={del.id} className="bg-white border-2 border-[#141414] p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${del.status === 'Processing' ? 'bg-slate-400' : 'bg-blue-500 animate-pulse'}`} />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold uppercase tracking-tight leading-none truncate">{del.customerName}</p>
                    <p className="text-[9px] font-mono opacity-50 mt-1 uppercase truncate">{del.status} // {del.invoiceNumber}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 opacity-20 shrink-0" />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
