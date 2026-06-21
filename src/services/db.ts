// Grocery Warehouse ERP System - Database Service (Mocking localStorage + Supabase Connector)
import { supabase } from './supabaseClient';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: 'admin' | 'superowner' | 'owner' | 'manager' | 'staff' | 'delivery' | 'customer' | 'accountant';
  credit_limit?: number;
  outstanding_balance?: number;
  opening_balance?: number;
  customer_discount?: number;
  custom_pricing?: Record<string, number>;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  purchase_cost: number;
  selling_price: number;
  min_stock: number;
  stock_qty: number;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

export interface StockLedgerEntry {
  id: string;
  product_id: string;
  product_name: string;
  qty_change: number;
  type: 'purchase' | 'supplier_return' | 'manual_adjustment' | 'customer_sales' | 'damage' | 'expired' | 'dispatch';
  notes: string;
  timestamp: string;
  user_id: string;
  user_name: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  total: number;
}

export interface Order {
  id: string;
  customer_id: string;
  customer_name: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  type: 'normal' | 'walk-in' | 'phone' | 'cash';
  status: 'created' | 'approved' | 'packing' | 'assigned' | 'out_for_delivery' | 'delivered' | 'failed';
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  assigned_staff_id?: string | null;
  assigned_staff_name?: string | null;
  delivery_route?: string | null;
  cod_tracking: boolean;
  cod_collected?: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  status_history: {
    status: Order['status'];
    updated_at: string;
    updated_by_name: string;
  }[];
}

export interface CustomerLedgerEntry {
  id: string;
  customer_id: string;
  type: 'opening' | 'purchase' | 'payment';
  ref_id: string;
  amount: number;
  balance_after: number;
  timestamp: string;
  notes: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  timestamp: string;
  details: string;
  is_admin_only: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  timestamp: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
}

const isClient = typeof window !== 'undefined';

// Seed Data
const defaultUsers: User[] = [
  { id: 'usr-admin', username: 'sysadmin', password: 'cfi@2024', name: 'System Admin (CFI)', role: 'admin' }
];

const defaultProducts: Product[] = [];

const defaultStockLedger: StockLedgerEntry[] = [];

const defaultCustomerLedger: CustomerLedgerEntry[] = [];

const defaultExpenses: Expense[] = [];

// Helper to initialize local storage
const initializeLocalStorage = () => {
  if (!isClient) return;
  if (!localStorage.getItem('erp_initialized_v6')) {
    localStorage.setItem('users', JSON.stringify(defaultUsers));
    localStorage.setItem('products', JSON.stringify(defaultProducts));
    localStorage.setItem('stock_ledger', JSON.stringify(defaultStockLedger));
    localStorage.setItem('orders', JSON.stringify([]));
    localStorage.setItem('customer_ledger', JSON.stringify(defaultCustomerLedger));
    localStorage.setItem('audit_logs', JSON.stringify([]));
    localStorage.setItem('expenses', JSON.stringify(defaultExpenses));
    localStorage.setItem('erp_initialized_v6', 'true');
  }
};

const getLocalTable = <T>(tableName: string): T[] => {
  if (!isClient) return [];
  initializeLocalStorage();
  const data = localStorage.getItem(tableName);
  return data ? JSON.parse(data) : [];
};

const saveLocalTable = <T>(tableName: string, data: T[]): void => {
  if (isClient) {
    localStorage.setItem(tableName, JSON.stringify(data));
  }
};

