import React from 'react';
import { useAuth } from './AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  Package, 
  FileText, 
  ShoppingBag,
  ShieldCheck,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { user, appUser, isAdmin, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'CRM', icon: Users },
    { id: 'suppliers', label: 'Suppliers', icon: Truck },
    { id: 'purchases', label: 'Purchases', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'deliveries', label: 'Deliveries', icon: Truck },
  ];

  if (isAdmin) {
    menuItems.push({ id: 'users', label: 'Authorizations', icon: ShieldCheck });
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] font-sans text-[#141414] flex flex-col">
      {/* Header - Desktop & Mobile Hybrid */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#141414] h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#141414] rounded-sm flex items-center justify-center border border-[#141414]">
            <span className="text-[#E4E3E0] font-bold text-xs">ME</span>
          </div>
          <h1 className="text-xl font-bold tracking-tighter uppercase hidden sm:block">Mckasy Enterprise</h1>
        </div>

        <nav className="hidden lg:flex gap-8 text-[11px] font-bold uppercase tracking-widest">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`transition-all pb-1 border-b-2 ${
                activeTab === item.id 
                  ? 'border-[#141414] opacity-100' 
                  : 'border-transparent opacity-40 hover:opacity-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 pr-4 border-r border-[#141414] hidden sm:flex text-right">
             <div>
                <p className="text-[10px] font-bold leading-none">{user?.displayName?.toUpperCase()}</p>
                <p className="text-[8px] font-mono opacity-60 leading-none mt-1 uppercase">
                  {isAdmin ? 'System Admin' : appUser?.role === 'staff' ? 'Staff Member' : 'Operator'}
                </p>
             </div>
             <div className="w-8 h-8 rounded-full border-2 border-[#141414] flex items-center justify-center font-bold text-[10px] overflow-hidden">
                {user?.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                    user?.displayName?.slice(0, 2).toUpperCase()
                )}
             </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="p-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-all bg-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button 
            className="lg:hidden p-2 border border-[#141414]"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-16 z-30 bg-white border-b border-[#141414] p-6 lg:hidden"
          >
            <nav className="flex flex-col gap-4">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`text-left text-sm font-bold uppercase tracking-widest ${
                    activeTab === item.id ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-8">
        <div className="border-[1px] border-[#141414] bg-[#E4E3E0] min-h-[calc(100vh-10rem)]">
          {children}
        </div>
      </main>

      <footer className="h-8 border-t border-[#141414] flex items-center px-6 bg-white justify-between text-[9px] font-mono uppercase tracking-[0.2em] opacity-60">
        <div>Mckasy Enterprise © 2024 / System Active</div>
        <div>User: Administrator (IT_Student_Dev)</div>
      </footer>
    </div>
  );
}
