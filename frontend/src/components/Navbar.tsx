import React from 'react';
import {
  LayoutDashboard,
  Package,
  History,
  FileSpreadsheet,
  ShoppingCart,
  Receipt,
  LogOut,
  UserCheck,
  ShieldCheck,
  Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'dashboard' | 'products' | 'movements' | 'import' | 'pos' | 'sales';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout, isAdmin } = useAuth();

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard Analitik', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'products', label: 'Katalog & Master Produk', icon: <Package className="w-4 h-4" /> },
    { id: 'movements', label: 'Kartu Stok (Riwayat)', icon: <History className="w-4 h-4" /> },
    { id: 'import', label: 'Impor Massal Excel/CSV', icon: <FileSpreadsheet className="w-4 h-4" />, adminOnly: true },
    { id: 'pos', label: 'Kasir / Transaksi (POS)', icon: <ShoppingCart className="w-4 h-4" /> },
    { id: 'sales', label: 'Riwayat Penjualan', icon: <Receipt className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">Koperasi Kampus</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  MVP v1.0
                </span>
              </div>
              <p className="text-xs text-slate-500">Sistem Inventaris & Penjualan Kampus</p>
            </div>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              {isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <UserCheck className="w-4 h-4 text-blue-600" />
              )}
              <div className="text-left text-xs">
                <div className="font-semibold text-slate-800">{user?.name}</div>
                <div className="text-slate-500 capitalize">{user?.role === 'admin' ? 'Manajer / Admin' : 'Operator / Kasir'}</div>
              </div>
            </div>

            <button
              onClick={() => logout()}
              title="Keluar dari sistem"
              className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto scrollbar-none py-1 border-t border-slate-100">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
