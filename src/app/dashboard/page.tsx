"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/auth";
import { supabase } from "@/services/supabaseClient";
import { db, User, Product, Order, StockLedgerEntry, CustomerLedgerEntry, Expense, AuditLog, Warehouse, WarehouseStock, logAction, StockReservation, PickList, Dispatch } from "@/services/db";
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

  // Selected warehouse for order creation
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');

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

  // Per-item warehouse selection: { [orderId]: { [productId]: warehouseId } }
  const [itemWarehouseSelections, setItemWarehouseSelections] = React.useState<Record<string, Record<string, string>>>({});
  // Per-item split qty for combined fulfillment: { [orderId]: { [productId]: { [warehouseId]: qty } } }
  const [combinedSplitQty, setCombinedSplitQty] = React.useState<Record<string, Record<string, Record<string, number>>>>({});

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

    const [prods, ords, stk, usrs, exps, logs, trash, whs, whStk, res, pls, dps] = await Promise.all([
      db.getProducts(), db.getOrders(), db.getStockLedger(), db.getUsers(),
      db.getExpenses(), db.getAuditLogs(user), db.getTrash(),
      db.getWarehouses(), db.getWarehouseStock(),
      db.getReservations(), db.getPickLists(), db.getDispatches()
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
    // Customers never get a warehouse pre-selected — they order against combined stock
    const loggedInUser = auth.getCurrentUser();
    if (!selectedWarehouseId && whs.length > 0 && loggedInUser?.role !== 'customer') {
      setSelectedWarehouseId(whs[0].id);
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
    const change = stockInTypes.includes(stockForm.type) ? absQty : -absQty;
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
      await reloadOrders();
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
  // Returns the available qty for a product: per-warehouse if a warehouse is selected, else total
  const getAvailableQty = (prodId: string): number => {
    const user = currentUser;
    // Customers always order against total combined stock across all warehouses.
    // Warehouse splitting is done by staff after approval — not at order time.
    if (!user || user.role === 'customer') {
      return Math.max(0, warehouseStock
        .filter(ws => ws.product_id === prodId)
        .reduce((sum, ws) => sum + ws.qty, 0));
    }
    // Staff/admin: respect selected warehouse if one is chosen
    if (selectedWarehouseId) {
      const wsRow = warehouseStock.find(ws => ws.warehouse_id === selectedWarehouseId && ws.product_id === prodId);
      return Math.max(0, wsRow ? wsRow.qty : 0);
    }
    // No warehouse selected — sum all warehouses
    return Math.max(0, warehouseStock
      .filter(ws => ws.product_id === prodId)
      .reduce((sum, ws) => sum + ws.qty, 0));
  };

  const addToCart = (prodId: string) => {
    const maxQty = getAvailableQty(prodId);
    const existing = cart.find(c => c.product_id === prodId);
    if (existing) {
      if (existing.qty + 1 > maxQty) {
        alert(`Cannot add more. Only ${maxQty} units available${selectedWarehouseId ? ' in the selected warehouse' : ''}.`);
        return;
      }
      setCart(cart.map(c => c.product_id === prodId ? { ...c, qty: c.qty + 1 } : c));
    } else {
      if (maxQty <= 0) {
        alert(`No stock available${selectedWarehouseId ? ' in the selected warehouse' : ''}.`);
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
      alert(`Exceeds available inventory${selectedWarehouseId ? ' in the selected warehouse' : ''} (${maxQty} units).`);
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

    // Compute totals optimistically
    const customer = usersList.find(u => u.id === customerId);
    const customerDiscount = customer?.customer_discount || 0;
    const items = cart.map(c => {
      const p = products.find(pr => pr.id === c.product_id)!;
      const unitPrice = (customer?.custom_pricing?.[c.product_id]) ?? p?.selling_price ?? 0;
      const discountedPrice = unitPrice * (1 - customerDiscount / 100);
      return {
        product_id: c.product_id,
        name: p?.name || c.product_id,
        qty: c.qty,
        unit_price: discountedPrice,
        total: discountedPrice * c.qty,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const discountAmt = subtotal * (manualDiscountPct / 100) + manualDiscountAmt;
    const total = Math.max(0, subtotal - discountAmt);
    const tempOrderId = `ord-${Date.now()}`;
    const tempOrder: Order = {
      id: tempOrderId,
      customer_id: customerId,
      customer_name: customer?.name || customerId,
      created_by_id: currentUser!.id,
      created_by_name: currentUser!.name,
      created_at: new Date().toISOString(),
      type: selectedOrderType,
      status: 'created',
      items,
      subtotal,
      discount: discountAmt,
      manual_discount_pct: manualDiscountPct,
      manual_discount_amt: manualDiscountAmt,
      total,
      cod_tracking: isCodOrder,
      warehouse_id: selectedWarehouseId || undefined,
      status_history: [{ status: 'created', updated_at: new Date().toISOString(), updated_by_name: currentUser!.name }],
    };

    // Optimistic: reserve stock and add order immediately
    const tempResList: StockReservation[] = cart.map(c => ({
      id: `res-temp-${Date.now()}-${c.product_id}`,
      order_id: tempOrderId,
      product_id: c.product_id,
      warehouse_id: selectedWarehouseId || 'wh-main',
      qty: c.qty,
      status: 'active',
      created_at: new Date().toISOString()
    }));
    setStockReservations(prev => [...tempResList, ...prev]);
    setOrders(prev => [tempOrder, ...prev]);
    setCart([]);
    setSelectedCustomerId("");
    setManualDiscountPct(0);
    setManualDiscountAmt(0);
    setLastOrderId(tempOrderId);
    setShowOrderSuccess(true);

    try {
      const orderWarehouseId = currentUser!.role === 'customer' ? undefined : (selectedWarehouseId || undefined);
      const newOrder = await db.createOrder(customerId, cart.slice(), selectedOrderType, isCodOrder, currentUser!, manualDiscountPct, manualDiscountAmt, orderWarehouseId);
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
      for (const item of order.items) {
        // SINGLE-WAREHOUSE MODE: order came back from delivery — user chose one warehouse for all items
        if (isSingleMode && chosenWarehouseId) {
          await db.addStockAdjustment(
            item.product_id,
            item.qty,
            'customer_return',
            `Return - Cancelled Order ${order.id} (returned from delivery)`,
            currentUser!,
            chosenWarehouseId
          );
          continue;
        }
        const splitWh = (item as any).split_warehouses as { warehouse_id: string; warehouse_name: string; qty: number }[] | undefined;
        if (splitWh && splitWh.length > 1) {
          // Split order — return each portion to its original warehouse
          for (const portion of splitWh) {
            if (portion.qty <= 0) continue;
            await db.addStockAdjustment(
              item.product_id,
              portion.qty,
              'customer_return',
              `Return - Cancelled Order ${order.id} (${portion.warehouse_name})`,
              currentUser!,
              portion.warehouse_id
            );
          }
        } else {
          const manualWhId = returnItemWarehouses[item.product_id] || (item as any).warehouse_id || undefined;
          if (manualWhId) {
            // Single warehouse explicitly known — return directly
            await db.addStockAdjustment(item.product_id, item.qty, 'customer_return', `Return - Cancelled Order ${order.id}`, currentUser!, manualWhId);
          } else {
          // Auto-split order: look up the dispatch ledger entries to return stock
          // to the exact same warehouses it was taken from
          const ledger = await db.getStockLedger();
          const dispatchEntries = ledger.filter(e =>
            e.product_id === item.product_id &&
            e.type === 'dispatch' &&
            e.notes?.includes(order.id) &&
            e.warehouse_id
          );
          if (dispatchEntries.length > 0) {
            for (const entry of dispatchEntries) {
              await db.addStockAdjustment(
                item.product_id,
                Math.abs(entry.qty_change),
                'customer_return',
                `Return - Cancelled Order ${order.id} (auto-split reversal)`,
                currentUser!,
                entry.warehouse_id
              );
            }
          } else {
            // Fallback: no ledger trace found, return without warehouse (whole-stock adjust)
            await db.addStockAdjustment(item.product_id, item.qty, 'customer_return', `Return - Cancelled Order ${order.id}`, currentUser!);
            }
          }
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
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'customer'].includes(currentUser.role) && (
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
          {['admin', 'superowner', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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

          {/* Cancelled Orders Returns */}
          {['admin', 'superowner', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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
              {orders.filter(o => o.status === 'failed' && !o.status_history?.some((h: any) => h.updated_by_name?.startsWith('STOCK_RESTORED:'))).length > 0 && (
                <span className="ml-auto w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
              )}
            </button>
          )}

          {/* Accounting Expense/Ledger */}
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
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
          {['admin', 'superowner', 'owner', 'manager'].includes(currentUser.role) && (
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
          {['admin', 'owner', 'manager'].includes(currentUser.role) && (
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
          {['admin', 'superowner', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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
              {['admin', 'superowner', 'owner', 'manager'].includes(currentUser.role) && (
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
                            {['admin', 'owner', 'manager', 'staff'].includes(currentUser?.role) && (
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
                  
                  {['admin', 'owner', 'manager'].includes(currentUser.role) && (
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
                      {['admin', 'superowner', 'owner', 'manager', 'accountant'].includes(currentUser?.role) && <th className="p-4">Purchase Cost</th>}
                      <th className="p-4">Selling Price</th>
                      {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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
                            {/* Warehouse breakdown — admin/owner/manager only, show all warehouses */}
                            {['admin', 'superowner', 'owner', 'manager'].includes(currentUser.role) && warehouses.length > 1 && (() => {
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
                          {['admin', 'superowner', 'owner', 'manager', 'accountant'].includes(currentUser?.role) && (
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
                          {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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
                  {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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

          {/* TAB 4: ORDERS */}
          {activeTab === "orders" && (() => {
            const ORDER_STATUS_RANK: Record<string, number> = {
              created: 0, approved: 1, packing: 2, assigned: 3, out_for_delivery: 4, delivered: 5, failed: 6
            };

            const filteredAndSortedOrders = orders
              .filter(o => {
                if (currentUser?.role === 'customer' && o.customer_id !== currentUser?.id) return false;
                // Delivery staff only see orders assigned to them
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

            return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Orders & Delivery System</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Order dispatch control. Approve sales, assign delivery drivers (staff), and tracking status in real time.</p>
                </div>
                <div className="flex gap-2 shrink-0">
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
                        // Refresh stock immediately so customer sees live counts
                        reloadTabData("create-order").catch(() => {});
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Order Form
                    </button>
                  )}
                  <button
                    onClick={() => exportToCSV(filteredAndSortedOrders, "sales_orders_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel Orders
                  </button>
                </div>
              </div>

              {/* ORDER FILTERS */}
              <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-white dark:bg-white/3 border border-slate-200 dark:border-white/5">
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Status</label>
                  <select value={orderFilterStatus} onChange={e => setOrderFilterStatus(e.target.value)} className="glass-input px-2.5 py-1.5 rounded-lg text-xs">
                    <option value="">All Statuses</option>
                    <option value="created">Created (Pending)</option>
                    <option value="approved">Approved</option>
                    <option value="packing">Packing</option>
                    <option value="assigned">Assigned</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Cancelled / Failed</option>
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
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 italic">Sorted: active first</span>
                </div>
              </div>

              {/* ORDERS LIST */}
              <div className="space-y-4">
                {filteredAndSortedOrders.length === 0 ? (
                  <div className="glass-panel rounded-xl p-8 text-center text-slate-400 dark:text-gray-500 border border-slate-200 dark:border-white/5">No orders match the selected filters</div>
                ) : filteredAndSortedOrders.map(order => {
                  const currentStatus = order.status;
                  const isThisOrderLoading = orderLoadingId === order.id;

                  // Per-item warehouse analysis
                  const fulfillmentInfo = (() => {
                    if (warehouses.length === 0) return null;
                    // Order-level warehouse fallback (set at cart time or auto-resolved)
                    const orderWarehouseId = (order as any).warehouse_id;
                    const orderWarehouseName = (order as any).warehouse_name;
                    const currentSelections = itemWarehouseSelections[order.id] || {};
                    const currentSplits = combinedSplitQty[order.id] || {};

                    // itemChecks: for every item, list warehouses with enough stock and those with partial
                    const itemChecks = order.items.map((item: any) => {
                      // Since stock is physically deducted from warehouse_stock at order approval,
                      // the qty in warehouse_stock is already the TRUE available qty.
                      // We must NOT subtract reservations again — that would double-count.
                      // Only subtract reservations from OTHER orders that haven't been approved yet
                      // (status === 'created') since their stock hasn't been deducted yet.
                      const stockRows = warehouseStock.filter((ws: any) => ws.product_id === item.product_id).map((ws: any) => {
                        const reservedByCreatedOrders = stockReservations
                          .filter((r: any) =>
                            r.product_id === item.product_id &&
                            r.warehouse_id === ws.warehouse_id &&
                            r.status === 'active' &&
                            r.order_id !== order.id
                          )
                          .reduce((sum: number, r: any) => {
                            // Only subtract if the related order is still 'created' (not yet approved/deducted)
                            const relatedOrder = orders.find((o: any) => o.id === r.order_id);
                            return relatedOrder?.status === 'created' ? sum + r.qty : sum;
                          }, 0);
                        return { ...ws, qty: Math.max(0, ws.qty - reservedByCreatedOrders) };
                      });
                      const sufficient = stockRows.filter((ws: any) => ws.qty >= item.qty);
                      const partial = stockRows.filter((ws: any) => ws.qty > 0 && ws.qty < item.qty);
                      const totalQty = stockRows.reduce((s: number, ws: any) => s + ws.qty, 0);
                      // Combined: no single warehouse has enough but together they do
                      const combinedSufficient = sufficient.length === 0 && totalQty >= item.qty;

                      // For approved/in-progress orders: stock was already physically deducted at approval.
                      // Use the active reservations for THIS order to show what was actually allocated.
                      const isApproved = ['approved','packing','assigned','out_for_delivery'].includes(order.status);
                      const thisOrderReservations = stockReservations.filter((r: any) =>
                        r.order_id === order.id &&
                        r.product_id === item.product_id &&
                        r.status === 'active'
                      );
                      const reservedWh = thisOrderReservations.length > 0
                        ? thisOrderReservations.map((r: any) => ({
                            warehouse_id: r.warehouse_id,
                            warehouse_name: warehouses.find((w: any) => w.id === r.warehouse_id)?.name || r.warehouse_id,
                            qty: r.qty
                          }))
                        : null;

                      // Saved warehouse: item-level first, then fall back to order-level
                      const whId = item.warehouse_id || orderWarehouseId;
                      const whName = item.warehouse_name || orderWarehouseName;
                      const savedWh = whId ? { id: whId, name: whName } : null;
                      // Check if combined split is confirmed by user (all partial warehouses have qty assigned that sum to item.qty)
                      const splitMap = currentSplits[item.product_id] || {};
                      const splitTotal = Object.values(splitMap).reduce((s: number, q: any) => s + (q || 0), 0);
                      const splitConfirmed = combinedSufficient && splitTotal === item.qty && Object.keys(splitMap).length > 0;
                      return { product_id: item.product_id, name: item.name, qty: item.qty, sufficient, partial, savedWh, totalQty, combinedSufficient, splitMap, splitTotal, splitConfirmed, reservedWh, isApproved };
                    });

                    // Items that still need a decision (multiple choices OR combined-split not yet confirmed)
                    const pendingChoices = itemChecks.filter((ic: any) => {
                      const sel = currentSelections[ic.product_id];
                      if (ic.savedWh) return false; // already saved in DB
                      if (ic.sufficient.length === 1) return false; // auto-resolved
                      if (ic.sufficient.length > 1 && !sel) return true; // multiple warehouses, not chosen
                      if (ic.combinedSufficient && !ic.splitConfirmed) return true; // split needed
                      return false;
                    });

                    // Items already decided (saved on item) or with only one option
                    const resolved = itemChecks.map((ic: any) => {
                      const sel = currentSelections[ic.product_id];
                      if (sel) return { ...ic, chosenId: sel };
                      if (ic.savedWh) return { ...ic, chosenId: ic.savedWh.id };
                      if (ic.sufficient.length === 1) return { ...ic, chosenId: ic.sufficient[0].warehouse_id };
                      // Combined & split confirmed: treat as resolved with combined marker
                      if (ic.combinedSufficient && ic.splitConfirmed) return { ...ic, chosenId: 'combined' };
                      return { ...ic, chosenId: null };
                    });

                    // Group resolved items by warehouse for the driver summary
                    const byWarehouse: Record<string, { name: string; items: { itemName: string; qty: number }[] }> = {};
                    for (const r of resolved) {
                      if (!r.chosenId) continue;
                      if (r.chosenId === 'combined') {
                        // Use the user-confirmed split quantities
                        const splitMap = currentSplits[r.product_id] || {};
                        const stockRows = warehouseStock.filter((ws: any) => ws.product_id === r.product_id && ws.qty > 0);
                        for (const ws of stockRows) {
                          const qtyFromHere = splitMap[ws.warehouse_id] || 0;
                          if (qtyFromHere <= 0) continue;
                          if (!byWarehouse[ws.warehouse_id]) byWarehouse[ws.warehouse_id] = { name: ws.warehouse_name, items: [] };
                          byWarehouse[ws.warehouse_id].items.push({ itemName: r.name, qty: qtyFromHere });
                        }
                        continue;
                      }
                      const whRow = warehouseStock.find((ws: any) => ws.warehouse_id === r.chosenId && ws.product_id === r.product_id);
                      const whName = whRow?.warehouse_name || warehouses.find((w: any) => w.id === r.chosenId)?.name || r.chosenId;
                      if (!byWarehouse[r.chosenId]) byWarehouse[r.chosenId] = { name: whName, items: [] };
                      byWarehouse[r.chosenId].items.push({ itemName: r.name, qty: r.qty });
                    }
                    const allResolved = resolved.every((r: any) => !!r.chosenId);
                    return { itemChecks, pendingChoices, resolved, byWarehouse, allResolved, currentSelections, currentSplits };
                  })();

                  return (
                    <div key={order.id} className={`glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in${isThisOrderLoading ? ' opacity-60 pointer-events-none' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{order.id}</span>
                          <span className="text-slate-400 dark:text-gray-600">&bull;</span>
                          <span className="text-xs text-slate-500 dark:text-gray-400">{new Date(order.created_at).toLocaleString()}</span>
                          <span className="text-slate-400 dark:text-gray-600">&bull;</span>
                          <span className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider text-[10px]">{order.type}</span>
                          {order.warehouse_name && (
                            <>
                              <span className="text-slate-400 dark:text-gray-600">&bull;</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">📦 {order.warehouse_name}</span>
                            </>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{order.customer_name}</h3>
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {order.items.map((item: any, idx: number) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-700 dark:text-gray-300">
                              {item.name} x {item.qty}
                            </span>
                          ))}
                        </div>

                        {/* Warehouse fulfillment panel — staff / manager / owner / admin / delivery — only for active orders */}
                        {fulfillmentInfo && !['delivered','failed'].includes(currentStatus) && ['admin','superowner','owner','manager','staff','delivery'].includes(currentUser.role) && (() => {
                          const { itemChecks, pendingChoices, byWarehouse, allResolved, currentSelections, currentSplits } = fulfillmentInfo;
                          const hasPending = pendingChoices.length > 0;

                          return (
                            <div className="mt-3 rounded-lg border border-slate-200 dark:border-white/8 overflow-hidden text-[11px]">
                              {/* Header */}
                              <div className={`px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider border-b ${hasPending ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-slate-50 dark:bg-white/3 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-white/8'}`}>
                                {hasPending ? '🏢 Select warehouse per item' : '📦 Pickup plan'}
                              </div>

                              <div className="bg-white dark:bg-white/2 px-3 py-2 space-y-1.5">

                                {/* Per-item rows */}
                                {itemChecks.map((ic: any) => {
                                  const savedSel = currentSelections[ic.product_id];
                                  const alreadySaved = ic.savedWh;

                                  // For approved orders, show the reservation allocation instead of re-checking live stock
                                  if (ic.isApproved && ic.reservedWh && ic.reservedWh.length > 0) {
                                    return (
                                      <div key={ic.product_id} className="flex flex-wrap items-center gap-2 py-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                                        <span className="text-slate-700 dark:text-gray-200 font-semibold min-w-[120px]">
                                          {ic.name} <span className="text-slate-400 dark:text-gray-500 font-normal">×{ic.qty}</span>
                                        </span>
                                        {ic.reservedWh.length === 1 ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-bold">
                                            📦 {ic.reservedWh[0].warehouse_name}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/20 font-bold">
                                            🔀 {ic.reservedWh.map((r: any) => `${r.warehouse_name} ×${r.qty}`).join(' + ')}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  }

                                  const chosenId = savedSel || (alreadySaved ? alreadySaved.id : null) || (ic.sufficient.length === 1 ? ic.sufficient[0].warehouse_id : null);
                                  const chosenName = chosenId && chosenId !== 'combined'
                                    ? (warehouseStock.find((ws: any) => ws.warehouse_id === chosenId && ws.product_id === ic.product_id)?.warehouse_name
                                       || warehouses.find((w: any) => w.id === chosenId)?.name
                                       || chosenId)
                                    : null;
                                  const needsChoice = ic.sufficient.length > 1 && !chosenId;
                                  const noStock = ic.sufficient.length === 0 && !ic.combinedSufficient;
                                  // Combined split: stock is spread across warehouses, need user to specify per-warehouse qty
                                  const needsSplitInput = ic.combinedSufficient && !ic.splitConfirmed && !alreadySaved;
                                  const splitMap = currentSplits[ic.product_id] || {};
                                  const isCombined = ic.combinedSufficient && ic.sufficient.length === 0;

                                  return (
                                    <div key={ic.product_id} className={`flex flex-wrap items-center gap-2 py-1 border-b border-slate-100 dark:border-white/5 last:border-0`}>
                                      {/* Item name + qty */}
                                      <span className="text-slate-700 dark:text-gray-200 font-semibold min-w-[120px]">
                                        {ic.name} <span className="text-slate-400 dark:text-gray-500 font-normal">×{ic.qty}</span>
                                      </span>

                                      {/* No stock anywhere */}
                                      {noStock && (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 font-bold">
                                          ❌ Out of stock
                                        </span>
                                      )}

                                      {/* Combined stock: user must enter how many to take from each warehouse */}
                                      {needsSplitInput && (
                                        <div className="w-full space-y-1.5 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/20">
                                          <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
                                            🔀 Stock is split — specify how many units to take from each warehouse (total needed: {ic.qty})
                                          </p>
                                          {ic.partial.map((ws: any) => (
                                            <div key={ws.warehouse_id} className="flex items-center gap-2">
                                              <span className="text-[10px] text-slate-700 dark:text-gray-300 min-w-[110px]">{ws.warehouse_name} <span className="text-slate-400">({ws.qty} avail)</span></span>
                                              <input
                                                type="number"
                                                min={0}
                                                max={Math.min(ws.qty, ic.qty)}
                                                value={splitMap[ws.warehouse_id] ?? ''}
                                                placeholder="0"
                                                onChange={(e) => {
                                                  const val = Math.min(ws.qty, Math.max(0, parseInt(e.target.value) || 0));
                                                  setCombinedSplitQty(prev => ({
                                                    ...prev,
                                                    [order.id]: {
                                                      ...(prev[order.id] || {}),
                                                      [ic.product_id]: { ...(prev[order.id]?.[ic.product_id] || {}), [ws.warehouse_id]: val }
                                                    }
                                                  }));
                                                }}
                                                className="w-16 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-500/50 bg-white dark:bg-blue-950/20 text-xs text-center text-slate-800 dark:text-white"
                                              />
                                            </div>
                                          ))}
                                          {ic.splitTotal > 0 && (
                                            <p className={`text-[10px] font-bold ${ic.splitTotal === ic.qty ? 'text-emerald-600 dark:text-emerald-400' : ic.splitTotal > ic.qty ? 'text-red-500' : 'text-amber-500'}`}>
                                              {ic.splitTotal === ic.qty ? `✓ Total confirmed: ${ic.splitTotal}` : `Total entered: ${ic.splitTotal} / ${ic.qty} needed`}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* Combined split confirmed */}
                                      {ic.combinedSufficient && ic.splitConfirmed && !alreadySaved && (
                                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-bold">
                                          🔀 Split confirmed
                                          <button
                                            className="ml-1 text-emerald-400 hover:text-emerald-600 cursor-pointer"
                                            onClick={() => setCombinedSplitQty(prev => {
                                              const n = { ...prev, [order.id]: { ...(prev[order.id] || {}) } };
                                              delete n[order.id][ic.product_id];
                                              return n;
                                            })}
                                            title="Edit split"
                                          >✏️</button>
                                        </span>
                                      )}

                                      {/* Only partial stock (no warehouse has enough, not enough combined either) */}
                                      {!noStock && !isCombined && ic.sufficient.length === 0 && ic.partial.length > 0 && (
                                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                          ⚠ Partial only: {ic.partial.map((ws: any) => `${ws.warehouse_name} (${ws.qty})`).join(', ')} — need {ic.qty}, have {ic.totalQty}
                                        </span>
                                      )}

                                      {/* Already chosen / single option */}
                                      {chosenId && !needsChoice && (
                                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-bold">
                                          📦 {chosenName}
                                          {ic.sufficient.length > 1 && (
                                            <button
                                              className="ml-1 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-200 cursor-pointer"
                                              onClick={() => setItemWarehouseSelections(prev => {
                                                const next = { ...prev, [order.id]: { ...(prev[order.id] || {}) } };
                                                delete next[order.id][ic.product_id];
                                                return next;
                                              })}
                                              title="Change warehouse"
                                            >✏️</button>
                                          )}
                                        </span>
                                      )}

                                      {/* Multiple choices available — show picker buttons */}
                                      {needsChoice && (
                                        <div className="flex flex-wrap gap-1">
                                          {ic.sufficient.map((ws: any) => (
                                            <button
                                              key={ws.warehouse_id}
                                              onClick={() => setItemWarehouseSelections(prev => ({
                                                ...prev,
                                                [order.id]: { ...(prev[order.id] || {}), [ic.product_id]: ws.warehouse_id }
                                              }))}
                                              className="px-2 py-0.5 rounded border-2 border-indigo-300 dark:border-indigo-500/50 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer transition"
                                            >
                                              📦 {ws.warehouse_name} <span className="text-indigo-400 dark:text-indigo-500 font-normal">({ws.qty} in stock)</span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {/* Save button — shown when all items are resolved and there are new UI selections or confirmed splits */}
                                {allResolved && !hasPending && (Object.keys(currentSelections).length > 0 || Object.keys(currentSplits).length > 0) && (
                                  <button
                                    disabled={isThisOrderLoading}
                                    onClick={() => withOrderLock(order.id, async () => {
                                      const selections: Record<string, { warehouseId: string; warehouseName: string; splitWarehouses?: { warehouse_id: string; warehouse_name: string; qty: number }[] }> = {};
                                      // Standard single-warehouse selections
                                      for (const [pid, whId] of Object.entries(currentSelections)) {
                                        const whRow = warehouseStock.find((ws: any) => ws.warehouse_id === whId && ws.product_id === pid);
                                        const whName = whRow?.warehouse_name || warehouses.find((w: any) => w.id === whId)?.name || whId as string;
                                        selections[pid] = { warehouseId: whId as string, warehouseName: whName };
                                      }
                                      // Combined split — save ALL warehouse portions so dispatch deducts from each correctly
                                      for (const [pid, splitMap] of Object.entries(currentSplits)) {
                                        const portions = Object.entries(splitMap as Record<string, number>)
                                          .filter(([, q]) => (q || 0) > 0)
                                          .map(([whId, qty]) => {
                                            const whRow = warehouseStock.find((ws: any) => ws.warehouse_id === whId && ws.product_id === pid);
                                            const whName = whRow?.warehouse_name || warehouses.find((w: any) => w.id === whId)?.name || whId;
                                            return { warehouse_id: whId, warehouse_name: whName, qty: qty as number };
                                          })
                                          .sort((a, b) => b.qty - a.qty);
                                        const primaryWh = portions[0];
                                        if (primaryWh) {
                                          selections[pid] = {
                                            warehouseId: primaryWh.warehouse_id,
                                            warehouseName: portions.length > 1
                                              ? `Split: ${portions.map(p => `${p.warehouse_name} ×${p.qty}`).join(' + ')}`
                                              : primaryWh.warehouse_name,
                                            splitWarehouses: portions.length > 1 ? portions : undefined
                                          };
                                        }
                                      }
                                      await db.saveOrderItemWarehouses(order.id, selections, currentUser);
                                      setItemWarehouseSelections(prev => { const n = {...prev}; delete n[order.id]; return n; });
                                      setCombinedSplitQty(prev => { const n = {...prev}; delete n[order.id]; return n; });
                                      await reloadOrdersAndStock();
                                    })}
                                    className="mt-1 w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                                  >
                                    ✓ Save warehouse assignments
                                  </button>
                                )}

                                {/* Driver pickup summary — grouped by warehouse */}
                                {allResolved && Object.keys(byWarehouse).length > 0 && Object.keys(currentSelections).length === 0 && Object.keys(currentSplits).length === 0 && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 space-y-1">
                                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">Driver pickup plan</p>
                                    {Object.entries(byWarehouse).map(([whId, whData]: [string, any]) => (
                                      <div key={whId} className="flex items-start gap-2">
                                        <span className="shrink-0 mt-0.5 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-bold text-[10px] whitespace-nowrap">
                                          📦 {whData.name}
                                        </span>
                                        <span className="text-slate-600 dark:text-gray-300 text-[10px]">
                                          {whData.items.map((it: any) => `${it.itemName} ×${it.qty}`).join(' · ')}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                              </div>
                            </div>
                          );
                        })()}

                        {/* Pick List Panel */}
                        {currentStatus === 'packing' && (() => {
                          const matchingPl = pickLists.find(pl => pl.order_id === order.id);
                          if (!matchingPl) {
                            return (
                              <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-500/20 overflow-hidden text-[11px]">
                                <div className="px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 flex flex-wrap gap-2 justify-between items-center">
                                  <span>⚠️ No Pick List generated for this order.</span>
                                  <button
                                    onClick={async () => {
                                      const pickItems = order.items.map((item: any) => ({
                                        product_id: item.product_id,
                                        name: item.name,
                                        qty: item.qty,
                                        warehouse_id: item.warehouse_id || order.warehouse_id || 'wh-main',
                                        warehouse_name: item.warehouse_name || order.warehouse_name || 'Main Warehouse',
                                        picked_qty: 0
                                      }));
                                      try {
                                        await db.createPickList(order.id, pickItems);
                                        await reloadData();
                                      } catch (err: any) {
                                        alert("Could not generate pick list: " + err.message);
                                      }
                                    }}
                                    className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold transition cursor-pointer"
                                  >
                                    Generate Pick List
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="mt-3 rounded-lg border border-purple-200 dark:border-purple-500/20 overflow-hidden text-[11px]">
                              <div className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-b border-purple-200 dark:border-purple-500/20 flex justify-between items-center">
                                <span>📋 Pick List ({matchingPl.id})</span>
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  matchingPl.status === 'completed' ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                                }`}>
                                  {matchingPl.status}
                                </span>
                              </div>
                              <div className="bg-white dark:bg-white/2 px-3 py-2 space-y-1.5">
                                {matchingPl.items.map(item => {
                                  const isItemPicked = item.picked_qty === item.qty;
                                  // Use composite key so the same product from two warehouses renders as two distinct rows
                                  const rowKey = `${item.product_id}__${item.warehouse_id}`;
                                  return (
                                    <div key={rowKey} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                                      <div className="flex flex-col">
                                        <span className="text-slate-800 dark:text-gray-200 font-semibold">{item.name} × {item.qty}</span>
                                        <span className="text-slate-400 dark:text-gray-500 text-[10px]">From: 📦 {item.warehouse_name}</span>
                                      </div>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isItemPicked}
                                          onChange={(e) => handlePickItemToggle(matchingPl.id, item.product_id, e.target.checked, item.warehouse_id)}
                                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-white/10 dark:bg-white/5 cursor-pointer"
                                        />
                                        <span className={`text-[10px] font-bold ${isItemPicked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`}>
                                          {isItemPicked ? 'Picked' : 'To Pick'}
                                        </span>
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Dispatch Panel */}
                        {['out_for_delivery', 'delivered'].includes(currentStatus) && (() => {
                          const matchingDp = dispatches.find(d => d.order_id === order.id);
                          if (!matchingDp) return null;
                          return (
                            <div className="mt-3 rounded-lg border border-teal-200 dark:border-teal-500/20 overflow-hidden text-[11px]">
                              <div className="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border-b border-teal-200 dark:border-teal-500/20">
                                🚚 Dispatch Details ({matchingDp.id})
                              </div>
                              <div className="bg-white dark:bg-white/2 px-3 py-2 space-y-1 text-slate-700 dark:text-gray-300">
                                <p><span className="font-semibold text-slate-400 dark:text-gray-500">Dispatched at:</span> {new Date(matchingDp.dispatched_at).toLocaleString()}</p>
                                <p><span className="font-semibold text-slate-400 dark:text-gray-500">Dispatched by:</span> {matchingDp.dispatched_by_name}</p>
                                {matchingDp.carrier_details && <p><span className="font-semibold text-slate-400 dark:text-gray-500">Carrier / Route:</span> {matchingDp.carrier_details}</p>}
                                {matchingDp.delivered_at && <p><span className="font-semibold text-slate-400 dark:text-gray-500">Delivered at:</span> {new Date(matchingDp.delivered_at).toLocaleString()}</p>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t border-slate-100 dark:border-white/5 pt-4 md:pt-0">
                        {order.delivery_route && (
                          <div className="text-left md:text-right">
                            <span className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-semibold">Route & Driver</span>
                            <p className="text-[10px] text-slate-900 dark:text-gray-300 font-bold">{order.delivery_route}</p>
                            <p className="text-[10px] text-blue-600 dark:text-blue-400">Driver: {order.assigned_staff_name || "Unassigned"}</p>
                          </div>
                        )}

                        <div className="text-left md:text-right">
                          <span className="text-[9px] text-slate-400 dark:text-gray-500 uppercase font-semibold">Total Amount</span>
                          {order.discount > 0 && (
                            <>
                              <p className="text-[10px] text-slate-400 dark:text-gray-500 line-through">{formatSAR(order.subtotal)}</p>
                              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">- {formatSAR(order.discount)} customer disc.</p>
                            </>
                          )}
                          {(order.manual_discount_pct > 0 || order.manual_discount_amt > 0) && (
                            <>
                              {order.manual_discount_pct > 0 && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">- {order.manual_discount_pct}% manual</p>
                              )}
                              {order.manual_discount_amt > 0 && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">- {formatSAR(order.manual_discount_amt)} manual</p>
                              )}
                            </>
                          )}
                          <p className="text-sm font-extrabold text-slate-900 dark:text-white">{formatSAR(order.total)}</p>
                          {order.cod_tracking && (
                            <span className="inline-block text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-1 py-0.2 rounded mt-0.5">
                              COD {order.cod_collected ? '(Collected)' : '(Pending)'}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2 shrink-0">
                          <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-bold items-center ${
                            currentStatus === 'created' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20' :
                            currentStatus === 'approved' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20' :
                            currentStatus === 'packing' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20' :
                            currentStatus === 'assigned' ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20' :
                            currentStatus === 'out_for_delivery' ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20' :
                            currentStatus === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' :
                            'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                          }`}>
                            {currentStatus === 'failed'
                              ? (order.status_history.find((h: any) => h.status === 'failed' && h.notes) ? 'Cancelled' : 'Failed')
                              : currentStatus}
                          </span>
                          {currentStatus === 'failed' && (() => {
                            const cancelEntry = order.status_history.find((h: any) => h.status === 'failed' && h.notes);
                            return cancelEntry ? (
                              <span className="text-[10px] text-red-500 dark:text-red-400 italic">Reason: {(cancelEntry as any).notes}</span>
                            ) : null;
                          })()}

                          {currentStatus === 'created' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (() => {
                            const hasPendingFulfillment = fulfillmentInfo ? fulfillmentInfo.pendingChoices.length > 0 : false;
                            return (
                              <button
                                disabled={isThisOrderLoading || hasPendingFulfillment}
                                title={hasPendingFulfillment ? 'Resolve warehouse assignments above before approving' : ''}
                                onClick={() => withOrderLock(order.id, async () => {
                                  // Auto-save warehouse for items that have exactly one sufficient warehouse but were never explicitly saved
                                  if (fulfillmentInfo) {
                                    const autoSelections: Record<string, { warehouseId: string; warehouseName: string }> = {};
                                    for (const ic of fulfillmentInfo.itemChecks) {
                                      if (!ic.savedWh && ic.sufficient.length === 1) {
                                        autoSelections[ic.product_id] = { warehouseId: ic.sufficient[0].warehouse_id, warehouseName: ic.sufficient[0].warehouse_name };
                                      }
                                    }
                                    if (Object.keys(autoSelections).length > 0) {
                                      await db.saveOrderItemWarehouses(order.id, autoSelections, currentUser);
                                    }
                                  }
                                  await db.updateOrderStatus(order.id, 'approved', currentUser);
                                  await reloadOrdersAndStock();
                                })}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                              >
                                {isThisOrderLoading ? '…' : hasPendingFulfillment ? '⚠ Assign Warehouses First' : 'Approve'}
                              </button>
                            );
                          })()}
                          {currentStatus === 'approved' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                            <button disabled={isThisOrderLoading} onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'packing', currentUser); await reloadOrders(); })} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer">{isThisOrderLoading ? '…' : 'Start Packing'}</button>
                          )}
                          {currentStatus === 'packing' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (() => {
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
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer"
                              >
                                {isThisOrderLoading ? '…' : !isPickListCompleted ? '⚠️ Complete Picking First' : 'Assign Driver'}
                              </button>
                            );
                          })()}
                          {currentStatus === 'assigned' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                            <button disabled={isThisOrderLoading} onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'out_for_delivery', currentUser); await reloadOrders(); })} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer">{isThisOrderLoading ? '…' : 'Dispatch Order'}</button>
                          )}
                          {currentStatus === 'out_for_delivery' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                            <div className="flex gap-1">
                              <button disabled={isThisOrderLoading} onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'delivered', currentUser, { codCollected: order.cod_tracking ? true : false }); await reloadOrders(); })} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer">{isThisOrderLoading ? '…' : 'Delivered'}</button>
                              <button disabled={isThisOrderLoading} onClick={() => withOrderLock(order.id, async () => { await db.updateOrderStatus(order.id, 'failed', currentUser); await reloadOrdersAndStock(); })} className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition cursor-pointer">{isThisOrderLoading ? '…' : 'Fail'}</button>
                            </div>
                          )}
                          {!['delivered', 'failed'].includes(currentStatus) && ['admin', 'owner', 'manager'].includes(currentUser.role) && (
                            <button disabled={isThisOrderLoading} onClick={() => { setCancelOrderId(order.id); setCancelReason(""); setShowCancelModal(true); }} className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950/30 hover:bg-red-200 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Cancel</button>
                          )}
                          {currentUser.role === 'admin' && (
                            <button disabled={isThisOrderLoading} onClick={() => withOrderLock(order.id, async () => { await db.deleteOrder(order.id, currentUser); await reloadOrders(); })} className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

              {/* ── Warehouse selector ── outside cart, full-width, staff/admin only */}
              {warehouses.length > 0 && currentUser.role !== 'customer' && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-500/25">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                    📦 Fulfillment Warehouse
                  </span>
                  {warehouses.length === 1 ? (
                    <span className="text-xs font-semibold text-slate-700 dark:text-gray-300">{warehouses[0].name}</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 flex-1">
                      {warehouses.map(wh => (
                        <button
                          key={wh.id}
                          onClick={() => {
                            if (wh.id === selectedWarehouseId) return;
                            if (cart.length > 0) {
                              if (confirm('Changing warehouse will clear your current cart. Continue?')) {
                                setCart([]);
                              } else return;
                            }
                            setSelectedWarehouseId(wh.id);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition border ${
                            selectedWarehouseId === wh.id
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow'
                              : 'bg-white dark:bg-indigo-950/40 text-slate-700 dark:text-gray-300 border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                          }`}
                        >
                          {wh.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedWarehouseId && (
                    <span className="text-[10px] text-indigo-500 dark:text-indigo-400 ml-auto">
                      Showing stock for selected warehouse
                    </span>
                  )}
                </div>
              )}

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
                      // availQty = live sum from warehouseStock (all warehouses for customers, selected WH for staff)
                      const availQty = getAvailableQty(p.id);
                      // liveTotal = always the full cross-warehouse sum, for customer display
                      const liveTotal = warehouseStock.filter(ws => ws.product_id === p.id).reduce((sum, ws) => sum + ws.qty, 0);
                      const outOfStock = availQty <= 0;
                      const isLow = availQty > 0 && availQty <= p.min_stock;
                      return (
                        <div key={p.id} className="glass-card rounded-xl p-4 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold">{p.category}</span>
                              <div className="text-right">
                                {currentUser.role === 'customer' ? (
                                  // Customers see total combined stock across all warehouses (live)
                                  <span className={`text-[10px] font-bold ${liveTotal <= 0 ? 'text-red-500' : liveTotal <= p.min_stock ? 'text-amber-500' : 'text-green-500'}`}>
                                    {liveTotal <= 0 ? 'Out of stock' : `${liveTotal} in stock`}
                                  </span>
                                ) : (
                                  <>
                                    <span className={`text-[10px] font-bold ${outOfStock ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-500'}`}>
                                      {availQty} avail
                                    </span>
                                    {selectedWarehouseId && liveTotal !== availQty && (
                                      <span className="block text-[9px] text-slate-400 dark:text-gray-500">({liveTotal} total)</span>
                                    )}
                                  </>
                                )}
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
                    const canApplyManual = ['owner', 'manager', 'staff', 'admin', 'superowner'].includes(currentUser.role);
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
                  {['admin', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
                    <button onClick={() => setShowExpenseModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer">
                      <Plus className="w-3.5 h-3.5" />
                      Record Expense
                    </button>
                  )}
                  {['admin', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
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
                  const filteredExpenses = expenses.filter((ex: any) => {
                    if (expenseFilterCategory && ex.category !== expenseFilterCategory) return false;
                    if (expenseFilterFrom && ex.timestamp.split('T')[0] < expenseFilterFrom) return false;
                    if (expenseFilterTo && ex.timestamp.split('T')[0] > expenseFilterTo) return false;
                    return true;
                  }).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                  const filteredTotal = filteredExpenses.reduce((s: number, e: any) => s + e.amount, 0);
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
                            if (ledgerFilterFrom && l.timestamp.split('T')[0] < ledgerFilterFrom) return false;
                            if (ledgerFilterTo && l.timestamp.split('T')[0] > ledgerFilterTo) return false;
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
          {activeTab === "users" && ['admin', 'superowner', 'owner', 'manager', 'accountant'].includes(currentUser.role) && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">System User Management</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Control system users, setup role access, temporary credentials, and client custom pricing matrices.</p>
                </div>
                
                {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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
                      {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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
                        {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
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
          {activeTab === "warehouses" && ['admin', 'owner', 'manager'].includes(currentUser.role) && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Warehouse Management</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Create and manage physical warehouse locations. Stock is tracked per warehouse with full transfer support.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setWarehouseForm({ name: '', location: '' }); setEditingWarehouseId(null); setShowWarehouseModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Warehouse
                  </button>
                  <button
                    onClick={() => { setTransferForm({ productId: products[0]?.id || '', fromWarehouseId: warehouses[0]?.id || '', toWarehouseId: warehouses[1]?.id || '', qty: 1 }); setShowTransferModal(true); }}
                    disabled={warehouses.length < 2}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-xs font-bold text-white cursor-pointer"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Transfer Stock
                  </button>
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
              for (const item of order.items) {
                if (!productMap[item.product_id]) {
                  const prod = products.find(p => p.id === item.product_id);
                  productMap[item.product_id] = { productId: item.product_id, productName: item.name, totalQty: 0, unit: prod?.unit || 'Pcs', orders: [] };
                }
                const alreadyRestored = order.status_history?.some((h: any) => h.updated_by_name?.startsWith('STOCK_RESTORED:'));
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
              // Check if this order was ever dispatched out for delivery
              const wasOutForDelivery = liveOrder.status_history?.some((h: any) => h.status === 'out_for_delivery');

              if (wasOutForDelivery) {
                // Order came back from delivery — ask for ONE warehouse for all items
                const firstWhId = warehouses[0]?.id || '';
                setReturnSingleWarehouseId(firstWhId);
                setReturnWarehouseModal({ order: liveOrder, singleWarehouseMode: true });
              } else {
                // Order never went out — per-item warehouse selection
                const orderWhId = (liveOrder as any).warehouse_id || '';
                const defaults: Record<string, string> = {};
                for (const item of liveOrder.items) {
                  defaults[item.product_id] = (item as any).warehouse_id || orderWhId || warehouses[0]?.id || '';
                }
                setReturnItemWarehouses(defaults);
                setReturnWarehouseModal({ order: liveOrder, singleWarehouseMode: false });
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
                      {cancelledOrders.length} cancelled orders · {productRows.reduce((s, r) => s + r.totalQty, 0)} total units pending review
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

                {cancelledOrders.length === 0 && (
                  <div className="text-center py-16 text-slate-400 dark:text-gray-500">
                    <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">No cancelled orders</p>
                    <p className="text-[11px] mt-1">All orders are active or delivered</p>
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
                            {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                              <button
                                onClick={() => restoreTrashItem(item.id, item.type)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px]"
                              >
                                Restore
                              </button>
                            )}
                            {currentUser.role === 'admin' && (
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
                    <label className="block text-slate-500 dark:text-gray-400 mb-1">Update Stock Quantity</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={productForm.stock_qty}
                      onChange={(e) => setProductForm({ ...productForm, stock_qty: parseInt(e.target.value) || 0 })}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">Enter the new total stock quantity for this product.</p>
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
                    <label className="block text-slate-500 dark:text-gray-400 mb-1">
                      {isEditingProduct ? 'Stock Quantity' : 'Initial Stock Qty'}
                    </label>
                    <input
                      type="number"
                      value={productForm.stock_qty}
                      onChange={(e) => setProductForm({ ...productForm, stock_qty: parseInt(e.target.value) || 0 })}
                      className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                    />
                    {isEditingProduct && (
                      <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">Changing this will log a manual stock adjustment.</p>
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
              <p className="text-xs text-slate-500 dark:text-gray-400">Your order has been submitted successfully and is now pending approval.</p>
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