// SEED SUPABASE AUTOMATICALLY ON FIRST ACCESS
const checkAndSeedSupabase = async () => {
  if (!supabase) return;
  try {
    const { count, error } = await supabase.from('users').select('*', { count: 'exact', head: true });
    if (!error && count === 0) {
      console.log("Supabase empty, seeding cloud tables...");
      await supabase.from('users').insert(defaultUsers);
      await supabase.from('products').insert(defaultProducts);
      await supabase.from('stock_ledger').insert(defaultStockLedger);
      await supabase.from('customer_ledger').insert(defaultCustomerLedger);
      await supabase.from('expenses').insert(defaultExpenses);
    } else {
      // Ensure the sysadmin user has the correct password in the database
      const adminUser = defaultUsers.find(u => u.username === 'sysadmin');
      if (adminUser) {
        await supabase.from('users').upsert(adminUser);
      }
    }
  } catch (err) {
    console.error("Failed to seed Supabase database automatically:", err);
  }
};

// Initialize both
if (isClient) {
  initializeLocalStorage();
  checkAndSeedSupabase();
}

// AUDIT LOG HELPER
export const logAction = async (
  userId: string,
  userName: string,
  role: string,
  action: string,
  details: string = '',
  isAdminOnly: boolean = false
) => {
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    user_id: userId,
    user_name: userName,
    user_role: role,
    action,
    timestamp: new Date().toISOString(),
    details,
    is_admin_only: isAdminOnly
  };

  if (supabase) {
    await supabase.from('audit_logs').insert([newLog]);
  } else {
    const logs = getLocalTable<AuditLog>('audit_logs');
    saveLocalTable('audit_logs', [newLog, ...logs]);
  }
};

