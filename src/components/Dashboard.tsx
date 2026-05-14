import React, { useEffect, useState } from 'react';
import { db, collection, query, where, onSnapshot, auth, getDocs, addDoc, serverTimestamp, orderBy, limit, handleFirestoreError, OperationType, Timestamp } from '../lib/firebase';
import { Product, Invoice, Delivery } from '../types';
import { AlertTriangle, TrendingUp, ChevronRight, FileText, Truck } from 'lucide-react';
import { startOfMonth, format } from 'date-fns';
import { motion } from 'motion/react';

export default function Dashboard() {
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [hospitalStats, setHospitalStats] = useState<{ [key: string]: { name: string, revenue: number, profit: number, count: number } }>({});
  const [monthlyStats, setMonthlyStats] = useState({
    revenue: 0,
    profit: 0,
    cost: 0,
    purchases: 0,
    invoiceCount: 0
  });

  const [inventoryValue, setInventoryValue] = useState(0);
  const [allTimePurchases, setAllTimePurchases] = useState(0);

  useEffect(() => {
    const startOfCurrentMonth = startOfMonth(new Date());

    // All Time Purchases listener (for overall investment record)
    const unsubAllPurchases = onSnapshot(collection(db, 'purchases'), (snap) => {
      const total = snap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
      setAllTimePurchases(total);
    });

    // Monthly Purchases listener
    const qMonthlyPurchases = query(
      collection(db, 'purchases'),
      where('date', '>=', startOfCurrentMonth)
    );
    const unsubMonthlyPurchases = onSnapshot(qMonthlyPurchases, (snap) => {
      const total = snap.docs.reduce((sum, doc) => sum + (Number(doc.data().amount) || 0), 0);
      setMonthlyStats(prev => ({ ...prev, purchases: total }));
    });

    const qAllProducts = collection(db, 'products');
    const unsubscribeAllProducts = onSnapshot(qAllProducts, 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setAllProducts(items);
        
        let totalVal = 0;
        items.forEach(p => {
          totalVal += (p.currentStock || 0) * (p.purchasePrice || 0);
        });
        setInventoryValue(totalVal);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products_all')
    );

    const qInvoices = query(
      collection(db, 'invoices'),
      where('date', '>=', startOfCurrentMonth)
    );

    const unsubscribeInvoices = onSnapshot(qInvoices, 
      (snapshot) => {
        let revenue = 0;
        let profit = 0;
        let cost = 0;
        const stats: { [key: string]: { name: string, revenue: number, profit: number, count: number } } = {};

        snapshot.docs.forEach(doc => {
          const data = doc.data() as Invoice;
          const docRevenue = Number(data.totalAmount) || 0;
          const docProfit = Number(data.profit) || 0;
          const docCost = Number(data.totalCost) || (docRevenue - docProfit);
          
          revenue += docRevenue;
          profit += docProfit;
          cost += docCost;

          if (data.customerName) {
            if (!stats[data.customerName]) {
              stats[data.customerName] = { name: data.customerName, revenue: 0, profit: 0, count: 0 };
            }
            stats[data.customerName].revenue += docRevenue;
            stats[data.customerName].profit += docProfit;
            stats[data.customerName].count += 1;
          }
        });
        setMonthlyStats(prev => ({
          ...prev,
          revenue,
          profit,
          cost,
          invoiceCount: snapshot.docs.length
        }));
        setHospitalStats(stats);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'invoices_monthly')
    );

    const qDeliveries = query(collection(db, 'deliveries'), where('status', '!=', 'Delivered'), limit(4));
    const unsubscribeDeliveries = onSnapshot(qDeliveries, 
      (snapshot) => {
        setActiveDeliveries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delivery)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'deliveries_active')
    );

    return () => {
      unsubAllPurchases();
      unsubMonthlyPurchases();
      unsubscribeAllProducts();
      unsubscribeInvoices();
      unsubscribeDeliveries();
    };
  }, []);

  const [isSeeding, setIsSeeding] = useState(false);

  const generatePrescriptiveInsights = () => {
    const insights: { type: string, title: string, action: string, priority: 'HIGH' | 'MEDIUM' | 'LOW' }[] = [];

    // 1. Inventory & Restock Insights
    const criticalStock = allProducts.filter(p => p.currentStock <= (p.lowStockThreshold || 10));
    if (criticalStock.length > 0) {
      insights.push({
        type: 'Procurement',
        title: `${criticalStock.length} Critical Stock Depletions`,
        action: `Issue Immediate PO for ${criticalStock[0].itemName.slice(0, 15)}...`,
        priority: 'HIGH'
      });
    }

    // 2. Financial & Profitability Insights
    const margin = monthlyStats.revenue > 0 ? (monthlyStats.profit / monthlyStats.revenue) : 0;
    if (margin < 0.2 && monthlyStats.revenue > 0) {
      insights.push({
        type: 'Efficiency',
        title: 'Tight Profit Margin Warning',
        action: 'Review Pricing Strategy or Negotiate Supplier Rates',
        priority: 'MEDIUM'
      });
    }

    const netCashFlow = monthlyStats.revenue - monthlyStats.purchases;
    if (netCashFlow < 0) {
      insights.push({
        type: 'Finance',
        title: 'Negative Monthly Cash Flow',
        action: 'Halt Non-Essential Procurement for Current Cycle',
        priority: 'HIGH'
      });
    }

    // 3. Sales Opportunity
    if (monthlyStats.invoiceCount > 10) {
      insights.push({
        type: 'Growth',
        title: 'High Transaction Velocity',
        action: 'Request Bulk Discounts from Primary Suppliers',
        priority: 'MEDIUM'
      });
    } else if (monthlyStats.invoiceCount > 0) {
       insights.push({
        type: 'Operation',
        title: 'Stable Operational Rhythm',
        action: 'Maintain Current Supply Chain Flow',
        priority: 'LOW'
      });
    }

    return insights;
  };

  const insights = generatePrescriptiveInsights();

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
        { invoiceNumber: 'INV-000621', customer: 'MCU HOSPITAL', type: 'Invoice', totalAmount: 595, profit: 145, projectDescription: 'URGENT LUBRICANT RESTOCK', items: [{ productNo: '66', qty: 1, up: 595, cp: 450, name: 'LUBRICANT JELLY SACHET 5g' }] },
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
  const netCashFlow = monthlyStats.revenue - monthlyStats.purchases;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 auto-rows-min gap-0">
      {/* 01 / Analytics */}
      <section className="col-span-1 md:col-span-8 border-r border-b border-[#141414] p-4 sm:p-8 flex flex-col justify-between bg-white min-h-[300px]">
        <div className="flex justify-between items-start">
          <h2 className="text-[11px] font-mono uppercase opacity-50 tracking-widest leading-tight">Monthly Profit Analytics</h2>
          <span className="text-[10px] bg-[#141414] text-[#E4E3E0] px-2 py-1 uppercase font-bold shrink-0 ml-4">Financial Health</span>
        </div>
        
        <div className="flex flex-col gap-2 my-6 sm:my-8">
          <span className="text-4xl sm:text-6xl md:text-8xl font-light tracking-tighter leading-none">
            ₱{(monthlyStats.profit || 0).toLocaleString()}
          </span>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 text-xs font-mono font-bold uppercase tracking-tight">+ {margin.toFixed(1)}% MARGIN</span>
              <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest hidden sm:inline">Sales Profit</span>
            </div>
            <div className="flex items-center gap-2 border-l border-[#141414] pl-4 sm:pl-6">
               <span className={`text-xs font-mono font-bold uppercase tracking-tight ${netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                 ₱{(netCashFlow || 0).toLocaleString()}
               </span>
               <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest hidden sm:inline">Net Cash Flow</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 border-t border-[#141414] pt-6">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Monthly Rev.</span>
            <span className="font-mono text-sm font-bold">₱{(monthlyStats.revenue || 0).toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Inventory Value</span>
            <span className="font-mono text-sm font-bold text-blue-600">₱{(inventoryValue || 0).toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Cost of Sales</span>
            <span className="font-mono text-sm font-bold">₱{(monthlyStats.cost || 0).toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Monthly Purchases</span>
            <span className="font-mono text-sm font-bold text-red-600">₱{(monthlyStats.purchases || 0).toLocaleString()}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase opacity-50 font-bold mb-1">Vol / Count</span>
            <span className="font-mono text-sm font-bold">{(monthlyStats.invoiceCount || 0)} DR/INV</span>
          </div>
        </div>
      </section>

      {/* 02 / Prescriptive Analytics Engine */}
      <section className="col-span-1 md:col-span-4 border-b border-[#141414] p-8 bg-[#141414] text-[#E4E3E0] flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-8">
            <h2 className="text-[11px] font-mono uppercase opacity-50 text-[#E4E3E0]">Prescriptive Strategy Engine</h2>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold">ANALYZING</span>
            </div>
          </div>
          
          <div className="space-y-6">
            {insights.length === 0 ? (
               <p className="text-[11px] font-mono opacity-40 italic">Aggregating historical data for business modeling...</p>
            ) : (
              insights.map((insight, idx) => (
                <div key={idx} className="group cursor-default">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold font-mono text-emerald-400 uppercase tracking-widest">{insight.type}</span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 border ${
                      insight.priority === 'HIGH' ? 'border-red-500 text-red-500' : 
                      insight.priority === 'MEDIUM' ? 'border-amber-500 text-amber-500' : 'border-gray-500 text-gray-500'
                    }`}>
                      {insight.priority}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-tight mb-1">{insight.title}</h3>
                  <p className="text-[10px] opacity-40 font-mono leading-tight group-hover:opacity-100 transition-opacity italic">Action: {insight.action}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#E4E3E0]/10 flex flex-col gap-1">
           <span className="text-[9px] font-mono opacity-40 uppercase">Decision Confidence</span>
           <div className="w-full h-1 bg-[#282828]">
             <div className="h-full bg-emerald-500 w-[92%]" />
           </div>
        </div>
      </section>

      {/* 03 / Hospital Profitability Breakdown */}
      <section className="col-span-1 md:col-span-12 lg:col-span-6 border-r border-[#141414] p-4 sm:p-8 bg-white max-h-[500px] overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-6 sm:mb-8 shrink-0">
          <h2 className="text-[11px] font-mono uppercase opacity-50">Partner Hospital Performance</h2>
          <TrendingUp className="h-4 w-4 opacity-30" />
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-4">
              {Object.values(hospitalStats)
                .sort((a, b) => b.profit - a.profit)
                .map((stat, idx) => {
                  const partnerMargin = stat.revenue > 0 ? (stat.profit / stat.revenue) * 100 : 0;
                  return (
                    <div key={idx} className="group border-b border-[#141414]/10 pb-4 last:border-0 hover:bg-[#E4E3E0]/20 transition-colors p-2 -mx-2">
                      <div className="flex justify-between items-start mb-2">
                        <div className="min-w-0 flex-1 pr-4">
                          <h4 className="text-xs font-bold uppercase tracking-tight truncate">{stat.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-mono opacity-40 uppercase">{stat.count} Transactions</span>
                            <span className="text-[8px] bg-[#141414] text-[#E4E3E0] px-1 font-bold">TOP PARTNER</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold font-mono">₱{stat.profit.toLocaleString()}</p>
                          <p className="text-[9px] font-mono text-emerald-600 font-bold uppercase">+{partnerMargin.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full h-1 bg-[#E4E3E0] mt-1 relative overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((stat.profit / (monthlyStats.profit || 1)) * 100, 100)}%` }}
                          className="absolute h-full bg-[#141414]"
                        />
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </section>

      {/* 04 / Delivery Tracker Preview */}
      <section className="col-span-1 md:col-span-12 lg:col-span-6 p-8 bg-[#E4E3E0] border-b border-[#141414]">
        <div className="flex justify-between items-start mb-8">
          <h2 className="text-[11px] font-mono uppercase opacity-50 text-[#141414]">Logistics Tracking Preview</h2>
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
