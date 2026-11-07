import { create } from 'zustand';

export type ViewMode = 'dashboard' | 'products' | 'customers' | 'sale' | 'transactions' | 'expenses' | 'reports';

interface AppState {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open })
}));
