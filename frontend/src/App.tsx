import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Navbar, type ActiveTab } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { StockMovementView } from './components/StockMovementView';
import { BulkImportView } from './components/BulkImportView';
import { PosView } from './components/PosView';
import { SalesHistoryView } from './components/SalesHistoryView';
import { Loader2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { user, token, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [productStatusFilter, setProductStatusFilter] = useState<string>('');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-3" />
        <p className="text-sm font-medium text-slate-400">Memuat sistem koperasi...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <LoginPage />;
  }

  const handleNavigateToProducts = (statusFilter?: string) => {
    setProductStatusFilter(statusFilter || '');
    setActiveTab('products');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView onNavigateToProducts={handleNavigateToProducts} />
        )}

        {activeTab === 'products' && (
          <ProductsView initialStatusFilter={productStatusFilter} />
        )}

        {activeTab === 'movements' && <StockMovementView />}

        {activeTab === 'import' && <BulkImportView />}

        {activeTab === 'pos' && <PosView />}

        {activeTab === 'sales' && <SalesHistoryView />}
      </main>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}

export default App;
