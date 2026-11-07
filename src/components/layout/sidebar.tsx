'use client';

import { useAppStore, type ViewMode } from '@/store';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Receipt,
  Wallet,
  BarChart3,
  Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLowStockProducts } from '@/hooks/use-data';

interface NavItem {
  id: ViewMode;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: 'products', label: 'Products', icon: <Package className="h-5 w-5" /> },
  { id: 'customers', label: 'Customers', icon: <Users className="h-5 w-5" /> },
  { id: 'sale', label: 'New Sale', icon: <ShoppingCart className="h-5 w-5" /> },
  { id: 'transactions', label: 'Transactions', icon: <Receipt className="h-5 w-5" /> },
  { id: 'expenses', label: 'Expenses', icon: <Wallet className="h-5 w-5" /> },
  { id: 'reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" /> },
];

export function Sidebar() {
  const { currentView, setCurrentView } = useAppStore();
  const { data: lowStockProducts = [] } = useLowStockProducts();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Store className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Store Manager</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={currentView === item.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3',
                currentView === item.id && 'bg-secondary'
              )}
              onClick={() => setCurrentView(item.id)}
            >
              {item.icon}
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'products' && lowStockProducts.length > 0 && (
                <Badge variant="destructive" className="ml-auto h-5 min-w-5 justify-center px-1.5">
                  {lowStockProducts.length}
                </Badge>
              )}
            </Button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-center text-xs text-muted-foreground">
            Offline-First Store Management
          </p>
        </div>
      </div>
    </aside>
  );
}
