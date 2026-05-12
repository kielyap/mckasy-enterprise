export interface Customer {
  id: string;
  companyName: string;
  contactName: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  createdAt?: any;
}

export interface Supplier {
  id: string;
  supplierName: string;
  contactInfo?: string;
  createdAt?: any;
}

export interface Product {
  id: string;
  productNo?: string;
  itemName: string;
  packaging: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  lowStockThreshold?: number;
  updatedAt?: any;
}

export interface Purchase {
  id: string;
  date: any;
  supplierId: string;
  supplierName: string;
  orNo?: string;
  invoiceNo?: string;
  amount: number;
  memo?: string;
  createdAt?: any;
}

export type UserRole = 'admin' | 'staff';

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isAuthorized: boolean;
  updatedAt?: any;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'Invoice' | 'Delivery Receipt';
  date: any;
  customerId: string;
  customerName?: string;
  projectDescription?: string;
  purchaseOrderNo?: string;
  taxRate?: number;
  taxAmount?: number;
  depositReceived?: number;
  totalAmount: number;
  status: 'Paid' | 'Unpaid';
  totalCost: number;
  profit: number;
  createdAt?: any;
}

export interface InvoiceItem {
  id?: string;
  productId: string;
  productNo?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number;
  lineTotal: number;
}

export interface Delivery {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  status: 'Processing' | 'Dispensing' | 'In Transit' | 'Delivered';
  location?: string;
  updatedAt: any;
}
