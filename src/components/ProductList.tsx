import React, { useState, useEffect } from 'react';
import { 
  db,
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  writeBatch,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { ProductCategory, ProductListItem } from '../types';
import { useAuth } from './AuthContext';
import { Plus, Trash2, Save, Download, RefreshCw, Info, FolderPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProductList() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  useEffect(() => {
    // Listen for items
    const qItems = query(collection(db, 'productList'), orderBy('order', 'asc'));
    const unsubscribeItems = onSnapshot(qItems, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductListItem)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'productList');
    });

    // Listen for categories
    const qCats = query(collection(db, 'productCategories'), orderBy('order', 'asc'));
    const unsubscribeCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'productCategories');
      setLoading(false);
    });

    return () => {
      unsubscribeItems();
      unsubscribeCats();
    };
  }, []);

  const handleUpdate = async (id: string, field: keyof ProductListItem, value: string | number) => {
    setIsSaving(id);
    try {
      await updateDoc(doc(db, 'productList', id), {
        [field]: value,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `productList/${id}`);
    } finally {
      setIsSaving(null);
    }
  };

  const handleCategoryUpdate = async (id: string, name: string) => {
    try {
      await updateDoc(doc(db, 'productCategories', id), { name });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `productCategories/${id}`);
    }
  };

  const addCategory = async () => {
    const name = window.prompt('Enter new table name:');
    if (!name) return;
    
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.order)) : 0;
    try {
      await addDoc(collection(db, 'productCategories'), {
        name,
        order: maxOrder + 1
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'productCategories');
    }
  };

  const deleteCategory = async (id: string, name: string) => {
    const hasItems = items.some(i => i.category === name);
    if (hasItems) {
      alert('Cannot delete a table that still contains items. Move or delete items first.');
      return;
    }
    if (!window.confirm(`Delete table "${name}"?`)) return;
    
    try {
      await deleteDoc(doc(db, 'productCategories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `productCategories/${id}`);
    }
  };

  const addItem = async (category: string) => {
    const categoryItems = items.filter(i => i.category === category);
    const maxOrder = categoryItems.length > 0 ? Math.max(...categoryItems.map(i => i.order)) : 0;
    
    try {
      await addDoc(collection(db, 'productList'), {
        category,
        item: 'New Item',
        volume: '',
        purchasePrice: 0,
        totalPurchase: 0,
        supplier: '',
        sellingPrice: 0,
        totalSellingPrice: 0,
        notes: '',
        order: maxOrder + 1,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'productList');
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'productList', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `productList/${id}`);
    }
  };

  const seedData = async () => {
    if (!isAdmin) return;
    if (categories.length > 0 && !window.confirm('This will append data. Proceed?')) return;
    
    const batch = writeBatch(db);
    
    const defaultCategories = [
      "PRODUCT LIST", "SUTURES", "QUEEN MARY", "MORONG DOCTORS", "INDOPLAS", "MACTYCOON", "MCU"
    ];

    defaultCategories.forEach((cat, idx) => {
      const catRef = doc(collection(db, 'productCategories'));
      batch.set(catRef, { name: cat, order: idx });
    });

    const productListData = [
      // PRODUCT LIST
      { item: "3-WAY STOPCOCK UNIMEX", volume: "", purchasePrice: 35, supplier: "ALTCARE", sellingPrice: 75, category: "PRODUCT LIST" },
      { item: "Adult Diaper Large", volume: "10pcs/pack", purchasePrice: 19.5, totalPurchase: 195, supplier: "INDOPLAS", sellingPrice: 32, totalSellingPrice: 320, category: "PRODUCT LIST" },
      { item: "Adult Diaper Medium", volume: "", purchasePrice: 18, totalPurchase: 180, supplier: "INDOPLAS", sellingPrice: 29, totalSellingPrice: 290, category: "PRODUCT LIST" },
      { item: "ALCOHOL 70% (FAMILY) 473ml", volume: "36pcs/case", purchasePrice: 65.7, totalPurchase: 2365.2, supplier: "PAGODA PHILS", sellingPrice: 120, totalSellingPrice: 4320, category: "PRODUCT LIST" },
      { item: "ALCOHOL PAD SWAB", volume: "100/case", purchasePrice: 35, totalPurchase: 350, supplier: "INDOPLAS", sellingPrice: 69, totalSellingPrice: 690, category: "PRODUCT LIST" },
      { item: "AMBER BOTTLE 120 ml", volume: "", purchasePrice: 14, supplier: "BESPAK", sellingPrice: 28, category: "PRODUCT LIST" },
      { item: "CATHULA IV CANNULA HMD", volume: "100/Box", purchasePrice: 15, totalPurchase: 1500, supplier: "MAC TYCOON", sellingPrice: 31, totalSellingPrice: 3100, category: "PRODUCT LIST" },
      { item: "Examination Gloves Large", volume: "1000pcs/case", purchasePrice: 1.35, totalPurchase: 1350, supplier: "", sellingPrice: 2.2, totalSellingPrice: 2200, category: "PRODUCT LIST" },
      
      // SUTURES
      { item: "0 round- 10194B chromic tudor", volume: "dozen", purchasePrice: 240, supplier: "ALTCARE", sellingPrice: 455, category: "SUTURES" },
      { item: "1 round - 10194B chromic tudor", volume: "3 dozen", purchasePrice: 240, totalPurchase: 720, supplier: "ALTCARE", sellingPrice: 480, totalSellingPrice: 1440, category: "SUTURES" },
      { item: "2-0 round - 10194B chromic tudor", volume: "dozen", purchasePrice: 250, supplier: "ALTCARE", sellingPrice: 480, category: "SUTURES" },
      { item: "3/0 CHROMIC ROUND 10194B TUDOR", volume: "3 dozen", purchasePrice: 240, totalPurchase: 720, supplier: "", sellingPrice: 480, totalSellingPrice: 1440, category: "SUTURES" },
      
      // QUEEN MARY
      { item: "BBRAUN BT SET", volume: "200 pcs", purchasePrice: 75, totalPurchase: 15000, supplier: "", sellingPrice: 185, totalSellingPrice: 37000, category: "QUEEN MARY" },
      { item: "BOUFFANT NURSES CAP ROUND", volume: "10 packs", purchasePrice: 240, totalPurchase: 2400, supplier: "LAZADA", sellingPrice: 480, totalSellingPrice: 4800, category: "QUEEN MARY" },
      { item: "EXAMINATION GLOVES NITRILE MEDIUM", volume: "40 boxes", purchasePrice: 150, totalPurchase: 6000, supplier: "REZOSTAR", sellingPrice: 340, totalSellingPrice: 13600, category: "QUEEN MARY" },
      
      // MORONG DOCTORS
      { item: "ADULT DIAPER LARGE", volume: "10 packs", purchasePrice: 195, totalPurchase: 1950, supplier: "INDOPLAS", sellingPrice: 350, totalSellingPrice: 3500, category: "MORONG DOCTORS" },
      { item: "BBRAUN SOLUSET DOSIFIX", volume: "75 pcs", purchasePrice: 275, totalPurchase: 20625, supplier: "DAILY", sellingPrice: 595, totalSellingPrice: 44625, category: "MORONG DOCTORS" },
      
      // INDOPLAS
      { item: "STERILE GLOVES 6.5", volume: "10 boxes", purchasePrice: 520, totalPurchase: 5200, supplier: "", sellingPrice: 0, category: "INDOPLAS" },
      { item: "STERILE GLOVES 7.0", volume: "10 box", purchasePrice: 520, totalPurchase: 5200, supplier: "", sellingPrice: 0, category: "INDOPLAS" },
      
      // MACTYCOON
      { item: "GAUZE ROLL TOPCARE", volume: "6 rolls", purchasePrice: 600, totalPurchase: 3600, supplier: "MEDILOVE", sellingPrice: 0, category: "MACTYCOON" },
      { item: "URINE SPECIMEN CUP", volume: "500 pcs", purchasePrice: 5.5, totalPurchase: 2750, supplier: "SMARTECH", sellingPrice: 0, category: "MACTYCOON" },
      
      // MCU
      { item: "leukoplast", volume: "100", purchasePrice: 100, totalPurchase: 125, supplier: "", sellingPrice: 135, category: "MCU" },
      { item: "RAZOR DISPOSABLE", volume: "100", purchasePrice: 500, totalPurchase: 600, supplier: "", sellingPrice: 610, category: "MCU" }
    ];

    productListData.forEach((data, index) => {
      const newDocRef = doc(collection(db, 'productList'));
      batch.set(newDocRef, {
        ...data,
        totalPurchase: data.totalPurchase || 0,
        totalSellingPrice: data.totalSellingPrice || 0,
        notes: "",
        order: index,
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <RefreshCw className="h-6 w-6 animate-spin opacity-20" />
      </div>
    );
  }

  return (
    <div className="bg-[#E4E3E0] min-h-screen">
      {/* Product List Header */}
      <div className="border-b border-[#141414] bg-white p-4 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-2xl sm:text-4xl font-bold uppercase tracking-tighter italic leading-none mb-2">Master Catalog</h2>
          <p className="text-[10px] font-mono font-bold opacity-40 uppercase tracking-widest">Consolidated Medical Reference System</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-4 w-full md:w-auto">
          {isAdmin && categories.length === 0 && (
            <button 
              onClick={seedData}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white text-[10px] font-bold uppercase tracking-tight hover:bg-amber-700 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              <RefreshCw className="h-3 w-3" /> <span className="whitespace-nowrap">Initialize</span>
            </button>
          )}
          <button 
            onClick={addCategory}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-tight hover:bg-blue-700 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <FolderPlus className="h-3 w-3" /> <span className="whitespace-nowrap">Add Table</span>
          </button>
          <button className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 md:py-3 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase tracking-tight hover:opacity-90 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)] md:shadow-[8px_8px_0px_0px_rgba(20,20,20,0.2)]">
            <Download className="h-4 w-4" /> <span className="whitespace-nowrap">Export</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8 space-y-8 sm:space-y-12 pb-24">
        {categories.map(category => {
          const categoryItems = items.filter(i => i.category === category.name);
          return (
            <section key={category.id} className="border-2 border-[#141414] bg-white overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
              {/* Category Header */}
              <div className="bg-[#B8C8D8] border-b-2 border-[#141414] p-4 flex justify-between items-center group">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-6 bg-[#141414]" />
                  <input 
                    defaultValue={category.name}
                    disabled={!isAdmin}
                    onBlur={(e) => handleCategoryUpdate(category.id, e.target.value)}
                    className="bg-transparent border-none text-sm font-black uppercase tracking-widest text-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414] px-1"
                  />
                  {isAdmin && (
                    <button 
                      onClick={() => deleteCategory(category.id, category.name)}
                      className="opacity-0 group-hover:opacity-40 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => addItem(category.name)}
                  className="flex items-center gap-2 px-3 py-1 bg-[#141414] text-[#E4E3E0] text-[10px] font-bold uppercase hover:bg-white hover:text-[#141414] transition-all border border-[#141414]"
                >
                  <Plus className="h-3 w-3" /> Add Row
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#E4E3E0]/50 border-b border-[#141414]">
                      <th className="px-4 py-3 text-left border-r border-[#141414] font-bold uppercase w-1/4">Item Description</th>
                      <th className="px-4 py-3 text-left border-r border-[#141414] font-bold uppercase">Volume/Pack</th>
                      <th className="px-4 py-3 text-right border-r border-[#141414] font-bold uppercase">Purchase</th>
                      <th className="px-4 py-3 text-right border-r border-[#141414] font-bold uppercase bg-amber-50/50">Total Pur.</th>
                      <th className="px-4 py-3 text-left border-r border-[#141414] font-bold uppercase">Supplier</th>
                      <th className="px-4 py-3 text-right border-r border-[#141414] font-bold uppercase">Selling</th>
                      <th className="px-4 py-3 text-right border-r border-[#141414] font-bold uppercase bg-emerald-50/50">Total Sell.</th>
                      <th className="px-4 py-3 text-left border-r border-[#141414] font-bold uppercase w-1/6">Notes</th>
                      <th className="px-4 py-3 text-center opacity-50 px-2">
                        <Trash2 className="h-3 w-3 mx-auto" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#141414]/10">
                    {categoryItems.map(item => (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="border-r border-[#141414]/10">
                          <input 
                            defaultValue={item.item}
                            disabled={!isAdmin}
                            onBlur={(e) => handleUpdate(item.id, 'item', e.target.value)}
                            className="w-full p-3 bg-transparent font-bold uppercase tracking-tight focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414]"
                          />
                        </td>
                        <td className="border-r border-[#141414]/10">
                          <input 
                            defaultValue={item.volume || ''}
                            disabled={!isAdmin}
                            onBlur={(e) => handleUpdate(item.id, 'volume', e.target.value)}
                            className="w-full p-3 bg-transparent opacity-60 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414]"
                            placeholder="---"
                          />
                        </td>
                        <td className="border-r border-[#141414]/10">
                          <input 
                            type="number"
                            defaultValue={item.purchasePrice || 0}
                            disabled={!isAdmin}
                            onBlur={(e) => handleUpdate(item.id, 'purchasePrice', Number(e.target.value))}
                            className="w-full p-3 bg-transparent text-right font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414]"
                          />
                        </td>
                        <td className="border-r border-[#141414]/10 bg-amber-50/20">
                           <input 
                            type="number"
                            defaultValue={item.totalPurchase || 0}
                            disabled={!isAdmin}
                            onBlur={(e) => handleUpdate(item.id, 'totalPurchase', Number(e.target.value))}
                            className="w-full p-3 bg-transparent text-right font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414]"
                          />
                        </td>
                        <td className="border-r border-[#141414]/10">
                          <input 
                            defaultValue={item.supplier || ''}
                            disabled={!isAdmin}
                            onBlur={(e) => handleUpdate(item.id, 'supplier', e.target.value)}
                            className="w-full p-3 bg-transparent uppercase text-[10px] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414]"
                            placeholder="ENTER..."
                          />
                        </td>
                        <td className="border-r border-[#141414]/10">
                          <input 
                            type="number"
                            defaultValue={item.sellingPrice || 0}
                            disabled={!isAdmin}
                            onBlur={(e) => handleUpdate(item.id, 'sellingPrice', Number(e.target.value))}
                            className="w-full p-3 bg-transparent text-right font-mono focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414]"
                          />
                        </td>
                        <td className="border-r border-[#141414]/10 bg-emerald-50/20 text-[#141414]">
                          <input 
                            type="number"
                            defaultValue={item.totalSellingPrice || 0}
                            disabled={!isAdmin}
                            onBlur={(e) => handleUpdate(item.id, 'totalSellingPrice', Number(e.target.value))}
                            className="w-full p-3 bg-transparent text-right font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414]"
                          />
                        </td>
                        <td className="border-r border-[#141414]/10">
                          <input 
                            defaultValue={item.notes || ''}
                            onBlur={(e) => handleUpdate(item.id, 'notes', e.target.value)}
                            className="w-full p-3 bg-transparent font-mono opacity-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#141414] text-[9px]"
                            placeholder="Add memo..."
                          />
                        </td>
                        <td className="text-center px-2">
                          <button 
                            onClick={() => deleteItem(item.id)}
                            className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {categoryItems.length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-[10px] font-mono opacity-30 uppercase">
                          Empty Catalog Category / Use Add Row to Begin
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
      
      {/* Fixed Save Status indicator */}
      <AnimatePresence>
        {isSaving && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-6 right-6 bg-[#141414] text-[#E4E3E0] px-4 py-2 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-3 shadow-2xl border border-[#E4E3E0]/20 z-50"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Synchronizing To Registry...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
