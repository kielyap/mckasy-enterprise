import React, { useState, useEffect } from 'react';
import { db, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { Product } from '../types';
import { Plus, Search, Edit2, Trash2, Package, X, Upload, ChevronUp, ChevronDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import ImportIntelligence from './ImportIntelligence';

import Pagination from './Pagination';

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof Product>('itemName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 10;

  const productSchema = `
    - productNo (string, optional): Catalogue reference number (e.g. "01", "A-100")
    - itemName (string, required): Full name of the medical item
    - packaging (string, required): Unit description e.g. "Box of 100", "50ml Bottle"
    - purchasePrice (number, required): Cost price per unit (e.g. 150.00)
    - sellingPrice (number, required): Market price per unit (e.g. 200.00)
    - currentStock (number, required): Current quantity on hand
    - lowStockThreshold (number, optional): Minimum stock alert level (default 10)
    - category (string, optional): Item group (e.g. "Medical Supply", "Equipment")
  `;

  const { register, handleSubmit, reset, setValue } = useForm<Partial<Product>>();

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'products'), 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(items);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );
    return unsubscribe;
  }, []);

  const onSubmit = async (data: any) => {
    try {
      const payload = {
        ...data,
        purchasePrice: Number(data.purchasePrice),
        sellingPrice: Number(data.sellingPrice),
        currentStock: Number(data.currentStock),
        lowStockThreshold: Number(data.lowStockThreshold || 10),
        updatedAt: serverTimestamp()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), payload);
      } else {
        await addDoc(collection(db, 'products'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      closeModal();
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setValue('productNo', product.productNo || '');
      setValue('itemName', product.itemName);
      setValue('packaging', product.packaging);
      setValue('purchasePrice', product.purchasePrice);
      setValue('sellingPrice', product.sellingPrice);
      setValue('currentStock', product.currentStock);
      setValue('lowStockThreshold', product.lowStockThreshold);
    } else {
      setEditingProduct(null);
      reset();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    reset();
    setEditingProduct(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleSort = (field: keyof Product) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredProducts = products
    .filter(p => (p.itemName?.toLowerCase() || '').includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const aValue = a[sortField] || '';
      const bValue = b[sortField] || '';
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return sortOrder === 'asc' 
        ? String(aValue).localeCompare(String(bValue), undefined, { numeric: true, sensitivity: 'base' })
        : String(bValue).localeCompare(String(aValue), undefined, { numeric: true, sensitivity: 'base' });
    });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const currentItems = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="p-8 border-b border-[#141414] bg-white flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tighter uppercase leading-none italic">Inventory Catalog</h2>
          <p className="text-[10px] font-mono mt-2 opacity-50 uppercase tracking-widest leading-none">Medical Supply Stock & Pricing Control</p>
        </div>
        <div className="flex gap-4">
          <ImportIntelligence 
            collectionName="products" 
            title="Catalogue" 
            schemaDetails={productSchema} 
          />
          <button 
            onClick={() => openModal()}
            className="flex items-center justify-center gap-2 border-2 border-[#141414] bg-[#141414] px-4 py-2 text-[10px] font-bold uppercase text-[#E4E3E0] hover:bg-transparent hover:text-[#141414] transition-all"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#141414] opacity-40" />
          <input
            type="text"
            placeholder="FILTER CATALOG..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full border-b-2 border-[#141414] bg-transparent py-4 pl-12 pr-4 text-sm font-bold uppercase tracking-tight focus:outline-none"
          />
        </div>

        <div className="overflow-hidden border border-[#141414] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-[#141414] text-[#E4E3E0] text-[9px] font-bold tracking-widest uppercase">
                <tr>
                  <th className="px-6 py-3 border-r border-[#E4E3E0]/20 cursor-pointer hover:bg-[#141414]/80 transition-colors" onClick={() => handleSort('productNo')}>
                    <div className="flex items-center gap-1">
                      ID# {sortField === 'productNo' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 border-r border-[#E4E3E0]/20 cursor-pointer hover:bg-[#141414]/80 transition-colors" onClick={() => handleSort('itemName')}>
                    <div className="flex items-center gap-1">
                      Item Name {sortField === 'itemName' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 border-r border-[#E4E3E0]/20 cursor-pointer hover:bg-[#141414]/80 transition-colors" onClick={() => handleSort('packaging')}>
                    <div className="flex items-center gap-1">
                      Packaging {sortField === 'packaging' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 border-r border-[#E4E3E0]/20 cursor-pointer hover:bg-[#141414]/80 transition-colors" onClick={() => handleSort('purchasePrice')}>
                    <div className="flex items-center gap-1">
                      Cost {sortField === 'purchasePrice' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 border-r border-[#E4E3E0]/20 cursor-pointer hover:bg-[#141414]/80 transition-colors" onClick={() => handleSort('sellingPrice')}>
                    <div className="flex items-center gap-1">
                      Price {sortField === 'sellingPrice' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 border-r border-[#E4E3E0]/20 cursor-pointer hover:bg-[#141414]/80 transition-colors" onClick={() => handleSort('currentStock')}>
                    <div className="flex items-center gap-1">
                      Stock {sortField === 'currentStock' && (sortOrder === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#141414]/10">
                {currentItems.map((product) => (
                  <tr key={product.id} className="hover:bg-[#E4E3E0]/30 transition-colors">
                    <td className="px-6 py-4 border-r border-[#141414]/10">
                      <span className="text-[10px] font-mono font-bold">{product.productNo || '---'}</span>
                    </td>
                    <td className="px-6 py-4 border-r border-[#141414]/10">
                      <p className="font-bold uppercase tracking-tighter text-sm">{product.itemName}</p>
                    </td>
                    <td className="px-6 py-4 border-r border-[#141414]/10">
                        <span className="text-[10px] font-mono opacity-60 uppercase">{product.packaging}</span>
                    </td>
                    <td className="px-6 py-4 border-r border-[#141414]/10 font-mono text-xs">₱{(product.purchasePrice || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 border-r border-[#141414]/10 font-mono font-bold">₱{(product.sellingPrice || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 border-r border-[#141414]/10">
                      <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border ${
                        product.currentStock < (product.lowStockThreshold || 10) 
                          ? 'border-red-500 text-red-600 bg-red-50' 
                          : 'border-[#141414] opacity-100'
                      }`}>
                        {product.currentStock} UNITS
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => openModal(product)} className="p-1.5 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button onClick={() => handleDelete(product.id)} className="p-1.5 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
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
              className="absolute inset-0 bg-[#141414]/80 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md overflow-hidden bg-white border-[6px] border-[#141414] shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="border-b border-[#141414] p-6 bg-white flex justify-between items-center">
                <h3 className="text-xl font-bold uppercase tracking-tighter">{editingProduct ? 'Update Product' : 'Catalog New Item'}</h3>
                <button onClick={closeModal} className="p-1 hover:bg-[#E4E3E0] transition-colors"><X className="h-5 w-5" /></button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#141414] opacity-50 mb-1.5">REF#</label>
                    <input {...register('productNo')} className="w-full border-2 border-[#141414] bg-transparent px-4 py-3 text-sm font-mono font-bold uppercase focus:bg-[#E4E3E0] focus:outline-none transition-all placeholder:opacity-20" placeholder="e.g. 66" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#141414] opacity-50 mb-1.5">Item Nomenclature</label>
                    <input {...register('itemName', { required: true })} className="w-full border-2 border-[#141414] bg-transparent px-4 py-3 text-sm font-bold uppercase focus:bg-[#E4E3E0] focus:outline-none transition-all placeholder:opacity-20" placeholder="e.g. STERILE GLOVES" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#141414] opacity-50 mb-1.5">Unit Packaging</label>
                  <input {...register('packaging', { required: true })} className="w-full border-2 border-[#141414] bg-transparent px-4 py-3 text-sm font-bold uppercase focus:bg-[#E4E3E0] focus:outline-none" placeholder="e.g. PACK OF 50" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#141414] opacity-50 mb-1.5">Purchase Price</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xs font-bold">₱</span>
                        <input type="number" {...register('purchasePrice', { required: true })} className="w-full border-2 border-[#141414] bg-transparent pl-8 pr-4 py-3 text-sm font-mono font-bold focus:bg-[#E4E3E0] focus:outline-none" placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#141414] opacity-50 mb-1.5">Selling Price</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xs font-bold">₱</span>
                        <input type="number" {...register('sellingPrice', { required: true })} className="w-full border-2 border-[#141414] bg-transparent pl-8 pr-4 py-3 text-sm font-mono font-bold focus:bg-[#E4E3E0] focus:outline-none" placeholder="0.00" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#141414] opacity-50 mb-1.5">Initial Qty</label>
                    <input type="number" {...register('currentStock', { required: true })} className="w-full border-2 border-[#141414] bg-transparent px-4 py-3 text-sm font-mono font-bold focus:bg-[#E4E3E0] focus:outline-none" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-[#141414] opacity-50 mb-1.5">Alert Threshold</label>
                    <input type="number" {...register('lowStockThreshold')} className="w-full border-2 border-[#141414] bg-transparent px-4 py-3 text-sm font-mono font-bold focus:bg-[#E4E3E0] focus:outline-none" placeholder="10" />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={closeModal} className="flex-1 border-2 border-[#141414] py-3 text-[10px] font-bold uppercase hover:bg-[#E4E3E0] transition-all">Abort</button>
                  <button type="submit" className="flex-1 border-2 border-[#141414] bg-[#141414] text-[#E4E3E0] py-3 text-[10px] font-bold uppercase hover:opacity-90 transition-all">Commit Entry</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
