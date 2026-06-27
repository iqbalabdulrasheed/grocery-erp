"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/auth";
import { supabase } from "@/services/supabaseClient";
import { db, User, Product, Order, StockLedgerEntry, CustomerLedgerEntry, Expense, AuditLog, Warehouse, WarehouseStock, logAction, StockReservation, PickList, Dispatch, CompanySettings, CustomerCompanyDetails, OutOfStockError, defaultCompanySettings } from "@/services/db";
import { 
  Users, Package, ClipboardList, TrendingUp, History, Trash2, 
  UserCheck, Shield, ShoppingBag, Plus, Search, Edit2, Check, 
  X, AlertTriangle, ChevronRight, LogOut, Bell, FileText, Download, 
  Printer, DollarSign, Truck, PlusCircle, RotateCcw, HelpCircle, 
  CreditCard, Calendar, BarChart2, Activity, Settings, RefreshCcw,
  Sun, Moon, Menu, Undo2, ArchiveRestore, PackageCheck
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from "recharts";

// Helper to format currency
const formatSAR = (amount: number) => {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
};

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Out of Stock Dialog state
  const [showOutOfStockDialog, setShowOutOfStockDialog] = useState(false);
  const [outOfStockDialogData, setOutOfStockDialogData] = useState<{ orderId: string; availableItems: any[]; outOfStockItems: any[]; partialItems: any[] } | null>(null);
  const [adjustedQtys, setAdjustedQtys] = useState<Record<string, number>>({});


  // Owner Company Settings state
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [showCompanySettingsSaved, setShowCompanySettingsSaved] = useState(false);
  const [companySettingsError, setCompanySettingsError] = useState("");

  // Customer Company Profile state
  const [customerCompany, setCustomerCompany] = useState<CustomerCompanyDetails | null>(null);
  const [customerCompanySaved, setCustomerCompanySaved] = useState(false);
  const [customerCompanyError, setCustomerCompanyError] = useState("");

  // Keep window var in sync so auto-refresh interval knows which tab to reload
  React.useEffect(() => { (window as any).__erpActiveTab = activeTab; }, [activeTab]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Lists & State
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockLedger, setStockLedger] = useState<StockLedgerEntry[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [trashList, setTrashList] = useState<{ id: string; name: string; type: 'product' | 'order' | 'user' | 'expense'; deletedAt: string }[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseStock, setWarehouseStock] = useState<WarehouseStock[]>([]);
  const [stockReservations, setStockReservations] = useState<StockReservation[]>([]);
  const [pickLists, setPickLists] = useState<PickList[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);

  // Warehouse form state
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouseForm, setWarehouseForm] = useState({ name: '', location: '' });
  const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);

  // Transfer stock modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ productId: '', fromWarehouseId: '', toWarehouseId: '', qty: 1 });

  // Stock filter by warehouse
  const [stockFilterWarehouse, setStockFilterWarehouse] = useState<string>('');
  const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; type: string }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Form states
  const [searchQuery, setSearchQuery] = useState("");
  const [productForm, setProductForm] = useState<Partial<Product>>({ name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0 });
  const [productWarehouseId, setProductWarehouseId] = useState<string>("");
  const [isEditingProduct, setIsEditingProduct] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductOriginalStock, setEditingProductOriginalStock] = useState<number>(0);

  // Order Cart state (for customer / phone sales)
  const [cart, setCart] = useState<{ product_id: string; qty: number }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedOrderType, setSelectedOrderType] = useState<Order['type']>("normal");
  const [isCodOrder, setIsCodOrder] = useState(false);
  const [manualDiscountPct, setManualDiscountPct] = useState(0);
  const [manualDiscountAmt, setManualDiscountAmt] = useState(0);

  // User Form state
  const [userForm, setUserForm] = useState<Partial<User>>({ username: "", password: "", name: "", role: "customer", credit_limit: 0, customer_discount: 0 });
  const [isEditingUser, setIsEditingUser] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userCustomPriceItem, setUserCustomPriceItem] = useState({ product_id: "", price: 0 });

  // Expense Form state
  const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({ amount: 0, category: "Utilities", description: "" });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseFilterCategory, setExpenseFilterCategory] = useState('');
  const [expenseFilterFrom, setExpenseFilterFrom] = useState('');
  const [expenseFilterTo, setExpenseFilterTo] = useState('');

  // Customer Payment Form state
  const [paymentForm, setPaymentForm] = useState({ amount: 0, ref: "", notes: "", customerId: "" });
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Stock Adjust Form state
  const [stockForm, setStockForm] = useState({ productId: "", qty: 0, type: "purchase" as StockLedgerEntry['type'], notes: "", warehouseId: "" });
  const [showStockModal, setShowStockModal] = useState(false);

  // Route & Staff Assign state
  const [assignForm, setAssignForm] = useState({ orderId: "", staffId: "", route: "" });
  const [showAssignModal, setShowAssignModal] = useState(false);

  // Cancel order state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  // Returns page state (must be top-level — Rules of Hooks)
  const [returnsView, setReturnsView] = React.useState<'byProduct' | 'byOrder'>('byProduct');
  const [expandedProduct, setExpandedProduct] = React.useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = React.useState<string | null>(null);
  const [returningOrderId, setReturningOrderId] = React.useState<string | null>(null);
  const [returnWarehouseModal, setReturnWarehouseModal] = React.useState<{ order: any; singleWarehouseMode: boolean } | null>(null);
  const [returnItemWarehouses, setReturnItemWarehouses] = React.useState<Record<string, string>>({});
  const [returnSingleWarehouseId, setReturnSingleWarehouseId] = React.useState<string>('');

  // Stock Ledger filters
  const [stockFilterProduct, setStockFilterProduct] = useState<string>('');
  const [stockFilterType, setStockFilterType] = useState<string>('');
  const [stockFilterFrom, setStockFilterFrom] = useState<string>('');
  const [stockFilterTo, setStockFilterTo] = useState<string>('');

  // Order Pipeline filters
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('');
  const [orderFilterType, setOrderFilterType] = useState<string>('');
  const [orderFilterFrom, setOrderFilterFrom] = useState<string>('');
  const [orderFilterTo, setOrderFilterTo] = useState<string>('');

  // Order History page filters + pagination
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('');
  const [historyFilterType, setHistoryFilterType] = useState<string>('');
  const [historyFilterFrom, setHistoryFilterFrom] = useState<string>('');
  const [historyFilterTo, setHistoryFilterTo] = useState<string>('');
  const [historyFilterCustomer, setHistoryFilterCustomer] = useState<string>('');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyPage, setHistoryPage] = useState<number>(1);
  const HISTORY_PAGE_SIZE = 25;

  // Accounts Ledger filters + pagination + expanded rows
  const [accountingSubTab, setAccountingSubTab] = useState<'expenses'|'ledger'>('expenses');
  const [ledgerFilterCustomer, setLedgerFilterCustomer] = useState<string>('');
  const [ledgerFilterType, setLedgerFilterType] = useState<string>('');
  const [ledgerFilterFrom, setLedgerFilterFrom] = useState<string>('');
  const [ledgerFilterTo, setLedgerFilterTo] = useState<string>('');
  const [expandedLedgerCustomers, setExpandedLedgerCustomers] = useState<Record<string, { entries: any[]; page: number } | null>>({});

  // Order success modal state
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState("");

  // Products filters & pagination
  const [productFilterCategory, setProductFilterCategory] = useState<string>('');
  const [productFilterStock, setProductFilterStock] = useState<string>('');
  const [productPage, setProductPage] = useState(1);
  const PRODUCT_PAGE_SIZE = 20;

  // Stock Ledger pagination
  const [stockPage, setStockPage] = useState(1);
  const STOCK_PAGE_SIZE = 50;

  // Date range filter for overview stats & charts
  const [dateRange, setDateRange] = useState<'daily' | 'monthly' | 'custom'>('monthly');
  const [customFrom, setCustomFrom] = useState<string>(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Global action lock — prevents double-clicks on any async button
  const actionLock = useRef(false);
  const withLock = useCallback(async (fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    try { await fn(); } finally { actionLock.current = false; }
  }, []);

  // Per-order loading state — disables all buttons on a specific order card while processing
  const [orderLoadingId, setOrderLoadingId] = React.useState<string | null>(null);
  const withOrderLock = React.useCallback(async (orderId: string, fn: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setOrderLoadingId(orderId);
    try { await fn(); } finally { setOrderLoadingId(null); actionLock.current = false; }
  }, []);

  // Close any open modal on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowProductModal(false);
      setShowUserModal(false);
      setShowStockModal(false);
      setShowAssignModal(false);
      setShowExpenseModal(false);
      setShowPaymentModal(false);
      setShowCancelModal(false);
      setShowWarehouseModal(false);
      setShowTransferModal(false);
      setShowNotifications(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Targeted fast reloaders — only fetch what changed
  const reloadOrders = useCallback(async () => {
    const ords = await db.getOrders();
    setOrders(ords);
  }, []);

  const reloadOrdersAndStock = useCallback(async () => {
    const [ords, stk, prods, whStk, res, pls, dps] = await Promise.all([
      db.getOrders(), db.getStockLedger(), db.getProducts(), db.getWarehouseStock(),
      db.getReservations(), db.getPickLists(), db.getDispatches()
    ]);
    setOrders(ords);
    setStockLedger(stk);
    setProducts(prods);
    setWarehouseStock(whStk);
    setStockReservations(res);
    setPickLists(pls);
    setDispatches(dps);
  }, []);

  // Tab-aware smart reload: only fetches what the current tab needs
  const reloadTabData = useCallback(async (tab: string) => {
    const fetchers: Record<string, () => Promise<void>> = {
      overview:   async () => { const [p, o, e] = await Promise.all([db.getProducts(), db.getOrders(), db.getExpenses()]); setProducts(p); setOrders(o); setExpenses(e); },
      products:   async () => { const p = await db.getProducts(); setProducts(p); },
      inventory:  async () => { const [p, s, w, res] = await Promise.all([db.getProducts(), db.getStockLedger(), db.getWarehouseStock(), db.getReservations()]); setProducts(p); setStockLedger(s); setWarehouseStock(w); setStockReservations(res); },
      orders:        async () => { const [o, p, w, res, pls, dps] = await Promise.all([db.getOrders(), db.getProducts(), db.getWarehouseStock(), db.getReservations(), db.getPickLists(), db.getDispatches()]); setOrders(o); setProducts(p); setWarehouseStock(w); setStockReservations(res); setPickLists(pls); setDispatches(dps); },
      'create-order': async () => { const [p, w, wh] = await Promise.all([db.getProducts(), db.getWarehouseStock(), db.getWarehouses()]); setProducts(p); setWarehouseStock(w); setWarehouses(wh); },
      returns:       async () => { const [o, p, w, wh] = await Promise.all([db.getOrders(), db.getProducts(), db.getWarehouseStock(), db.getWarehouses()]); setOrders(o); setProducts(p); setWarehouseStock(w); setWarehouses(wh); },
      accounting: async () => { const [e, o] = await Promise.all([db.getExpenses(), db.getOrders()]); setExpenses(e); setOrders(o); },
      users:      async () => { const u = await db.getUsers(); setUsersList(u); },
      logs:       async () => { const user = auth.getCurrentUser(); if (user) { const l = await db.getAuditLogs(user); setAuditLogs(l); } },
      warehouses: async () => { const [w, ws] = await Promise.all([db.getWarehouses(), db.getWarehouseStock()]); setWarehouses(w); setWarehouseStock(ws); },
      trash:      async () => { const t = await db.getTrash(); setTrashList(t); },
      'company-settings': async () => { const s = await db.getCompanySettings(); setCompanySettings(s); },
      'customer-profile': async () => { const user = auth.getCurrentUser(); if (user) { const cc = await db.getCustomerCompanyDetails(user.id); if (cc) setCustomerCompany(cc); } },
    };
    await (fetchers[tab] || fetchers.overview)();
  }, []);

  // Full parallel reload — all data at once (used by initial load and full refresh button)
  const reloadData = async () => {
    const user = auth.getCurrentUser();
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);

    const [prods, ords, stk, usrs, exps, logs, trash, whs, whStk, res, pls, dps, settings] = await Promise.all([
      db.getProducts(), db.getOrders(), db.getStockLedger(), db.getUsers(),
      db.getExpenses(), db.getAuditLogs(user), db.getTrash(),
      db.getWarehouses(), db.getWarehouseStock(),
      db.getReservations(), db.getPickLists(), db.getDispatches(),
      db.getCompanySettings()
    ]);

    setProducts(prods);
    setOrders(ords);
    setStockLedger(stk);
    setUsersList(usrs);
    setExpenses(exps);
    setAuditLogs(logs);
    setTrashList(trash);
    setWarehouses(whs);
    setWarehouseStock(whStk);
    setStockReservations(res);
    setPickLists(pls);
    setDispatches(dps);
    setCompanySettings(settings);

    if (user.role === 'customer') {
      const cc = await db.getCustomerCompanyDetails(user.id);
      if (cc) setCustomerCompany(cc);
    }

    // Generate smart contextual notifications
    const alerts = [];
    const lowStockProds = prods.filter(p => p.stock_qty <= p.min_stock);
    lowStockProds.forEach(p => {
      alerts.push({
        id: `notif-stock-${p.id}`,
        text: `Low Stock alert: ${p.name} (${p.stock_qty} ${p.unit} left)`,
        time: "Just now",
        type: "stock"
      });
    });

    const pendingOrders = ords.filter(o => o.status === 'created');
    if (pendingOrders.length > 0) {
      alerts.push({
        id: "notif-orders",
        text: `You have ${pendingOrders.length} pending orders waiting for approval`,
        time: "5m ago",
        type: "order"
      });
    }

    setNotifications(alerts);
  };


  const handleWipeDatabase = async () => {
    if (!currentUser) return;
    const pwd = prompt("WARNING: This will permanently wipe all users, products, orders, expenses, and ledger entries (keeping only your administrator account). Enter the security password to confirm:");
    if (pwd === null) return;
    if (pwd === "9495471187") {
      try {
        await db.wipeDatabase(currentUser);
        alert("Database successfully wiped and reset to clean defaults.");
        reloadData();
      } catch (err: any) {
        alert("Failed to wipe database: " + err.message);
      }
    } else {
      alert("Incorrect password. Wipe cancelled.");
    }
  };

  useEffect(() => {
    setMounted(true);

    // Initialize Theme
    // Load theme: Supabase user_preferences → localStorage fallback
    const loadTheme = async () => {
      let storedTheme: "dark" | "light" = "dark";
      if (supabase) {
        try {
          const currentUser = auth.getCurrentUser();
          if (currentUser) {
            const { data } = await supabase
              .from("user_preferences")
              .select("theme")
              .eq("user_id", currentUser.id)
              .single();
            if (data?.theme === "dark" || data?.theme === "light") {
              storedTheme = data.theme as "dark" | "light";
            } else {
              storedTheme = (localStorage.getItem("erp_theme") as "dark" | "light") || "dark";
            }
          } else {
            storedTheme = (localStorage.getItem("erp_theme") as "dark" | "light") || "dark";
          }
        } catch {
          storedTheme = (localStorage.getItem("erp_theme") as "dark" | "light") || "dark";
        }
      } else {
        storedTheme = (localStorage.getItem("erp_theme") as "dark" | "light") || "dark";
      }
      setTheme(storedTheme);
      document.documentElement.setAttribute("data-theme", storedTheme);
      if (storedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    loadTheme();

    reloadData();

    // Auto-refresh: poll every 15 seconds so stock, orders, and reservations
    // stay current across all users without a manual page refresh.
    const pollInterval = setInterval(() => {
      const tab = (window as any).__erpActiveTab || 'overview';
      reloadTabData(tab).catch(() => {});
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [router, reloadTabData]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    // Persist theme: Supabase user_preferences + localStorage fallback
    if (supabase) {
      const currentUser = auth.getCurrentUser();
      if (currentUser) {
        supabase
          .from("user_preferences")
          .upsert({ user_id: currentUser.id, theme: newTheme })
          .then(({ error }) => {
            if (error) localStorage.setItem("erp_theme", newTheme);
          });
      } else {
        localStorage.setItem("erp_theme", newTheme);
      }
    } else {
      localStorage.setItem("erp_theme", newTheme);
    }
    document.documentElement.setAttribute("data-theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (!mounted || !currentUser) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleLogout = async () => {
    await auth.logout();
    router.push("/");
  };

  // CSV Export Utility (SAR aligned)
  const exportToCSV = async (data: any[], filename: string) => {
    if (!data.length) return;
    
    // Clean data if customer is exporting to prevent leaking purchase_cost
    let cleanData = data;
    if (currentUser?.role === 'customer') {
      cleanData = data.map(item => {
        const copy = { ...item };
        delete copy.purchase_cost;
        return copy;
      });
    }
    
    // Extract headers
    const headers = Object.keys(cleanData[0]).join(",");
    const rows = data.map(row => {
      return Object.values(row).map(val => {
        if (typeof val === 'string') {
          return `"${val.replace(/"/g, '""')}"`;
        }
        if (typeof val === 'object' && val !== null) {
          return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        }
        return val;
      }).join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Audit log
    await db.updateUser(currentUser.id, {}, currentUser); 
    await logAction(currentUser.id, currentUser.name, currentUser.role, `Exported CSV report: ${filename}`);
  };

  // PRODUCT CRUD HANDLERS
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name || !productForm.sku || !productForm.category) return;

    const tempId = `prod-${Date.now()}`;
    const optimisticProduct: Product = { id: tempId, name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0, ...productForm } as Product;

    // Close modal & update UI instantly
    setShowProductModal(false);
    if (isEditingProduct) {
      setProducts(prev => prev.map(p => p.id === isEditingProduct ? { ...p, ...productForm } : p));
    } else {
      setProducts(prev => [...prev, optimisticProduct]);
    }
    const editingId = isEditingProduct;
    setIsEditingProduct(null);
    setProductForm({ name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0 });
    setProductWarehouseId("");

    // Persist in background
    try {
      if (editingId) {
        await db.updateProduct(editingId, productForm, currentUser, productWarehouseId || undefined);
      } else {
        const saved = await db.createProduct(productForm as any, currentUser, productWarehouseId || undefined);
        // Replace temp optimistic item with real one from server
        setProducts(prev => prev.map(p => p.id === tempId ? saved : p));
      }
    } catch (err: any) {
      alert(err.message);
      await reloadData(); // revert on error
    }
  };

  const startEditProduct = (prod: Product) => {
    setIsEditingProduct(prod.id);
    setEditingProductOriginalStock(prod.stock_qty);
    setProductForm(prod);
    // Pre-select the warehouse that already holds stock for this product (pick the one with most qty)
    const existing = warehouseStock.filter(ws => ws.product_id === prod.id);
    if (existing.length > 0) {
      const top = existing.reduce((a, b) => (a.qty >= b.qty ? a : b));
      setProductWarehouseId(top.warehouse_id);
    } else if (warehouses.length > 0) {
      setProductWarehouseId(warehouses[0].id);
    } else {
      setProductWarehouseId("");
    }
    setShowProductModal(true);
  };

  const deleteProduct = async (id: string) => {
    if (confirm("Are you sure you want to soft-delete this product? It will move to Trash.")) {
      // Optimistic: remove from list immediately
      const removed = products.find(p => p.id === id);
      setProducts(prev => prev.filter(p => p.id !== id));
      try {
        await db.deleteProduct(id, currentUser);
      } catch (err: any) {
        alert(err.message);
        if (removed) setProducts(prev => [...prev, removed]); // revert
      }
    }
  };

  // USER CRUD HANDLERS
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.name) return;

    const tempId = `usr-${Date.now()}`;
    const optimisticUser: User = { id: tempId, username: "", password: "", name: "", role: "customer", credit_limit: 0, customer_discount: 0, ...userForm } as User;

    setShowUserModal(false);
    if (isEditingUser) {
      setUsersList(prev => prev.map(u => u.id === isEditingUser ? { ...u, ...userForm } : u));
    } else {
      setUsersList(prev => [...prev, optimisticUser]);
    }
    const editingId = isEditingUser;
    setIsEditingUser(null);
    setUserForm({ username: "", password: "", name: "", role: "customer", credit_limit: 0, customer_discount: 0 });

    try {
      if (editingId) {
        await db.updateUser(editingId, userForm, currentUser);
      } else {
        const saved = await db.createUser(userForm as any, currentUser);
        setUsersList(prev => prev.map(u => u.id === tempId ? saved : u));
      }
    } catch (err: any) {
      alert(err.message);
      await reloadData();
    }
  };

  const startEditUser = (usr: User) => {
    setIsEditingUser(usr.id);
    setUserForm({ ...usr, password: "" });
    setShowUserModal(true);
  };

  const deleteUser = async (id: string) => {
    if (confirm("Soft-delete this user account?")) {
      const removed = usersList.find(u => u.id === id);
      setUsersList(prev => prev.filter(u => u.id !== id));
      try {
        await db.deleteUser(id, currentUser);
      } catch (err: any) {
        alert(err.message);
        if (removed) setUsersList(prev => [...prev, removed]);
      }
    }
  };

  const addCustomPriceToUser = async (userId: string) => {
    if (!userCustomPriceItem.product_id || userCustomPriceItem.price <= 0) return;
    const target = usersList.find(u => u.id === userId);
    if (!target) return;
    
    const customPricing = { ...(target.custom_pricing || {}) };
    customPricing[userCustomPriceItem.product_id] = userCustomPriceItem.price;

    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, custom_pricing: customPricing } : u));
    setUserCustomPriceItem({ product_id: "", price: 0 });
    db.updateUser(userId, { custom_pricing: customPricing }, currentUser!).catch(async (err) => {
      alert(err.message); await reloadData();
    });
  };

  const removeCustomPriceFromUser = async (userId: string, productId: string) => {
    const target = usersList.find(u => u.id === userId);
    if (!target || !target.custom_pricing) return;
    
    const customPricing = { ...target.custom_pricing };
    delete customPricing[productId];

    setUsersList(prev => prev.map(u => u.id === userId ? { ...u, custom_pricing: customPricing } : u));
    db.updateUser(userId, { custom_pricing: customPricing }, currentUser!).catch(async (err) => {
      alert(err.message); await reloadData();
    });
  };

  // STOCK ADJUST SUBMIT
  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.productId || stockForm.qty === 0) return;

    const stockInTypes: StockLedgerEntry['type'][] = ['purchase', 'supplier_return', 'customer_return'];
    const absQty = Math.abs(stockForm.qty);
    // manual_adjustment: user enters signed value directly (negative to deduct, positive to add)
    const change = stockForm.type === 'manual_adjustment' ? stockForm.qty : (stockInTypes.includes(stockForm.type) ? absQty : -absQty);
    const pid = stockForm.productId;
    const prod = products.find(p => p.id === pid);

    // Optimistic: update product stock qty and add ledger entry immediately
    setProducts(prev => prev.map(p => p.id === pid ? { ...p, stock_qty: p.stock_qty + change } : p));
    const tempEntry: StockLedgerEntry = {
      id: `stk-${Date.now()}`,
      product_id: pid,
      product_name: prod?.name || pid,
      qty_change: change,
      type: stockForm.type,
      notes: stockForm.notes,
      timestamp: new Date().toISOString(),
      user_id: currentUser!.id,
      user_name: currentUser!.name,
      warehouse_id: stockForm.warehouseId || undefined,
    };
    setStockLedger(prev => [tempEntry, ...prev]);
    setShowStockModal(false);
    setStockForm({ productId: "", qty: 0, type: "purchase", notes: "", warehouseId: "" });

    try {
      await db.addStockAdjustment(pid, change, stockForm.type, stockForm.notes, currentUser!, stockForm.warehouseId || undefined);
    } catch (err: any) {
      alert(err.message);
      await reloadData(); // revert on error
    }
  };

  // PICK LIST ITEM TOGGLE
  const handlePickItemToggle = async (picklistId: string, productId: string, isPicked: boolean, warehouseId?: string) => {
    const pl = pickLists.find(p => p.id === picklistId);
    if (!pl) return;
    const updatedItems = pl.items.map(item => {
      // Match by product_id + warehouse_id so split-warehouse rows are toggled independently
      const matches = warehouseId
        ? item.product_id === productId && item.warehouse_id === warehouseId
        : item.product_id === productId;
      if (matches) {
        return { ...item, picked_qty: isPicked ? item.qty : 0 };
      }
      return item;
    });
    const allCompleted = updatedItems.every(item => item.picked_qty === item.qty);
    const newStatus = allCompleted ? 'completed' : 'picking';
    try {
      const updatedPl = await db.updatePickList(picklistId, { items: updatedItems, status: newStatus });
      setPickLists(prev => prev.map(p => p.id === picklistId ? updatedPl : p));
    } catch (err: any) {
      alert(err.message || "Failed to update pick list");
    }
  };

  // ASSIGN & ROUTE SUBMIT
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.orderId || !assignForm.staffId) return;
    await withLock(async () => {
      await db.updateOrderStatus(assignForm.orderId, 'assigned', currentUser, {
        assignedStaffId: assignForm.staffId,
        deliveryRoute: assignForm.route
      });
      setShowAssignModal(false);
      setAssignForm({ orderId: "", staffId: "", route: "" });
      await reloadOrdersAndStock();
    });
  };

  // EXPENSE HANDLERS
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.amount || expenseForm.amount <= 0 || !expenseForm.description) return;

    const tempExpense: Expense = {
      id: `exp-${Date.now()}`,
      amount: expenseForm.amount || 0,
      category: expenseForm.category || "Utilities",
      description: expenseForm.description || "",
      timestamp: new Date().toISOString(),
      user_id: currentUser!.id,
      user_name: currentUser!.name,
    };
    setShowExpenseModal(false);
    setExpenses(prev => [tempExpense, ...prev]);
    setExpenseForm({ amount: 0, category: "Utilities", description: "" });

    try {
      const saved = await db.createExpense(expenseForm as any, currentUser!);
      setExpenses(prev => prev.map(e => e.id === tempExpense.id ? saved : e));
    } catch (err: any) {
      alert(err.message);
      setExpenses(prev => prev.filter(e => e.id !== tempExpense.id));
    }
  };

  // PAYMENT HANDLERS
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentForm.amount <= 0 || !paymentForm.customerId) return;

    // Optimistic: update the customer balance in usersList immediately
    const customerId = paymentForm.customerId;
    const amount = paymentForm.amount;
    setUsersList(prev => prev.map(u =>
      u.id === customerId ? { ...u, outstanding_balance: Math.max(0, (u.outstanding_balance || 0) - amount) } : u
    ));
    setShowPaymentModal(false);
    setPaymentForm({ amount: 0, ref: "", notes: "", customerId: "" });

    try {
      await db.recordCustomerPayment(customerId, amount, paymentForm.ref, paymentForm.notes, currentUser!);
    } catch (err: any) {
      alert(err.message);
      await reloadData(); // revert on error
    }
  };

  // CART HANDLERS
  // Everyone orders against total combined stock across all warehouses.
  // The system automatically pulls from the primary warehouse first, and combines
  // in stock from other warehouses behind the scenes if the primary runs short —
  // no warehouse choice needed at order time.
  const getAvailableQty = (prodId: string): number => {
    return Math.max(0, warehouseStock
      .filter(ws => ws.product_id === prodId)
      .reduce((sum, ws) => sum + ws.qty, 0));
  };

  const addToCart = (prodId: string) => {
    const maxQty = getAvailableQty(prodId);
    const existing = cart.find(c => c.product_id === prodId);
    if (existing) {
      if (existing.qty + 1 > maxQty) {
        alert(`Cannot add more. Only ${maxQty} units available.`);
        return;
      }
      setCart(cart.map(c => c.product_id === prodId ? { ...c, qty: c.qty + 1 } : c));
    } else {
      if (maxQty <= 0) {
        alert(`No stock available.`);
        return;
      }
      setCart([...cart, { product_id: prodId, qty: 1 }]);
    }
  };

  const removeFromCart = (prodId: string) => {
    setCart(cart.filter(c => c.product_id !== prodId));
  };

  const updateCartQty = (prodId: string, val: number) => {
    if (val <= 0) {
      removeFromCart(prodId);
      return;
    }
    const maxQty = getAvailableQty(prodId);
    if (val > maxQty) {
      alert(`Exceeds available inventory (${maxQty} units).`);
      return;
    }
    setCart(cart.map(c => c.product_id === prodId ? { ...c, qty: val } : c));
  };

  const checkoutCart = async () => {
    if (!cart.length) return;
    const customerId = currentUser.role === 'customer' ? currentUser.id : selectedCustomerId;
    if (!customerId) {
      alert("Please select a customer for this order.");
      return;
    }

    // Compute totals optimistically — mirrors db.calculateCustomerPrice logic exactly
    const customer = usersList.find(u => u.id === customerId);
    const items = cart.map(c => {
      const p = products.find(pr => pr.id === c.product_id)!;
      const sellingPrice = p?.selling_price ?? 0;
      let unitPrice: number;
      if (customer?.custom_pricing?.[c.product_id] !== undefined) {
        // Custom price takes precedence — no additional discount stacked on top
        unitPrice = customer.custom_pricing[c.product_id];
      } else if (customer?.customer_discount && customer.customer_discount > 0) {
        unitPrice = Number((sellingPrice * (1 - customer.customer_discount / 100)).toFixed(2));
      } else {
        unitPrice = sellingPrice;
      }
      return {
        product_id: c.product_id,
        name: p?.name || c.product_id,
        qty: c.qty,
        unit_price: unitPrice,
        total: Number((unitPrice * c.qty).toFixed(2)),
      };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discountAmt = subtotal * (manualDiscountPct / 100) + manualDiscountAmt;
    const total = Math.max(0, subtotal - discountAmt);
    const tempOrderId = `ord-${Date.now()}`;

    // Capture snapshot BEFORE clearing cart — cart.slice() after clear is always []
    const cartSnapshot = cart.slice();

    // Determine status — auto-approving roles skip the 'created' state
    const isApprovedImmediately = ['admin', 'superowner', 'owner', 'manager', 'warehouse_manager'].includes(currentUser.role);
    const tempStatus: Order['status'] = isApprovedImmediately ? 'approved' : 'created';

    // Primary warehouse is fulfilled from first automatically; only used here for an
    // optimistic preview before the real order (with its final combined breakdown) comes back.
    const primaryWh = warehouses[0];

    const tempOrder: Order = {
      id: tempOrderId,
      customer_id: customerId,
      customer_name: customer?.name || customerId,
      created_by_id: currentUser!.id,
      created_by_name: currentUser!.name,
      created_at: new Date().toISOString(),
      type: selectedOrderType,
      status: tempStatus,
      items,
      subtotal,
      discount: discountAmt,
      manual_discount_pct: manualDiscountPct,
      manual_discount_amt: manualDiscountAmt,
      total,
      cod_tracking: isCodOrder,
      warehouse_id: primaryWh?.id,
      warehouse_name: primaryWh?.name,
      status_history: [{ status: 'created', updated_at: new Date().toISOString(), updated_by_name: currentUser!.name }],
    };

    // Optimistic: reserve stock and add order immediately
    if (isApprovedImmediately) {
      const tempResList: StockReservation[] = cart.map(c => ({
        id: `res-temp-${Date.now()}-${c.product_id}`,
        order_id: tempOrderId,
        product_id: c.product_id,
        warehouse_id: primaryWh?.id || 'wh-main',
        qty: c.qty,
        status: 'active',
        created_at: new Date().toISOString()
      }));
      setStockReservations(prev => [...tempResList, ...prev]);
    }
    setOrders(prev => [tempOrder, ...prev]);
    setCart([]);
    setSelectedCustomerId("");
    setManualDiscountPct(0);
    setManualDiscountAmt(0);
    setLastOrderId(tempOrderId);
    setShowOrderSuccess(true);

    try {
      const newOrder = await db.createOrder(customerId, cartSnapshot, selectedOrderType, isCodOrder, currentUser!, manualDiscountPct, manualDiscountAmt);
      // Replace temp order with real one
      if (newOrder) {
        setOrders(prev => prev.map(o => o.id === tempOrderId ? newOrder : o));
        setLastOrderId(newOrder.id);
      }
    } catch (err: any) {
      alert(err.message || "Failed to checkout order");
      await reloadData(); // revert on error
    }
  };

  const getZatcaTlv = (
    sellerName: string,
    sellerVat: string,
    timestamp: string,
    totalAmount: number,
    vatAmount: number
  ): string => {
    const encoder = new TextEncoder();
    
    const toTlvSegment = (tag: number, value: string): Uint8Array => {
      const valBytes = encoder.encode(value);
      const len = valBytes.length;
      const segment = new Uint8Array(2 + len);
      segment[0] = tag;
      segment[1] = len;
      segment.set(valBytes, 2);
      return segment;
    };

    const seg1 = toTlvSegment(1, sellerName);
    const seg2 = toTlvSegment(2, sellerVat);
    const seg3 = toTlvSegment(3, timestamp);
    const seg4 = toTlvSegment(4, totalAmount.toFixed(2));
    const seg5 = toTlvSegment(5, vatAmount.toFixed(2));

    const totalLength = seg1.length + seg2.length + seg3.length + seg4.length + seg5.length;
    const tlvBytes = new Uint8Array(totalLength);
    
    let offset = 0;
    tlvBytes.set(seg1, offset); offset += seg1.length;
    tlvBytes.set(seg2, offset); offset += seg2.length;
    tlvBytes.set(seg3, offset); offset += seg3.length;
    tlvBytes.set(seg4, offset); offset += seg4.length;
    tlvBytes.set(seg5, offset);

    let binary = '';
    const len = tlvBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(tlvBytes[i]);
    }
    return window.btoa(binary);
  };

  const handleGenerateInvoice = async (order: Order) => {
    const seller = companySettings || defaultCompanySettings;
    let customerComp: CustomerCompanyDetails | undefined;
    try {
      customerComp = await db.getCustomerCompanyDetails(order.customer_id);
    } catch (e) {}

    const grandTotal = order.total;
    const vatTotal = grandTotal * (15 / 115);
    const subtotalBeforeVat = grandTotal - vatTotal;
    const invoiceTime = order.created_at || new Date().toISOString();
    const invoiceDateStr = new Date(invoiceTime).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const logoImg = seller.logo_url
      ? `<img src="${seller.logo_url}" class="header-logo" alt="Logo" />`
      : `<div style="font-size:18px;font-weight:800;color:#3b82f6;">${seller.name}</div>`;
    const stampImg = seller.stamp_url
      ? `<img src="${seller.stamp_url}" class="footer-stamp" alt="Stamp" /><br />`
      : '';

    const itemsHtml = order.items.map(item => {
      const p = products.find(pr => pr.id === item.product_id);
      const sku = p ? p.sku : 'N/A';
      const itemVat = item.total * (15 / 115);
      const itemUnitPriceExVat = item.unit_price / 1.15;
      return `<tr class="item-row">
        <td><div class="item-name">${item.name}</div></td>
        <td class="tc mono">${sku}</td>
        <td class="tc">${item.qty}</td>
        <td class="tr">${formatSAR(itemUnitPriceExVat)}</td>
        <td class="tc">15%</td>
        <td class="tr">${formatSAR(itemVat)}</td>
        <td class="tr bold">${formatSAR(item.total)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <title>Invoice-${order.id}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    @media print {
      body { margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    * { box-sizing:border-box; font-family:'Outfit',sans-serif; }
    body { background:#fff; color:#1e293b; margin:0; padding:40px; font-size:11px; line-height:1.5; }
    .invoice-container { width:100%; max-width:800px; margin:0 auto; }
    .header-table { width:100%; border-collapse:collapse; margin-bottom:25px; }
    .header-logo { width:120px; max-height:80px; object-fit:contain; }
    .invoice-title { font-size:20px; font-weight:800; color:#0f172a; text-align:center; margin:0 0 5px 0; }
    .invoice-title-arabic { font-size:18px; font-weight:700; color:#475569; text-align:center; margin:0; }
    .metadata-bar { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 15px; margin-bottom:25px; display:flex; justify-content:space-between; align-items:center; }
    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:25px; }
    .info-card { border:1px solid #e2e8f0; border-radius:8px; padding:15px; }
    .card-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; color:#3b82f6; border-bottom:1px dashed #e2e8f0; padding-bottom:8px; margin-bottom:10px; display:flex; justify-content:space-between; }
    .info-row { display:flex; justify-content:space-between; margin-bottom:6px; }
    .info-label { color:#64748b; font-weight:500; }
    .info-value { color:#0f172a; font-weight:600; text-align:right; }
    .items-table { width:100%; border-collapse:collapse; margin-bottom:25px; }
    .items-table th { background:#f1f5f9; color:#475569; font-weight:700; font-size:9px; text-transform:uppercase; letter-spacing:0.5px; padding:10px 12px; border-top:1px solid #cbd5e1; border-bottom:1px solid #cbd5e1; }
    .items-table td { padding:12px; border-bottom:1px solid #e2e8f0; vertical-align:middle; }
    .item-name { font-weight:700; color:#0f172a; font-size:11px; }
    .tc { text-align:center; } .tr { text-align:right; } .mono { font-family:monospace; } .bold { font-weight:700; }
    .totals-box { width:320px; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-left:auto; }
    .totals-row { display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid #e2e8f0; font-size:10px; }
    .totals-row:last-child { border-bottom:none; }
    .totals-row.grand-total { background:#3b82f6; color:#fff; font-size:12px; font-weight:800; }
    .footer { border-top:1px solid #cbd5e1; padding-top:15px; margin-top:40px; text-align:center; color:#64748b; font-size:9px; }
    .footer-stamp { width:100px; max-height:80px; object-fit:contain; margin-bottom:10px; opacity:0.85; }
  </style>
</head>
<body>
  <div class="invoice-container">
    <table class="header-table">
      <tr>
        <td style="width:33%;vertical-align:top;">${logoImg}</td>
        <td style="width:34%;text-align:center;vertical-align:middle;">
          <h2 class="invoice-title">TAX INVOICE</h2>
          <h3 class="invoice-title-arabic">فاتورة ضريبية</h3>
        </td>
        <td style="width:33%;text-align:right;vertical-align:top;">
          <div style="font-size:9px;color:#64748b;font-weight:600;">Original / النسخة الأصلية</div>
        </td>
      </tr>
    </table>

    <div class="metadata-bar">
      <div><span class="info-label">Invoice No / رقم الفاتورة: </span><span class="info-value">${order.id}</span></div>
      <div><span class="info-label">Date / التاريخ: </span><span class="info-value">${invoiceDateStr}</span></div>
      <div><span class="info-label">Payment / طريقة الدفع: </span><span class="info-value" style="text-transform:uppercase;">${order.type === 'normal' ? 'Credit' : order.type}</span></div>
    </div>

    <div class="info-grid">
      <div class="info-card">
        <div class="card-title"><span>Seller Details</span><span>بيانات المورد</span></div>
        <div class="info-row"><span class="info-label">Company / الشركة:</span><span class="info-value">${seller.name}</span></div>
        <div class="info-row"><span class="info-label">VAT No / الرقم الضريبي:</span><span class="info-value">${seller.vat_number}</span></div>
        <div class="info-row"><span class="info-label">CR No / السجل التجاري:</span><span class="info-value">${seller.cr_number}</span></div>
        ${seller.zakat_number ? `<div class="info-row"><span class="info-label">Zakat No:</span><span class="info-value">${seller.zakat_number}</span></div>` : ''}
        <div class="info-row"><span class="info-label">Address / العنوان:</span><span class="info-value">${seller.address}, ${seller.city}</span></div>
        <div class="info-row"><span class="info-label">Tel / الهاتف:</span><span class="info-value">${seller.phone}</span></div>
      </div>
      <div class="info-card">
        <div class="card-title"><span>Customer Details</span><span>بيانات العميل</span></div>
        <div class="info-row"><span class="info-label">Name / الاسم:</span><span class="info-value">${customerComp?.company_name || order.customer_name}</span></div>
        ${customerComp ? `
        <div class="info-row"><span class="info-label">Contact:</span><span class="info-value">${customerComp.contact_person}</span></div>
        <div class="info-row"><span class="info-label">VAT No:</span><span class="info-value">${customerComp.vat_number || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">CR No:</span><span class="info-value">${customerComp.cr_number || 'N/A'}</span></div>
        <div class="info-row"><span class="info-label">Address:</span><span class="info-value">${customerComp.address || 'N/A'}, ${customerComp.city || ''}</span></div>
        <div class="info-row"><span class="info-label">Tel:</span><span class="info-value">${customerComp.phone || 'N/A'}</span></div>
        ` : `
        <div class="info-row"><span class="info-label">Customer ID:</span><span class="info-value">${order.customer_id}</span></div>
        <div class="info-row"><span class="info-label">Account:</span><span class="info-value">Standard Retail</span></div>
        `}
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="text-align:left;width:38%;">Description / الوصف</th>
          <th style="width:13%;">SKU</th>
          <th style="width:8%;">Qty</th>
          <th style="text-align:right;width:13%;">Unit Price (Ex VAT)</th>
          <th style="width:7%;">VAT%</th>
          <th style="text-align:right;width:11%;">VAT Amount</th>
          <th style="text-align:right;width:10%;">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row"><span class="info-label">Subtotal (Ex VAT):</span><span class="info-value">${formatSAR(subtotalBeforeVat)}</span></div>
      <div class="totals-row"><span class="info-label">VAT (15%):</span><span class="info-value">${formatSAR(vatTotal)}</span></div>
      ${order.discount > 0 ? `<div class="totals-row"><span class="info-label">Discount:</span><span class="info-value" style="color:#ef4444;">- ${formatSAR(order.discount)}</span></div>` : ''}
      <div class="totals-row grand-total"><span>Grand Total (Inc VAT) / المجموع النهائي:</span><span>${formatSAR(grandTotal)}</span></div>
    </div>

    <div class="footer">
      ${stampImg}
      <p style="margin:0 0 5px 0;font-weight:700;">${seller.name} · VAT: ${seller.vat_number} · CR: ${seller.cr_number}</p>
      <p style="margin:0;">${seller.address}, ${seller.city}, ${seller.postal_code}, ${seller.country} | Tel: ${seller.phone} | ${seller.email}</p>
    </div>
  </div>
  <script>
    document.title = 'Invoice-${order.id}';
  </script>
</body>
</html>`;

    // Inject a hidden iframe into the current page, write the invoice HTML into it,
    // then call print() on it — no new tab, no navigation, just the print dialog.
    const existingFrame = document.getElementById('__invoice_print_frame__');
    if (existingFrame) existingFrame.remove();

    const frame = document.createElement('iframe');
    frame.id = '__invoice_print_frame__';
    frame.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(frame);

    const frameDoc = frame.contentDocument || frame.contentWindow?.document;
    if (!frameDoc) return;
    frameDoc.open();
    frameDoc.write(html);
    frameDoc.close();

    frame.onload = () => {
      setTimeout(() => {
        const prevTitle = document.title;
        document.title = 'Invoice - ' + order.id;
        frame.contentWindow?.print();
        setTimeout(() => { document.title = prevTitle; }, 2000);
      }, 300);
    };
  };

    // TRASH HANDLERS
  const cancelOrder = async () => {
    if (!cancelOrderId) return;
    if (!cancelReason.trim()) { alert("Please enter a cancellation reason."); return; }
    await withLock(async () => {
      try {
        await db.updateOrderStatus(cancelOrderId, 'failed', currentUser!, { cancelReason: cancelReason.trim() } as any);
        setShowCancelModal(false);
        setCancelOrderId("");
        setCancelReason("");
        await reloadOrdersAndStock();
      } catch (err: any) {
        alert(err.message || "Failed to cancel order.");
      }
    });
  };

  const restoreTrashItem = async (id: string, type: 'product' | 'order' | 'user' | 'expense') => {
    setTrashList(prev => prev.filter(t => t.id !== id));
    try {
      await db.restoreTrashItem(id, type, currentUser!);
      // Refresh relevant list in background
      if (type === 'product') db.getProducts().then(setProducts);
      else if (type === 'order') db.getOrders().then(setOrders);
      else if (type === 'user') db.getUsers().then(setUsersList);
      else if (type === 'expense') db.getExpenses().then(setExpenses);
    } catch (err: any) {
      alert(err.message);
      await reloadData();
    }
  };

  const permanentDeleteTrashItem = async (id: string, type: 'product' | 'order' | 'user' | 'expense') => {
    if (confirm("WARNING: This is permanent and cannot be undone. Proceed?")) {
      setTrashList(prev => prev.filter(t => t.id !== id));
      try {
        await db.permanentlyDeleteTrashItem(id, type, currentUser!);
      } catch (err: any) {
        alert(err.message);
        await reloadData();
      }
    }
  };

  const confirmReturnWithWarehouse = async () => {
    const order = returnWarehouseModal?.order;
    if (!order) return;
    const isSingleMode = returnWarehouseModal?.singleWarehouseMode ?? false;
    const chosenWarehouseId = isSingleMode ? returnSingleWarehouseId : undefined;
    setReturnWarehouseModal(null);
    setReturningOrderId(order.id);
    try {
      // CRITICAL: Only restore items that have reservations — these are the items
      // that were actually deducted from stock. For partially-approved orders, some items
      // may never have been approved/deducted, so restoring them would create phantom stock.
      //
      // Reservation status depends on how far the order got:
      //   - cancelled before out_for_delivery → reservations are still 'active'
      //   - cancelled from out_for_delivery → reservations were marked 'completed' at dispatch
      const wasOutForDelivery = order.status_history?.some((h: any) => h.status === 'out_for_delivery');
      const allReservations = await db.getReservations();
      const relevantReservations = allReservations.filter(
        r => r.order_id === order.id &&
          (wasOutForDelivery ? r.status === 'completed' : r.status === 'active')
      );

      if (isSingleMode && chosenWarehouseId) {
        // SINGLE-WAREHOUSE MODE: order came back from delivery — user chose one warehouse for all items.
        for (const res of relevantReservations) {
          await db.addStockAdjustment(
            res.product_id,
            res.qty,
            'customer_return',
            `Return - Cancelled Order ${order.id} (returned from delivery)`,
            currentUser!,
            chosenWarehouseId
          );
          await db.updateReservationStatus(res.id, 'cancelled');
        }
      } else {
        // PER-ITEM MODE: return each reservation's qty to its exact source warehouse.
        for (const res of relevantReservations) {
          const item = order.items.find((i: any) => i.product_id === res.product_id);
          const splitWh = (item as any)?.split_warehouses as { warehouse_id: string; warehouse_name: string; qty: number }[] | undefined;

          if (splitWh && splitWh.length > 1) {
            for (const portion of splitWh) {
              if (portion.qty <= 0) continue;
              await db.addStockAdjustment(
                res.product_id,
                portion.qty,
                'customer_return',
                `Return - Cancelled Order ${order.id} (${portion.warehouse_name})`,
                currentUser!,
                portion.warehouse_id
              );
            }
          } else {
            const targetWarehouseId = res.warehouse_id || returnItemWarehouses[res.product_id] || undefined;
            if (targetWarehouseId) {
              await db.addStockAdjustment(res.product_id, res.qty, 'customer_return', `Return - Cancelled Order ${order.id}`, currentUser!, targetWarehouseId);
            } else {
              await db.addStockAdjustment(res.product_id, res.qty, 'customer_return', `Return - Cancelled Order ${order.id}`, currentUser!);
            }
          }
          await db.updateReservationStatus(res.id, 'cancelled');
        }
      }
      const restoredEntry = { status: 'failed' as const, updated_at: new Date().toISOString(), updated_by_name: `STOCK_RESTORED:${currentUser!.name}` };
      const newHistory = [...order.status_history, restoredEntry];
      // Optimistically update local orders state immediately so alreadyRestored=true
      // in the UI before the async DB reload completes — prevents double-restore on rapid clicks
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status_history: newHistory } : o));
      if (supabase) {
        await supabase.from('orders').update({ status_history: newHistory }).eq('id', order.id);
      } else {
        const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
        localStorage.setItem('orders', JSON.stringify(allOrders.map((o: any) => o.id === order.id ? { ...o, status_history: newHistory } : o)));
      }
      await reloadOrdersAndStock();
    } catch (err: any) {
      alert(err.message || 'Failed to restore stock.');
    } finally {
      setReturningOrderId(null);
    }
  };

  // FILTERED LISTS
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.includes(searchQuery) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = orders.filter(o => 
    (currentUser?.role !== 'customer' || o.customer_id === currentUser?.id) &&
    (o.id.includes(searchQuery) ||
     o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     o.status.includes(searchQuery.toLowerCase()))
  );

  // DASHBOARD CHARTS DATA CALCULATION
  const isFinanciallyRestricted = ['staff', 'delivery'].includes(currentUser?.role ?? '');

  // Compute date range boundaries
  const getDateBounds = (): { from: string; to: string; days: string[] } => {
    const today = new Date();
    const pad = (d: Date) => d.toISOString().split('T')[0];

    if (dateRange === 'daily') {
      const todayStr = pad(today);
      return { from: todayStr, to: todayStr, days: [todayStr] };
    }
    if (dateRange === 'monthly') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const dayCount = today.getDate();
      const days = Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(first); d.setDate(i + 1); return pad(d);
      });
      return { from: pad(first), to: pad(today), days };
    }
    // custom
    const from = new Date(customFrom);
    const to = new Date(customTo);
    const days: string[] = [];
    const cur = new Date(from);
    while (cur <= to) { days.push(pad(cur)); cur.setDate(cur.getDate() + 1); }
    return { from: customFrom, to: customTo, days };
  };

  const { from: filterFrom, to: filterTo, days: filterDays } = getDateBounds();

  // Orders in the selected date range (by created_at date)
  const rangeOrders = orders.filter(o => {
    const d = o.created_at.split('T')[0];
    return d >= filterFrom && d <= filterTo;
  });

  const getOverviewData = () => {
    // For daily: show last 24 hrs by hour label; for monthly/custom: show per-day
    let chartDays = filterDays;
    // Cap chart to 31 points for readability
    if (chartDays.length > 31) {
      const step = Math.ceil(chartDays.length / 31);
      chartDays = chartDays.filter((_, i) => i % step === 0);
    }

    const chartData = chartDays.map(date => {
      const dayOrders = orders.filter(o => o.status === 'delivered' && o.created_at.startsWith(date));
      const totalSales = dayOrders.reduce((sum, o) => sum + o.total, 0);
      const totalCost = dayOrders.reduce((sum, o) => {
        return sum + o.items.reduce((costSum, item) => {
          const prod = products.find(p => p.id === item.product_id);
          return costSum + (prod ? prod.purchase_cost * item.qty : 0);
        }, 0);
      }, 0);

      const label = dateRange === 'daily'
        ? new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
        : new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return { date: label, Sales: totalSales, Profit: totalSales - totalCost };
    });

    const categoryTotals: Record<string, number> = {};
    products.forEach(p => {
      categoryTotals[p.category] = (categoryTotals[p.category] || 0) + (p.stock_qty * p.selling_price);
    });
    const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

    return { chartData, pieData };
  };

  const { chartData, pieData } = getOverviewData();

  // Accounting Summary stats — scoped to selected date range
  const totalSalesVal = rangeOrders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);
  const totalCostVal = rangeOrders.filter(o => o.status === 'delivered').reduce((sum, o) => {
    return sum + o.items.reduce((costSum, item) => {
      const prod = products.find(p => p.id === item.product_id);
      return costSum + (prod ? prod.purchase_cost * item.qty : 0);
    }, 0);
  }, 0);
  const totalExpensesVal = expenses
    .filter(e => { const d = e.timestamp.split('T')[0]; return d >= filterFrom && d <= filterTo; })
    .reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalSalesVal - totalCostVal - totalExpensesVal;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="flex-1 flex flex-row h-screen overflow-hidden text-slate-700 dark:text-slate-200">
      {/* MOBILE SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* SIDEBAR */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-100 dark:bg-gray-950/60 border-r border-slate-200 dark:border-white/5 flex flex-col no-print transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:flex-shrink-0`}>
        <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex justify-center items-center font-bold text-white shadow-lg shrink-0">
            Z
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-tight">
              ZENVORA ERP
            </h1>
            <span className="text-[10px] text-slate-500 dark:text-gray-500 font-semibold uppercase tracking-wider">
              {currentUser.role} Control
            </span>
          </div>
          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 mx-4 my-4 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 flex justify-center items-center text-blue-500 dark:text-blue-400 text-sm font-bold">
            {currentUser.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name}</p>
            <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate">@{currentUser.username}</p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => { setActiveTab("overview"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
              activeTab === "overview" 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Dashboard Portal
          </button>

           {/* B2B Customer Pricing / Catalog */}
          {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff', 'customer'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("products"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "products" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Package className="w-4 h-4" />
              Products & Pricing
            </button>
          )}

          {/* Stock adjustments & ledgers */}
          {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("inventory"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "inventory" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Stock & Ledger
            </button>
          )}

          {/* Orders Tracking Pipeline */}
          {currentUser.role !== 'accountant' && (
          <button
            onClick={() => { setActiveTab("orders"); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
              activeTab === "orders" 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Orders Pipeline
            {orders.filter(o => o.status !== 'delivered' && o.status !== 'failed').length > 0 && (
              <span className="ml-auto w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
            )}
          </button>
          )}

          {/* Order History — delivered & cancelled */}
          {currentUser.role !== 'accountant' && (
            <button
              onClick={() => { setActiveTab("order-history"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "order-history"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <History className="w-4 h-4" />
              Order History
            </button>
          )}

          {/* Cancelled Orders Returns */}
          {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("returns"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "returns"
                  ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Undo2 className="w-4 h-4" />
              Cancelled Returns
              {orders.filter(o =>
                o.status === 'failed' &&
                !o.status_history?.some((h: any) => h.updated_by_name?.startsWith('STOCK_RESTORED:')) &&
                o.status_history?.some((h: any) => ['approved','packing','assigned','out_for_delivery'].includes(h.status))
              ).length > 0 && (
                <span className="ml-auto w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
              )}
            </button>
          )}

          {/* Accounting Expense/Ledger */}
          {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("accounting"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "accounting" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              Accounting Ledger
            </button>
          )}

          {/* Users Creation RBAC */}
          {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("users"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "users" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              User Control
            </button>
          )}

          {/* Audit Trail Logs */}
          {['admin', 'superowner', 'owner', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("logs"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "logs" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <History className="w-4 h-4" />
              System Audit
            </button>
          )}

          {/* Warehouses Management */}
          {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("warehouses"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "warehouses" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Package className="w-4 h-4" />
              Warehouses
            </button>
          )}

          {/* Soft Deleted Trash Recovery */}
          {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("trash"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "trash" 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Trash2 className="w-4 h-4" />
              Trash Bin
            </button>
          )}

          {/* Owner Company Settings */}
          {['admin', 'superowner', 'owner'].includes(currentUser.role) && (
            <button
              onClick={() => { setActiveTab("company-settings"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "company-settings"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              Company Settings
            </button>
          )}

          {/* Customer Company Profile */}
          {currentUser.role === 'customer' && (
            <button
              onClick={() => { setActiveTab("customer-profile"); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                activeTab === "customer-profile"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Users className="w-4 h-4" />
              My Company Profile
            </button>
          )}
        </nav>


        {/* Footer Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-white/5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold text-red-500 dark:text-red-400 hover:bg-red-500/10 hover:text-red-600 transition duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50 dark:bg-[#0b0f19] relative">
        {/* HEADER BAR */}
        <header className="h-16 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 md:px-8 bg-white/60 dark:bg-gray-950/20 backdrop-blur-md sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex justify-center items-center text-slate-600 dark:text-gray-400"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-500 dark:text-gray-400 capitalize truncate">
              {activeTab}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* White mode switcher toggle */}
            <button 
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex justify-center items-center text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>

            {/* Notification bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="w-9 h-9 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex justify-center items-center text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white cursor-pointer relative"
              >
                <Bell className="w-4 h-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-950"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 glass-panel rounded-xl border border-slate-200 dark:border-white/5 shadow-2xl p-4 z-50">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-3 uppercase tracking-wider">Alert notifications</h3>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center">No new notifications</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="flex gap-2 p-2 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] text-slate-800 dark:text-gray-200 leading-normal">{n.text}</p>
                            <span className="text-[9px] text-slate-400 dark:text-gray-500 mt-1 block">{n.time}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick action refresh */}
            <button
              onClick={async () => { setIsRefreshing(true); try { await reloadTabData(activeTab); } finally { setIsRefreshing(false); } }}
              disabled={isRefreshing}
              className="w-9 h-9 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex justify-center items-center text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition"
              title="Refresh Data"
            >
              <RefreshCcw className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* MODULE CONTAINER */}
        <div className="p-4 md:p-8 flex-1 animate-fade-in print-card">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-5 md:space-y-8 print-card">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 no-print">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white">Marhaba, {currentUser.name}!</h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Here is the latest status of Zenvora Grocery Warehouse ERP.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Date Range Filter — hidden for staff/delivery */}
                  {!isFinanciallyRestricted && currentUser?.role !== 'customer' && (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-1">
                      {(['daily', 'monthly', 'custom'] as const).map(r => (
                        <button
                          key={r}
                          onClick={() => setDateRange(r)}
                          className={`px-3 py-1 rounded-md text-xs font-bold capitalize transition cursor-pointer ${dateRange === r ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                  {!isFinanciallyRestricted && dateRange === 'custom' && currentUser?.role !== 'customer' && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={customFrom}
                        max={customTo}
                        onChange={e => setCustomFrom(e.target.value)}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-700 dark:text-gray-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <input
                        type="date"
                        value={customTo}
                        min={customFrom}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={e => setCustomTo(e.target.value)}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-xs text-slate-700 dark:text-gray-300 cursor-pointer"
                      />
                    </div>
                  )}
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print PDF Summary
                  </button>
                </div>
              </div>

              {/* STATS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 print:grid-cols-4">
                {currentUser?.role === 'customer' ? (
                  <>
                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Credit Limit</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(currentUser.credit_limit || 0)}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex justify-center items-center text-blue-600 dark:text-blue-400">
                        <CreditCard className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Outstanding Balance</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(currentUser.outstanding_balance || 0)}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex justify-center items-center text-red-600 dark:text-red-400">
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Available Credit</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                          {formatSAR(Math.max(0, (currentUser.credit_limit || 0) - (currentUser.outstanding_balance || 0)))}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex justify-center items-center text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">My Orders</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                          {orders.filter(o => o.customer_id === currentUser.id).length} Orders
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex justify-center items-center text-amber-600 dark:text-amber-400">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Financial cards — hidden from staff & delivery */}
                    {!isFinanciallyRestricted && (
                      <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Total Sales</span>
                          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(totalSalesVal)}</h3>
                          <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-0.5 capitalize">{dateRange === 'custom' ? `${customFrom} → ${customTo}` : dateRange}</span>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex justify-center items-center text-emerald-600 dark:text-emerald-400">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                      </div>
                    )}

                    {!isFinanciallyRestricted && (
                      <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Inventory Valuation</span>
                          <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                            {formatSAR(products.reduce((sum, p) => sum + (p.stock_qty * p.purchase_cost), 0))}
                          </h3>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex justify-center items-center text-blue-600 dark:text-blue-400">
                          <Package className="w-5 h-5" />
                        </div>
                      </div>
                    )}

                    {/* Active Orders — hidden from accountant */}
                    {currentUser.role !== 'accountant' && (
                    <button
                      onClick={() => setActiveTab("orders")}
                      className="glass-card rounded-xl p-5 flex items-center justify-between w-full text-left hover:ring-2 hover:ring-amber-400/40 transition cursor-pointer"
                    >
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Active Orders</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                          {orders.filter(o => o.status !== 'delivered' && o.status !== 'failed').length} Pending
                        </h3>
                        <span className="text-[9px] text-amber-500 dark:text-amber-400 mt-0.5 block">Click to view orders →</span>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex justify-center items-center text-amber-600 dark:text-amber-400">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    </button>
                    )}

                    {/* Low stock count — hidden from accountant */}
                    {currentUser.role !== 'accountant' && (
                    <button
                      onClick={() => setActiveTab("inventory")}
                      className="glass-card rounded-xl p-5 flex items-center justify-between w-full text-left hover:ring-2 hover:ring-red-400/40 transition cursor-pointer"
                    >
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Low Stock Items</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                          {products.filter(p => p.stock_qty <= p.min_stock).length} Items
                        </h3>
                        <span className="text-[9px] text-red-500 dark:text-red-400 mt-0.5 block">Click to view inventory →</span>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex justify-center items-center text-red-500 dark:text-red-400">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    </button>
                    )}

                    {/* Net Profit — hidden from staff & delivery */}
                    {!isFinanciallyRestricted && (
                      <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Net Profit (Loss)</span>
                          <h3 className={`text-xl font-extrabold mt-1 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                            {formatSAR(netProfit)}
                          </h3>
                          <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-0.5 capitalize">{dateRange === 'custom' ? `${customFrom} → ${customTo}` : dateRange}</span>
                        </div>
                        <div className={`w-10 h-10 rounded-lg flex justify-center items-center ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20'}`}>
                          <DollarSign className="w-5 h-5" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* ANALYTICS CHARTS */}
              {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager'].includes(currentUser.role) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
                  <div className="lg:col-span-2 glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5 flex items-center gap-1.5">
                      <BarChart2 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      Sales & Profit Performance (SAR)
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                          <XAxis dataKey="date" stroke={theme === 'dark' ? '#9ca3af' : '#475569'} fontSize={11} />
                          <YAxis stroke={theme === 'dark' ? '#9ca3af' : '#475569'} fontSize={11} />
                          <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#111827' : '#ffffff', border: '1px solid rgba(0,0,0,0.1)', color: theme === 'dark' ? '#fff' : '#000' }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Area type="monotone" dataKey="Sales" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSales)" />
                          <Area type="monotone" dataKey="Profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-5">
                      Inventory Asset Mix (SAR)
                    </h3>
                    <div className="h-72 flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${Number(value).toLocaleString()} SAR`} />
                          <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* WATCHLIST & OPERATIONAL TASKS */}
              {!['customer', 'delivery'].includes(currentUser?.role) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5">
                  <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Low Stock Reorder Alert Board
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-80 overflow-y-auto">
                    {products.filter(p => p.stock_qty <= p.min_stock).length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">All product inventory levels healthy</p>
                    ) : (
                      products.filter(p => p.stock_qty <= p.min_stock).map(p => (
                        <div key={p.id} className="py-3 flex justify-between items-center">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">{p.name}</h4>
                            <span className="text-[10px] text-slate-500 dark:text-gray-500">Min limit: {p.min_stock} {p.unit} | SKU: {p.sku}</span>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2.5 py-0.5 rounded-full font-bold bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[10px]">
                              {p.stock_qty} left
                            </span>
                            {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser?.role) && (
                              <p className="text-[9px] text-blue-500 dark:text-blue-400 mt-1 underline cursor-pointer" onClick={() => {
                                setStockForm({ ...stockForm, productId: p.id, qty: p.min_stock * 2, type: 'purchase' });
                                setShowStockModal(true);
                              }}>
                                Auto Reorder Suggestion: +{p.min_stock * 3}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5">
                  <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Truck className="w-4 h-4" />
                    Staff Packing & Delivery Tasks
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-80 overflow-y-auto">
                    {orders.filter(o => 
                      (currentUser.role === 'delivery' && o.assigned_staff_id === currentUser.id && o.status !== 'delivered' && o.status !== 'failed') ||
                      (currentUser.role !== 'delivery' && (o.status === 'approved' || o.status === 'packing' || o.status === 'assigned'))
                    ).length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">No active tasks assigned to staff</p>
                    ) : (
                      orders.filter(o => 
                        (currentUser.role === 'delivery' && o.assigned_staff_id === currentUser.id && o.status !== 'delivered' && o.status !== 'failed') ||
                        (currentUser.role !== 'delivery' && (o.status === 'approved' || o.status === 'packing' || o.status === 'assigned'))
                      ).map(o => (
                        <div key={o.id} className="py-3 flex justify-between items-center">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white">Order {o.id} - {o.customer_name}</h4>
                            <span className="text-[10px] text-slate-500 dark:text-gray-500">Route: {o.delivery_route || "Pending Route Assign"}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.status === 'approved' ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' :
                              o.status === 'packing' ? 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20' :
                              'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                            }`}>
                              {o.status}
                            </span>
                            <button
                              onClick={() => {
                                setActiveTab("orders");
                                setSearchQuery(o.id);
                              }}
                              className="px-2 py-0.5 rounded bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[10px] text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                            >
                              Action
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
          )}

          {/* TAB 2: PRODUCTS */}
          {activeTab === "products" && (() => {
            const productCategories = Array.from(new Set(products.map(p => p.category))).sort();

            const filteredProducts = products.filter(p => {
              const q = searchQuery.toLowerCase();
              if (q && !p.name.toLowerCase().includes(q) && !p.sku.includes(searchQuery) && !p.category.toLowerCase().includes(q)) return false;
              if (productFilterCategory && p.category !== productFilterCategory) return false;
              if (productFilterStock === 'low' && p.stock_qty > p.min_stock) return false;
              if (productFilterStock === 'ok' && p.stock_qty <= p.min_stock) return false;
              if (productFilterStock === 'zero' && p.stock_qty !== 0) return false;
              return true;
            });

            const hasActiveProductFilter = productFilterCategory || productFilterStock;
            const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE));
            const pagedProducts = filteredProducts.slice((productPage - 1) * PRODUCT_PAGE_SIZE, productPage * PRODUCT_PAGE_SIZE);

            return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Products Catalog & Pricing Manager</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Setup catalog, track SKU/barcodes, default selling prices, and configure B2B custom discounts.</p>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input 
                      type="text" 
                      placeholder="Search SKU, name, category..." 
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setProductPage(1); }}
                      className="glass-input pl-9 pr-3 py-2 rounded-lg text-xs w-48 sm:w-64"
                    />
                  </div>
                  
                  {['admin', 'owner', 'manager', 'warehouse_manager'].includes(currentUser.role) && (
                    <button
                      onClick={() => {
                        setIsEditingProduct(null);
                        setProductForm({ name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0 });
                        setProductWarehouseId(warehouses[0]?.id || "");
                        setShowProductModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Product
                    </button>
                  )}

                  <button
                    onClick={() => exportToCSV(products, "product_catalog_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel
                  </button>
                </div>
              </div>

              {/* PRODUCT FILTERS */}
              <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-200 dark:border-white/5">
                <div className="flex flex-col gap-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Category</label>
                  <select value={productFilterCategory} onChange={e => { setProductFilterCategory(e.target.value); setProductPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                    <option value="">All Categories</option>
                    {productCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Stock Level</label>
                  <select value={productFilterStock} onChange={e => { setProductFilterStock(e.target.value); setProductPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                    <option value="">All Stock</option>
                    <option value="ok">In Stock</option>
                    <option value="low">Low / Critical</option>
                    <option value="zero">Out of Stock</option>
                  </select>
                </div>
                {hasActiveProductFilter && (
                  <button
                    onClick={() => { setProductFilterCategory(''); setProductFilterStock(''); setProductPage(1); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2 self-end pb-1">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">{filteredProducts.length} products</span>
                  {filteredProducts.filter(p => p.stock_qty <= p.min_stock).length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold">
                      {filteredProducts.filter(p => p.stock_qty <= p.min_stock).length} low stock
                    </span>
                  )}
                </div>
              </div>

              {/* PRODUCTS LIST TABLE */}
              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Product Details</th>
                      <th className="p-4">SKU / Barcode</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Stock Qty</th>
                      {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'accountant'].includes(currentUser?.role) && <th className="p-4">Purchase Cost</th>}
                      <th className="p-4">Selling Price</th>
                      {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                        <th className="p-4 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {pagedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 dark:text-gray-500">No products match the selected filters</td>
                      </tr>
                    ) : pagedProducts.map(p => {
                      const isLowStock = p.stock_qty <= p.min_stock;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/2">
                          <td className="p-4">
                            <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                            <span className="text-[10px] text-slate-400 dark:text-gray-505">Unit: {p.unit}</span>
                          </td>
                          <td className="p-4 font-mono">{p.sku}</td>
                          <td className="p-4">{p.category}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${isLowStock ? 'bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400' : 'bg-green-100 dark:bg-green-950/40 border border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400'}`}>
                              {p.stock_qty} {p.unit}
                            </span>
                            {/* Warehouse breakdown — show all warehouses */}
                            {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (() => {
                              const breakdown = warehouseStock.filter(ws => ws.product_id === p.id);
                              if (breakdown.length === 0) return null;
                              return (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {breakdown.map(ws => (
                                    <span key={ws.warehouse_id} className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 font-semibold">
                                      {ws.warehouse_name}: {ws.qty}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                          </td>
                          {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'accountant'].includes(currentUser?.role) && (
                            <td className="p-4 font-bold text-slate-900 dark:text-white">{formatSAR(p.purchase_cost)}</td>
                          )}
                          <td className="p-4">
                            {(() => {
                              const finalPrice = db.calculateCustomerPrice(currentUser, p);
                              if (finalPrice !== p.selling_price) {
                                return (
                                  <div>
                                    <span className="line-through text-slate-400 mr-2 text-[10px]">{formatSAR(p.selling_price)}</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatSAR(finalPrice)}</span>
                                  </div>
                                );
                              }
                              return <span className="text-blue-600 dark:text-blue-400 font-bold">{formatSAR(p.selling_price)}</span>;
                            })()}
                          </td>
                          {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                            <td className="p-4 text-right space-x-2">
                              <button 
                                onClick={() => startEditProduct(p)}
                                className="p-1.5 rounded bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-0"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              {currentUser.role === 'admin' && (
                                <button 
                                  onClick={() => deleteProduct(p.id)}
                                  className="p-1.5 rounded bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              {totalProductPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">
                    Showing {(productPage - 1) * PRODUCT_PAGE_SIZE + 1}–{Math.min(productPage * PRODUCT_PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setProductPage(p => Math.max(1, p - 1))}
                      disabled={productPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >← Prev</button>
                    {Array.from({ length: totalProductPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalProductPages || Math.abs(p - productPage) <= 1).map((p, idx, arr) => (
                      <React.Fragment key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 py-1.5 text-xs text-slate-400 dark:text-gray-600">…</span>}
                        <button
                          onClick={() => setProductPage(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${p === productPage ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                        >{p}</button>
                      </React.Fragment>
                    ))}
                    <button
                      onClick={() => setProductPage(p => Math.min(totalProductPages, p + 1))}
                      disabled={productPage === totalProductPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >Next →</button>
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {/* TAB 3: INVENTORY */}
          {activeTab === "inventory" && (() => {
            // Unique product names for filter dropdown
            const stockProductNames = Array.from(new Set(stockLedger.map(e => e.product_name))).sort();
            const stockTypes = Array.from(new Set(stockLedger.map(e => e.type))).sort();

            // Filtered ledger
            const filteredStock = stockLedger.filter(entry => {
              if (stockFilterWarehouse && entry.warehouse_id !== stockFilterWarehouse) return false;
              if (stockFilterProduct && entry.product_name !== stockFilterProduct) return false;
              if (stockFilterType && entry.type !== stockFilterType) return false;
              if (stockFilterFrom && entry.timestamp.split('T')[0] < stockFilterFrom) return false;
              if (stockFilterTo && entry.timestamp.split('T')[0] > stockFilterTo) return false;
              return true;
            });

            const totalStockPages = Math.max(1, Math.ceil(filteredStock.length / STOCK_PAGE_SIZE));
            const pagedStock = filteredStock.slice((stockPage - 1) * STOCK_PAGE_SIZE, stockPage * STOCK_PAGE_SIZE);
            const hasActiveStockFilter = stockFilterWarehouse || stockFilterProduct || stockFilterType || stockFilterFrom || stockFilterTo;

            return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Stock Operations Ledger</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Complete traceability log of every single box, packet, and bag moving in or out of the warehouse.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                    <button
                      onClick={() => {
                        setStockForm({ productId: products[0]?.id || "", qty: 0, type: "purchase", notes: "", warehouseId: "" });
                        setShowStockModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add Stock entry
                    </button>
                  )}
                  <button
                    onClick={() => exportToCSV(filteredStock, "stock_ledger_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel Ledger
                  </button>
                </div>
              </div>

              {/* FILTERS */}
              <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-200 dark:border-white/5">
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Warehouse</label>
                  <select value={stockFilterWarehouse} onChange={e => { setStockFilterWarehouse(e.target.value); setStockPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                    <option value="">All Warehouses</option>
                    {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 min-w-[160px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Product</label>
                  <select
                    value={stockFilterProduct}
                    onChange={e => { setStockFilterProduct(e.target.value); setStockPage(1); }}
                    className="glass-input px-2.5 py-1.5 rounded-lg text-xs"
                  >
                    <option value="">All Products</option>
                    {stockProductNames.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1 min-w-[150px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Movement Type</label>
                  <select
                    value={stockFilterType}
                    onChange={e => { setStockFilterType(e.target.value); setStockPage(1); }}
                    className="glass-input px-2.5 py-1.5 rounded-lg text-xs"
                  >
                    <option value="">All Types</option>
                    {stockTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">From Date</label>
                  <input type="date" value={stockFilterFrom} onChange={e => { setStockFilterFrom(e.target.value); setStockPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">To Date</label>
                  <input type="date" value={stockFilterTo} onChange={e => { setStockFilterTo(e.target.value); setStockPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                </div>
                {hasActiveStockFilter && (
                  <button
                    onClick={() => { setStockFilterWarehouse(''); setStockFilterProduct(''); setStockFilterType(''); setStockFilterFrom(''); setStockFilterTo(''); setStockPage(1); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                  >
                    <X className="w-3 h-3" /> Clear Filters
                  </button>
                )}
                <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500 self-end pb-1.5">
                  {filteredStock.length} entries
                </span>
              </div>

              {/* STOCK LEDGER TABLE */}
              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Product</th>
                      <th className="p-4">Movement Qty</th>
                      <th className="p-4">Log Type</th>
                      <th className="p-4">Description / Notes</th>
                      <th className="p-4">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {pagedStock.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-400 dark:text-gray-500">No entries match the selected filters</td></tr>
                    ) : pagedStock.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-white/2">
                        <td className="p-4 text-slate-500 dark:text-gray-400">{new Date(entry.timestamp).toLocaleString()}</td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{entry.product_name}</td>
                        <td className="p-4">
                          <span className={`font-extrabold text-sm ${entry.qty_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                            {entry.qty_change > 0 ? `+${entry.qty_change}` : entry.qty_change}
                          </span>
                        </td>
                        <td className="p-4 capitalize">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            entry.type === 'purchase' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20' :
                            entry.type === 'customer_sales' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' :
                            entry.type === 'damage' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' :
                            'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                          }`}>
                            {entry.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 dark:text-gray-400">{entry.notes}</td>
                        <td className="p-4">
                          <div className="font-bold text-slate-900 dark:text-white">{entry.user_name}</div>
                          <span className="text-[9px] text-slate-400 dark:text-gray-500">ID: {entry.user_id}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              {totalStockPages > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 dark:text-gray-400">
                    Page {stockPage} of {totalStockPages} &nbsp;·&nbsp; showing {(stockPage - 1) * STOCK_PAGE_SIZE + 1}–{Math.min(stockPage * STOCK_PAGE_SIZE, filteredStock.length)} of {filteredStock.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setStockPage(1)}
                      disabled={stockPage === 1}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer disabled:cursor-default"
                    >«</button>
                    <button
                      onClick={() => setStockPage(p => Math.max(1, p - 1))}
                      disabled={stockPage === 1}
                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer disabled:cursor-default"
                    >‹ Prev</button>
                    {Array.from({ length: Math.min(7, totalStockPages) }, (_, i) => {
                      const start = Math.max(1, Math.min(stockPage - 3, totalStockPages - 6));
                      const page = start + i;
                      if (page > totalStockPages) return null;
                      return (
                        <button key={page} onClick={() => setStockPage(page)}
                          className={`px-2.5 py-1 rounded text-[10px] font-bold border cursor-pointer transition ${stockPage === page ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}
                        >{page}</button>
                      );
                    })}
                    <button
                      onClick={() => setStockPage(p => Math.min(totalStockPages, p + 1))}
                      disabled={stockPage === totalStockPages}
                      className="px-2.5 py-1 rounded text-[10px] font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer disabled:cursor-default"
                    >Next ›</button>
                    <button
                      onClick={() => setStockPage(totalStockPages)}
                      disabled={stockPage === totalStockPages}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer disabled:cursor-default"
                    >»</button>
                  </div>
                </div>
              )}
            </div>
            );
          })()}

{/* TAB 4: ORDERS — Kanban pipeline */}
          {activeTab === "orders" && (() => {
            const ORDER_STATUS_RANK: Record<string, number> = {
              created: 0, approved: 1, packing: 2, assigned: 3, out_for_delivery: 4, delivered: 5, failed: 6
            };

            const filteredAndSortedOrders = orders
              .filter(o => {
                if (['delivered', 'failed'].includes(o.status)) return false; // moved to Order History
                if (currentUser?.role === 'customer' && o.customer_id !== currentUser?.id) return false;
                if (currentUser?.role === 'delivery' && o.assigned_staff_id !== currentUser?.id) return false;
                if (orderFilterStatus && o.status !== orderFilterStatus) return false;
                if (orderFilterType && o.type !== orderFilterType) return false;
                if (orderFilterFrom && o.created_at.split('T')[0] < orderFilterFrom) return false;
                if (orderFilterTo && o.created_at.split('T')[0] > orderFilterTo) return false;
                if (searchQuery) {
                  const q = searchQuery.toLowerCase();
                  if (!o.id.includes(searchQuery) && !o.customer_name.toLowerCase().includes(q) && !o.status.includes(q)) return false;
                }
                return true;
              })
              .sort((a, b) => {
                const rankA = ORDER_STATUS_RANK[a.status] ?? 99;
                const rankB = ORDER_STATUS_RANK[b.status] ?? 99;
                if (rankA !== rankB) return rankA - rankB;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              });

            const hasActiveOrderFilter = orderFilterStatus || orderFilterType || orderFilterFrom || orderFilterTo;
            const orderTypes = Array.from(new Set(orders.map(o => o.type)));
            const activeCount = orders.filter(o => !['delivered', 'failed'].includes(o.status) && (currentUser?.role !== 'customer' || o.customer_id === currentUser?.id)).length;

            // Kanban columns definition — maps DB status values to display stages
            const KANBAN_COLUMNS = [
              { key: 'created',          label: 'Pending Approval', color: 'amber' },
              { key: 'approved',         label: 'Approved',         color: 'blue' },
              { key: 'packing',          label: 'Packing',          color: 'purple' },
              { key: 'assigned',         label: 'Driver Assigned',  color: 'indigo' },
              { key: 'out_for_delivery', label: 'Out for Delivery', color: 'teal' },
            ] as const;

            // Color maps for column headers and card accents
            const colColors: Record<string, { header: string; badge: string; dot: string }> = {
              amber:   { header: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400',   badge: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',   dot: 'bg-amber-400' },
              blue:    { header: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400',         badge: 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',         dot: 'bg-blue-400' },
              purple:  { header: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400', badge: 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20', dot: 'bg-purple-400' },
              indigo:  { header: 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-400', badge: 'bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/20', dot: 'bg-indigo-400' },
              teal:    { header: 'bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-500/20 text-teal-700 dark:text-teal-400',         badge: 'bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/20',         dot: 'bg-teal-400' },
              emerald: { header: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400', badge: 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', dot: 'bg-emerald-400' },
            };

            // Age in days from created_at
            const orderAgeDays = (order: Order) => {
              const ms = Date.now() - new Date(order.created_at).getTime();
              return Math.floor(ms / 86400000);
            };

            return (
            <div className="space-y-6">
              {/* ── Header ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Orders Pipeline</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Each column is one stage. Each card shows one action.</p>
                </div>
                <div className="flex gap-2 shrink-0 flex-wrap">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search Order ID, Customer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input pl-9 pr-3 py-2 rounded-lg text-xs w-48 sm:w-64"
                    />
                  </div>
                  {['admin', 'owner', 'manager', 'staff', 'customer'].includes(currentUser.role) && (
                    <button
                      onClick={() => {
                        setCart([]);
                        setSelectedCustomerId(usersList.find(u => u.role === 'customer')?.id || "");
                        setActiveTab("create-order");
                        reloadTabData("create-order").catch(() => {});
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Order
                    </button>
                  )}
                  <button
                    onClick={() => exportToCSV(filteredAndSortedOrders, "sales_orders_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>
              </div>

              {/* ── Filters ── */}
              <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-200 dark:border-white/5">
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Stage</label>
                  <select value={orderFilterStatus} onChange={e => setOrderFilterStatus(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                    <option value="">All Stages</option>
                    <option value="created">Pending Approval</option>
                    <option value="approved">Approved</option>
                    <option value="packing">Packing</option>
                    <option value="assigned">Driver Assigned</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 min-w-[130px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Order Type</label>
                  <select value={orderFilterType} onChange={e => setOrderFilterType(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                    <option value="">All Types</option>
                    {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">From Date</label>
                  <input type="date" value={orderFilterFrom} onChange={e => setOrderFilterFrom(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">To Date</label>
                  <input type="date" value={orderFilterTo} onChange={e => setOrderFilterTo(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                </div>
                {hasActiveOrderFilter && (
                  <button
                    onClick={() => { setOrderFilterStatus(''); setOrderFilterType(''); setOrderFilterFrom(''); setOrderFilterTo(''); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2 self-end pb-1">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500">{filteredAndSortedOrders.length} orders</span>
                  {activeCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
                      {activeCount} active
                    </span>
                  )}
                </div>
              </div>

              {/* ── Kanban Board ── */}
              <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
                {KANBAN_COLUMNS.map(col => {
                  const colOrders = filteredAndSortedOrders.filter(o => o.status === col.key);
                  const cc = colColors[col.color];

                  return (
                    <div key={col.key} className="flex flex-col gap-3 flex-shrink-0 w-[260px]">

                      {/* Column header */}
                      <div className={`flex items-center justify-between px-3 py-2 rounded-xl border ${cc.header}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${cc.dot}`} />
                          <span className="text-[11px] font-bold uppercase tracking-wider">{col.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {col.key === 'delivered' && colOrders.length > 0 && (
                            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                              {formatSAR(colOrders.reduce((s, o) => s + o.total, 0))}
                            </span>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cc.badge}`}>
                            {colOrders.length}
                          </span>
                        </div>
                      </div>

                      {/* Cards */}
                      {colOrders.length === 0 ? (
                        <div className="text-[11px] text-slate-400 dark:text-gray-600 text-center py-6 border border-dashed border-slate-200 dark:border-white/8 rounded-xl">
                          No orders
                        </div>
                      ) : colOrders.map(order => {
                        const currentStatus = order.status;
                        const isThisOrderLoading = orderLoadingId === order.id;
                        const ageDays = orderAgeDays(order);
                        const isOverdue = ageDays >= 2 && !['delivered', 'failed'].includes(currentStatus);

                        // Automatic fulfillment preview — primary warehouse first, combined
                        // overflow from other warehouses if needed. Nothing here requires a
                        // manual choice; this is purely informational ("where will/did stock
                        // come from").
                        const fulfillmentInfo = (() => {
                          if (warehouses.length === 0) return null;
                          const isApproved = ['approved', 'packing', 'assigned', 'out_for_delivery'].includes(order.status);
                          // For active reservations (approved/packing/assigned) use 'active';
                          // for dispatched orders (out_for_delivery) reservations are marked 'completed' — use those too
                          const reservationStatuses = order.status === 'out_for_delivery' ? ['active', 'completed'] : ['active'];

                          const itemChecks = order.items.map((item: any) => {
                            const thisOrderReservations = stockReservations.filter((r: any) =>
                              r.order_id === order.id && r.product_id === item.product_id && reservationStatuses.includes(r.status)
                            );
                            if (thisOrderReservations.length > 0) {
                              // Already approved — show exactly where stock was actually taken from.
                              const sourceWh = thisOrderReservations.map((r: any) => ({
                                warehouse_id: r.warehouse_id,
                                warehouse_name: warehouses.find((w: any) => w.id === r.warehouse_id)?.name || r.warehouse_id,
                                qty: r.qty
                              }));
                              const totalQty = sourceWh.reduce((s: number, w: any) => s + w.qty, 0);
                              return { product_id: item.product_id, name: item.name, qty: item.qty, sourceWh, totalQty, sufficient: totalQty >= item.qty };
                            }
                            // Not approved yet — preview what would happen if approved right now:
                            // primary warehouse first, then combine in overflow from other warehouses.
                            const primary = warehouses[0];
                            const others = warehouses.slice(1)
                              .map((w: any) => ({ warehouse_id: w.id, warehouse_name: w.name, qty: warehouseStock.find((ws: any) => ws.warehouse_id === w.id && ws.product_id === item.product_id)?.qty || 0 }))
                              .sort((a: any, b: any) => b.qty - a.qty);
                            const primaryQty = warehouseStock.find((ws: any) => ws.warehouse_id === primary.id && ws.product_id === item.product_id)?.qty || 0;
                            const portions: { warehouse_id: string; warehouse_name: string; qty: number }[] = [];
                            let stillNeeded = item.qty;
                            if (primaryQty > 0) {
                              const take = Math.min(stillNeeded, primaryQty);
                              portions.push({ warehouse_id: primary.id, warehouse_name: primary.name, qty: take });
                              stillNeeded -= take;
                            }
                            for (const o of others) {
                              if (stillNeeded <= 0) break;
                              const take = Math.min(stillNeeded, o.qty);
                              if (take > 0) {
                                portions.push(o.warehouse_id ? { warehouse_id: o.warehouse_id, warehouse_name: o.warehouse_name, qty: take } : o);
                                stillNeeded -= take;
                              }
                            }
                            const totalQty = portions.reduce((s, p) => s + p.qty, 0);
                            return { product_id: item.product_id, name: item.name, qty: item.qty, sourceWh: portions, totalQty, sufficient: stillNeeded <= 0 };
                          });

                          const byWarehouse: Record<string, { name: string; items: { itemName: string; qty: number }[] }> = {};
                          for (const ic of itemChecks) {
                            for (const wh of ic.sourceWh) {
                              if (!byWarehouse[wh.warehouse_id]) byWarehouse[wh.warehouse_id] = { name: wh.warehouse_name, items: [] };
                              byWarehouse[wh.warehouse_id].items.push({ itemName: ic.name, qty: wh.qty });
                            }
                          }
                          return { itemChecks, byWarehouse };
                        })();

                        // ── Delivered: compact reference row ──────────────────
                        if (currentStatus === 'delivered') {
                          return (
                            <div
                              key={order.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-white/5 px-3 py-2 bg-white dark:bg-white/2 opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">{order.id}</span>
                                  <span className="text-[10px] text-slate-500 dark:text-gray-400 truncate">{order.customer_name}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] font-bold text-slate-700 dark:text-gray-200">{formatSAR(order.total)}</span>
                                  {order.cod_tracking && (
                                    <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">COD {order.cod_collected ? '✓' : ''}</span>
                                  )}
                                  {order.assigned_staff_name && (
                                    <span className="text-[9px] text-slate-400 dark:text-gray-500">via {order.assigned_staff_name}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleGenerateInvoice(order)}
                                title="Print / Save Invoice PDF"
                                className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-[9px] font-bold transition"
                              >
                                <Printer className="w-2.5 h-2.5" />
                                Invoice
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={order.id}
                            className={`relative flex flex-col gap-3 rounded-xl border p-3.5 bg-white dark:bg-white/3 animate-fade-in transition
                              ${isOverdue ? 'border-red-300 dark:border-red-500/40' : 'border-slate-200 dark:border-white/8'}
                              ${isThisOrderLoading ? 'opacity-50 pointer-events-none' : ''}
                            `}
                          >
                            {/* Invoice button — owner/manager/staff after approval; customer only after delivery (see Order History) */}
                            {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && ['approved', 'packing', 'assigned', 'out_for_delivery'].includes(currentStatus) && (
                            <button
                              onClick={() => handleGenerateInvoice(order)}
                              title="Print / Save Invoice PDF"
                              className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-[9px] font-bold transition z-10"
                            >
                              <Printer className="w-2.5 h-2.5" />
                              Invoice
                            </button>
                            )}

                            {/* Order ID + age */}
                            <div className="flex items-start gap-2 pr-14">
                              <div>
                                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">{order.id}</span>
                                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 leading-tight">{order.customer_name}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="text-[9px] text-slate-400 dark:text-gray-500">{new Date(order.created_at).toLocaleDateString()}</span>
                                  <span className="text-[9px] text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wide">{order.type}</span>
                                  {order.warehouse_name && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 font-bold">📦 {order.warehouse_name}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Age badge — overdue warning */}
                            {ageDays >= 1 && !['delivered', 'failed'].includes(currentStatus) && (
                              <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full self-start border
                                ${ageDays >= 3 ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/30' :
                                  ageDays >= 2 ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30' :
                                  'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-500 border-slate-200 dark:border-white/10'}`}
                              >
                                {ageDays === 1 ? '1 day ago' : `${ageDays} days ago`}
                              </div>
                            )}

                            {/* Items */}
                            <div className="flex flex-wrap gap-1">
                              {order.items.map((item: any, idx: number) => (
                                <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/8">
                                  {item.name} ×{item.qty}
                                </span>
                              ))}
                            </div>

                            {/* Total + COD */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-extrabold text-slate-900 dark:text-white">{formatSAR(order.total)}</span>
                              <div className="flex items-center gap-1.5">
                                {order.discount > 0 && (
                                  <span className="text-[9px] text-emerald-600 dark:text-emerald-400">-{formatSAR(order.discount)}</span>
                                )}
                                {order.cod_tracking && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 uppercase tracking-wide">
                                    COD {order.cod_collected ? '✓' : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Driver info — assigned / out_for_delivery */}
                            {['assigned', 'out_for_delivery', 'delivered'].includes(currentStatus) && order.assigned_staff_name && (
                              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8">
                                <Truck className="w-3 h-3 text-slate-400 dark:text-gray-500 shrink-0" />
                                <div>
                                  <p className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-semibold">Driver</p>
                                  <p className="text-[10px] font-bold text-slate-800 dark:text-gray-200">{order.assigned_staff_name}</p>
                                  {order.delivery_route && <p className="text-[9px] text-slate-500 dark:text-gray-500">{order.delivery_route}</p>}
                                </div>
                              </div>
                            )}

                            {/* ── Warehouse fulfillment panel ── */}
                            {fulfillmentInfo && !['delivered','failed'].includes(currentStatus) && ['admin','superowner','owner','manager','warehouse_manager','staff','delivery'].includes(currentUser.role) && (() => {
                              const { itemChecks, byWarehouse } = fulfillmentInfo;
                              const anyShort = itemChecks.some((ic: any) => !ic.sufficient);
                              const isApprovedAlready = ['approved', 'packing', 'assigned', 'out_for_delivery'].includes(order.status);
                              return (
                                <div className="rounded-lg border border-slate-200 dark:border-white/8 overflow-hidden text-[11px]">
                                  <div className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider border-b bg-slate-50 dark:bg-white/3 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-white/8">
                                    {isApprovedAlready ? '📦 Pickup plan' : '📦 Will fulfill from'}
                                  </div>
                                  <div className="bg-white dark:bg-white/2 px-3 py-2 space-y-1.5">
                                    {itemChecks.map((ic: any) => (
                                      <div key={ic.product_id} className="flex flex-wrap items-center gap-2 py-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                                        <span className="text-slate-700 dark:text-gray-200 font-semibold min-w-[100px]">{ic.name} <span className="text-slate-400 dark:text-gray-500 font-normal">×{ic.qty}</span></span>
                                        {ic.sourceWh.length === 0 && (
                                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 font-bold">❌ Out of stock</span>
                                        )}
                                        {ic.sourceWh.length === 1 && (
                                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-bold">📦 {ic.sourceWh[0].warehouse_name}</span>
                                        )}
                                        {ic.sourceWh.length > 1 && (
                                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 font-bold">🔀 {ic.sourceWh.map((w: any) => `${w.warehouse_name} ×${w.qty}`).join(' + ')}</span>
                                        )}
                                        {!ic.sufficient && ic.sourceWh.length > 0 && (
                                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                            ⚠ Only {ic.totalQty} of {ic.qty} available across all warehouses
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                    {Object.keys(byWarehouse).length > 0 && (
                                      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 space-y-1">
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">{isApprovedAlready ? 'Driver pickup plan' : 'Pickup plan preview'}</p>
                                        {Object.entries(byWarehouse).map(([whId, whData]: [string, any]) => (
                                          <div key={whId} className="flex items-start gap-2">
                                            <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-bold text-[10px] whitespace-nowrap">📦 {whData.name}</span>
                                            <span className="text-slate-600 dark:text-gray-300 text-[10px]">{whData.items.map((it: any) => `${it.itemName} ×${it.qty}`).join(' · ')}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* ── Pick List panel ── */}
                            {currentStatus === 'packing' && (() => {
                              const matchingPl = pickLists.find(pl => pl.order_id === order.id);
                              if (!matchingPl) {
                                return (
                                  <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 overflow-hidden text-[11px]">
                                    <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 flex flex-wrap gap-2 justify-between items-center">
                                      <span>⚠️ No Pick List yet.</span>
                                      <button
                                        onClick={async () => {
                                          const pickItems = order.items.map((item: any) => ({ product_id: item.product_id, name: item.name, qty: item.qty, warehouse_id: item.warehouse_id || order.warehouse_id || 'wh-main', warehouse_name: item.warehouse_name || order.warehouse_name || 'Main Warehouse', picked_qty: 0 }));
                                          try { await db.createPickList(order.id, pickItems); await reloadData(); }
                                          catch (err: any) { alert("Could not generate pick list: " + err.message); }
                                        }}
                                        className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold transition cursor-pointer"
                                      >Generate</button>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="rounded-lg border border-purple-200 dark:border-purple-500/20 overflow-hidden text-[11px]">
                                  <div className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-b border-purple-200 dark:border-purple-500/20 flex justify-between items-center">
                                    <span>📋 Pick List</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${matchingPl.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'}`}>{matchingPl.status}</span>
                                  </div>
                                  <div className="bg-white dark:bg-white/2 px-3 py-2 space-y-1.5">
                                    {matchingPl.items.map(item => {
                                      const isItemPicked = item.picked_qty === item.qty;
                                      const rowKey = `${item.product_id}__${item.warehouse_id}`;
                                      return (
                                        <div key={rowKey} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                                          <div className="flex flex-col">
                                            <span className="text-slate-800 dark:text-gray-200 font-semibold">{item.name} × {item.qty}</span>
                                            <span className="text-slate-400 dark:text-gray-500 text-[10px]">📦 {item.warehouse_name}</span>
                                          </div>
                                          <label className="flex items-center gap-1.5 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={isItemPicked}
                                              onChange={(e) => handlePickItemToggle(matchingPl.id, item.product_id, e.target.checked, item.warehouse_id)}
                                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-white/10 dark:bg-white/5 cursor-pointer"
                                            />
                                            <span className={`text-[10px] font-bold ${isItemPicked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`}>{isItemPicked ? 'Picked' : 'To Pick'}</span>
                                          </label>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* ── Dispatch detail panel — collapsible ── */}
                            {currentStatus === 'out_for_delivery' && (() => {
                              const matchingDp = dispatches.find(d => d.order_id === order.id);
                              if (!matchingDp) return null;
                              return (
                                <details className="rounded-lg border border-teal-200 dark:border-teal-500/20 overflow-hidden text-[11px] group">
                                  <summary className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 cursor-pointer select-none list-none flex items-center justify-between">
                                    <span>🚚 Dispatch details</span>
                                    <span className="text-teal-400 dark:text-teal-600 group-open:rotate-180 transition-transform inline-block">▾</span>
                                  </summary>
                                  <div className="bg-white dark:bg-white/2 px-3 py-2 space-y-0.5 text-slate-700 dark:text-gray-300">
                                    <p><span className="text-slate-400 dark:text-gray-500">Dispatched:</span> {new Date(matchingDp.dispatched_at).toLocaleString()}</p>
                                    <p><span className="text-slate-400 dark:text-gray-500">By:</span> {matchingDp.dispatched_by_name}</p>
                                    {matchingDp.carrier_details && <p><span className="text-slate-400 dark:text-gray-500">Carrier:</span> {matchingDp.carrier_details}</p>}
                                  </div>
                                </details>
                              );
                            })()}

                            {/* ── Action button — one per stage ── */}
                            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 dark:border-white/5">

                              {/* Failed reason */}
                              {currentStatus === 'failed' && (() => {
                                const cancelEntry = order.status_history.find((h: any) => h.status === 'failed' && h.notes);
                                return (
                                  <span className="text-[10px] text-red-500 dark:text-red-400 italic">
                                    {cancelEntry ? `Cancelled: ${cancelEntry.notes}` : 'Failed'}
                                  </span>
                                );
                              })()}

                              {/* created → Approve */}
                              {currentStatus === 'created' && ['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                                <button
                                  disabled={isThisOrderLoading}
                                  onClick={() => withOrderLock(order.id, async () => {
                                    try {
                                      await db.updateOrderStatus(order.id, 'approved', currentUser);
                                      await reloadOrdersAndStock();
                                    } catch (err: any) {
                                      if (err instanceof OutOfStockError) {
                                        const partialItems = err.outOfStockItems.filter((i: any) => i.availableQty > 0);
                                        const fullyOutItems = err.outOfStockItems.filter((i: any) => !i.availableQty || i.availableQty === 0);
                                        const initQtys: Record<string, number> = {};
                                        partialItems.forEach((i: any) => { initQtys[i.product_id] = i.availableQty; });
                                        setAdjustedQtys(initQtys);
                                        setOutOfStockDialogData({ orderId: order.id, availableItems: err.availableItems, outOfStockItems: fullyOutItems, partialItems });
                                        setShowOutOfStockDialog(true);
                                      } else {
                                        alert(err.message || "Failed to approve order.");
                                      }
                                    }
                                  })}
                                  className="w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                                >
                                  {isThisOrderLoading ? '…' : 'Approve Order'}
                                </button>
                              )}

                              {/* approved → Start Packing */}
                              {currentStatus === 'approved' && ['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                                <button
                                  disabled={isThisOrderLoading}
                                  onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'packing', currentUser); await reloadOrdersAndStock(); })}
                                  className="w-full px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                                >
                                  {isThisOrderLoading ? '…' : 'Start Packing'}
                                </button>
                              )}

                              {/* packing → Assign Driver */}
                              {currentStatus === 'packing' && ['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (() => {
                                const matchingPl = pickLists.find(pl => pl.order_id === order.id);
                                const isPickListCompleted = matchingPl ? matchingPl.status === 'completed' : true;
                                return (
                                  <button
                                    disabled={isThisOrderLoading || !isPickListCompleted}
                                    title={!isPickListCompleted ? 'Complete all pick list items before assigning driver' : ''}
                                    onClick={() => {
                                      setAssignForm({ orderId: order.id, staffId: usersList.filter(u => u.role === 'delivery')[0]?.id || "", route: "" });
                                      setShowAssignModal(true);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                                  >
                                    {isThisOrderLoading ? '…' : !isPickListCompleted ? '⚠ Complete Picking First' : 'Assign Driver'}
                                  </button>
                                );
                              })()}

                              {/* assigned → Dispatch */}
                              {currentStatus === 'assigned' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                                <button
                                  disabled={isThisOrderLoading}
                                  onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'out_for_delivery', currentUser); await reloadOrdersAndStock(); })}
                                  className="w-full px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                                >
                                  {isThisOrderLoading ? '…' : 'Dispatch Order'}
                                </button>
                              )}

                              {/* out_for_delivery → Delivered / Fail */}
                              {currentStatus === 'out_for_delivery' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                                <div className="flex gap-1.5">
                                  <button
                                    disabled={isThisOrderLoading}
                                    onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'delivered', currentUser, { codCollected: order.cod_tracking ? true : false }); await reloadOrdersAndStock(); })}
                                    className="flex-1 px-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                                  >
                                    {isThisOrderLoading ? '…' : '✓ Delivered'}
                                  </button>
                                  <button
                                    disabled={isThisOrderLoading}
                                    onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'failed', currentUser); await reloadOrdersAndStock(); })}
                                    className="flex-1 px-2 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                                  >
                                    {isThisOrderLoading ? '…' : '✕ Failed'}
                                  </button>
                                </div>
                              )}

                              {/* Cancel — available to managers and staff until delivered/failed */}
                              {!['delivered', 'failed'].includes(currentStatus) && ['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                                <button
                                  disabled={isThisOrderLoading}
                                  onClick={() => { setCancelOrderId(order.id); setCancelReason(""); setShowCancelModal(true); }}
                                  className="w-full px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                                >
                                  Cancel Order
                                </button>
                              )}

                              {/* Delete (admin only) */}
                              {currentUser.role === 'admin' && (
                                <button
                                  disabled={isThisOrderLoading}
                                  onClick={() => withOrderLock(order.id, async () => { await db.deleteOrder(order.id, currentUser); await reloadOrders(); })}
                                  className="w-full p-1.5 rounded-lg bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 disabled:opacity-50 flex items-center justify-center gap-1 text-xs font-bold"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Failed orders — moved to Order History tab */}
              </div>
            </div>
            );
          })()}

                    {/* TAB: ORDER HISTORY */}
          {activeTab === "order-history" && (() => {
            const orderTypes = Array.from(new Set(orders.map(o => o.type)));
            const customerMap = new Map<string, string>();
            orders.filter(o => o.customer_name).forEach(o => { if (!customerMap.has(o.customer_id)) customerMap.set(o.customer_id, o.customer_name); });
            const customers = Array.from(customerMap.entries()).map(([id, name]) => ({ id, name }));

            const historyOrders = orders
              .filter(o => {
                if (!['delivered', 'failed'].includes(o.status)) return false;
                if (currentUser.role === 'customer' && o.customer_id !== currentUser.id) return false;
                if (historyFilterStatus && o.status !== historyFilterStatus) return false;
                if (historyFilterType && o.type !== historyFilterType) return false;
                if (historyFilterFrom && o.created_at.split('T')[0] < historyFilterFrom) return false;
                if (historyFilterTo && o.created_at.split('T')[0] > historyFilterTo) return false;
                if (historyFilterCustomer && o.customer_id !== historyFilterCustomer) return false;
                if (historySearchQuery) {
                  const q = historySearchQuery.toLowerCase();
                  if (!o.id.includes(historySearchQuery) && !o.customer_name.toLowerCase().includes(q)) return false;
                }
                return true;
              })
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            const totalPages = Math.max(1, Math.ceil(historyOrders.length / HISTORY_PAGE_SIZE));
            const pagedOrders = historyOrders.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);
            const hasFilter = historyFilterStatus || historyFilterType || historyFilterFrom || historyFilterTo || historyFilterCustomer || historySearchQuery;

            // Invoice permission helper
            const canPrintInvoice = (order: Order) => {
              if (['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role)) return true;
              if (currentUser.role === 'customer' && order.status === 'delivered') return true;
              return false;
            };

            return (
              <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-950 dark:text-white">Order History</h2>
                    <p className="text-xs text-slate-500 dark:text-gray-400">All delivered and cancelled orders.</p>
                  </div>
                  <button
                    onClick={() => exportToCSV(historyOrders, "order_history_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export
                  </button>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-200 dark:border-white/5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Search</label>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                      <input
                        type="text"
                        placeholder="Order ID / Customer..."
                        value={historySearchQuery}
                        onChange={e => { setHistorySearchQuery(e.target.value); setHistoryPage(1); }}
                        className="glass-input pl-8 pr-3 py-1.5 rounded-lg text-xs w-44"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[130px]">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Status</label>
                    <select value={historyFilterStatus} onChange={e => { setHistoryFilterStatus(e.target.value); setHistoryPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                      <option value="">All</option>
                      <option value="delivered">Delivered</option>
                      <option value="failed">Cancelled / Failed</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[120px]">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Order Type</label>
                    <select value={historyFilterType} onChange={e => { setHistoryFilterType(e.target.value); setHistoryPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                      <option value="">All Types</option>
                      {orderTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  {currentUser.role !== 'customer' && (
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Customer</label>
                      <select value={historyFilterCustomer} onChange={e => { setHistoryFilterCustomer(e.target.value); setHistoryPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                        <option value="">All Customers</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">From Date</label>
                    <input type="date" value={historyFilterFrom} onChange={e => { setHistoryFilterFrom(e.target.value); setHistoryPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">To Date</label>
                    <input type="date" value={historyFilterTo} onChange={e => { setHistoryFilterTo(e.target.value); setHistoryPage(1); }} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                  </div>
                  {hasFilter && (
                    <button
                      onClick={() => { setHistoryFilterStatus(''); setHistoryFilterType(''); setHistoryFilterFrom(''); setHistoryFilterTo(''); setHistoryFilterCustomer(''); setHistorySearchQuery(''); setHistoryPage(1); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                    >
                      <X className="w-3 h-3" /> Clear
                    </button>
                  )}
                  <div className="ml-auto flex items-center gap-2 self-end pb-1">
                    <span className="text-[10px] text-slate-400 dark:text-gray-500">{historyOrders.length} orders</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">{formatSAR(historyOrders.filter(o => o.status === 'delivered').reduce((s, o) => s + o.total, 0))}</span>
                  </div>
                </div>

                {/* Table */}
                <div className="rounded-xl border border-slate-200 dark:border-white/8 bg-white dark:bg-white/3 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/2">
                          <th className="text-left px-4 py-2.5 font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">Order ID</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">Customer</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">Date</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">Type</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">Status</th>
                          <th className="text-right px-4 py-2.5 font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">Total</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">Notes</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {pagedOrders.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-gray-500 text-sm">No orders found</td>
                          </tr>
                        )}
                        {pagedOrders.map(order => {
                          const cancelEntry = order.status_history?.find((h: any) => h.status === 'failed' && h.notes);
                          const isDelivered = order.status === 'delivered';
                          return (
                            <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-white/2 transition-colors">
                              <td className="px-4 py-3">
                                <span className={`font-mono font-bold text-[11px] ${isDelivered ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{order.id}</span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-slate-800 dark:text-gray-200">{order.customer_name}</td>
                              <td className="px-4 py-3 text-slate-500 dark:text-gray-400 whitespace-nowrap">{new Date(order.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-3">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 text-[10px] font-bold uppercase">{order.type}</span>
                              </td>
                              <td className="px-4 py-3">
                                {isDelivered ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-bold">Delivered</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-[10px] font-bold">Cancelled</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-gray-200 whitespace-nowrap">{formatSAR(order.total)}</td>
                              <td className="px-4 py-3 text-slate-400 dark:text-gray-500 italic text-[10px] max-w-[200px] truncate">
                                {cancelEntry ? `Reason: ${(cancelEntry as any).notes}` : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5 justify-end">
                                  {canPrintInvoice(order) && (
                                    <button
                                      onClick={() => handleGenerateInvoice(order)}
                                      title="Print Invoice"
                                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 text-[10px] font-bold transition"
                                    >
                                      <Printer className="w-3 h-3" /> Invoice
                                    </button>
                                  )}
                                  {currentUser.role === 'admin' && (
                                    <button
                                      onClick={() => withOrderLock(order.id, async () => { await db.deleteOrder(order.id, currentUser); await reloadOrders(); })}
                                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-[10px] font-bold transition"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-white/5">
                      <span className="text-[11px] text-slate-500 dark:text-gray-400">
                        Page {historyPage} of {totalPages} · {historyOrders.length} orders
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={historyPage === 1}
                          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                        >‹ Prev</button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const start = Math.max(1, Math.min(historyPage - 2, totalPages - 4));
                          const page = start + i;
                          return (
                            <button
                              key={page}
                              onClick={() => setHistoryPage(page)}
                              className={`w-7 h-7 rounded-lg text-xs font-bold transition ${page === historyPage ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-gray-300'}`}
                            >{page}</button>
                          );
                        })}
                        <button
                          disabled={historyPage === totalPages}
                          onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs font-bold disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                        >Next ›</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

                    {/* TAB 5: CREATE ORDER */}
          {activeTab === "create-order" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2">
                <button onClick={() => setActiveTab("orders")} className="text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white text-xs underline">
                  Back to Orders Pipeline
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Select Products</h3>
                    <input 
                      type="text" 
                      placeholder="Filter product list..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input px-3 py-1.5 rounded-lg text-xs w-48"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredProducts.map(p => {
                      // Combined stock across all warehouses — primary warehouse is used first
                      // automatically at fulfillment time, with overflow combined in as needed.
                      const availQty = getAvailableQty(p.id);
                      const outOfStock = availQty <= 0;
                      const isLow = availQty > 0 && availQty <= p.min_stock;
                      return (
                        <div key={p.id} className="glass-card rounded-xl p-4 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold">{p.category}</span>
                              <div className="text-right">
                                <span className={`text-[10px] font-bold ${outOfStock ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-500'}`}>
                                  {outOfStock ? 'Out of stock' : `${availQty} in stock`}
                                </span>
                              </div>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">{p.name}</h4>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">{formatSAR(p.selling_price)}</p>
                          </div>
                          
                          <button
                            disabled={outOfStock}
                            onClick={() => addToCart(p.id)}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold text-white rounded-lg transition"
                          >
                            {outOfStock ? "Out of Stock" : "Add to Order"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-6 border border-slate-200 dark:border-white/5 self-start space-y-5">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-white/5">Order Cart</h3>

                  {currentUser.role !== 'customer' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-1.5">Select B2B Customer</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-xs"
                      >
                        {usersList.filter(u => u.role === 'customer').map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {cart.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">Cart is empty. Add products on the left.</p>
                    ) : (
                      cart.map(item => {
                        const prod = products.find(p => p.id === item.product_id)!;
                        return (
                          <div key={item.product_id} className="flex justify-between items-center gap-2 text-xs">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-slate-900 dark:text-white truncate">{prod.name}</h4>
                              <span className="text-[10px] text-blue-500 dark:text-blue-400">{formatSAR(prod.selling_price)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                value={item.qty}
                                onChange={(e) => updateCartQty(item.product_id, parseInt(e.target.value) || 0)}
                                className="w-12 glass-input px-1.5 py-1 text-center rounded text-xs"
                              />
                              <button 
                                onClick={() => removeFromCart(item.product_id)}
                                className="p-1 rounded bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-950/40"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {cart.length > 0 && (() => {
                    const selectedCustomer = currentUser.role === 'customer'
                      ? currentUser
                      : usersList.find(u => u.id === selectedCustomerId);
                    const cartSubtotal = cart.reduce((sum, item) => {
                      const prod = products.find(p => p.id === item.product_id)!;
                      return sum + (prod.selling_price * item.qty);
                    }, 0);
                    const cartDiscounted = cart.reduce((sum, item) => {
                      const prod = products.find(p => p.id === item.product_id)!;
                      const price = selectedCustomer ? db.calculateCustomerPrice(selectedCustomer as any, prod) : prod.selling_price;
                      return sum + (price * item.qty);
                    }, 0);
                    const cartDiscount = cartSubtotal - cartDiscounted;
                    const manualPctDeduction = Number(((cartDiscounted * manualDiscountPct) / 100).toFixed(2));
                    const manualAmtCapped = Number(Math.min(manualDiscountAmt, Math.max(0, cartDiscounted - manualPctDeduction)).toFixed(2));
                    const finalTotal = Number((cartDiscounted - manualPctDeduction - manualAmtCapped).toFixed(2));
                    const canApplyManual = ['owner', 'manager', 'warehouse_manager', 'staff', 'admin', 'superowner'].includes(currentUser.role);
                    return (
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/5 text-xs text-slate-500 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="text-slate-900 dark:text-white font-semibold">
                          {formatSAR(cartSubtotal)}
                        </span>
                      </div>
                      {cartDiscount > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Customer Discount ({selectedCustomer?.customer_discount || 0}%):</span>
                          <span className="font-semibold">- {formatSAR(cartDiscount)}</span>
                        </div>
                      )}

                      {canApplyManual && (
                        <div className="space-y-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Manual Discount Override</p>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-[10px] text-slate-400 dark:text-gray-500 mb-1">Extra % Off</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={manualDiscountPct || ""}
                                  placeholder="0"
                                  onChange={(e) => setManualDiscountPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                                  className="glass-input w-full px-2 py-1.5 rounded text-xs"
                                />
                                <span className="text-slate-400 dark:text-gray-500">%</span>
                              </div>
                            </div>
                            <div className="flex-1">
                              <label className="block text-[10px] text-slate-400 dark:text-gray-500 mb-1">Fixed Amount Off</label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  value={manualDiscountAmt || ""}
                                  placeholder="0"
                                  onChange={(e) => setManualDiscountAmt(Math.max(0, parseFloat(e.target.value) || 0))}
                                  className="glass-input w-full px-2 py-1.5 rounded text-xs"
                                />
                                <span className="text-slate-400 dark:text-gray-500">SAR</span>
                              </div>
                            </div>
                          </div>
                          {(manualDiscountPct > 0 || manualAmtCapped > 0) && (
                            <div className="space-y-1 pt-1">
                              {manualDiscountPct > 0 && (
                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                  <span>Extra {manualDiscountPct}% off:</span>
                                  <span className="font-semibold">- {formatSAR(manualPctDeduction)}</span>
                                </div>
                              )}
                              {manualAmtCapped > 0 && (
                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                  <span>Fixed deduction:</span>
                                  <span className="font-semibold">- {formatSAR(manualAmtCapped)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-white/5 pt-2 text-sm">
                        <span>Total:</span>
                        <span className="text-emerald-600 dark:text-emerald-400">{formatSAR(finalTotal)}</span>
                      </div>


                      <div className="space-y-2">
                        <label className="block text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase mb-1">Order Type</label>
                        <select
                          value={selectedOrderType}
                          onChange={(e) => setSelectedOrderType(e.target.value as any)}
                          className="glass-input block w-full px-2 py-1.5 rounded text-xs"
                        >
                          <option value="normal">Normal Account Order</option>
                          <option value="walk-in">Walk-in Cash Order</option>
                          <option value="phone">Phone Order Entry</option>
                          <option value="cash">Direct Cash Sale</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          id="cod"
                          checked={isCodOrder}
                          onChange={(e) => setIsCodOrder(e.target.checked)}
                          className="rounded border-slate-300 dark:border-white/10"
                        />
                        <label htmlFor="cod" className="text-[11px] font-bold text-amber-600 dark:text-amber-400">COD (Cash on Delivery) Tracking</label>
                      </div>

                      {/* Warehouse selector moved outside — shown above products grid */}

                      <button
                        onClick={checkoutCart}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-lg transition text-xs cursor-pointer"
                      >
                        Submit Order
                      </button>
                    </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ACCOUNTING */}
          {activeTab === "accounting" && (() => {
            const LEDGER_PAGE_SIZE = 50;
            const customers = usersList.filter(u => u.role === 'customer');

            // Filter customers
            const filteredCustomers = customers.filter(c => {
              if (ledgerFilterCustomer && c.id !== ledgerFilterCustomer) return false;
              return true;
            });

            const toggleLedger = async (customerId: string, customerName: string) => {
              if (expandedLedgerCustomers[customerId] !== undefined) {
                setExpandedLedgerCustomers(prev => { const n = { ...prev }; delete n[customerId]; return n; });
                return;
              }
              setExpandedLedgerCustomers(prev => ({ ...prev, [customerId]: null }));
              const list = await db.getCustomerLedger(customerId);
              setExpandedLedgerCustomers(prev => ({ ...prev, [customerId]: { entries: list, page: 1 } }));
            };

            return (
            <div className="space-y-5 md:space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Accounting Ledger & Profits</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Evaluate net sales revenues, record expenses, review customer credit accounts, and track unpaid balances.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {['admin', 'owner', 'manager', 'warehouse_manager', 'staff', 'accountant'].includes(currentUser.role) && (
                    <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                      Record Expense
                    </button>
                  )}
                  {['admin', 'owner', 'manager', 'warehouse_manager', 'staff', 'accountant'].includes(currentUser.role) && (
                    <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer">
                      <CreditCard className="w-3.5 h-3.5" />
                      Receive B2B Payment
                    </button>
                  )}

                </div>
              </div>

              {/* P&L SUMMARY */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {!isFinanciallyRestricted && (
                  <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">Gross Sales Revenue</span>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(totalSalesVal)}</h3>
                    <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-1">Delivered customer orders</span>
                  </div>
                )}
                {!isFinanciallyRestricted && (
                  <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">Operating Expenses</span>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(totalExpensesVal)}</h3>
                    <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-1">Rent, electricity, repairs</span>
                  </div>
                )}
                {!isFinanciallyRestricted && (
                  <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/5">
                    <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">Net Profit</span>
                    <h3 className={`text-xl font-extrabold mt-1 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                      {formatSAR(netProfit)}
                    </h3>
                    <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-1">Sales minus stock costs & expenses</span>
                  </div>
                )}
              </div>



              {/* INNER SUB-TABS: Expenses | Customer Ledger */}
              <div className="space-y-4">
                {/* Sub-tab toggle */}
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-xl w-fit border border-slate-200 dark:border-white/5">
                  <button
                    onClick={() => setAccountingSubTab('expenses')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${accountingSubTab === 'expenses' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    Operating Expenses
                  </button>
                  <button
                    onClick={() => setAccountingSubTab('ledger')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${accountingSubTab === 'ledger' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white'}`}
                  >
                    B2B Customer Ledger
                  </button>
                </div>

                {/* ---- EXPENSES SUB-TAB ---- */}
                {accountingSubTab === 'expenses' && (() => {
                  const expenseCategories = ['Utilities','Rent','Maintenance','Salaries','Fuel/Transport','Other'];
                  const filteredExpenses = expenses
                    .filter((ex: any) => {
                      if (expenseFilterCategory && ex.category !== expenseFilterCategory) return false;
                      const exLocal = ex.timestamp ? (() => { const d = new Date(ex.timestamp); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() : '';
                      if (expenseFilterFrom && exLocal < expenseFilterFrom) return false;
                      if (expenseFilterTo && exLocal > expenseFilterTo) return false;
                      return true;
                    })
                    .slice()
                    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                  const filteredTotal = filteredExpenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
                  return (
                  <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-200 dark:border-white/5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Category</label>
                        <select value={expenseFilterCategory} onChange={e => setExpenseFilterCategory(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                          <option value="">All Categories</option>
                          {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">From</label>
                        <input type="date" value={expenseFilterFrom} onChange={e => setExpenseFilterFrom(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">To</label>
                        <input type="date" value={expenseFilterTo} onChange={e => setExpenseFilterTo(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs" />
                      </div>
                      {(expenseFilterCategory || expenseFilterFrom || expenseFilterTo) && (
                        <button onClick={() => { setExpenseFilterCategory(''); setExpenseFilterFrom(''); setExpenseFilterTo(''); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 transition self-end">
                          <X className="w-3 h-3" /> Clear
                        </button>
                      )}
                      <div className="ml-auto flex items-center gap-4 self-end pb-0.5">
                        <span className="text-[10px] text-slate-400 dark:text-gray-500">{filteredExpenses.length} records</span>
                        <span className="text-xs font-bold text-red-600 dark:text-red-400">Total: {formatSAR(filteredTotal)}</span>
                        <button onClick={() => exportToCSV(filteredExpenses, 'expenses_export')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer">
                          <Download className="w-3 h-3" /> Export
                        </button>
                      </div>
                    </div>
                    {/* Expense table */}
                    <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                        <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="p-4">Date</th>
                            <th className="p-4">Category</th>
                            <th className="p-4">Description</th>
                            <th className="p-4">Recorded By</th>
                            <th className="p-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredExpenses.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 dark:text-gray-500">No expenses found</td></tr>
                          ) : filteredExpenses.map((ex: any) => (
                            <tr key={ex.id} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/2">
                              <td className="p-4 text-slate-500 dark:text-gray-400 whitespace-nowrap">{new Date(ex.timestamp).toLocaleDateString()}</td>
                              <td className="p-4">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20">{ex.category}</span>
                              </td>
                              <td className="p-4 text-slate-700 dark:text-gray-300 max-w-xs truncate" title={ex.description}>{ex.description}</td>
                              <td className="p-4 text-slate-500 dark:text-gray-400">{ex.user_name || '—'}</td>
                              <td className="p-4 text-right font-bold text-red-600 dark:text-red-400">{formatSAR(ex.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {filteredExpenses.length > 0 && (
                          <tfoot>
                            <tr className="border-t-2 border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/3">
                              <td colSpan={4} className="p-4 text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider">Total</td>
                              <td className="p-4 text-right font-extrabold text-red-600 dark:text-red-400">{formatSAR(filteredTotal)}</td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>
                  );
                })()}

                {/* ---- B2B CUSTOMER LEDGER SUB-TAB ---- */}
                {accountingSubTab === 'ledger' && (
                <div className="space-y-4">
                  {/* LEDGER FILTERS */}
                  <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-200 dark:border-white/5">
                    <div className="flex flex-col gap-1 min-w-[160px]">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Customer</label>
                      <select
                        value={ledgerFilterCustomer}
                        onChange={e => setLedgerFilterCustomer(e.target.value)}
                        className="glass-input px-2.5 py-1.5 rounded-lg text-xs"
                      >
                        <option value="">All Customers</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {ledgerFilterCustomer && (
                      <button
                        onClick={() => setLedgerFilterCustomer('')}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/20 transition self-end"
                      >
                        <X className="w-3 h-3" /> Clear
                      </button>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500 self-end pb-1.5">{filteredCustomers.length} customers</span>
                  </div>

                  {/* CUSTOMER TABLE WITH INLINE LEDGER */}
                  <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                      <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-4">Customer Name</th>
                          <th className="p-4">Credit Limit</th>
                          <th className="p-4">Outstanding Balance</th>
                          <th className="p-4">Available Credit</th>
                          <th className="p-4 text-right">Ledger Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCustomers.length === 0 ? (
                          <tr><td colSpan={5} className="p-8 text-center text-slate-400 dark:text-gray-500">No customers found</td></tr>
                        ) : filteredCustomers.map(c => {
                          const limit = c.credit_limit || 0;
                          const outstanding = c.outstanding_balance || 0;
                          const available = limit - outstanding;
                          const expanded = expandedLedgerCustomers[c.id];
                          const isOpen = c.id in expandedLedgerCustomers;
                          const ledgerEntries = expanded?.entries ?? [];
                          const ledgerPage = expanded?.page ?? 1;
                          const ledgerTotalPages = Math.max(1, Math.ceil(ledgerEntries.length / LEDGER_PAGE_SIZE));

                          // Apply type + date filters to inline ledger entries
                          const filteredLedgerEntries = ledgerEntries.filter((l: any) => {
                            if (ledgerFilterType && l.type !== ledgerFilterType) return false;
                            const lLocal = l.timestamp ? (() => { const d = new Date(l.timestamp); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() : '';
                            if (ledgerFilterFrom && lLocal < ledgerFilterFrom) return false;
                            if (ledgerFilterTo && lLocal > ledgerFilterTo) return false;
                            return true;
                          });
                          const pagedLedger = filteredLedgerEntries.slice((ledgerPage - 1) * LEDGER_PAGE_SIZE, ledgerPage * LEDGER_PAGE_SIZE);
                          const ledgerFilteredPages = Math.max(1, Math.ceil(filteredLedgerEntries.length / LEDGER_PAGE_SIZE));

                          return (
                            <React.Fragment key={c.id}>
                              <tr className={`hover:bg-slate-50 dark:hover:bg-white/2 divide-y-0 border-t border-slate-100 dark:border-white/5 ${isOpen ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
                                <td className="p-4">
                                  <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                                  <span className="text-[10px] text-slate-400 dark:text-gray-500">Username: @{c.username}</span>
                                </td>
                                <td className="p-4 font-bold">{formatSAR(limit)}</td>
                                <td className="p-4 font-bold text-amber-600 dark:text-amber-400">{formatSAR(outstanding)}</td>
                                <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">{formatSAR(available)}</td>
                                <td className="p-4 text-right">
                                  <button
                                    onClick={() => toggleLedger(c.id, c.name)}
                                    className={`px-3 py-1 rounded font-bold text-[10px] border transition ${isOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border-slate-200 dark:border-white/10 text-slate-700 dark:text-gray-300'}`}
                                  >
                                    {isOpen ? 'Hide Statements ▲' : 'View Statements ▼'}
                                  </button>
                                </td>
                              </tr>

                              {/* INLINE EXPANDED LEDGER */}
                              {isOpen && (
                                <tr key={`${c.id}-ledger`}>
                                  <td colSpan={5} className="p-0 border-t border-blue-100 dark:border-blue-500/10">
                                    <div className="bg-slate-50/80 dark:bg-blue-950/5 px-6 py-4 space-y-3">
                                      {/* Sub-filters for the ledger entries */}
                                      <div className="flex flex-wrap items-end gap-3 pb-2 border-b border-slate-200 dark:border-white/5">
                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider self-end">Ledger for {c.name}</span>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">Type</label>
                                          <select value={ledgerFilterType} onChange={e => setLedgerFilterType(e.target.value)} className="glass-input px-2 py-1 rounded text-xs">
                                            <option value="">All</option>
                                            <option value="order">Order</option>
                                            <option value="payment">Payment</option>
                                            <option value="credit_adjustment">Credit Adjustment</option>
                                          </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">From</label>
                                          <input type="date" value={ledgerFilterFrom} onChange={e => setLedgerFilterFrom(e.target.value)} className="glass-input px-2 py-1 rounded text-xs" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <label className="text-[10px] text-slate-400 dark:text-gray-500 uppercase">To</label>
                                          <input type="date" value={ledgerFilterTo} onChange={e => setLedgerFilterTo(e.target.value)} className="glass-input px-2 py-1 rounded text-xs" />
                                        </div>
                                        {(ledgerFilterType || ledgerFilterFrom || ledgerFilterTo) && (
                                          <button onClick={() => { setLedgerFilterType(''); setLedgerFilterFrom(''); setLedgerFilterTo(''); }} className="flex items-center gap-1 px-2 py-1 rounded border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[10px] font-bold self-end">
                                            <X className="w-3 h-3" /> Clear
                                          </button>
                                        )}
                                        <span className="ml-auto text-[10px] text-slate-400 dark:text-gray-500 self-end">{filteredLedgerEntries.length} entries</span>
                                      </div>

                                      {expanded === null ? (
                                        <p className="text-xs text-slate-400 dark:text-gray-500 py-2 text-center">Loading ledger…</p>
                                      ) : filteredLedgerEntries.length === 0 ? (
                                        <p className="text-xs text-slate-400 dark:text-gray-500 py-2 text-center">No ledger entries found</p>
                                      ) : (
                                        <>
                                          <table className="w-full text-left text-[11px] text-slate-700 dark:text-gray-300">
                                            <thead className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                                              <tr>
                                                <th className="pb-2 pr-4">Date</th>
                                                <th className="pb-2 pr-4">Type</th>
                                                <th className="pb-2 pr-4">Reference</th>
                                                <th className="pb-2 pr-4 text-right">Amount</th>
                                                <th className="pb-2 pr-4 text-right">Balance After</th>
                                                <th className="pb-2">Notes</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                              {pagedLedger.map((l: any) => (
                                                <tr key={l.id} className="hover:bg-slate-100/50 dark:hover:bg-white/3">
                                                  <td className="py-2 pr-4 text-slate-500 dark:text-gray-400 whitespace-nowrap">{new Date(l.timestamp).toLocaleDateString()}</td>
                                                  <td className="py-2 pr-4">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                                      l.type === 'order' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' :
                                                      l.type === 'payment' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' :
                                                      'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-white/10'
                                                    }`}>
                                                      {l.type}
                                                    </span>
                                                  </td>
                                                  <td className="py-2 pr-4 font-mono text-slate-600 dark:text-gray-400">{l.ref_id || '—'}</td>
                                                  <td className={`py-2 pr-4 text-right font-bold ${l.type === 'payment' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                                                    {l.type === 'payment' ? '−' : '+'}{formatSAR(Math.abs(l.amount))}
                                                  </td>
                                                  <td className="py-2 pr-4 text-right font-bold text-slate-900 dark:text-white">{formatSAR(l.balance_after)}</td>
                                                  <td className="py-2 text-slate-500 dark:text-gray-400 max-w-xs truncate" title={l.notes}>{l.notes || '—'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>

                                          {/* LEDGER PAGINATION */}
                                          {ledgerFilteredPages > 1 && (
                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                                              <span className="text-[10px] text-slate-400 dark:text-gray-500">
                                                Page {ledgerPage} of {ledgerFilteredPages} · {filteredLedgerEntries.length} entries
                                              </span>
                                              <div className="flex items-center gap-1">
                                                <button onClick={() => setExpandedLedgerCustomers(prev => ({ ...prev, [c.id]: { ...prev[c.id]!, page: Math.max(1, ledgerPage - 1) } }))} disabled={ledgerPage === 1} className="px-2.5 py-1 rounded text-[10px] font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 disabled:opacity-40 cursor-pointer disabled:cursor-default">‹</button>
                                                {Array.from({ length: Math.min(5, ledgerFilteredPages) }, (_, i) => {
                                                  const start = Math.max(1, Math.min(ledgerPage - 2, ledgerFilteredPages - 4));
                                                  const p = start + i;
                                                  if (p > ledgerFilteredPages) return null;
                                                  return <button key={p} onClick={() => setExpandedLedgerCustomers(prev => ({ ...prev, [c.id]: { ...prev[c.id]!, page: p } }))} className={`px-2.5 py-1 rounded text-[10px] font-bold border cursor-pointer ${ledgerPage === p ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-white/10'}`}>{p}</button>;
                                                })}
                                                <button onClick={() => setExpandedLedgerCustomers(prev => ({ ...prev, [c.id]: { ...prev[c.id]!, page: Math.min(ledgerFilteredPages, ledgerPage + 1) } }))} disabled={ledgerPage === ledgerFilteredPages} className="px-2.5 py-1 rounded text-[10px] font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 disabled:opacity-40 cursor-pointer disabled:cursor-default">›</button>
                                              </div>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                )}
              </div>
            </div>
            );
          })()}

          {/* TAB 7: USER MANAGEMENT */}
          {activeTab === "users" && ['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'accountant'].includes(currentUser.role) && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">System User Management</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Control system users, setup role access, temporary credentials, and client custom pricing matrices.</p>
                </div>
                
                {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                  <button
                    onClick={() => {
                      setIsEditingUser(null);
                      setUserForm({ username: "", password: "123", name: "", role: "customer", credit_limit: 5000, customer_discount: 0 });
                      setShowUserModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create User
                  </button>
                )}
              </div>

              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Username</th>
                      <th className="p-4">System Role</th>
                      <th className="p-4">B2B Credit/Discount</th>
                      <th className="p-4">Custom Prices</th>
                      {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                        <th className="p-4 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {usersList.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/2">
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{u.name}</td>
                        <td className="p-4 font-mono">@{u.username}</td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            u.role === 'admin' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20' :
                            u.role === 'manager' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' :
                            'bg-slate-100 dark:bg-gray-500/10 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-500/20'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          {u.role === 'customer' ? (
                            <div>
                              <p className="font-bold">{formatSAR(u.credit_limit || 0)} limit</p>
                              <span className="text-[10px] text-slate-400 dark:text-gray-550">Discount: {u.customer_discount || 0}%</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-4">
                          {u.role === 'customer' ? (
                            <span className="font-bold">{Object.keys(u.custom_pricing || {}).length} rules</span>
                          ) : '-'}
                        </td>
                        {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                          <td className="p-4 text-right space-x-2">
                            {u.role === 'customer' && (
                              <button
                                onClick={async () => {
                                  const prodId = prompt("Enter Product ID (e.g. prod-rice, prod-oil):");
                                  if (!prodId) return;
                                  const priceStr = prompt("Enter Custom Price in SAR:");
                                  if (!priceStr) return;
                                  const price = parseFloat(priceStr);
                                  if (isNaN(price)) return;
                                  
                                  const target = usersList.find(usr => usr.id === u.id);
                                  if (!target) return;
                                  
                                  const customPricing = { ...(target.custom_pricing || {}) };
                                  customPricing[prodId] = price;
                                  await db.updateUser(u.id, { custom_pricing: customPricing }, currentUser);
                                  await reloadData();
                                }}
                                className="px-2 py-1 rounded bg-blue-900/20 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold"
                              >
                                + Custom Price
                              </button>
                            )}
                            <button 
                              onClick={() => startEditUser(u)}
                              className="p-1.5 rounded bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-0"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {u.username !== 'sysadmin' && (
                              <button 
                                onClick={async () => {
                                  await deleteUser(u.id);
                                }}
                                className="p-1.5 rounded bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: AUDIT LOGS */}
          {activeTab === "logs" && ['admin', 'superowner', 'owner', 'accountant'].includes(currentUser.role) && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">System Activity Audit Trail</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Chronological history logs tracking user creations, stock overrides, price updates, and transactions.</p>
                </div>

                <div className="flex gap-2">
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={handleWipeDatabase}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Wipe Database
                    </button>
                  )}
                  <button
                    onClick={() => exportToCSV(auditLogs, "audit_trail_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Logs
                  </button>
                </div>
              </div>

              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">User</th>
                      <th className="p-4">Role</th>
                      <th className="p-4">Action Taken</th>
                      <th className="p-4">Transaction Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {auditLogs.map(log => (
                      <tr key={log.id} className={`hover:bg-slate-50 dark:hover:bg-white/2 ${log.is_admin_only ? 'bg-red-100 dark:bg-red-950/5 border-l-2 border-l-red-500' : ''}`}>
                        <td className="p-4 text-slate-500 dark:text-gray-400">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{log.user_name}</td>
                        <td className="p-4 uppercase text-[10px] text-slate-400 dark:text-gray-500 font-bold">{log.user_role}</td>
                        <td className="p-4 font-semibold">{log.action}</td>
                        <td className="p-4 text-slate-500 dark:text-gray-400 font-mono text-[10px] truncate max-w-xs" title={log.details}>
                          {log.details || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 9: TRASH BIN */}
          {/* TAB: WAREHOUSES */}
          {activeTab === "warehouses" && ['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Warehouse Management</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Create and manage physical warehouse locations. Stock is tracked per warehouse with full transfer support.</p>
                </div>
                <div className="flex gap-2">
                  {['admin', 'owner', 'manager', 'warehouse_manager'].includes(currentUser.role) && (
                  <button
                    onClick={() => { setWarehouseForm({ name: '', location: '' }); setEditingWarehouseId(null); setShowWarehouseModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Warehouse
                  </button>
                  )}
                  {['admin', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                  <button
                    onClick={() => { setTransferForm({ productId: products[0]?.id || '', fromWarehouseId: warehouses[0]?.id || '', toWarehouseId: warehouses[1]?.id || '', qty: 1 }); setShowTransferModal(true); }}
                    disabled={warehouses.length < 2}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-bold text-white cursor-pointer"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Transfer Stock
                  </button>
                  )}
                </div>
              </div>

              {/* Warehouse Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {warehouses.map(wh => {
                  const whItems = warehouseStock.filter(ws => ws.warehouse_id === wh.id);
                  const totalItems = whItems.length;
                  const totalQty = whItems.reduce((s, ws) => s + ws.qty, 0);
                  return (
                    <div key={wh.id} className="glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                            {wh.name}
                          </h3>
                          {wh.location && <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-0.5">{wh.location}</p>}
                        </div>
                        {currentUser.role === 'admin' && (
                          <div className="flex gap-1">
                            <button onClick={() => { setWarehouseForm({ name: wh.name, location: wh.location || '' }); setEditingWarehouseId(wh.id); setShowWarehouseModal(true); }} className="p-1.5 rounded bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-0">
                              <Edit2 className="w-3 h-3 text-slate-600 dark:text-gray-400" />
                            </button>
                            {warehouses.length > 1 && (
                              <button onClick={async () => { if (confirm(`Deactivate "${wh.name}"? This cannot be undone easily.`)) { await db.deleteWarehouse(wh.id, currentUser); await reloadData(); } }} className="p-1.5 rounded bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 border border-red-200 dark:border-0">
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-white/5">
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-bold tracking-wider">SKUs Stocked</p>
                          <p className="text-lg font-extrabold text-slate-900 dark:text-white">{totalItems}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-gray-500 uppercase font-bold tracking-wider">Total Units</p>
                          <p className="text-lg font-extrabold text-slate-900 dark:text-white">{totalQty}</p>
                        </div>
                      </div>
                      {whItems.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <p className="text-[10px] font-bold text-slate-400 dark:text-gray-500 uppercase tracking-wider">Top Products</p>
                          {whItems.sort((a,b) => b.qty - a.qty).slice(0, 4).map(ws => {
                            const prod = products.find(p => p.id === ws.product_id);
                            return (
                              <div key={ws.product_id} className="flex justify-between items-center text-xs">
                                <span className="text-slate-700 dark:text-gray-300 truncate max-w-[160px]">{prod?.name || ws.product_id}</span>
                                <span className="font-bold text-slate-900 dark:text-white ml-2 shrink-0">{ws.qty} {prod?.unit || ''}</span>
                              </div>
                            );
                          })}
                          {whItems.length > 4 && <p className="text-[10px] text-slate-400 dark:text-gray-500 italic">+{whItems.length - 4} more SKUs…</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Stock by warehouse table */}
              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                <div className="p-4 border-b border-slate-100 dark:border-white/5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Full Stock Breakdown by Warehouse</h3>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3">Product</th>
                      <th className="p-3">Total Qty</th>
                      {warehouses.map(wh => <th key={wh.id} className="p-3">{wh.name}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {products.map(p => {
                      const breakdown = warehouseStock.filter(ws => ws.product_id === p.id);
                      const isLow = p.stock_qty <= p.min_stock;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-white/2">
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                            <span className="text-[10px] text-slate-400 dark:text-gray-500">{p.sku} · {p.category}</span>
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${isLow ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20' : 'bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-500/20'}`}>
                              {p.stock_qty} {p.unit}
                            </span>
                          </td>
                          {warehouses.map(wh => {
                            const ws = breakdown.find(w => w.warehouse_id === wh.id);
                            return (
                              <td key={wh.id} className="p-3 text-slate-700 dark:text-gray-300 font-semibold">
                                {ws ? <span>{ws.qty} <span className="text-slate-400 dark:text-gray-500 font-normal">{p.unit}</span></span> : <span className="text-slate-300 dark:text-gray-700">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "returns" && (() => {
            const cancelledOrders = orders.filter(o => o.status === 'failed');
            const productMap: Record<string, { productId: string; productName: string; totalQty: number; unit: string; orders: { orderId: string; customerName: string; qty: number; cancelledAt: string; reason: string; alreadyRestored: boolean }[] }> = {};
            for (const order of cancelledOrders) {
              const cancelEntry = order.status_history?.find((h: any) => h.status === 'failed');
              const cancelledAt = cancelEntry?.updated_at || order.created_at;
              const reason = cancelEntry?.notes || 'No reason given';
              const alreadyRestored = order.status_history?.some((h: any) => h.updated_by_name?.startsWith('STOCK_RESTORED:'));

              // Only include items from orders that actually had stock deducted.
              // Stock is deducted at 'approved' — if the order was cancelled while still
              // 'created' (e.g. out-of-stock cancellation before approval), nothing was
              // ever taken from stock so there's nothing to return.
              const wasEverApproved = order.status_history?.some((h: any) =>
                ['approved', 'packing', 'assigned', 'out_for_delivery'].includes(h.status)
              );
              if (!wasEverApproved) continue;

              for (const item of order.items) {
                if (!productMap[item.product_id]) {
                  const prod = products.find(p => p.id === item.product_id);
                  productMap[item.product_id] = { productId: item.product_id, productName: item.name, totalQty: 0, unit: prod?.unit || 'Pcs', orders: [] };
                }
                productMap[item.product_id].totalQty += item.qty;
                productMap[item.product_id].orders.push({ orderId: order.id, customerName: (order as any).customer_name || 'Unknown', qty: item.qty, cancelledAt, reason, alreadyRestored });
              }
            }
            const productRows = Object.values(productMap);

            const handleReturnOrder = async (order: Order) => {
              // Guard: re-fetch live order from DB to prevent double-restore on rapid clicks
              const liveOrder = await db.getOrderById(order.id);
              if (!liveOrder) return;
              const alreadyDone = liveOrder.status_history?.some((h: any) => h.updated_by_name?.startsWith('STOCK_RESTORED:'));
              if (alreadyDone) {
                await reloadOrdersAndStock(); // sync UI
                return;
              }

              // CRITICAL: Only show items with reservations in the warehouse modal.
              // For partially-approved orders, some items were never deducted and must not be
              // included — iterating over order.items would add phantom stock for those items.
              //
              // Reservation status depends on how far the order got:
              //   - cancelled before out_for_delivery → reservations are still 'active'
              //   - cancelled from out_for_delivery → reservations were marked 'completed' at dispatch
              const wasOutForDelivery = liveOrder.status_history?.some((h: any) => h.status === 'out_for_delivery');
              const allReservations = await db.getReservations();
              const relevantReservations = allReservations.filter(r =>
                r.order_id === liveOrder.id &&
                (wasOutForDelivery ? r.status === 'completed' : r.status === 'active')
              );

              if (relevantReservations.length === 0) {
                // Nothing was ever deducted for this order (cancelled before any approval).
                // Mark as restored immediately so the UI removes the "Return to Stock" button.
                const restoredEntry = { status: 'failed' as const, updated_at: new Date().toISOString(), updated_by_name: `STOCK_RESTORED:${currentUser!.name}` };
                const newHistory = [...liveOrder.status_history, restoredEntry];
                setOrders(prev => prev.map(o => o.id === liveOrder.id ? { ...o, status_history: newHistory } : o));
                if (supabase) {
                  await supabase.from('orders').update({ status_history: newHistory }).eq('id', liveOrder.id);
                } else {
                  const allOrders = JSON.parse(localStorage.getItem('orders') || '[]');
                  localStorage.setItem('orders', JSON.stringify(allOrders.map((o: any) => o.id === liveOrder.id ? { ...o, status_history: newHistory } : o)));
                }
                await reloadOrdersAndStock();
                return;
              }

              // Build a synthetic order containing ONLY the reserved items so the modal
              // only shows what will actually be restored.
              const reservedItems = relevantReservations.map(res => {
                const original = liveOrder.items.find((i: any) => i.product_id === res.product_id);
                return { ...original, product_id: res.product_id, qty: res.qty, warehouse_id: res.warehouse_id };
              });
              const orderForModal = { ...liveOrder, items: reservedItems };

              if (wasOutForDelivery) {
                // Order came back from delivery — ask for ONE warehouse for all items
                const firstWhId = warehouses[0]?.id || '';
                setReturnSingleWarehouseId(firstWhId);
                setReturnWarehouseModal({ order: orderForModal, singleWarehouseMode: true });
              } else {
                // Order never went out — per-item warehouse selection.
                // Pre-fill each item with its reservation's source warehouse so the user
                // sees where stock came from (and can override if needed).
                const defaults: Record<string, string> = {};
                for (const res of relevantReservations) {
                  defaults[res.product_id] = res.warehouse_id || warehouses[0]?.id || '';
                }
                setReturnItemWarehouses(defaults);
                setReturnWarehouseModal({ order: orderForModal, singleWarehouseMode: false });
              }
            };


            return (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Undo2 className="w-5 h-5 text-red-500" />
                      Cancelled Order Returns
                    </h2>
                    <p className="text-[11px] text-slate-400 dark:text-gray-500 mt-0.5">
                      {productRows.length > 0 ? `${Object.keys(productMap).length > 0 ? cancelledOrders.filter(o => o.status_history?.some((h: any) => ['approved','packing','assigned','out_for_delivery'].includes(h.status))).length : 0} orders with stock to return · ${productRows.reduce((s, r) => s + r.totalQty, 0)} total units` : `${cancelledOrders.length} cancelled orders · no stock to return`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-200 dark:bg-white/5 rounded-lg p-1">
                    <button onClick={() => setReturnsView('byProduct')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer ${returnsView === 'byProduct' ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-gray-400'}`}>
                      By Product
                    </button>
                    <button onClick={() => setReturnsView('byOrder')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition cursor-pointer ${returnsView === 'byOrder' ? 'bg-white dark:bg-gray-800 text-slate-900 dark:text-white shadow' : 'text-slate-500 dark:text-gray-400'}`}>
                      By Order
                    </button>
                  </div>
                </div>

                {(cancelledOrders.length === 0 || productRows.length === 0) && (
                  <div className="text-center py-16 text-slate-400 dark:text-gray-500">
                    <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">{cancelledOrders.length === 0 ? 'No cancelled orders' : 'No stock to return'}</p>
                    <p className="text-[11px] mt-1">{cancelledOrders.length === 0 ? 'All orders are active or delivered' : 'Cancelled orders had no stock deducted — nothing needs returning'}</p>
                  </div>
                )}

                {returnsView === 'byProduct' && productRows.length > 0 && (
                  <div className="space-y-2">
                    {productRows.map(row => {
                      const isExpanded = expandedProduct === row.productId;
                      const unrestoredOrders = row.orders.filter(o => !o.alreadyRestored);
                      const allRestored = unrestoredOrders.length === 0;
                      return (
                        <div key={row.productId} className="bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-white/8 rounded-xl overflow-hidden">
                          <button onClick={() => setExpandedProduct(isExpanded ? null : row.productId)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/3 transition cursor-pointer text-left">
                            <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{row.productName}</p>
                              <p className="text-[10px] text-slate-400 dark:text-gray-500">{row.orders.length} cancelled order{row.orders.length !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="text-right flex-shrink-0 mr-2">
                              <p className="text-lg font-black text-red-500">{row.totalQty}</p>
                              <p className="text-[10px] text-slate-400 dark:text-gray-500">{row.unit} total</p>
                            </div>
                            {allRestored
                              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 font-bold flex-shrink-0">✓ Restored</span>
                              : <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold flex-shrink-0">Pending</span>
                            }
                            <ChevronRight className={`w-4 h-4 text-slate-400 ml-1 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                          {isExpanded && (
                            <div className="border-t border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
                              {row.orders.map((o, idx) => {
                                const fullOrder = cancelledOrders.find(co => co.id === o.orderId);
                                return (
                                  <div key={idx} className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50/50 dark:bg-white/2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[11px] font-bold text-slate-700 dark:text-gray-200">{o.orderId}</p>
                                      <p className="text-[10px] text-slate-400 dark:text-gray-500">{o.customerName} · {new Date(o.cancelledAt).toLocaleDateString()}</p>
                                      {o.reason !== 'No reason given' && <p className="text-[10px] text-slate-400 dark:text-gray-500 italic truncate">"{o.reason}"</p>}
                                    </div>
                                    <span className="text-[11px] font-black text-slate-700 dark:text-gray-200">{o.qty} {row.unit}</span>
                                    {o.alreadyRestored
                                      ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 font-bold">✓ Returned</span>
                                      : fullOrder && (
                                        <button
                                          disabled={returningOrderId === o.orderId}
                                          onClick={() => handleReturnOrder(fullOrder)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[10px] font-bold transition cursor-pointer"
                                        >
                                          <ArchiveRestore className="w-3 h-3" />
                                          {returningOrderId === o.orderId ? 'Restoring…' : 'Return to Stock'}
                                        </button>
                                      )
                                    }
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {returnsView === 'byOrder' && cancelledOrders.length > 0 && (
                  <div className="space-y-2">
                    {cancelledOrders.map(order => {
                      const cancelEntry = order.status_history?.find((h: any) => h.status === 'failed');
                      const cancelledAt = cancelEntry?.updated_at || order.created_at;
                      const reason = cancelEntry?.notes || 'No reason given';
                      const isExpanded = expandedOrder === order.id;
                      const alreadyRestored = order.status_history?.some((h: any) => h.updated_by_name?.startsWith('STOCK_RESTORED:'));
                      return (
                        <div key={order.id} className="bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-white/8 rounded-xl overflow-hidden">
                          <div onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpandedOrder(isExpanded ? null : order.id); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/3 transition cursor-pointer text-left">
                            <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                              <ShoppingBag className="w-4 h-4 text-red-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-bold text-slate-700 dark:text-gray-200">{order.id}</p>
                              <p className="text-[10px] text-slate-400 dark:text-gray-500">{(order as any).customer_name} · {new Date(cancelledAt).toLocaleDateString()}</p>
                              {reason !== 'No reason given' && <p className="text-[10px] text-red-400 italic truncate">"{reason}"</p>}
                            </div>
                            <div className="text-right flex-shrink-0 mr-2">
                              <p className="text-sm font-black text-slate-700 dark:text-white">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</p>
                              <p className="text-[10px] text-slate-400 dark:text-gray-500">{formatSAR(order.total)}</p>
                            </div>
                            {alreadyRestored
                              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40 text-green-600 dark:text-green-400 font-bold flex-shrink-0">✓ Restored</span>
                              : (
                                <button
                                  disabled={returningOrderId === order.id}
                                  onClick={e => { e.stopPropagation(); handleReturnOrder(order); }}
                                  className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[10px] font-bold transition cursor-pointer flex-shrink-0"
                                >
                                  <ArchiveRestore className="w-3 h-3" />
                                  {returningOrderId === order.id ? 'Restoring…' : 'Return to Stock'}
                                </button>
                              )
                            }
                            <ChevronRight className={`w-4 h-4 text-slate-400 ml-1 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                          {isExpanded && (
                            <div className="border-t border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
                              {order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50/50 dark:bg-white/2">
                                  <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="flex-1 text-[11px] text-slate-700 dark:text-gray-200 font-semibold">{item.name}</span>
                                  <span className="text-[11px] text-slate-500 dark:text-gray-400">×{item.qty}</span>
                                  <span className="text-[11px] text-slate-400 dark:text-gray-500">{formatSAR(item.price * item.qty)}</span>
                                  {item.warehouse_name && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400">{item.warehouse_name}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {activeTab === "trash" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">Soft-Deleted Trash Bin</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">Review deleted products, orders, customers, and users. Restore them, or command permanent purge (Admin only).</p>
              </div>

              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Deleted Item Name</th>
                      <th className="p-4">Entity Type</th>
                      <th className="p-4">Deleted At</th>
                      <th className="p-4 text-right">Recovery Commands</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {trashList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">Trash bin is clean and empty</td>
                      </tr>
                    ) : (
                      trashList.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/2">
                          <td className="p-4 font-bold text-slate-900 dark:text-white">{item.name}</td>
                          <td className="p-4 capitalize">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                              {item.type}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 dark:text-gray-400">{new Date(item.deletedAt).toLocaleString()}</td>
                          <td className="p-4 text-right space-x-2">
                            {['admin', 'superowner', 'owner', 'manager', 'warehouse_manager', 'staff'].includes(currentUser.role) && (
                              <button
                                onClick={() => restoreTrashItem(item.id, item.type)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px]"
                              >
                                Restore
                              </button>
                            )}
                            {['admin', 'superowner'].includes(currentUser.role) && (
                              <button
                                onClick={() => permanentDeleteTrashItem(item.id, item.type)}
                                className="px-2.5 py-1 bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded font-bold text-[10px]"
                              >
                                Purge
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Owner Company Settings tab */}
          {activeTab === "company-settings" && ['admin', 'superowner', 'owner'].includes(currentUser.role) && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">Owner Company Settings</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">Configure your business details. These fields are automatically displayed on generated tax invoices.</p>
              </div>

              {companySettingsError && (
                <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold">
                  ⚠️ {companySettingsError}
                </div>
              )}

              {showCompanySettingsSaved && (
                <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  ✓ Company settings saved successfully!
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCompanySettingsError("");
                  setShowCompanySettingsSaved(false);

                  // Validate VAT (15 digits, starts and ends with 3)
                  if (companySettings?.vat_number && !/^3\d{13}3$/.test(companySettings.vat_number.trim())) {
                    setCompanySettingsError("VAT Number must be exactly 15 digits, starting and ending with '3'.");
                    return;
                  }

                  // Validate CR Number (10 digits)
                  if (companySettings?.cr_number && !/^\d{10}$/.test(companySettings.cr_number.trim())) {
                    setCompanySettingsError("CR Number (Commercial Registration) must be exactly 10 digits.");
                    return;
                  }

                  // Validate Zakat Number (10 digits)
                  if (companySettings?.zakat_number && !/^\d{10}$/.test(companySettings.zakat_number.trim())) {
                    setCompanySettingsError("Zakat Number must be exactly 10 digits.");
                    return;
                  }

                  try {
                    const updated = await db.updateCompanySettings(companySettings || {}, currentUser);
                    setCompanySettings(updated);
                    setShowCompanySettingsSaved(true);
                    setTimeout(() => setShowCompanySettingsSaved(false), 4000);
                  } catch (err: any) {
                    setCompanySettingsError(err.message || "Failed to save company settings.");
                  }
                }}
                className="glass-panel rounded-xl p-6 border border-slate-200 dark:border-white/5 space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Name</label>
                    <input
                      type="text"
                      required
                      value={companySettings?.name || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. Zenvora Distribution Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">VAT Number (15-digit)</label>
                    <input
                      type="text"
                      required
                      value={companySettings?.vat_number || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, vat_number: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 310123456700003"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">CR Number (10-digit)</label>
                    <input
                      type="text"
                      required
                      value={companySettings?.cr_number || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, cr_number: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 1010987654"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Zakat Number (10-digit)</label>
                    <input
                      type="text"
                      value={companySettings?.zakat_number || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, zakat_number: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 3101234567"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Business License Number</label>
                    <input
                      type="text"
                      value={companySettings?.business_license_number || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, business_license_number: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. LIC-2026-8890"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Website</label>
                    <input
                      type="text"
                      value={companySettings?.website || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, website: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. www.zenvora.com"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={companySettings?.phone || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. +966 11 456 7890"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Email</label>
                    <input
                      type="email"
                      value={companySettings?.email || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, email: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. info@zenvora.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Address</label>
                    <input
                      type="text"
                      value={companySettings?.address || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, address: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 4259 King Abdulaziz Road"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">City</label>
                    <input
                      type="text"
                      value={companySettings?.city || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, city: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. Riyadh"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={companySettings?.postal_code || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, postal_code: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 12211"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Logo (Image URL)</label>
                    <input
                      type="text"
                      value={companySettings?.logo_url || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, logo_url: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. https://example.com/logo.png"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Stamp (Image URL)</label>
                    <input
                      type="text"
                      value={companySettings?.stamp_url || ""}
                      onChange={(e) => setCompanySettings(prev => prev ? { ...prev, stamp_url: e.target.value } : null)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. https://example.com/stamp.png"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/5">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition text-xs shadow-lg cursor-pointer"
                  >
                    Save Company Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Customer Company Profile tab */}
          {activeTab === "customer-profile" && currentUser.role === 'customer' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">My Company Profile</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">Manage your business settings. These details are used automatically when generating wholesale tax invoices.</p>
              </div>

              {customerCompanyError && (
                <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold">
                  ⚠️ {customerCompanyError}
                </div>
              )}

              {customerCompanySaved && (
                <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                  ✓ Profile saved successfully!
                </div>
              )}

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setCustomerCompanyError("");
                  setCustomerCompanySaved(false);

                  // Validate VAT (15 digits, starts and ends with 3)
                  if (customerCompany?.vat_number && !/^3\d{13}3$/.test(customerCompany.vat_number.trim())) {
                    setCustomerCompanyError("VAT Number must be exactly 15 digits, starting and ending with '3'.");
                    return;
                  }

                  // Validate CR Number (10 digits)
                  if (customerCompany?.cr_number && !/^\d{10}$/.test(customerCompany.cr_number.trim())) {
                    setCustomerCompanyError("CR Number must be exactly 10 digits.");
                    return;
                  }

                  try {
                    const res = await db.updateCustomerCompanyDetails(currentUser.id, customerCompany || {}, currentUser);
                    setCustomerCompany(res);
                    setCustomerCompanySaved(true);
                    setTimeout(() => setCustomerCompanySaved(false), 4000);
                  } catch (err: any) {
                    setCustomerCompanyError(err.message || "Failed to save profile.");
                  }
                }}
                className="glass-panel rounded-xl p-6 border border-slate-200 dark:border-white/5 space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Name</label>
                    <input
                      type="text"
                      required
                      value={customerCompany?.company_name || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, company_name: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. Al-Najah Supermarkets Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Contact Person</label>
                    <input
                      type="text"
                      required
                      value={customerCompany?.contact_person || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, contact_person: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. Abdullah bin Khalid"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">VAT Number (15-digit)</label>
                    <input
                      type="text"
                      value={customerCompany?.vat_number || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, vat_number: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 310111222300003"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">CR Number (10-digit)</label>
                    <input
                      type="text"
                      value={customerCompany?.cr_number || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, cr_number: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 1010112233"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Phone Number</label>
                    <input
                      type="text"
                      value={customerCompany?.phone || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, phone: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. +966 50 123 4567"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Company Email</label>
                    <input
                      type="email"
                      value={customerCompany?.email || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, email: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. store@alnajah.com"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Address</label>
                    <input
                      type="text"
                      value={customerCompany?.address || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, address: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 8891 Olaya District"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">City</label>
                    <input
                      type="text"
                      value={customerCompany?.city || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, city: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. Riyadh"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={customerCompany?.postal_code || ""}
                      onChange={(e) => setCustomerCompany(prev => ({ ...prev!, postal_code: e.target.value }))}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      placeholder="e.g. 12214"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/5">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition text-xs shadow-lg cursor-pointer"
                  >
                    Save My Company Profile
                  </button>
                </div>
              </form>
            </div>
          )}


        </div>
      </main>

      {/* ===================== MODALS ===================== */}

      {/* 1. PRODUCT CREATE/EDIT MODAL */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-white/5">
              {isEditingProduct ? (currentUser?.role === 'staff' ? "Update Stock Quantity" : "Edit Product") : "Create New Product"}
            </h3>
            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
              {/* Staff editing: only show stock qty update */}
              {currentUser?.role === 'staff' && isEditingProduct ? (
                <>
                  <div className="p-3 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    <p className="font-bold text-slate-900 dark:text-white">{productForm.name}</p>
                    <p className="text-slate-400 dark:text-gray-500 mt-0.5">SKU: {productForm.sku} &nbsp;·&nbsp; {productForm.category}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
                      <span className="text-slate-500 dark:text-gray-400">Current stock:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{editingProductOriginalStock} units</span>
                    </div>
                    <label className="block text-slate-500 dark:text-gray-400 mb-1">Set New Target Quantity</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productForm.stock_qty}
                      onChange={(e) => setProductForm({ ...productForm, stock_qty: parseInt(e.target.value) || 0 })}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                    />
                    {(() => {
                      const diff = (productForm.stock_qty ?? 0) - editingProductOriginalStock;
                      if (diff === 0) return <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">No change — stock will stay at {editingProductOriginalStock}.</p>;
                      return (
                        <p className={`text-[10px] mt-1 font-semibold ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {diff > 0 ? `▲ +${diff} units will be added` : `▼ ${diff} units will be removed`}
                        </p>
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">Product Name</label>
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">SKU / Barcode</label>
                      <input
                        type="text"
                        required
                        value={productForm.sku}
                        onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">Category</label>
                      <select
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      >
                        <optgroup label="🥩 Fresh & Perishables">
                          <option value="Fresh Meat & Poultry">Fresh Meat & Poultry</option>
                          <option value="Fresh Seafood">Fresh Seafood</option>
                          <option value="Fresh Fruits">Fresh Fruits</option>
                          <option value="Fresh Vegetables">Fresh Vegetables</option>
                          <option value="Fresh Herbs & Spices">Fresh Herbs & Spices</option>
                          <option value="Deli & Charcuterie">Deli & Charcuterie</option>
                          <option value="Bakery & Fresh Bread">Bakery & Fresh Bread</option>
                          <option value="Flowers & Plants">Flowers & Plants</option>
                        </optgroup>
                        <optgroup label="🧀 Dairy, Eggs & Chilled">
                          <option value="Milk & Dairy">Milk & Dairy</option>
                          <option value="Cheese">Cheese</option>
                          <option value="Yogurt & Cream">Yogurt & Cream</option>
                          <option value="Butter & Margarine">Butter & Margarine</option>
                          <option value="Eggs">Eggs</option>
                          <option value="Chilled Juices & Drinks">Chilled Juices & Drinks</option>
                          <option value="Chilled Ready Meals">Chilled Ready Meals</option>
                        </optgroup>
                        <optgroup label="🍞 Dry Food & Pantry">
                          <option value="Rice & Grains">Rice & Grains</option>
                          <option value="Pasta & Noodles">Pasta & Noodles</option>
                          <option value="Flour & Baking">Flour & Baking</option>
                          <option value="Bread & Cereals">Bread & Cereals</option>
                          <option value="Breakfast Cereals & Oats">Breakfast Cereals & Oats</option>
                          <option value="Dry Legumes & Pulses">Dry Legumes & Pulses</option>
                          <option value="Nuts & Dried Fruits">Nuts & Dried Fruits</option>
                          <option value="Sugar, Salt & Condiments">Sugar, Salt & Condiments</option>
                        </optgroup>
                        <optgroup label="🥫 Canned, Jarred & Preserved">
                          <option value="Canned Vegetables">Canned Vegetables</option>
                          <option value="Canned Fruits">Canned Fruits</option>
                          <option value="Canned Fish & Seafood">Canned Fish & Seafood</option>
                          <option value="Canned Meat">Canned Meat</option>
                          <option value="Canned Beans & Lentils">Canned Beans & Lentils</option>
                          <option value="Jams, Honey & Spreads">Jams, Honey & Spreads</option>
                          <option value="Pickles & Olives">Pickles & Olives</option>
                          <option value="Sauces & Pastes">Sauces & Pastes</option>
                          <option value="Soups & Broths">Soups & Broths</option>
                        </optgroup>
                        <optgroup label="🛢️ Oils, Fats & Vinegar">
                          <option value="Cooking Oils">Cooking Oils</option>
                          <option value="Olive Oil">Olive Oil</option>
                          <option value="Ghee & Clarified Butter">Ghee & Clarified Butter</option>
                          <option value="Vinegar & Dressings">Vinegar & Dressings</option>
                        </optgroup>
                        <optgroup label="🧂 Spices, Herbs & Seasonings">
                          <option value="Whole Spices">Whole Spices</option>
                          <option value="Ground Spices">Ground Spices</option>
                          <option value="Spice Blends & Mixes">Spice Blends & Mixes</option>
                          <option value="Dried Herbs">Dried Herbs</option>
                          <option value="Curry Powders & Pastes">Curry Powders & Pastes</option>
                          <option value="Food Coloring & Flavoring">Food Coloring & Flavoring</option>
                        </optgroup>
                        <optgroup label="🥤 Beverages">
                          <option value="Water & Sparkling Water">Water & Sparkling Water</option>
                          <option value="Soft Drinks & Carbonated">Soft Drinks & Carbonated</option>
                          <option value="Juices & Nectars">Juices & Nectars</option>
                          <option value="Energy & Sports Drinks">Energy & Sports Drinks</option>
                          <option value="Tea & Herbal Infusions">Tea & Herbal Infusions</option>
                          <option value="Coffee & Hot Drinks">Coffee & Hot Drinks</option>
                          <option value="Milk Drinks & Plant-Based">Milk Drinks & Plant-Based</option>
                          <option value="Syrups & Cordials">Syrups & Cordials</option>
                        </optgroup>
                        <optgroup label="🍫 Snacks, Sweets & Confectionery">
                          <option value="Chocolates & Candy">Chocolates & Candy</option>
                          <option value="Chips & Crisps">Chips & Crisps</option>
                          <option value="Biscuits & Cookies">Biscuits & Cookies</option>
                          <option value="Crackers & Rice Cakes">Crackers & Rice Cakes</option>
                          <option value="Popcorn & Pretzels">Popcorn & Pretzels</option>
                          <option value="Gum & Mints">Gum & Mints</option>
                          <option value="Ice Cream & Frozen Desserts">Ice Cream & Frozen Desserts</option>
                          <option value="Cakes & Pastries">Cakes & Pastries</option>
                        </optgroup>
                        <optgroup label="❄️ Frozen Foods">
                          <option value="Frozen Meat & Poultry">Frozen Meat & Poultry</option>
                          <option value="Frozen Seafood">Frozen Seafood</option>
                          <option value="Frozen Vegetables">Frozen Vegetables</option>
                          <option value="Frozen Fruits">Frozen Fruits</option>
                          <option value="Frozen Meals & Snacks">Frozen Meals & Snacks</option>
                          <option value="Frozen Pizza & Breads">Frozen Pizza & Breads</option>
                        </optgroup>
                        <optgroup label="🍼 Baby & Infant">
                          <option value="Baby Formula & Milk">Baby Formula & Milk</option>
                          <option value="Baby Food & Purees">Baby Food & Purees</option>
                          <option value="Baby Snacks & Cereals">Baby Snacks & Cereals</option>
                          <option value="Diapers & Wipes">Diapers & Wipes</option>
                          <option value="Baby Toiletries">Baby Toiletries</option>
                          <option value="Baby Accessories">Baby Accessories</option>
                        </optgroup>
                        <optgroup label="🧴 Health, Beauty & Personal Care">
                          <option value="Shampoo & Conditioner">Shampoo & Conditioner</option>
                          <option value="Soaps & Body Wash">Soaps & Body Wash</option>
                          <option value="Skincare & Moisturizers">Skincare & Moisturizers</option>
                          <option value="Oral Care">Oral Care</option>
                          <option value="Deodorants & Antiperspirants">Deodorants & Antiperspirants</option>
                          <option value="Hair Care & Styling">Hair Care & Styling</option>
                          <option value="Feminine Hygiene">Feminine Hygiene</option>
                          <option value="Vitamins & Supplements">Vitamins & Supplements</option>
                          <option value="OTC Medicine & First Aid">OTC Medicine & First Aid</option>
                          <option value="Cosmetics & Makeup">Cosmetics & Makeup</option>
                          <option value="Fragrances & Perfumes">Fragrances & Perfumes</option>
                        </optgroup>
                        <optgroup label="🧹 Household & Cleaning">
                          <option value="Laundry Detergents">Laundry Detergents</option>
                          <option value="Fabric Softeners">Fabric Softeners</option>
                          <option value="Dish Soap & Dishwasher">Dish Soap & Dishwasher</option>
                          <option value="Floor & Surface Cleaners">Floor & Surface Cleaners</option>
                          <option value="Bathroom Cleaners">Bathroom Cleaners</option>
                          <option value="Trash Bags & Liners">Trash Bags & Liners</option>
                          <option value="Paper Towels & Tissues">Paper Towels & Tissues</option>
                          <option value="Toilet Paper">Toilet Paper</option>
                          <option value="Insecticides & Pest Control">Insecticides & Pest Control</option>
                          <option value="Air Fresheners">Air Fresheners</option>
                          <option value="Mops, Brooms & Brushes">Mops, Brooms & Brushes</option>
                        </optgroup>
                        <optgroup label="🍽️ Kitchen & Dining">
                          <option value="Cookware & Bakeware">Cookware & Bakeware</option>
                          <option value="Cutlery & Utensils">Cutlery & Utensils</option>
                          <option value="Plates, Bowls & Glasses">Plates, Bowls & Glasses</option>
                          <option value="Food Storage & Containers">Food Storage & Containers</option>
                          <option value="Foil, Wrap & Bags">Foil, Wrap & Bags</option>
                          <option value="Small Kitchen Appliances">Small Kitchen Appliances</option>
                        </optgroup>
                        <optgroup label="🏠 Home & Lifestyle">
                          <option value="Candles & Home Fragrance">Candles & Home Fragrance</option>
                          <option value="Bedding & Pillows">Bedding & Pillows</option>
                          <option value="Towels & Bath Linen">Towels & Bath Linen</option>
                          <option value="Storage & Organization">Storage & Organization</option>
                          <option value="Stationery & Office">Stationery & Office</option>
                          <option value="Batteries & Electricals">Batteries & Electricals</option>
                          <option value="Light Bulbs & Fixtures">Light Bulbs & Fixtures</option>
                        </optgroup>
                        <optgroup label="🐾 Pet Supplies">
                          <option value="Pet Food - Dry">Pet Food - Dry</option>
                          <option value="Pet Food - Wet">Pet Food - Wet</option>
                          <option value="Pet Treats & Snacks">Pet Treats & Snacks</option>
                          <option value="Pet Grooming">Pet Grooming</option>
                          <option value="Pet Accessories">Pet Accessories</option>
                        </optgroup>
                        <optgroup label="🌿 Organic & Specialty">
                          <option value="Organic & Natural Foods">Organic & Natural Foods</option>
                          <option value="Gluten-Free Products">Gluten-Free Products</option>
                          <option value="Vegan & Plant-Based">Vegan & Plant-Based</option>
                          <option value="Halal Certified">Halal Certified</option>
                          <option value="Diabetic & Low-Sugar">Diabetic & Low-Sugar</option>
                          <option value="Keto & Low-Carb">Keto & Low-Carb</option>
                          <option value="International & Ethnic Foods">International & Ethnic Foods</option>
                        </optgroup>
                        <optgroup label="🎉 Seasonal & Other">
                          <option value="Seasonal & Festive">Seasonal & Festive</option>
                          <option value="Gift Sets & Hampers">Gift Sets & Hampers</option>
                          <option value="Sports & Nutrition">Sports & Nutrition</option>
                          <option value="Other">Other</option>
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">Unit of Measure</label>
                      <input
                        type="text"
                        value={productForm.unit}
                        placeholder="e.g. Bag, Bottle, Carton"
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">Cost Price (SAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={productForm.purchase_cost}
                        onChange={(e) => setProductForm({ ...productForm, purchase_cost: parseFloat(e.target.value) || 0 })}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">Selling Price (SAR)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={productForm.selling_price}
                        onChange={(e) => setProductForm({ ...productForm, selling_price: parseFloat(e.target.value) || 0 })}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">Min Stock Threshold</label>
                      <input
                        type="number"
                        required
                        value={productForm.min_stock}
                        onChange={(e) => setProductForm({ ...productForm, min_stock: parseInt(e.target.value) || 0 })}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Stock qty — shown both when creating AND when editing (admin/owner/manager) */}
                  <div>
                    {isEditingProduct ? (
                      <>
                        <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs">
                          <span className="text-slate-500 dark:text-gray-400">Current stock:</span>
                          <span className="font-bold text-slate-900 dark:text-white">{editingProductOriginalStock} units</span>
                        </div>
                        <label className="block text-slate-500 dark:text-gray-400 mb-1">Set New Target Quantity</label>
                        <input
                          type="number"
                          min="0"
                          value={productForm.stock_qty}
                          onChange={(e) => setProductForm({ ...productForm, stock_qty: parseInt(e.target.value) || 0 })}
                          className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                        />
                        {(() => {
                          const diff = (productForm.stock_qty ?? 0) - editingProductOriginalStock;
                          if (diff === 0) return <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">No change — stock will stay at {editingProductOriginalStock}.</p>;
                          return (
                            <p className={`text-[10px] mt-1 font-semibold ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                              {diff > 0 ? `▲ +${diff} units will be added` : `▼ ${diff} units will be removed`} — logged as manual adjustment.
                            </p>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        <label className="block text-slate-500 dark:text-gray-400 mb-1">Initial Stock Qty</label>
                        <input
                          type="number"
                          value={productForm.stock_qty}
                          onChange={(e) => setProductForm({ ...productForm, stock_qty: parseInt(e.target.value) || 0 })}
                          className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                        />
                      </>
                    )}
                  </div>

                  {/* Warehouse selector — always visible */}
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 mb-1">
                      {isEditingProduct ? 'Warehouse (for stock adjustment)' : 'Assign to Warehouse'}
                    </label>
                    <select
                      value={productWarehouseId}
                      onChange={(e) => setProductWarehouseId(e.target.value)}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      required
                    >
                      <option value="">— Select Warehouse —</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">
                      {isEditingProduct ? 'Stock change will be logged against this warehouse.' : 'Initial stock will be placed in this warehouse.'}
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. USER CREATE/EDIT MODAL */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-white/5">
              {isEditingUser ? "Edit User Account" : "Create New ERP Account"}
            </h3>
            <form onSubmit={handleUserSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Username (Login)</label>
                <input
                  type="text"
                  required
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">{isEditingUser ? "Password Reset (Optional)" : "Password"}</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  placeholder={isEditingUser ? "Leave empty to keep current" : "Temporary password"}
                />
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">System Role Access</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as any })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="superowner">Super Owner</option>
                  <option value="owner">Owner</option>
                  <option value="manager">Manager</option>
                  <option value="warehouse_manager">Warehouse Manager</option>
                  <option value="accountant">Accountant</option>
                  <option value="staff">Warehouse Staff</option>
                  <option value="delivery">Delivery Staff</option>
                  <option value="customer">B2B Customer Client</option>
                </select>
              </div>

              {userForm.role === 'customer' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 mb-1">Credit Limit (SAR)</label>
                    <input
                      type="number"
                      value={userForm.credit_limit}
                      onChange={(e) => setUserForm({ ...userForm, credit_limit: parseFloat(e.target.value) || 0 })}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 dark:text-gray-400 mb-1">Standard Discount %</label>
                    <input
                      type="number"
                      value={userForm.customer_discount}
                      onChange={(e) => setUserForm({ ...userForm, customer_discount: parseFloat(e.target.value) || 0 })}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                    />
                  </div>
                  {!isEditingUser && (
                    <div className="col-span-2">
                      <label className="block text-slate-500 dark:text-gray-400 mb-1">Opening Balance (SAR)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={(userForm as any).opening_balance || 0}
                        onChange={(e) => setUserForm({ ...userForm, opening_balance: parseFloat(e.target.value) || 0 } as any)}
                        className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">Pre-existing balance owed before this account was created. Logged as an opening entry in the customer ledger.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. STOCK ADJUSTMENT MODAL */}
      {showStockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-white/5">
              Record Stock Adjustment Entry
            </h3>
            <form onSubmit={handleStockSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Select Product</label>
                <select
                  value={stockForm.productId}
                  onChange={(e) => setStockForm({ ...stockForm, productId: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1">Adjustment Quantity</label>
                  <input
                    type="number"
                    required
                    value={stockForm.qty}
                    onChange={(e) => setStockForm({ ...stockForm, qty: parseInt(e.target.value) || 0 })}
                    className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1">Operation Type</label>
                  <select
                    value={stockForm.type}
                    onChange={(e) => setStockForm({ ...stockForm, type: e.target.value as any })}
                    className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="purchase">Stock In: Purchase Entry</option>
                    <option value="supplier_return">Stock In: Supplier Return</option>
                    <option value="customer_return">Stock In: Cancelled Order Return</option>
                    <option value="manual_adjustment">Manual Adjustment (+/-)</option>
                    <option value="damage">Stock Out: Damage Goods</option>
                    <option value="expired">Stock Out: Expired Goods</option>
                  </select>
                </div>
              </div>

              {/* Contextual hint */}
              {stockForm.type && (
                <p className="text-[10px] px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400">
                  {stockForm.type === 'purchase' && 'Stock IN — adds to inventory. Use for new supplier purchase arrivals.'}
                  {stockForm.type === 'supplier_return' && 'Stock IN — adds to inventory. Use when a supplier returns previously returned goods back to you.'}
                  {stockForm.type === 'customer_return' && 'Stock IN — adds to inventory. Use when a customer cancels/returns an order and goods come back to warehouse.'}
                  {stockForm.type === 'manual_adjustment' && 'Manual override — enter a positive number to add stock, negative to deduct. Use for stock counts / corrections.'}
                  {stockForm.type === 'damage' && 'Stock OUT — deducts from inventory. Use for goods damaged in warehouse.'}
                  {stockForm.type === 'expired' && 'Stock OUT — deducts from inventory. Use for expired/unsellable goods.'}
                </p>
              )}

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Warehouse</label>
                <select
                  value={stockForm.warehouseId}
                  onChange={(e) => setStockForm({ ...stockForm, warehouseId: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  required
                >
                  <option value="">— Select Warehouse —</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Internal Reference Notes</label>
                <textarea
                  required
                  value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white h-20 resize-none"
                  placeholder="Invoice number, order ID, supplier details, or damage description..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                >
                  Record Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. DRIVER ASSIGNMENT MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-white/5">
              Assign Driver (Staff) & Delivery Route
            </h3>
            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Select Delivery Staff</label>
                <select
                  value={assignForm.staffId}
                  onChange={(e) => setAssignForm({ ...assignForm, staffId: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                >
                  {usersList.filter(u => u.role === 'delivery').map(s => (
                    <option key={s.id} value={s.id}>{s.name} (@{s.username})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Route / Area Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Riyadh Central - Olaya - Exit 5"
                  value={assignForm.route}
                  onChange={(e) => setAssignForm({ ...assignForm, route: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                >
                  Assign & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OUT OF STOCK DIALOG */}
      {showOutOfStockDialog && outOfStockDialogData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-xl p-6 border border-amber-300/40 dark:border-amber-500/20 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/5">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Out of Stock Warning
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold">
                  Order ID: {outOfStockDialogData.orderId} · Stock validation failed
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[11px] text-slate-600 dark:text-gray-300 leading-relaxed">
                The following items have insufficient stock and cannot be fully fulfilled. Please choose how you want to resolve this:
              </p>

              {/* PARTIALLY AVAILABLE ITEMS — staff can adjust qty */}
              {outOfStockDialogData.partialItems.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Partially Available — Adjust Quantity</span>
                  <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/10 p-2.5 space-y-2">
                    {outOfStockDialogData.partialItems.map((item: any) => (
                      <div key={item.product_id} className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-slate-800 dark:text-gray-200 block truncate">{item.name}</span>
                          <span className="text-amber-600 dark:text-amber-400 font-mono">Ordered: {item.qty} · Available: {item.availableQty}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-500 dark:text-gray-400 text-[10px]">Approve:</span>
                          <input
                            type="number"
                            min={0}
                            max={item.availableQty}
                            value={adjustedQtys[item.product_id] ?? item.availableQty}
                            onChange={e => setAdjustedQtys(prev => ({ ...prev, [item.product_id]: Math.min(item.availableQty, Math.max(0, Number(e.target.value))) }))}
                            className="w-14 px-1.5 py-1 rounded border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-white/10 text-slate-900 dark:text-white text-center font-mono font-bold text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* FULLY OUT OF STOCK ITEMS */}
              {outOfStockDialogData.outOfStockItems.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Out of Stock Items</span>
                <div className="max-h-28 overflow-y-auto rounded-lg border border-red-200 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/10 p-2.5 space-y-1.5">
                  {outOfStockDialogData.outOfStockItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-gray-200">{item.name}</span>
                      <span className="font-mono text-red-600 dark:text-red-400 font-bold">Qty Ordered: {item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* AVAILABLE ITEMS */}
              {outOfStockDialogData.availableItems.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Available Items</span>
                  <div className="max-h-28 overflow-y-auto rounded-lg border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10 p-2.5 space-y-1.5">
                    {outOfStockDialogData.availableItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px]">
                        <span className="font-semibold text-slate-800 dark:text-gray-200">{item.name}</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">Qty Available: {item.qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg p-3 text-[11px] text-slate-600 dark:text-gray-400 space-y-1.5">
              {outOfStockDialogData.partialItems.length > 0 && <p><strong>Option 1: Adjust qty &amp; approve</strong> - Set the quantity to what's available for partial items, approve the order.</p>}
              <p><strong>{outOfStockDialogData.partialItems.length > 0 ? 'Option 2' : 'Option 1'}: Approve available items only</strong> - Removes out-of-stock items, recalculates totals, and approves available items.</p>
              <p><strong>{outOfStockDialogData.partialItems.length > 0 ? 'Option 3' : 'Option 2'}: Keep pending</strong> - Keeps the order in its current pending status.</p>
              <p><strong>{outOfStockDialogData.partialItems.length > 0 ? 'Option 4' : 'Option 3'}: Cancel order</strong> - Marks the order as failed/cancelled.</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-3 border-t border-slate-200 dark:border-white/5 text-xs">
              {/* ADJUST & APPROVE — shown only when partial items exist */}
              {outOfStockDialogData.partialItems.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      // Build the full items list: available items (unchanged) + partial items at adjusted qty
                      const allItemsForApproval = [
                        ...outOfStockDialogData.availableItems,
                        ...outOfStockDialogData.partialItems.map((item: any) => ({
                          ...item,
                          adjustedQty: adjustedQtys[item.product_id] ?? item.availableQty
                        }))
                      ];
                      const removedItems = outOfStockDialogData.outOfStockItems;
                      await (db as any).approveOrderWithAdjustedItems(
                        outOfStockDialogData.orderId,
                        allItemsForApproval,
                        removedItems,
                        currentUser
                      );
                      setShowOutOfStockDialog(false);
                      setOutOfStockDialogData(null);
                      setAdjustedQtys({});
                      await reloadOrdersAndStock();
                    } catch (err: any) {
                      alert(err.message || "Failed to approve with adjusted quantities.");
                    }
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition"
                >
                  Adjust Qty &amp; Approve
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowOutOfStockDialog(false);
                  setOutOfStockDialogData(null);
                  setAdjustedQtys({});
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition"
              >
                Keep Pending
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (confirm("Are you sure you want to cancel this order?")) {
                    try {
                      await db.updateOrderStatus(outOfStockDialogData.orderId, 'failed', currentUser, { cancelReason: "Cancelled due to out of stock items" });
                      setShowOutOfStockDialog(false);
                      setOutOfStockDialogData(null);
                      await reloadOrdersAndStock();
                    } catch (err: any) {
                      alert(err.message || "Failed to cancel order.");
                    }
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition"
              >
                Cancel Order
              </button>
              {outOfStockDialogData.availableItems.length > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await db.approveOrderAvailableItems(
                        outOfStockDialogData.orderId,
                        outOfStockDialogData.availableItems,
                        outOfStockDialogData.outOfStockItems,
                        currentUser
                      );
                      setShowOutOfStockDialog(false);
                      setOutOfStockDialogData(null);
                      await reloadOrdersAndStock();
                    } catch (err: any) {
                      alert(err.message || "Failed to approve available items.");
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition"
                >
                  Approve Available Remaining
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANCEL ORDER MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-red-200 dark:border-red-500/20 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/5">
              <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <X className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cancel Order</h3>
                <p className="text-[10px] text-slate-400 dark:text-gray-500">Order {cancelOrderId} · Stock will be restored</p>
              </div>
            </div>

            <form onSubmit={e => { e.preventDefault(); cancelOrder(); }} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Cancellation Reason <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {["Customer requested", "Out of stock", "Duplicate order", "Pricing error", "Payment issue", "Other"].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCancelReason(r)}
                      className={`px-2 py-1.5 rounded-lg text-left border transition text-[11px] ${cancelReason === r ? 'bg-red-100 dark:bg-red-950/40 border-red-400 dark:border-red-500 text-red-700 dark:text-red-300 font-bold' : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-white/20'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="Add more detail (optional)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 rounded-lg p-3 text-[11px] text-amber-700 dark:text-amber-400">
                ⚠ This will mark the order as <strong>Cancelled</strong> and automatically restore any reserved stock back to inventory.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => { setShowCancelModal(false); setCancelReason(""); }}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition text-xs"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition text-xs"
                >
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. RECORD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-white/5">
              Record Operating Expense
            </h3>
            <form onSubmit={handleExpenseSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1">Expense Amount (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: parseFloat(e.target.value) || 0 })}
                    className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1">Category</label>
                  <select
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Utilities">Utilities</option>
                    <option value="Rent">Rent</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Fuel/Transport">Fuel/Transport</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Expense Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Warehouse electricity invoice, Fuel fill van #2"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                >
                  Record Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. RECEIVE PAYMENT MODAL */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider pb-3 border-b border-slate-200 dark:border-white/5">
              Receive B2B Client Outstanding Payment
            </h3>
            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Select Customer</label>
                <select
                  value={paymentForm.customerId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customerId: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                >
                  <option value="">-- Select B2B Account --</option>
                  {usersList.filter(u => u.role === 'customer').map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Owed: {formatSAR(c.outstanding_balance || 0)})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1">Amount Paid (SAR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                    className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1">Receipt/Payment Ref</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bank Transfer Ref, Cash Receipt #"
                    value={paymentForm.ref}
                    onChange={(e) => setPaymentForm({ ...paymentForm, ref: e.target.value })}
                    className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Internal Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Deposited in Al-Rajhi Bank main account"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WAREHOUSE CREATE/EDIT MODAL */}
      {showWarehouseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-xl p-6 border border-slate-200 dark:border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/5">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{editingWarehouseId ? 'Edit Warehouse' : 'New Warehouse'}</h3>
                <p className="text-[10px] text-slate-400 dark:text-gray-500">Define a physical storage location</p>
              </div>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              if (!warehouseForm.name.trim()) return;
              if (editingWarehouseId) {
                await db.updateWarehouse(editingWarehouseId, { name: warehouseForm.name, location: warehouseForm.location }, currentUser);
              } else {
                await db.createWarehouse(warehouseForm.name, warehouseForm.location, currentUser);
              }
              setShowWarehouseModal(false);
              await reloadData();
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Warehouse Name <span className="text-red-500">*</span></label>
                <input type="text" value={warehouseForm.name} onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})} placeholder="e.g. Main Warehouse, Branch Riyadh" className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white" autoFocus />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Location / Address</label>
                <input type="text" value={warehouseForm.location} onChange={e => setWarehouseForm({...warehouseForm, location: e.target.value})} placeholder="e.g. Industrial Area, Block 5" className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                <button type="button" onClick={() => setShowWarehouseModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition text-xs">Cancel</button>
                <button
                  type="submit"
                  disabled={!warehouseForm.name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-lg transition text-xs"
                >
                  {editingWarehouseId ? 'Save Changes' : 'Create Warehouse'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOCK TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-xl p-6 border border-amber-200 dark:border-amber-500/20 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/5">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <RefreshCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Transfer Stock</h3>
                <p className="text-[10px] text-slate-400 dark:text-gray-500">Move stock between warehouses</p>
              </div>
            </div>
            <form onSubmit={async e => {
              e.preventDefault();
              try {
                await db.transferStock(transferForm.productId, transferForm.fromWarehouseId, transferForm.toWarehouseId, transferForm.qty, currentUser);
                setShowTransferModal(false);
                await reloadData();
              } catch(err: any) { alert(err.message); }
            }} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Product</label>
                <select value={transferForm.productId} onChange={e => setTransferForm({...transferForm, productId: e.target.value})} className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white">
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Total: {p.stock_qty} {p.unit})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">From Warehouse</label>
                  <select value={transferForm.fromWarehouseId} onChange={e => { const newFrom = e.target.value; setTransferForm(prev => ({ ...prev, fromWarehouseId: newFrom, toWarehouseId: prev.toWarehouseId === newFrom ? (warehouses.find(w => w.id !== newFrom)?.id || "") : prev.toWarehouseId })); }} className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white">
                    {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">To Warehouse</label>
                  <select value={transferForm.toWarehouseId} onChange={e => setTransferForm({...transferForm, toWarehouseId: e.target.value})} className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white">
                    {warehouses.filter(wh => wh.id !== transferForm.fromWarehouseId).map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Quantity to Transfer</label>
                <input type="number" min="1" value={transferForm.qty} onChange={e => setTransferForm({...transferForm, qty: parseInt(e.target.value)||1})} className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white" />
                {(() => {
                  const src = warehouseStock.find(ws => ws.warehouse_id === transferForm.fromWarehouseId && ws.product_id === transferForm.productId);
                  const srcQty = src?.qty ?? 0;
                  const totalAcrossAll = warehouseStock.filter(ws => ws.product_id === transferForm.productId).reduce((s, ws) => s + ws.qty, 0);
                  const needsMultiple = transferForm.qty > srcQty && transferForm.qty <= totalAcrossAll;
                  const impossible = transferForm.qty > totalAcrossAll;
                  if (!src) return <p className="text-[10px] text-red-400 mt-1">No stock in source warehouse for this product</p>;
                  if (impossible) return <p className="text-[10px] text-red-400 mt-1">❌ Only {totalAcrossAll} available across all warehouses — not enough</p>;
                  if (needsMultiple) {
                    const others = warehouseStock.filter(ws => ws.product_id === transferForm.productId && ws.warehouse_id !== transferForm.fromWarehouseId && ws.qty > 0);
                    return (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[10px] text-amber-500">⚠️ Source only has {srcQty} — need to transfer from multiple warehouses:</p>
                        {others.map((ws: any) => (
                          <p key={ws.warehouse_id} className="text-[10px] text-slate-400 dark:text-gray-500 pl-2">📦 {ws.warehouse_name}: {ws.qty} available</p>
                        ))}
                        <p className="text-[10px] text-slate-400 dark:text-gray-500 pl-2">Total available: {totalAcrossAll}</p>
                      </div>
                    );
                  }
                  return <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">Available in source: {srcQty}</p>;
                })()}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition text-xs">Cancel</button>
                <button
                  type="submit"
                  disabled={!transferForm.productId || !transferForm.fromWarehouseId || !transferForm.toWarehouseId || transferForm.fromWarehouseId === transferForm.toWarehouseId || transferForm.qty < 1 || (() => { const src = warehouseStock.find(ws => ws.warehouse_id === transferForm.fromWarehouseId && ws.product_id === transferForm.productId); return !src || transferForm.qty > src.qty; })()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold rounded-lg transition text-xs"
                >
                  Transfer Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RETURN WAREHOUSE MODAL */}
      {returnWarehouseModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-xl p-6 border border-green-200 dark:border-green-500/20 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-white/5">
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-950/30 flex items-center justify-center text-green-600 dark:text-green-400">
                <ArchiveRestore className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Return to Warehouse</h3>
                <p className="text-[10px] text-slate-400 dark:text-gray-500">
                  {returnWarehouseModal.order.id} · {returnWarehouseModal.singleWarehouseMode ? 'Select warehouse to store all returned items' : 'Select return warehouse per item'}
                </p>
              </div>
            </div>
            <div className="space-y-3 text-xs">
              {returnWarehouseModal.singleWarehouseMode ? (
                // SINGLE WAREHOUSE MODE — order was out for delivery, pick one warehouse for everything
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400">
                    This order was out for delivery. All returned items will be stored in the warehouse you select below.
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {returnWarehouseModal.order.items.map((item: any) => (
                      <div key={item.product_id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8">
                        <p className="flex-1 font-semibold text-slate-700 dark:text-gray-200 truncate">{item.name}</p>
                        <span className="text-slate-400 dark:text-gray-500 text-[10px] shrink-0">×{item.qty}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8">
                    <p className="font-bold text-slate-800 dark:text-white flex-1">Store all items in:</p>
                    <select
                      value={returnSingleWarehouseId}
                      onChange={e => setReturnSingleWarehouseId(e.target.value)}
                      className="glass-input px-2 py-1.5 rounded text-[11px] font-semibold text-slate-800 dark:text-white shrink-0 max-w-[160px]"
                    >
                      <option value="">— Select warehouse —</option>
                      {warehouses.map(wh => (
                        <option key={wh.id} value={wh.id}>{wh.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                // PER-ITEM MODE — order never went out, select per product
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {returnWarehouseModal.order.items.map((item: any) => (
                    <div key={item.product_id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-white/3 border border-slate-200 dark:border-white/8">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400 dark:text-gray-500">×{item.qty} returning</p>
                      </div>
                      <select
                        value={returnItemWarehouses[item.product_id] || ''}
                        onChange={e => setReturnItemWarehouses(prev => ({ ...prev, [item.product_id]: e.target.value }))}
                        className="glass-input px-2 py-1.5 rounded text-[11px] font-semibold text-slate-800 dark:text-white shrink-0 max-w-[140px]"
                      >
                        {warehouses.map(wh => (
                          <option key={wh.id} value={wh.id}>{wh.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
                <button type="button" onClick={() => setReturnWarehouseModal(null)} className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition text-xs">Cancel</button>
                <button
                  type="button"
                  disabled={
                    returnWarehouseModal.singleWarehouseMode
                      ? !returnSingleWarehouseId
                      : returnWarehouseModal.order.items.some((i: any) => !returnItemWarehouses[i.product_id])
                  }
                  onClick={confirmReturnWithWarehouse}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold rounded-lg transition text-xs flex items-center gap-1.5"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" />
                  Confirm Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER SUCCESS MODAL */}
      {showOrderSuccess && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-8 border border-emerald-200 dark:border-emerald-500/20 shadow-2xl flex flex-col items-center gap-5 text-center">
            {/* Animated checkmark */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-500/60 flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1">Order Placed!</h3>
              {lastOrderId && (
                <p className="text-xs font-mono text-blue-600 dark:text-blue-400 mb-2">{lastOrderId}</p>
              )}
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {currentUser && ['admin', 'superowner', 'owner', 'manager', 'warehouse_manager'].includes(currentUser.role)
                  ? 'Order placed and automatically approved. Stock has been reserved.'
                  : 'Your order has been submitted successfully and is now pending approval.'}
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              <button
                onClick={() => { setShowOrderSuccess(false); setActiveTab("orders"); }}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-sm"
              >
                View in Order Pipeline →
              </button>
              <button
                onClick={() => { setShowOrderSuccess(false); setActiveTab("create-order"); }}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 font-semibold rounded-xl transition text-sm"
              >
                Place Another Order
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
