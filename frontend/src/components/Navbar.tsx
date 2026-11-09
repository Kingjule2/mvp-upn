import React, { useState } from 'react';
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
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActiveTab = 'dashboard' | 'products' | 'movements' | 'import' | 'pos' | 'sales';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: {
    id: ActiveTab;
    label: string;
    shortLabel: string;
    desc: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard Analitik',
      shortLabel: 'Dashboard',
      desc: 'Ringkasan omzet, laba & grafik penjualan',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'products',
      label: 'Katalog & Master Produk',
      shortLabel: 'Produk',
      desc: 'Kelola daftar barang, harga & stok minimum',
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: 'pos',
      label: 'Kasir / Transaksi (POS)',
      shortLabel: 'Kasir',
      desc: 'Input transaksi penjualan & cetak struk',
      icon: <ShoppingCart className="w-4 h-4" />,
    },
    {
      id: 'movements',
      label: 'Kartu Stok (Riwayat)',
      shortLabel: 'Mutasi',
      desc: 'Catatan mutasi barang masuk, keluar & opname',
      icon: <History className="w-4 h-4" />,
    },
    {
      id: 'import',
      label: 'Impor Massal Excel/CSV',
      shortLabel: 'Impor',
      desc: 'Upload katalog produk via file Excel/CSV',
      icon: <FileSpreadsheet className="w-4 h-4" />,
      adminOnly: true,
    },
    {
      id: 'sales',
      label: 'Riwayat Penjualan',
      shortLabel: 'Nota',
      desc: 'Daftar transaksi kasir & rincian laba',
      icon: <Receipt className="w-4 h-4" />,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);
  const currentItem = visibleItems.find((item) => item.id === activeTab) || visibleItems[0];

  const handleSelectTab = (id: ActiveTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          {/* Top Bar */}
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo & Brand */}
            <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm font-bold shrink-0">
                <Store className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="font-bold text-sm sm:text-lg text-slate-900 tracking-tight truncate">
                    Koperasi Kampus
                  </span>
                  <span className="hidden xs:inline-flex text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                    UPN
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                  <span className="md:hidden font-medium text-emerald-700">{currentItem?.label}</span>
                  <span className="hidden md:inline">Sistem Inventaris &amp; Penjualan Kampus</span>
                </p>
              </div>
            </div>

            {/* Desktop User Profile & Logout */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                {isAdmin ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <UserCheck className="w-4 h-4 text-blue-600" />
                )}
                <div className="text-left text-xs">
                  <div className="font-semibold text-slate-800">{user?.name}</div>
                  <div className="text-slate-500 capitalize">
                    {user?.role === 'admin' ? 'Manajer / Admin' : 'Operator / Kasir'}
                  </div>
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

            {/* Mobile Right Controls: Role Badge + Hamburger Button */}
            <div className="flex md:hidden items-center space-x-2">
              <div
                className={`inline-flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-semibold ${
                  isAdmin
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-blue-50 border-blue-200 text-blue-800'
                }`}
              >
                {isAdmin ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span className="max-w-[80px] truncate">{user?.name?.split(' ')[0]}</span>
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Buka menu navigasi"
                className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                  mobileMenuOpen
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Desktop Tab Navigation */}
          <nav className="hidden md:flex space-x-1 overflow-x-auto py-1.5 border-t border-slate-100">
            {visibleItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap transition-all cursor-pointer ${
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

        {/* Mobile Slide-Down Drawer Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white shadow-xl">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isAdmin ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {isAdmin ? <ShieldCheck className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">{user?.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {user?.email} · {isAdmin ? 'Admin' : 'Kasir'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => logout()}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            <div className="p-2.5 space-y-1 max-h-[70vh] overflow-y-auto">
              {visibleItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">{item.label}</div>
                        <div
                          className={`text-[11px] truncate ${
                            isActive ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          {item.desc}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-300'}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Backdrop when mobile drawer is open */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-20 md:hidden"
        />
      )}

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]"
      >
        <div
          className={`grid ${
            visibleItems.length === 6 ? 'grid-cols-6' : 'grid-cols-5'
          } max-w-md mx-auto px-1 py-1`}
        >
          {visibleItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
                  isActive ? 'text-emerald-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-3 h-0.5 rounded-full bg-emerald-600" />
                )}
                <div
                  className={`p-1 rounded-lg transition-colors ${
                    isActive ? 'bg-emerald-50 text-emerald-600' : ''
                  }`}
                >
                  {item.icon}
                </div>
                <span className="text-[10px] leading-tight mt-0.5 truncate max-w-full">
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