// DUAL SERVICE DATABASE CLIENT
export const db = {
  // USERS
  getUsers: async (includeDeleted = false): Promise<User[]> => {
    if (supabase) {
      const query = supabase.from('users').select('*');
      const { data, error } = includeDeleted ? await query : await query.eq('is_deleted', false);
      if (error) throw error;
      return data || [];
    } else {
      const list = getLocalTable<User>('users');
      return includeDeleted ? list : list.filter(u => !u.is_deleted);
    }
  },

  getUserById: async (id: string): Promise<User | undefined> => {
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
      if (error) return undefined;
      return data;
    } else {
      const list = getLocalTable<User>('users');
      return list.find(u => u.id === id);
    }
  },

  createUser: async (user: Omit<User, 'id'>, actor: User): Promise<User> => {
    const newUser: User = {
      ...user,
      id: `usr-${Date.now()}`,
      outstanding_balance: 0
    };

    if (supabase) {
      const { error } = await supabase.from('users').insert([newUser]);
      if (error) throw error;
    } else {
      const users = getLocalTable<User>('users');
      saveLocalTable('users', [...users, newUser]);
    }

    await logAction(actor.id, actor.name, actor.role, `Created User: ${newUser.name} (${newUser.role})`, `Username: ${newUser.username}`);
    return newUser;
  },

  updateUser: async (id: string, updates: Partial<User>, actor: User): Promise<User> => {
    if (supabase) {
      const cleanUpdates = { ...updates };
      if (cleanUpdates.password === '') delete cleanUpdates.password;

      // If no actual updates, just fetch and return the user
      if (Object.keys(cleanUpdates).length === 0) {
        const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
      }

      const { data, error } = await supabase.from('users').update(cleanUpdates).eq('id', id).select().single();
      if (error) throw error;
      await logAction(actor.id, actor.name, actor.role, `Updated User: ${data.name}`, JSON.stringify(updates));
      return data;
    } else {
      const users = getLocalTable<User>('users');
      const updatedUsers = users.map(u => {
        if (u.id === id) {
          const updated = { ...u, ...updates };
          if (updates.password === '') delete updated.password;
          else if (updates.password) updated.password = updates.password;
          return updated;
        }
        return u;
      });
      saveLocalTable('users', updatedUsers);
      const target = updatedUsers.find(u => u.id === id)!;
      await logAction(actor.id, actor.name, actor.role, `Updated User: ${target.name}`, JSON.stringify(updates));
      return target;
    }
  },

  deleteUser: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('users').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    } else {
      const users = getLocalTable<User>('users');
      const updatedUsers = users.map(u => {
        if (u.id === id) return { ...u, is_deleted: true, deleted_at: new Date().toISOString() };
        return u;
      });
      saveLocalTable('users', updatedUsers);
    }
    const target = await db.getUserById(id);
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Soft-deleted User: ${target.name}`, `ID: ${id}`);
    }
  },

  restoreUser: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('users').update({ is_deleted: false, deleted_at: null }).eq('id', id);
      if (error) throw error;
    } else {
      const users = getLocalTable<User>('users');
      const updatedUsers = users.map(u => {
        if (u.id === id) return { ...u, is_deleted: false, deleted_at: null };
        return u;
      });
      saveLocalTable('users', updatedUsers);
    }
    const target = await db.getUserById(id);
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Restored User: ${target.name}`, `ID: ${id}`);
    }
  },

  permanentlyDeleteUser: async (id: string, actor: User): Promise<void> => {
    const target = await db.getUserById(id);
    if (supabase) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    } else {
      const users = getLocalTable<User>('users');
      saveLocalTable('users', users.filter(u => u.id !== id));
    }
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Permanently Deleted User: ${target.name}`, `ID: ${id}`, true);
    }
  },

  // PRODUCTS
  getProducts: async (includeDeleted = false): Promise<Product[]> => {
    if (supabase) {
      const query = supabase.from('products').select('*');
      const { data, error } = includeDeleted ? await query : await query.eq('is_deleted', false);
      if (error) throw error;
      return data || [];
    } else {
      const list = getLocalTable<Product>('products');
      return includeDeleted ? list : list.filter(p => !p.is_deleted);
    }
  },

  getProductById: async (id: string): Promise<Product | undefined> => {
    if (supabase) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) return undefined;
      return data;
    } else {
      const list = getLocalTable<Product>('products');
      return list.find(p => p.id === id);
    }
  },

  createProduct: async (product: Omit<Product, 'id'>, actor: User): Promise<Product> => {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`
    };

    if (supabase) {
      const { error } = await supabase.from('products').insert([newProduct]);
      if (error) throw error;
    } else {
      const products = getLocalTable<Product>('products');
      saveLocalTable('products', [...products, newProduct]);
    }

    if (newProduct.stock_qty > 0) {
      await db.addStockLedgerEntry({
        id: `stk-${Date.now()}`,
        product_id: newProduct.id,
        product_name: newProduct.name,
        qty_change: newProduct.stock_qty,
        type: 'purchase',
        notes: 'Initial opening stock entry upon product creation',
        timestamp: new Date().toISOString(),
        user_id: actor.id,
        user_name: actor.name
      });
    }

    await logAction(actor.id, actor.name, actor.role, `Created Product: ${newProduct.name}`, `SKU: ${newProduct.sku}, Cost: ${newProduct.purchase_cost} SAR`);
    return newProduct;
  },

  updateProduct: async (id: string, updates: Partial<Product>, actor: User): Promise<Product> => {
    const original = await db.getProductById(id);
    if (!original) throw new Error("Product not found");

    if (supabase) {
      const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
      if (error) throw error;

      if (updates.stock_qty !== undefined && updates.stock_qty !== original.stock_qty) {
        const diff = updates.stock_qty - original.stock_qty;
        await db.addStockLedgerEntry({
          id: `stk-${Date.now()}`,
          product_id: id,
          product_name: data.name,
          qty_change: diff,
          type: 'manual_adjustment',
          notes: 'Manual inventory stock adjust',
          timestamp: new Date().toISOString(),
          user_id: actor.id,
          user_name: actor.name
        });
      }
      await logAction(actor.id, actor.name, actor.role, `Updated Product: ${data.name}`, JSON.stringify(updates));
      return data;
    } else {
      const products = getLocalTable<Product>('products');
      const updatedProducts = products.map(p => (p.id === id ? { ...p, ...updates } : p));
      saveLocalTable('products', updatedProducts);
      const target = updatedProducts.find(p => p.id === id)!;

      if (updates.stock_qty !== undefined && updates.stock_qty !== original.stock_qty) {
        const diff = updates.stock_qty - original.stock_qty;
        await db.addStockLedgerEntry({
          id: `stk-${Date.now()}`,
          product_id: id,
          product_name: target.name,
          qty_change: diff,
          type: 'manual_adjustment',
          notes: 'Manual inventory stock adjust',
          timestamp: new Date().toISOString(),
          user_id: actor.id,
          user_name: actor.name
        });
      }
      await logAction(actor.id, actor.name, actor.role, `Updated Product: ${target.name}`, JSON.stringify(updates));
      return target;
    }
  },

  deleteProduct: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('products').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
    } else {
      const products = getLocalTable<Product>('products');
      saveLocalTable('products', products.map(p => (p.id === id ? { ...p, is_deleted: true, deleted_at: new Date().toISOString() } : p)));
    }
    const target = await db.getProductById(id);
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Soft-deleted Product: ${target.name}`, `ID: ${id}`);
    }
  },

  restoreProduct: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('products').update({ is_deleted: false, deleted_at: null }).eq('id', id);
    } else {
      const products = getLocalTable<Product>('products');
      saveLocalTable('products', products.map(p => (p.id === id ? { ...p, is_deleted: false, deleted_at: null } : p)));
    }
    const target = await db.getProductById(id);
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Restored Product: ${target.name}`, `ID: ${id}`);
    }
  },

  permanentlyDeleteProduct: async (id: string, actor: User): Promise<void> => {
    const target = await db.getProductById(id);
    if (supabase) {
      await supabase.from('products').delete().eq('id', id);
    } else {
      const products = getLocalTable<Product>('products');
      saveLocalTable('products', products.filter(p => p.id !== id));
    }
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Permanently Deleted Product: ${target.name}`, `ID: ${id}`, true);
    }
  },

  // STOCK LEDGER & ADJUSTMENTS
  getStockLedger: async (): Promise<StockLedgerEntry[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('stock_ledger').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalTable<StockLedgerEntry>('stock_ledger');
    }
  },

  addStockLedgerEntry: async (entry: StockLedgerEntry): Promise<void> => {
    if (supabase) {
      await supabase.from('stock_ledger').insert([entry]);
    } else {
      const ledger = getLocalTable<StockLedgerEntry>('stock_ledger');
      saveLocalTable('stock_ledger', [entry, ...ledger]);
    }
  },

  addStockAdjustment: async (
    productId: string,
    qtyChange: number,
    type: StockLedgerEntry['type'],
    notes: string,
    actor: User
  ): Promise<void> => {
    const product = await db.getProductById(productId);
    if (!product) return;

    const newQty = product.stock_qty + qtyChange;
    
    // Update product stock
    if (supabase) {
      await supabase.from('products').update({ stock_qty: newQty }).eq('id', productId);
    } else {
      const products = getLocalTable<Product>('products');
      saveLocalTable('products', products.map(p => p.id === productId ? { ...p, stock_qty: newQty } : p));
    }

    // Insert entry
    const entry: StockLedgerEntry = {
      id: `stk-${Date.now()}-${Math.floor(Math.random()*100)}`,
      product_id: productId,
      product_name: product.name,
      qty_change: qtyChange,
      type,
      notes,
      timestamp: new Date().toISOString(),
      user_id: actor.id,
      user_name: actor.name
    };
    await db.addStockLedgerEntry(entry);
    await logAction(actor.id, actor.name, actor.role, `Stock Adjustment (${type}): ${product.name} by ${qtyChange} units`, notes);
  },

  // ORDERS
  getOrders: async (includeDeleted = false): Promise<Order[]> => {
    if (supabase) {
      const query = supabase.from('orders').select('*');
      const { data, error } = includeDeleted ? await query : await query.eq('is_deleted', false);
      if (error) throw error;
      return data || [];
    } else {
      const list = getLocalTable<Order>('orders');
      return includeDeleted ? list : list.filter(o => !o.is_deleted);
    }
  },

  getOrderById: async (id: string): Promise<Order | undefined> => {
    if (supabase) {
      const { data, error } = await supabase.from('orders').select('*').eq('id', id).single();
      if (error) return undefined;
      return data;
    } else {
      const list = getLocalTable<Order>('orders');
      return list.find(o => o.id === id);
    }
  },

  calculateCustomerPrice: (customer: User, product: Product): number => {
    if (customer.custom_pricing && customer.custom_pricing[product.id] !== undefined) {
      return customer.custom_pricing[product.id];
    }
    if (customer.customer_discount && customer.customer_discount > 0) {
      const discount = (product.selling_price * customer.customer_discount) / 100;
      return Number((product.selling_price - discount).toFixed(2));
    }
    return product.selling_price;
  },

  createOrder: async (
    customerId: string,
    items: { product_id: string; qty: number }[],
    orderType: Order['type'],
    codTracking: boolean,
    actor: User
  ): Promise<Order> => {
    const customer = await db.getUserById(customerId);
    if (!customer) throw new Error('Customer not found');

    let subtotal = 0;
    let totalDiscount = 0;
    
    const orderItems: OrderItem[] = [];
    for (const item of items) {
      const prod = await db.getProductById(item.product_id);
      if (!prod) throw new Error(`Product ${item.product_id} not found`);

      const defaultPrice = prod.selling_price;
      const finalPrice = db.calculateCustomerPrice(customer, prod);
      const discountVal = defaultPrice - finalPrice;

      const itemTotal = Number((finalPrice * item.qty).toFixed(2));
      subtotal += Number((defaultPrice * item.qty).toFixed(2));
      totalDiscount += Number((discountVal * item.qty).toFixed(2));

      orderItems.push({
        product_id: prod.id,
        name: prod.name,
        qty: item.qty,
        unit_price: finalPrice,
        total: itemTotal
      });
    }

    const total = Number((subtotal - totalDiscount).toFixed(2));
    
    if (customer.role === 'customer' && customer.credit_limit) {
      const currentOutstanding = customer.outstanding_balance || 0;
      if (!codTracking && (currentOutstanding + total > customer.credit_limit)) {
        throw new Error(`Order exceeds credit limit of ${customer.credit_limit} SAR. Current outstanding: ${currentOutstanding} SAR.`);
      }
    }

    let initialStatus: Order['status'] = 'created';
    if (['admin', 'superowner', 'owner', 'manager'].includes(actor.role)) {
      initialStatus = 'approved';
    }

    const newOrder: Order = {
      id: `ORD-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`,
      customer_id: customerId,
      customer_name: customer.name,
      created_by_id: actor.id,
      created_by_name: actor.name,
      created_at: new Date().toISOString(),
      type: orderType,
      status: initialStatus,
      items: orderItems,
      subtotal,
      discount: totalDiscount,
      total,
      cod_tracking: codTracking,
      status_history: [
        { status: 'created', updated_at: new Date().toISOString(), updated_by_name: actor.name }
      ]
    };

    if (initialStatus === 'approved') {
      newOrder.status_history.push({
        status: 'approved',
        updated_at: new Date().toISOString(),
        updated_by_name: actor.name
      });
    }

    if (supabase) {
      await supabase.from('orders').insert([newOrder]);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', [...orders, newOrder]);
    }

    await logAction(actor.id, actor.name, actor.role, `Created Order ${newOrder.id}`, `Total: ${total} SAR`);

    if (initialStatus === 'approved') {
      for (const item of items) {
        await db.addStockAdjustment(item.product_id, -item.qty, 'customer_sales', `Sales Reservation - Order ${newOrder.id}`, actor);
      }
    }

    return newOrder;
  },

  updateOrderStatus: async (
    orderId: string,
    newStatus: Order['status'],
    actor: User,
    meta?: { assignedStaffId?: string; deliveryRoute?: string; codCollected?: boolean }
  ): Promise<Order> => {
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const updated = {
      ...order,
      status: newStatus,
      status_history: [
        ...order.status_history,
        { status: newStatus, updated_at: new Date().toISOString(), updated_by_name: actor.name }
      ]
    } as Order;

    if (meta?.assignedStaffId) {
      const staff = await db.getUserById(meta.assignedStaffId);
      updated.assigned_staff_id = meta.assignedStaffId;
      updated.assigned_staff_name = staff ? staff.name : 'Unknown';
    }
    if (meta?.deliveryRoute !== undefined) updated.delivery_route = meta.deliveryRoute;
    if (meta?.codCollected !== undefined) updated.cod_collected = meta.codCollected;

    if (supabase) {
      await supabase.from('orders').update(updated).eq('id', orderId);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === orderId ? updated : o));
    }

    await logAction(actor.id, actor.name, actor.role, `Updated Order ${orderId} Status to: ${newStatus}`);

    if (order.status === 'created' && newStatus === 'approved') {
      for (const item of updated.items) {
        await db.addStockAdjustment(item.product_id, -item.qty, 'customer_sales', `Sales Reservation - Order ${orderId}`, actor);
      }
    }

    if (newStatus === 'delivered') {
      const customer = await db.getUserById(updated.customer_id);
      if (customer && customer.role === 'customer') {
        const currentBalance = customer.outstanding_balance || 0;
        const newBalance = currentBalance + updated.total;
        
        const entry: CustomerLedgerEntry = {
          id: `ldg-${Date.now()}`,
          customer_id: customer.id,
          type: 'purchase',
          ref_id: updated.id,
          amount: updated.total,
          balance_after: newBalance,
          timestamp: new Date().toISOString(),
          notes: `Sales Invoice - Delivered Order ${updated.id}`
        };

        if (supabase) {
          await supabase.from('customer_ledger').insert([entry]);
        } else {
          const ledger = getLocalTable<CustomerLedgerEntry>('customer_ledger');
          saveLocalTable('customer_ledger', [...ledger, entry]);
        }
        await db.updateUser(customer.id, { outstanding_balance: newBalance }, actor);
      }
    }

    return updated;
  },

  deleteOrder: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('orders').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === id ? { ...o, is_deleted: true, deleted_at: new Date().toISOString() } : o));
    }
    const target = await db.getOrderById(id);
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Soft-deleted Order: ${id}`, `Total: ${target.total} SAR`);
    }
  },

  restoreOrder: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('orders').update({ is_deleted: false, deleted_at: null }).eq('id', id);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === id ? { ...o, is_deleted: false, deleted_at: null } : o));
    }
    const target = await db.getOrderById(id);
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Restored Order: ${id}`, `Total: ${target.total} SAR`);
    }
  },

  permanentlyDeleteOrder: async (id: string, actor: User): Promise<void> => {
    const target = await db.getOrderById(id);
    if (supabase) {
      await supabase.from('orders').delete().eq('id', id);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.filter(o => o.id !== id));
    }
    if (target) {
      await logAction(actor.id, actor.name, actor.role, `Permanently Deleted Order: ${id}`, `Total: ${target.total} SAR`, true);
    }
  },

  // CUSTOMER PAYMENTS & LEDGER
  getCustomerLedger: async (customerId: string): Promise<CustomerLedgerEntry[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('customer_ledger').select('*').eq('customer_id', customerId).order('timestamp', { ascending: true });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalTable<CustomerLedgerEntry>('customer_ledger')
        .filter(l => l.customer_id === customerId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
  },

  recordCustomerPayment: async (customerId: string, amount: number, paymentRef: string, notes: string, actor: User): Promise<void> => {
    const customer = await db.getUserById(customerId);
    if (!customer) throw new Error('Customer not found');

    const currentBalance = customer.outstanding_balance || 0;
    const newBalance = Number((currentBalance - amount).toFixed(2));

    const entry: CustomerLedgerEntry = {
      id: `ldg-${Date.now()}`,
      customer_id: customerId,
      type: 'payment',
      ref_id: paymentRef,
      amount: -amount,
      balance_after: newBalance,
      timestamp: new Date().toISOString(),
      notes: notes || `Payment received: Ref ${paymentRef}`
    };

    if (supabase) {
      await supabase.from('customer_ledger').insert([entry]);
    } else {
      const ledger = getLocalTable<CustomerLedgerEntry>('customer_ledger');
      saveLocalTable('customer_ledger', [...ledger, entry]);
    }

    await db.updateUser(customerId, { outstanding_balance: newBalance }, actor);
    await logAction(actor.id, actor.name, actor.role, `Recorded Customer Payment from: ${customer.name}`, `Amount: ${amount} SAR`);
  },

  // EXPENSES
  getExpenses: async (includeDeleted = false): Promise<Expense[]> => {
    if (supabase) {
      const query = supabase.from('expenses').select('*');
      const { data, error } = includeDeleted ? await query : await query.eq('is_deleted', false);
      if (error) throw error;
      return data || [];
    } else {
      const list = getLocalTable<Expense>('expenses');
      return includeDeleted ? list : list.filter(e => !e.is_deleted);
    }
  },

  createExpense: async (expense: Omit<Expense, 'id' | 'timestamp'>, actor: User): Promise<Expense> => {
    const newExpense: Expense = {
      ...expense,
      id: `exp-${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    if (supabase) {
      await supabase.from('expenses').insert([newExpense]);
    } else {
      const expenses = getLocalTable<Expense>('expenses');
      saveLocalTable('expenses', [...expenses, newExpense]);
    }

    await logAction(actor.id, actor.name, actor.role, `Registered Expense: ${newExpense.description}`, `Amount: ${newExpense.amount} SAR`);
    return newExpense;
  },

  deleteExpense: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('expenses').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
    } else {
      const expenses = getLocalTable<Expense>('expenses');
      saveLocalTable('expenses', expenses.map(e => (e.id === id ? { ...e, is_deleted: true, deleted_at: new Date().toISOString() } : e)));
    }
    const target = await db.getExpenses(true);
    const item = target.find(e => e.id === id);
    if (item) {
      await logAction(actor.id, actor.name, actor.role, `Soft-deleted Expense: ${item.description}`, `Amount: ${item.amount} SAR`);
    }
  },

  restoreExpense: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('expenses').update({ is_deleted: false, deleted_at: null }).eq('id', id);
    } else {
      const expenses = getLocalTable<Expense>('expenses');
      saveLocalTable('expenses', expenses.map(e => (e.id === id ? { ...e, is_deleted: false, deleted_at: null } : e)));
    }
    const target = await db.getExpenses(true);
    const item = target.find(e => e.id === id);
    if (item) {
      await logAction(actor.id, actor.name, actor.role, `Restored Expense: ${item.description}`, `Amount: ${item.amount} SAR`);
    }
  },

  permanentlyDeleteExpense: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('expenses').delete().eq('id', id);
    } else {
      const expenses = getLocalTable<Expense>('expenses');
      saveLocalTable('expenses', expenses.filter(e => e.id !== id));
    }
    await logAction(actor.id, actor.name, actor.role, `Permanently Deleted Expense: ${id}`, `Admin purge`, true);
  },

  // AUDIT LOGS
  getAuditLogs: async (actor: User): Promise<AuditLog[]> => {
    if (supabase) {
      const query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
      const { data, error } = actor.role === 'admin' ? await query : await query.eq('is_admin_only', false);
      if (error) throw error;
      return data || [];
    } else {
      const logs = getLocalTable<AuditLog>('audit_logs');
      return actor.role === 'admin' ? logs : logs.filter(l => !l.is_admin_only);
    }
  },

  // TRASH CAN
  getTrash: async (): Promise<{ id: string; name: string; type: 'product' | 'order' | 'user' | 'expense'; deletedAt: string }[]> => {
    const trash: { id: string; name: string; type: 'product' | 'order' | 'user' | 'expense'; deletedAt: string }[] = [];
    
    const allProds = await db.getProducts(true);
    allProds.forEach(p => {
      if (p.is_deleted && p.deleted_at) {
        trash.push({ id: p.id, name: p.name, type: 'product', deletedAt: p.deleted_at });
      }
    });

    const allOrders = await db.getOrders(true);
    allOrders.forEach(o => {
      if (o.is_deleted && o.deleted_at) {
        trash.push({ id: o.id, name: `Order ${o.id} - ${o.customer_name}`, type: 'order', deletedAt: o.deleted_at });
      }
    });

    const allUsers = await db.getUsers(true);
    allUsers.forEach(u => {
      if (u.is_deleted && u.deleted_at) {
        trash.push({ id: u.id, name: `${u.name} (@${u.username})`, type: 'user', deletedAt: u.deleted_at });
      }
    });

    const allExpenses = await db.getExpenses(true);
    allExpenses.forEach(e => {
      if (e.is_deleted && e.deleted_at) {
        trash.push({ id: e.id, name: `${e.description} (${e.amount} SAR)`, type: 'expense', deletedAt: e.deleted_at });
      }
    });

    return trash.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  },

  restoreTrashItem: async (id: string, type: 'product' | 'order' | 'user' | 'expense', actor: User): Promise<void> => {
    if (type === 'product') await db.restoreProduct(id, actor);
    else if (type === 'order') await db.restoreOrder(id, actor);
    else if (type === 'user') await db.restoreUser(id, actor);
    else if (type === 'expense') await db.restoreExpense(id, actor);
  },

  permanentlyDeleteTrashItem: async (id: string, type: 'product' | 'order' | 'user' | 'expense', actor: User): Promise<void> => {
    if (actor.role !== 'admin') throw new Error('Only admins can permanently delete items.');
    if (type === 'product') await db.permanentlyDeleteProduct(id, actor);
    else if (type === 'order') await db.permanentlyDeleteOrder(id, actor);
    else if (type === 'user') await db.permanentlyDeleteUser(id, actor);
    else if (type === 'expense') await db.permanentlyDeleteExpense(id, actor);
  },

  wipeDatabase: async (actor: User): Promise<void> => {
    if (actor.role !== 'admin') throw new Error('Only admins can wipe the database.');
    if (supabase) {
      // Clear referencing tables first to prevent foreign key errors
      await supabase.from('stock_ledger').delete().neq('id', '_none_');
      await supabase.from('customer_ledger').delete().neq('id', '_none_');
      await supabase.from('orders').delete().neq('id', '_none_');
      await supabase.from('expenses').delete().neq('id', '_none_');
      await supabase.from('audit_logs').delete().neq('id', '_none_');
      await supabase.from('products').delete().neq('id', '_none_');
      await supabase.from('users').delete().neq('id', 'usr-admin');
    } else {
      const adminUser = defaultUsers.find(u => u.username === 'sysadmin') || { id: 'usr-admin', username: 'sysadmin', password: 'cfi@2024', name: 'System Admin (CFI)', role: 'admin' };
      saveLocalTable('users', [adminUser]);
      saveLocalTable('products', []);
      saveLocalTable('stock_ledger', []);
      saveLocalTable('orders', []);
      saveLocalTable('customer_ledger', []);
      saveLocalTable('expenses', []);
      saveLocalTable('audit_logs', []);
    }
    await logAction(actor.id, actor.name, actor.role, `Wiped Database`, `Entire database cleared by admin.`);
  }
};
