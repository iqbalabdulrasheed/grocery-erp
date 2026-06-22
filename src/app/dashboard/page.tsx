"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/auth";
import { supabase } from "@/services/supabaseClient";
import { db, User, Product, Order, StockLedgerEntry, CustomerLedgerEntry, Expense, AuditLog, Warehouse, WarehouseStock, logAction } from "@/services/db";
import { 
  Users, Package, ClipboardList, TrendingUp, History, Trash2, 
  UserCheck, Shield, ShoppingBag, Plus, Search, Edit2, Check, 
  X, AlertTriangle, ChevronRight, LogOut, Bell, FileText, Download, 
  Printer, DollarSign, Truck, PlusCircle, RotateCcw, HelpCircle, 
  CreditCard, Calendar, BarChart2, Activity, Settings, RefreshCcw,
  Sun, Moon
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

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

  // Targeted fast reloaders — only fetch what changed
  const reloadOrders = useCallback(async () => {
    const ords = await db.getOrders();
    setOrders(ords);
  }, []);

  const reloadOrdersAndStock = useCallback(async () => {
    const [ords, stk] = await Promise.all([db.getOrders(), db.getStockLedger()]);
    setOrders(ords);
    setStockLedger(stk);
  }, []);

  // Trigger data reload
  const reloadData = async () => {
    const user = auth.getCurrentUser();
    if (!user) {
      router.push("/");
      return;
    }
    setCurrentUser(user);

    const prods = await db.getProducts();
    const ords = await db.getOrders();
    const stk = await db.getStockLedger();
    const usrs = await db.getUsers();
    const exps = await db.getExpenses();
    const logs = await db.getAuditLogs(user);
    const trash = await db.getTrash();
    const whs = await db.getWarehouses();
    const whStk = await db.getWarehouseStock();

    setProducts(prods);
    setOrders(ords);
    setStockLedger(stk);
    setUsersList(usrs);
    setExpenses(exps);
    setAuditLogs(logs);
    setTrashList(trash);
    setWarehouses(whs);
    setWarehouseStock(whStk);
    if (!selectedWarehouseId && whs.length > 0) setSelectedWarehouseId(whs[0].id);

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
  }, [router]);

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

    try {
      if (isEditingProduct) {
        await db.updateProduct(isEditingProduct, productForm, currentUser, productWarehouseId || undefined);
      } else {
        await db.createProduct(productForm as any, currentUser, productWarehouseId || undefined);
      }
      setShowProductModal(false);
      setIsEditingProduct(null);
      setProductForm({ name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0 });
      setProductWarehouseId("");
      await reloadData();
    } catch (err: any) {
      alert(err.message);
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
      await db.deleteProduct(id, currentUser);
      await reloadData();
    }
  };

  // USER CRUD HANDLERS
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.username || !userForm.name) return;

    try {
      if (isEditingUser) {
        await db.updateUser(isEditingUser, userForm, currentUser);
      } else {
        await db.createUser(userForm as any, currentUser);
      }
      setShowUserModal(false);
      setIsEditingUser(null);
      setUserForm({ username: "", password: "", name: "", role: "customer", credit_limit: 0, customer_discount: 0 });
      await reloadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEditUser = (usr: User) => {
    setIsEditingUser(usr.id);
    setUserForm({ ...usr, password: "" });
    setShowUserModal(true);
  };

  const deleteUser = async (id: string) => {
    if (confirm("Soft-delete this user account?")) {
      await db.deleteUser(id, currentUser);
      await reloadData();
    }
  };

  const addCustomPriceToUser = async (userId: string) => {
    if (!userCustomPriceItem.product_id || userCustomPriceItem.price <= 0) return;
    const target = usersList.find(u => u.id === userId);
    if (!target) return;
    
    const customPricing = { ...(target.custom_pricing || {}) };
    customPricing[userCustomPriceItem.product_id] = userCustomPriceItem.price;

    await db.updateUser(userId, { custom_pricing: customPricing }, currentUser);
    setUserCustomPriceItem({ product_id: "", price: 0 });
    await reloadData();
  };

  const removeCustomPriceFromUser = async (userId: string, productId: string) => {
    const target = usersList.find(u => u.id === userId);
    if (!target || !target.custom_pricing) return;
    
    const customPricing = { ...target.custom_pricing };
    delete customPricing[productId];

    await db.updateUser(userId, { custom_pricing: customPricing }, currentUser);
    await reloadData();
  };

  // STOCK ADJUST SUBMIT
  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.productId || stockForm.qty === 0) return;

    // Stock-IN types: always add; Stock-OUT types: always deduct
    const stockInTypes: StockLedgerEntry['type'][] = ['purchase', 'supplier_return', 'customer_return'];
    const absQty = Math.abs(stockForm.qty);
    const change = stockInTypes.includes(stockForm.type) ? absQty : -absQty;

    await db.addStockAdjustment(stockForm.productId, change, stockForm.type, stockForm.notes, currentUser, stockForm.warehouseId || undefined);
    setShowStockModal(false);
    setStockForm({ productId: "", qty: 0, type: "purchase", notes: "", warehouseId: "" });
    await reloadData();
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

    await db.createExpense(expenseForm as any, currentUser);
    setShowExpenseModal(false);
    setExpenseForm({ amount: 0, category: "Utilities", description: "" });
    await reloadData();
  };

  // PAYMENT HANDLERS
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentForm.amount <= 0 || !paymentForm.customerId) return;

    await db.recordCustomerPayment(paymentForm.customerId, paymentForm.amount, paymentForm.ref, paymentForm.notes, currentUser);
    setShowPaymentModal(false);
    setPaymentForm({ amount: 0, ref: "", notes: "", customerId: "" });
    await reloadData();
  };

  // CART HANDLERS
  const addToCart = (prodId: string, maxQty: number) => {
    const existing = cart.find(c => c.product_id === prodId);
    if (existing) {
      if (existing.qty + 1 > maxQty) {
        alert("Cannot add more. Exceeds physical stock capacity!");
        return;
      }
      setCart(cart.map(c => c.product_id === prodId ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { product_id: prodId, qty: 1 }]);
    }
  };

  const removeFromCart = (prodId: string) => {
    setCart(cart.filter(c => c.product_id !== prodId));
  };

  const updateCartQty = (prodId: string, val: number, maxQty: number) => {
    if (val <= 0) {
      removeFromCart(prodId);
      return;
    }
    if (val > maxQty) {
      alert("Exceeds warehouse physical inventory!");
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

    try {
      const newOrder = await db.createOrder(customerId, cart, selectedOrderType, isCodOrder, currentUser, manualDiscountPct, manualDiscountAmt, selectedWarehouseId || undefined);
      setCart([]);
      setSelectedCustomerId("");
      setManualDiscountPct(0);
      setManualDiscountAmt(0);
      await reloadData();
      setLastOrderId(newOrder?.id || "");
      setShowOrderSuccess(true);
    } catch (err: any) {
      alert(err.message || "Failed to checkout order");
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
    await db.restoreTrashItem(id, type, currentUser);
    await reloadData();
  };

  const permanentDeleteTrashItem = async (id: string, type: 'product' | 'order' | 'user' | 'expense') => {
    if (confirm("WARNING: This is permanent and cannot be undone. Proceed?")) {
      await db.permanentlyDeleteTrashItem(id, type, currentUser);
      await reloadData();
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
    <div className="flex-1 flex flex-col md:flex-row h-screen overflow-hidden text-slate-700 dark:text-slate-200">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-slate-100 dark:bg-gray-950/60 border-r border-slate-200 dark:border-white/5 flex flex-col no-print">
        <div className="p-6 border-b border-slate-200 dark:border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex justify-center items-center font-bold text-white shadow-lg">
            Z
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-tight">
              ZENVORA ERP
            </h1>
            <span className="text-[10px] text-slate-500 dark:text-gray-500 font-semibold uppercase tracking-wider">
              {currentUser.role} Control
            </span>
          </div>
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
            onClick={() => setActiveTab("overview")}
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
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'customer', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => setActiveTab("products")}
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
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => setActiveTab("inventory")}
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
          <button
            onClick={() => setActiveTab("orders")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
              activeTab === "orders" 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                : "text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Orders Pipeline
          </button>

          {/* Accounting Expense/Ledger */}
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => setActiveTab("accounting")}
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
          {['admin', 'superowner', 'owner', 'manager', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => setActiveTab("users")}
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
          {['admin', 'superowner', 'owner', 'manager', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => setActiveTab("logs")}
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
              onClick={() => setActiveTab("warehouses")}
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
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
            <button
              onClick={() => setActiveTab("trash")}
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
        <header className="h-16 border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-8 bg-white/60 dark:bg-gray-950/20 backdrop-blur-md sticky top-0 z-30 no-print">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-500 dark:text-gray-400 capitalize">
              System Modules / {activeTab}
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
                <div className="absolute right-0 mt-2 w-80 glass-panel rounded-xl border border-slate-200 dark:border-white/5 shadow-2xl p-4 z-50">
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
              onClick={reloadData}
              className="w-9 h-9 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 flex justify-center items-center text-slate-600 dark:text-gray-400 hover:text-slate-950 dark:hover:text-white cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* MODULE CONTAINER */}
        <div className="p-8 flex-1 animate-fade-in print-card">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8 print-card">
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

                    {/* Active Orders — visible to all non-customer roles */}
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

                    {/* Low stock count — visible to all non-customer roles */}
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
              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700 dark:text-gray-300">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4">Product Details</th>
                      <th className="p-4">SKU / Barcode</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Stock Qty</th>
                      {currentUser?.role !== 'customer' && <th className="p-4">Purchase Cost</th>}
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
                            {['admin', 'owner', 'manager'].includes(currentUser.role) && warehouses.length > 1 && (() => {
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
                          {currentUser?.role !== 'customer' && (
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
              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
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
                  return (
                    <div key={order.id} className="glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{order.id}</span>
                          <span className="text-slate-400 dark:text-gray-600">•</span>
                          <span className="text-xs text-slate-500 dark:text-gray-400">{new Date(order.created_at).toLocaleString()}</span>
                          <span className="text-slate-400 dark:text-gray-600">•</span>
                          <span className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider text-[10px]">{order.type}</span>
                          {order.warehouse_name && (
                            <>
                              <span className="text-slate-400 dark:text-gray-600">•</span>
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

                          {currentStatus === 'created' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                            <button onClick={() => withLock(async () => { await db.updateOrderStatus(order.id, 'approved', currentUser); await reloadOrdersAndStock(); })} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer">Approve</button>
                          )}
                          {currentStatus === 'approved' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                            <button onClick={() => withLock(async () => { await db.updateOrderStatus(order.id, 'packing', currentUser); await reloadOrders(); })} className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition cursor-pointer">Start Packing</button>
                          )}
                          {currentStatus === 'packing' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                            <button onClick={() => { setAssignForm({ orderId: order.id, staffId: usersList.filter(u => u.role === 'delivery')[0]?.id || "", route: "" }); setShowAssignModal(true); }} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition cursor-pointer">Assign Driver</button>
                          )}
                          {currentStatus === 'assigned' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                            <button onClick={() => withLock(async () => { await db.updateOrderStatus(order.id, 'out_for_delivery', currentUser); await reloadOrders(); })} className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white transition cursor-pointer">Dispatch Order</button>
                          )}
                          {currentStatus === 'out_for_delivery' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                            <div className="flex gap-1">
                              <button onClick={() => withLock(async () => { await db.updateOrderStatus(order.id, 'delivered', currentUser, { codCollected: order.cod_tracking ? true : false }); await reloadOrders(); })} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer">Delivered</button>
                              <button onClick={() => withLock(async () => { await db.updateOrderStatus(order.id, 'failed', currentUser); await reloadOrdersAndStock(); })} className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition cursor-pointer">Fail</button>
                            </div>
                          )}
                          {!['delivered', 'failed'].includes(currentStatus) && ['admin', 'owner', 'manager'].includes(currentUser.role) && (
                            <button onClick={() => { setCancelOrderId(order.id); setCancelReason(""); setShowCancelModal(true); }} className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-950/30 hover:bg-red-200 dark:hover:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 text-xs font-bold transition cursor-pointer">Cancel</button>
                          )}
                          {currentUser.role === 'admin' && (
                            <button onClick={() => withLock(async () => { await db.deleteOrder(order.id, currentUser); await reloadOrders(); })} className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400">
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
                      const outOfStock = p.stock_qty <= 0;
                      return (
                        <div key={p.id} className="glass-card rounded-xl p-4 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex justify-between items-start">
                              <span className="text-[10px] text-slate-400 dark:text-gray-500 font-semibold">{p.category}</span>
                              <span className={`text-[10px] font-bold ${p.stock_qty <= p.min_stock ? 'text-amber-500' : 'text-green-500'}`}>
                                {p.stock_qty} left
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">{p.name}</h4>
                            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-1">{formatSAR(p.selling_price)}</p>
                          </div>
                          
                          <button
                            disabled={outOfStock}
                            onClick={() => addToCart(p.id, p.stock_qty)}
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
                                onChange={(e) => updateCartQty(item.product_id, parseInt(e.target.value) || 0, prod.stock_qty)}
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

                      {['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && warehouses.length > 1 && (
                        <div className="space-y-2">
                          <label className="block text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase mb-1">Fulfil From Warehouse</label>
                          <select
                            value={selectedWarehouseId}
                            onChange={(e) => setSelectedWarehouseId(e.target.value)}
                            className="glass-input block w-full px-2 py-1.5 rounded text-xs"
                          >
                            {warehouses.map(wh => <option key={wh.id} value={wh.id}>{wh.name}</option>)}
                          </select>
                        </div>
                      )}
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
            <div className="space-y-8">
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
                  <button onClick={() => exportToCSV(expenses, "operating_expenses_export")} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer">
                    <Download className="w-3.5 h-3.5" />
                    Expenses CSV
                  </button>
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

              {/* B2B CUSTOMER LEDGER SECTION */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  B2B Customer Credit & Ledger Tracker
                </h3>

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
                <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
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
                          <>
                            <tr key={c.id} className={`hover:bg-slate-50 dark:hover:bg-white/2 divide-y-0 border-t border-slate-100 dark:border-white/5 ${isOpen ? 'bg-blue-50/50 dark:bg-blue-950/10' : ''}`}>
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
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
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

              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
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
          {activeTab === "logs" && ['admin', 'superowner', 'owner', 'manager', 'accountant'].includes(currentUser.role) && (
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

              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
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
              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
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

          {activeTab === "trash" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">Soft-Deleted Trash Bin</h2>
                <p className="text-xs text-slate-500 dark:text-gray-400">Review deleted products, orders, customers, and users. Restore them, or command permanent purge (Admin only).</p>
              </div>

              <div className="glass-panel rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
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
                        <option value="Dry Food">Dry Food</option>
                        <option value="Dairy">Dairy</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Rice & Grains">Rice & Grains</option>
                        <option value="Oils & Fats">Oils & Fats</option>
                        <option value="Canned Goods">Canned Goods</option>
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

            <div className="space-y-3 text-xs">
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
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason(""); }}
                className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition text-xs"
              >
                Go Back
              </button>
              <button
                onClick={cancelOrder}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition text-xs"
              >
                Confirm Cancellation
              </button>
            </div>
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
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Warehouse Name <span className="text-red-500">*</span></label>
                <input type="text" value={warehouseForm.name} onChange={e => setWarehouseForm({...warehouseForm, name: e.target.value})} placeholder="e.g. Main Warehouse, Branch Riyadh" className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Location / Address</label>
                <input type="text" value={warehouseForm.location} onChange={e => setWarehouseForm({...warehouseForm, location: e.target.value})} placeholder="e.g. Industrial Area, Block 5" className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
              <button type="button" onClick={() => setShowWarehouseModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition text-xs">Cancel</button>
              <button
                type="button"
                disabled={!warehouseForm.name.trim()}
                onClick={async () => {
                  if (!warehouseForm.name.trim()) return;
                  if (editingWarehouseId) {
                    await db.updateWarehouse(editingWarehouseId, { name: warehouseForm.name, location: warehouseForm.location }, currentUser);
                  } else {
                    await db.createWarehouse(warehouseForm.name, warehouseForm.location, currentUser);
                  }
                  setShowWarehouseModal(false);
                  await reloadData();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold rounded-lg transition text-xs"
              >
                {editingWarehouseId ? 'Save Changes' : 'Create Warehouse'}
              </button>
            </div>
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
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">Product</label>
                <select value={transferForm.productId} onChange={e => setTransferForm({...transferForm, productId: e.target.value})} className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white">
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} (Total: {p.stock_qty} {p.unit})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1.5 font-semibold">From Warehouse</label>
                  <select value={transferForm.fromWarehouseId} onChange={e => setTransferForm({...transferForm, fromWarehouseId: e.target.value})} className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white">
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
                  return src ? <p className="text-[10px] text-slate-400 dark:text-gray-500 mt-1">Available in source: {src.qty}</p> : <p className="text-[10px] text-red-400 mt-1">No stock found in source warehouse for this product</p>;
                })()}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
              <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-800 dark:text-white rounded-lg transition text-xs">Cancel</button>
              <button
                type="button"
                disabled={!transferForm.productId || !transferForm.fromWarehouseId || !transferForm.toWarehouseId || transferForm.fromWarehouseId === transferForm.toWarehouseId || transferForm.qty < 1}
                onClick={async () => {
                  try {
                    await db.transferStock(transferForm.productId, transferForm.fromWarehouseId, transferForm.toWarehouseId, transferForm.qty, currentUser);
                    setShowTransferModal(false);
                    await reloadData();
                  } catch(err: any) { alert(err.message); }
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold rounded-lg transition text-xs"
              >
                Transfer Stock
              </button>
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
