"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/services/auth";
import { db, User, Product, Order, StockLedgerEntry, CustomerLedgerEntry, Expense, AuditLog, logAction } from "@/services/db";
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
  const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; type: string }[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Form states
  const [searchQuery, setSearchQuery] = useState("");
  const [productForm, setProductForm] = useState<Partial<Product>>({ name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0 });
  const [isEditingProduct, setIsEditingProduct] = useState<string | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);

  // Order Cart state (for customer / phone sales)
  const [cart, setCart] = useState<{ product_id: string; qty: number }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedOrderType, setSelectedOrderType] = useState<Order['type']>("normal");
  const [isCodOrder, setIsCodOrder] = useState(false);

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
  const [stockForm, setStockForm] = useState({ productId: "", qty: 0, type: "purchase" as StockLedgerEntry['type'], notes: "" });
  const [showStockModal, setShowStockModal] = useState(false);

  // Route & Staff Assign state
  const [assignForm, setAssignForm] = useState({ orderId: "", staffId: "", route: "" });
  const [showAssignModal, setShowAssignModal] = useState(false);

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

    setProducts(prods);
    setOrders(ords);
    setStockLedger(stk);
    setUsersList(usrs);
    setExpenses(exps);
    setAuditLogs(logs);
    setTrashList(trash);

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
    const storedTheme = (localStorage.getItem("erp_theme") as "dark" | "light") || "dark";
    setTheme(storedTheme);
    document.documentElement.setAttribute("data-theme", storedTheme);
    if (storedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    reloadData();
  }, [router]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("erp_theme", newTheme);
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

  const handleLogout = () => {
    auth.logout();
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
        await db.updateProduct(isEditingProduct, productForm, currentUser);
      } else {
        await db.createProduct(productForm as any, currentUser);
      }
      setShowProductModal(false);
      setIsEditingProduct(null);
      setProductForm({ name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0 });
      await reloadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const startEditProduct = (prod: Product) => {
    setIsEditingProduct(prod.id);
    setProductForm(prod);
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
    
    const change = stockForm.type === 'purchase' || stockForm.type === 'manual_adjustment' && stockForm.qty > 0 
      ? stockForm.qty 
      : -Math.abs(stockForm.qty);

    await db.addStockAdjustment(stockForm.productId, change, stockForm.type, stockForm.notes, currentUser);
    setShowStockModal(false);
    setStockForm({ productId: "", qty: 0, type: "purchase", notes: "" });
    await reloadData();
  };

  // ASSIGN & ROUTE SUBMIT
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.orderId || !assignForm.staffId) return;

    await db.updateOrderStatus(assignForm.orderId, 'assigned', currentUser, {
      assignedStaffId: assignForm.staffId,
      deliveryRoute: assignForm.route
    });
    setShowAssignModal(false);
    setAssignForm({ orderId: "", staffId: "", route: "" });
    await reloadData();
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
      await db.createOrder(customerId, cart, selectedOrderType, isCodOrder, currentUser);
      setCart([]);
      setSelectedCustomerId("");
      alert("Order placed successfully!");
      await reloadData();
    } catch (err: any) {
      alert(err.message || "Failed to checkout order");
    }
  };

  // TRASH HANDLERS
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
  const getOverviewData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const chartData = last7Days.map(date => {
      const dayOrders = orders.filter(o => o.status === 'delivered' && o.created_at.startsWith(date));
      const totalSales = dayOrders.reduce((sum, o) => sum + o.total, 0);
      const totalCost = dayOrders.reduce((sum, o) => {
        return sum + o.items.reduce((costSum, item) => {
          const prod = products.find(p => p.id === item.product_id);
          return costSum + (prod ? prod.purchase_cost * item.qty : 0);
        }, 0);
      }, 0);

      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        Sales: totalSales,
        Profit: totalSales - totalCost
      };
    });

    const categoryTotals: Record<string, number> = {};
    products.forEach(p => {
      categoryTotals[p.category] = (categoryTotals[p.category] || 0) + (p.stock_qty * p.selling_price);
    });
    const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

    return { chartData, pieData };
  };

  const { chartData, pieData } = getOverviewData();

  // Accounting Summary stats
  const totalSalesVal = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + o.total, 0);
  const totalCostVal = orders.filter(o => o.status === 'delivered').reduce((sum, o) => {
    return sum + o.items.reduce((costSum, item) => {
      const prod = products.find(p => p.id === item.product_id);
      return costSum + (prod ? prod.purchase_cost * item.qty : 0);
    }, 0);
  }, 0);
  const totalExpensesVal = expenses.reduce((sum, e) => sum + e.amount, 0);
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
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
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
          {['admin', 'superowner', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
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
              <div className="flex justify-between items-center no-print">
                <div>
                  <h2 className="text-2xl font-extrabold text-slate-950 dark:text-white">Marhaba, {currentUser.name}!</h2>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Here is the latest status of Zenvora Grocery Warehouse ERP.</p>
                </div>
                <div className="flex gap-2">
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
                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Total Sales</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(totalSalesVal)}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex justify-center items-center text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                    </div>

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

                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Active Orders</span>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                          {orders.filter(o => o.status !== 'delivered' && o.status !== 'failed').length} Pending
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex justify-center items-center text-amber-600 dark:text-amber-400">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="glass-card rounded-xl p-5 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-wider">Net Profit (Loss)</span>
                        <h3 className={`text-xl font-extrabold mt-1 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {formatSAR(netProfit)}
                        </h3>
                      </div>
                      <div className={`w-10 h-10 rounded-lg flex justify-center items-center ${netProfit >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20'}`}>
                        <DollarSign className="w-5 h-5" />
                      </div>
                    </div>
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
          {activeTab === "products" && (
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
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input pl-9 pr-3 py-2 rounded-lg text-xs w-48 sm:w-64"
                    />
                  </div>
                  
                  {['admin', 'owner', 'manager'].includes(currentUser.role) && (
                    <button
                      onClick={() => {
                        setIsEditingProduct(null);
                        setProductForm({ name: "", sku: "", category: "Dry Food", unit: "Pcs", purchase_cost: 0, selling_price: 0, min_stock: 5, stock_qty: 0 });
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
                      {['admin', 'owner', 'manager'].includes(currentUser.role) && (
                        <th className="p-4 text-right">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredProducts.map(p => {
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
                          {['admin', 'owner', 'manager'].includes(currentUser.role) && (
                            <td className="p-4 text-right space-x-2">
                              <button 
                                onClick={() => startEditProduct(p)}
                                className="p-1.5 rounded bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-gray-300 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-0"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => deleteProduct(p.id)}
                                className="p-1.5 rounded bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: INVENTORY */}
          {activeTab === "inventory" && (
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
                        setStockForm({ productId: products[0]?.id || "", qty: 0, type: "purchase", notes: "" });
                        setShowStockModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add Stock entry
                    </button>
                  )}

                  <button
                    onClick={() => exportToCSV(stockLedger, "stock_ledger_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel Ledger
                  </button>
                </div>
              </div>

              {/* STOCK LEDGER TIMELINE LIST */}
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
                    {stockLedger.map(entry => (
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
                            {entry.type.replace('_', ' ')}
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
            </div>
          )}

          {/* TAB 4: ORDERS */}
          {activeTab === "orders" && (
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
                    onClick={() => exportToCSV(orders, "sales_orders_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Excel Orders
                  </button>
                </div>
              </div>

              {/* ORDERS LIST */}
              <div className="space-y-4">
                {filteredOrders.map(order => {
                  const currentStatus = order.status;
                  return (
                    <div key={order.id} className="glass-panel rounded-xl p-5 border border-slate-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{order.id}</span>
                          <span className="text-slate-400 dark:text-gray-600">•</span>
                          <span className="text-xs text-slate-500 dark:text-gray-400">{new Date(order.created_at).toLocaleString()}</span>
                          <span className="text-slate-400 dark:text-gray-600">•</span>
                          <span className="text-xs text-blue-600 dark:text-blue-400 uppercase font-bold tracking-wider text-[10px]">{order.type}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{order.customer_name}</h3>
                        
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {order.items.map((item, idx) => (
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
                            {currentStatus}
                          </span>

                          {/* ACTION: MANAGER APPROVAL */}
                          {currentStatus === 'created' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                            <button
                              onClick={async () => {
                                  await db.updateOrderStatus(order.id, 'approved', currentUser);
                                  await reloadData();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer"
                            >
                              Approve
                            </button>
                          )}

                          {/* ACTION: STAFF PACKING */}
                          {currentStatus === 'approved' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                            <button
                              onClick={async () => {
                                await db.updateOrderStatus(order.id, 'packing', currentUser);
                                await reloadData();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition cursor-pointer"
                            >
                              Start Packing
                            </button>
                          )}

                          {/* ACTION: ASSIGN STAFF & ROUTE */}
                          {currentStatus === 'packing' && ['admin', 'owner', 'manager', 'staff'].includes(currentUser.role) && (
                            <button
                              onClick={() => {
                                setAssignForm({ orderId: order.id, staffId: usersList.filter(u => u.role === 'delivery')[0]?.id || "", route: "" });
                                setShowAssignModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition cursor-pointer"
                            >
                              Assign Driver
                            </button>
                          )}

                          {/* ACTION: STAFF DISPATCH */}
                          {currentStatus === 'assigned' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                            <button
                              onClick={async () => {
                                await db.updateOrderStatus(order.id, 'out_for_delivery', currentUser);
                                await reloadData();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white transition cursor-pointer"
                            >
                              Dispatch Order
                            </button>
                          )}

                          {/* ACTION: DELIVERY CONFIRM / FAIL */}
                          {currentStatus === 'out_for_delivery' && ['admin', 'owner', 'manager', 'staff', 'delivery'].includes(currentUser.role) && (
                            <div className="flex gap-1">
                              <button
                                onClick={async () => {
                                  await db.updateOrderStatus(order.id, 'delivered', currentUser, { codCollected: order.cod_tracking ? true : false });
                                  await reloadData();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer"
                              >
                                Delivered
                              </button>
                              <button
                                onClick={async () => {
                                  await db.updateOrderStatus(order.id, 'failed', currentUser);
                                  await reloadData();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-bold text-white transition cursor-pointer"
                              >
                                Fail
                              </button>
                            </div>
                          )}

                          {/* DELETE ORDER */}
                          {['admin', 'owner', 'manager'].includes(currentUser.role) && (
                            <button
                              onClick={async () => {
                                await db.deleteOrder(order.id, currentUser);
                                await reloadData();
                              }}
                              className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/20 hover:bg-red-200 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400"
                            >
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
          )}

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

                  {cart.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/5 text-xs text-slate-500 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="text-slate-900 dark:text-white font-semibold">
                          {formatSAR(cart.reduce((sum, item) => {
                            const prod = products.find(p => p.id === item.product_id)!;
                            return sum + (prod.selling_price * item.qty);
                          }, 0))}
                        </span>
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

                      <button
                        onClick={checkoutCart}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-lg transition text-xs cursor-pointer"
                      >
                        Submit Order
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ACCOUNTING */}
          {activeTab === "accounting" && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-950 dark:text-white">Accounting Ledger & Profits</h2>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Evaluate net sales revenues, record expenses, review customer credit accounts, and track unpaid balances.</p>
                </div>
                
                <div className="flex gap-2 shrink-0">
                  {['admin', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
                    <button
                      onClick={() => setShowExpenseModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Record Expense
                    </button>
                  )}

                  {['admin', 'owner', 'manager', 'staff', 'accountant'].includes(currentUser.role) && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Receive B2B Payment
                    </button>
                  )}

                  <button
                    onClick={() => exportToCSV(expenses, "operating_expenses_export")}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Expenses CSV
                  </button>
                </div>
              </div>

              {/* Gross and P&L details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/5">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">Gross Sales Revenue</span>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(totalSalesVal)}</h3>
                  <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-1">Delivered customer orders</span>
                </div>
                <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/5">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">Operating Expenses</span>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">{formatSAR(totalExpensesVal)}</h3>
                  <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-1">Rent, electricity, repairs</span>
                </div>
                <div className="glass-card rounded-xl p-5 border border-slate-200 dark:border-white/5">
                  <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">Net Profit</span>
                  <h3 className={`text-xl font-extrabold mt-1 ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {formatSAR(netProfit)}
                  </h3>
                  <span className="text-[9px] text-slate-400 dark:text-gray-500 block mt-1">Sales minus stock costs & expenses</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-950 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  B2B Customer Credit & Ledger Tracker
                </h3>

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
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {usersList.filter(u => u.role === 'customer').map(c => {
                        const limit = c.credit_limit || 0;
                        const outstanding = c.outstanding_balance || 0;
                        const available = limit - outstanding;
                        return (
                          <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/2">
                            <td className="p-4">
                              <div className="font-bold text-slate-900 dark:text-white">{c.name}</div>
                              <span className="text-[10px] text-slate-400 dark:text-gray-500">Username: @{c.username}</span>
                            </td>
                            <td className="p-4 font-bold">{formatSAR(limit)}</td>
                            <td className="p-4 font-bold text-amber-600 dark:text-amber-400">{formatSAR(outstanding)}</td>
                            <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">{formatSAR(available)}</td>
                            <td className="p-4 text-right">
                              <button
                                onClick={async () => {
                                  const list = await db.getCustomerLedger(c.id);
                                  alert(`Ledger for ${c.name}:\n\n` + list.map(l => 
                                    `[${new Date(l.timestamp).toLocaleDateString()}] ${l.type.toUpperCase()} | Ref: ${l.ref_id}\n` +
                                    `  Amount: ${l.amount} SAR | Balance: ${l.balance_after} SAR\n` +
                                    `  Notes: ${l.notes}`
                                  ).join("\n\n"));
                                }}
                                className="px-3 py-1 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10 rounded font-bold text-[10px] text-slate-700 dark:text-gray-300"
                              >
                                View Statements
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: USER MANAGEMENT */}
          {activeTab === "users" && (
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
          {activeTab === "logs" && (
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
              {isEditingProduct ? "Edit Product Form" : "Create New Product"}
            </h3>
            <form onSubmit={handleProductSubmit} className="space-y-4 text-xs">
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

              {!isEditingProduct && (
                <div>
                  <label className="block text-slate-500 dark:text-gray-400 mb-1">Initial Stock Qty</label>
                  <input
                    type="number"
                    value={productForm.stock_qty}
                    onChange={(e) => setProductForm({ ...productForm, stock_qty: parseInt(e.target.value) || 0 })}
                    className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
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
                    <option value="manual_adjustment">Manual Adjustment</option>
                    <option value="damage">Stock Out: Damage goods</option>
                    <option value="expired">Stock Out: Expired goods</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 dark:text-gray-400 mb-1">Internal Reference Notes</label>
                <textarea
                  required
                  value={stockForm.notes}
                  onChange={(e) => setStockForm({ ...stockForm, notes: e.target.value })}
                  className="glass-input block w-full px-3 py-2 rounded-lg text-slate-900 dark:text-white h-20 resize-none"
                  placeholder="Invoice number, supplier details, or forklift damage details..."
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

    </div>
  );
}
