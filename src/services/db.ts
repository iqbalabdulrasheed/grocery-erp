// Grocery Warehouse ERP System - Database Service (Supabase primary; localStorage fallback when Supabase is not configured)
import { supabase } from './supabaseClient';

export interface User {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: 'admin' | 'superowner' | 'owner' | 'manager' | 'warehouse_manager' | 'staff' | 'delivery' | 'customer' | 'accountant';
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

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  created_at: string;
  is_active: boolean;
}

export interface WarehouseStock {
  id: string;
  warehouse_id: string;
  warehouse_name: string;
  product_id: string;
  qty: number;
}

export interface StockLedgerEntry {
  id: string;
  product_id: string;
  product_name: string;
  qty_change: number;
  type: 'purchase' | 'supplier_return' | 'customer_return' | 'manual_adjustment' | 'customer_sales' | 'damage' | 'expired' | 'dispatch' | 'transfer_in' | 'transfer_out';
  notes: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  warehouse_id?: string;
  warehouse_name?: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
  total: number;
  warehouse_id?: string;
  warehouse_name?: string;
  // For split fulfillment: array of { warehouse_id, warehouse_name, qty } when
  // stock is taken from multiple warehouses for a single item
  split_warehouses?: { warehouse_id: string; warehouse_name: string; qty: number }[];
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
  manual_discount_pct: number;
  manual_discount_amt: number;
  total: number;
  assigned_staff_id?: string | null;
  assigned_staff_name?: string | null;
  delivery_route?: string | null;
  warehouse_id?: string;
  warehouse_name?: string;
  cod_tracking: boolean;
  cod_collected?: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  removed_items?: OrderItem[];
  status_history: {
    status: Order['status'];
    updated_at: string;
    updated_by_name: string;
    notes?: string;
  }[];
}

export class OutOfStockError extends Error {
  availableItems: any[];
  outOfStockItems: any[];
  constructor(message: string, availableItems: any[], outOfStockItems: any[]) {
    super(message);
    this.name = 'OutOfStockError';
    this.availableItems = availableItems;
    this.outOfStockItems = outOfStockItems;
  }
}

export interface CompanySettings {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  vat_number: string;
  cr_number: string;
  zakat_number?: string;
  business_license_number?: string;
  logo_url?: string;
  stamp_url?: string;
  updated_at?: string;
}

export interface CustomerCompanyDetails {
  customer_id: string;
  company_name: string;
  contact_person: string;
  address: string;
  city: string;
  country: string;
  postal_code: string;
  vat_number: string;
  cr_number: string;
  phone: string;
  email: string;
  updated_at?: string;
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
  user_id?: string;
  user_name?: string;
}

export interface StockReservation {
  id: string;
  order_id: string;
  product_id: string;
  warehouse_id: string;
  qty: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface PickListItem {
  product_id: string;
  name: string;
  qty: number;
  warehouse_id: string;
  warehouse_name: string;
  picked_qty: number;
}

export interface PickList {
  id: string;
  order_id: string;
  items: PickListItem[];
  status: 'pending' | 'picking' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Dispatch {
  id: string;
  order_id: string;
  status: 'dispatched' | 'delivered' | 'failed';
  dispatched_at: string;
  delivered_at?: string | null;
  dispatched_by_id: string;
  dispatched_by_name: string;
  carrier_details?: string | null;
  notes?: string | null;
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

export const defaultCompanySettings: CompanySettings = {
  id: 'owner-company',
  name: 'Zenvora Grocery Distribution Ltd',
  address: '4259 King Abdulaziz Road',
  city: 'Riyadh',
  postal_code: '12211',
  country: 'Saudi Arabia',
  phone: '+966 11 456 7890',
  email: 'finance@zenvora.com',
  website: 'www.zenvora.com',
  vat_number: '310123456700003',
  cr_number: '1010987654',
  zakat_number: '3101234567',
  business_license_number: 'LIC-2026-8890',
  logo_url: '',
  stamp_url: ''
};

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
    const defaultWarehouse: Warehouse[] = [{ id: 'wh-main', name: 'Main Warehouse', location: '', created_at: new Date().toISOString(), is_active: true }];
    localStorage.setItem('warehouses', JSON.stringify(defaultWarehouse));
    localStorage.setItem('warehouse_stock', JSON.stringify([]));
    localStorage.setItem('stock_reservations', JSON.stringify([]));
    localStorage.setItem('pick_lists', JSON.stringify([]));
    localStorage.setItem('dispatches', JSON.stringify([]));
    localStorage.setItem('company_settings', JSON.stringify([defaultCompanySettings]));
    localStorage.setItem('customer_companies', JSON.stringify([]));
    localStorage.setItem('erp_initialized_v6', 'true');
  } else {
    // Ensure company_settings and customer_companies are initialized even if initialized_v6 was set earlier
    if (!localStorage.getItem('company_settings')) {
      localStorage.setItem('company_settings', JSON.stringify([defaultCompanySettings]));
    }
    if (!localStorage.getItem('customer_companies')) {
      localStorage.setItem('customer_companies', JSON.stringify([]));
    }
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

    // Seed default company settings if missing
    try {
      const { count: cCount } = await supabase.from('company_settings').select('*', { count: 'exact', head: true });
      if (cCount === 0) {
        await supabase.from('company_settings').insert([defaultCompanySettings]);
      }
    } catch (e) {
      // Table may not exist yet
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
      outstanding_balance: user.opening_balance || 0
    };

    if (supabase) {
      const { error } = await supabase.from('users').insert([newUser]);
      if (error) throw error;
    } else {
      const users = getLocalTable<User>('users');
      saveLocalTable('users', [...users, newUser]);
    }

    // If customer has an opening balance, seed the ledger so their balance history starts correctly
    if (newUser.role === 'customer' && newUser.opening_balance && newUser.opening_balance > 0) {
      const openingEntry: CustomerLedgerEntry = {
        id: `ldg-ob-${Date.now()}`,
        customer_id: newUser.id,
        type: 'opening',
        ref_id: newUser.id,
        amount: newUser.opening_balance,
        balance_after: newUser.opening_balance,
        timestamp: new Date().toISOString(),
        notes: `Opening balance on account creation`
      };
      if (supabase) {
        await supabase.from('customer_ledger').insert([openingEntry]);
      } else {
        const ledger = getLocalTable<CustomerLedgerEntry>('customer_ledger');
        saveLocalTable('customer_ledger', [...ledger, openingEntry]);
      }
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

  getProducts: async (includeDeleted = false): Promise<Product[]> => {
    let list: Product[] = [];
    if (supabase) {
      const query = supabase.from('products').select('*');
      const { data, error } = includeDeleted ? await query : await query.eq('is_deleted', false);
      if (error) throw error;
      list = data || [];
    } else {
      const rawList = getLocalTable<Product>('products');
      list = includeDeleted ? rawList : rawList.filter(p => !p.is_deleted);
    }
    const whStock = await db.getWarehouseStock();
    return list.map(p => {
      const qty = whStock.filter(ws => ws.product_id === p.id).reduce((sum, ws) => sum + ws.qty, 0);
      return { ...p, stock_qty: qty };
    });
  },

  getProductById: async (id: string): Promise<Product | undefined> => {
    let product: Product | undefined;
    if (supabase) {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) return undefined;
      product = data;
    } else {
      const list = getLocalTable<Product>('products');
      product = list.find(p => p.id === id);
    }
    if (product) {
      const whStock = await db.getWarehouseStock();
      const qty = whStock.filter(ws => ws.product_id === product!.id).reduce((sum, ws) => sum + ws.qty, 0);
      product.stock_qty = qty;
    }
    return product;
  },

  createProduct: async (product: Omit<Product, 'id'>, actor: User, warehouseId?: string): Promise<Product> => {
    const newProduct: Product = {
      ...product,
      id: `prod-${Date.now()}`
    };

    // Remove stock_qty before inserting into products database table
    const { stock_qty, ...dbProduct } = newProduct as any;

    if (supabase) {
      const { error } = await supabase.from('products').insert([dbProduct]);
      if (error) throw error;
    } else {
      const products = getLocalTable<Product>('products');
      saveLocalTable('products', [...products, dbProduct]);
    }

    if (newProduct.stock_qty > 0) {
      // Resolve warehouse name
      let whName: string | undefined;
      if (warehouseId) {
        const whs = await db.getWarehouses();
        whName = whs.find(w => w.id === warehouseId)?.name;
        // Init warehouse_stock entry — Supabase or localStorage
        const newWs: WarehouseStock = {
          id: `ws-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          warehouse_id: warehouseId,
          warehouse_name: whName || warehouseId,
          product_id: newProduct.id,
          qty: newProduct.stock_qty
        };
        if (supabase) {
          const { error: wsErr } = await supabase.from('warehouse_stock').insert([newWs]);
          if (wsErr) throw new Error(`warehouse_stock insert failed: ${wsErr.message}`);
        } else {
          const whStockList = getLocalTable<WarehouseStock>('warehouse_stock');
          saveLocalTable('warehouse_stock', [...whStockList, newWs]);
        }
      }
      await db.addStockLedgerEntry({
        id: `stk-${Date.now()}`,
        product_id: newProduct.id,
        product_name: newProduct.name,
        qty_change: newProduct.stock_qty,
        type: 'purchase',
        notes: 'Initial opening stock entry upon product creation',
        timestamp: new Date().toISOString(),
        user_id: actor.id,
        user_name: actor.name,
        warehouse_id: warehouseId,
        warehouse_name: whName
      });
    }

    await logAction(actor.id, actor.name, actor.role, `Created Product: ${newProduct.name}`, `SKU: ${newProduct.sku}, Cost: ${newProduct.purchase_cost} SAR`);
    return newProduct;
  },

  updateProduct: async (id: string, updates: Partial<Product>, actor: User, warehouseId?: string): Promise<Product> => {
    const original = await db.getProductById(id);
    if (!original) throw new Error("Product not found");

    // Strip stock_qty from product table updates
    const { stock_qty, ...safeUpdates } = updates as any;
    delete safeUpdates._warehouseId;

    let updatedProduct: Product;
    if (supabase) {
      if (Object.keys(safeUpdates).length === 0) {
        const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
        if (error) throw error;
        updatedProduct = data;
      } else {
        const { data, error } = await supabase.from('products').update(safeUpdates).eq('id', id).select().single();
        if (error) throw error;
        updatedProduct = data;
      }
    } else {
      const products = getLocalTable<Product>('products');
      const updatedProducts = products.map(p => (p.id === id ? { ...p, ...safeUpdates } : p));
      saveLocalTable('products', updatedProducts);
      updatedProduct = updatedProducts.find(p => p.id === id)!;
    }

    if (updates.stock_qty !== undefined && updates.stock_qty !== original.stock_qty) {
      const diff = updates.stock_qty - original.stock_qty;
      // Update warehouse_stock if a warehouse was selected
      if (warehouseId) {
        const warehouses = await db.getWarehouses();
        const wh = warehouses.find(w => w.id === warehouseId);
        if (wh) {
          if (supabase) {
            const { data: wsRows } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', warehouseId).eq('product_id', id);
            if (wsRows && wsRows.length > 0) {
              await supabase.from('warehouse_stock').update({ qty: Math.max(0, wsRows[0].qty + diff) }).eq('warehouse_id', warehouseId).eq('product_id', id);
            } else {
              await supabase.from('warehouse_stock').insert([{ id: `ws-${Date.now()}`, warehouse_id: warehouseId, warehouse_name: wh.name, product_id: id, qty: Math.max(0, diff) }]);
            }
          } else {
            const whStockList = getLocalTable<WarehouseStock>('warehouse_stock');
            const existing = whStockList.find(ws => ws.warehouse_id === warehouseId && ws.product_id === id);
            if (existing) {
              saveLocalTable('warehouse_stock', whStockList.map(ws =>
                ws.warehouse_id === warehouseId && ws.product_id === id
                  ? { ...ws, qty: Math.max(0, ws.qty + diff) }
                  : ws
              ));
            } else {
              saveLocalTable('warehouse_stock', [...whStockList, {
                id: `ws-${Date.now()}`,
                warehouse_id: warehouseId,
                warehouse_name: wh.name,
                product_id: id,
                qty: Math.max(0, diff)
              }]);
            }
          }
        }
      }
      const whName = warehouseId ? (await db.getWarehouses()).find(w => w.id === warehouseId)?.name : undefined;
      await db.addStockLedgerEntry({
        id: `stk-${Date.now()}`,
        product_id: id,
        product_name: updatedProduct.name,
        qty_change: diff,
        type: 'manual_adjustment',
        notes: 'Manual inventory stock adjust',
        timestamp: new Date().toISOString(),
        user_id: actor.id,
        user_name: actor.name,
        warehouse_id: warehouseId,
        warehouse_name: whName
      });
    }

    const whStock = await db.getWarehouseStock();
    updatedProduct.stock_qty = whStock.filter(ws => ws.product_id === id).reduce((sum, ws) => sum + ws.qty, 0);

    await logAction(actor.id, actor.name, actor.role, `Updated Product: ${updatedProduct.name}`, JSON.stringify(updates));
    return updatedProduct;
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
    actor: User,
    warehouseId?: string
  ): Promise<void> => {
    const product = await db.getProductById(productId);
    if (!product) return;

    // Update warehouse stock if warehouseId provided
    if (warehouseId) {
      const warehouses = await db.getWarehouses();
      const wh = warehouses.find(w => w.id === warehouseId);
      if (supabase) {
        const { data: wsRows } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', warehouseId).eq('product_id', productId);
        const existing = wsRows?.[0];
        if (existing) {
          await supabase.from('warehouse_stock').update({ qty: Math.max(0, existing.qty + qtyChange) }).eq('warehouse_id', warehouseId).eq('product_id', productId);
        } else {
          await supabase.from('warehouse_stock').insert([{
            id: `ws-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            warehouse_id: warehouseId,
            warehouse_name: wh?.name || warehouseId,
            product_id: productId,
            qty: Math.max(0, qtyChange)
          }]);
        }
      } else {
        const whStockList = getLocalTable<WarehouseStock>('warehouse_stock');
        const existing = whStockList.find(ws => ws.warehouse_id === warehouseId && ws.product_id === productId);
        if (existing) {
          saveLocalTable('warehouse_stock', whStockList.map(ws =>
            ws.warehouse_id === warehouseId && ws.product_id === productId
              ? { ...ws, qty: Math.max(0, ws.qty + qtyChange) }
              : ws
          ));
        } else {
          saveLocalTable('warehouse_stock', [...whStockList, {
            id: `ws-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
            warehouse_id: warehouseId,
            warehouse_name: wh?.name || warehouseId,
            product_id: productId,
            qty: Math.max(0, qtyChange)
          }]);
        }
      }
    }

    // Resolve warehouse name for ledger
    let whName: string | undefined;
    if (warehouseId) {
      const whs = await db.getWarehouses();
      whName = whs.find(w => w.id === warehouseId)?.name;
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
      user_name: actor.name,
      warehouse_id: warehouseId,
      warehouse_name: whName
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
    actor: User,
    manualDiscountPct: number = 0,
    manualDiscountAmt: number = 0,
    // Deprecated: warehouse is now chosen automatically (primary first, overflow combined
    // from other warehouses as needed). This parameter is ignored but kept so older
    // callers don't break.
    _ignoredWarehouseId?: string
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

    const afterCustomerDiscount = Number((subtotal - totalDiscount).toFixed(2));
    const manualPctDeduction = Number(((afterCustomerDiscount * manualDiscountPct) / 100).toFixed(2));
    const manualAmtDeduction = Number(Math.min(manualDiscountAmt, afterCustomerDiscount - manualPctDeduction).toFixed(2));
    const totalManualDiscount = Number((manualPctDeduction + manualAmtDeduction).toFixed(2));
    const total = Number((afterCustomerDiscount - totalManualDiscount).toFixed(2));
    
    if (customer.role === 'customer' && customer.credit_limit) {
      const currentOutstanding = customer.outstanding_balance || 0;
      if (!codTracking && (currentOutstanding + total > customer.credit_limit)) {
        throw new Error(`Order exceeds credit limit of ${customer.credit_limit} SAR. Current outstanding: ${currentOutstanding} SAR.`);
      }
    }

    let initialStatus: Order['status'] = 'created';
    if (['admin', 'superowner', 'owner', 'manager', 'warehouse_manager'].includes(actor.role)) {
      initialStatus = 'approved';
    }

    const primaryWh = await db.getPrimaryWarehouse();

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
      manual_discount_pct: manualDiscountPct,
      manual_discount_amt: manualAmtDeduction,
      total,
      warehouse_id: primaryWh?.id,
      warehouse_name: primaryWh?.name,
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
      const { error } = await supabase.from('orders').insert([newOrder]);
      if (error) throw new Error(`Failed to save order: ${error.message}`);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', [...orders, newOrder]);
    }

    await logAction(actor.id, actor.name, actor.role, `Created Order ${newOrder.id}`, `Total: ${total} SAR`);

    if (initialStatus === 'approved') {
      // Automatically decide, per item, how much comes from the primary warehouse
      // and how much (if any) needs to be combined in from other warehouses.
      const { items: assignedItems } = await db.autoAssignWarehouses(orderItems, newOrder.id);

      for (const item of assignedItems) {
        const splitWh = item.split_warehouses;
        if (splitWh && splitWh.length > 1) {
          for (const portion of splitWh) {
            if (portion.qty <= 0) continue;
            await db.createReservation({
              order_id: newOrder.id,
              product_id: item.product_id,
              warehouse_id: portion.warehouse_id,
              qty: portion.qty,
              status: 'active'
            });
            await db.addStockAdjustment(
              item.product_id,
              -portion.qty,
              'customer_sales',
              `Order ${newOrder.id} approved — moved to temp storage (${portion.warehouse_name})`,
              actor,
              portion.warehouse_id
            );
          }
        } else {
          const finalWhId = item.warehouse_id || primaryWh?.id || 'wh-main';
          const finalWhName = item.warehouse_name || primaryWh?.name || 'Main Warehouse';
          await db.createReservation({
            order_id: newOrder.id,
            product_id: item.product_id,
            warehouse_id: finalWhId,
            qty: item.qty,
            status: 'active'
          });
          await db.addStockAdjustment(
            item.product_id,
            -item.qty,
            'customer_sales',
            `Order ${newOrder.id} approved — moved to temp storage (${finalWhName})`,
            actor,
            finalWhId
          );
        }
      }

      // Persist the auto-assigned warehouse info onto the order's items so the
      // UI can show exactly where stock came from (e.g. "Combined: Main x5 + Backup x3").
      if (supabase) {
        await supabase.from('orders').update({ items: assignedItems }).eq('id', newOrder.id);
      } else {
        const orders = getLocalTable<Order>('orders');
        saveLocalTable('orders', orders.map(o => o.id === newOrder.id ? { ...o, items: assignedItems } : o));
      }
      newOrder.items = assignedItems;

      const pickItems: PickListItem[] = assignedItems.map(item => ({
        product_id: item.product_id,
        name: item.name,
        qty: item.qty,
        warehouse_id: item.warehouse_id || primaryWh?.id || 'wh-main',
        warehouse_name: item.warehouse_name || primaryWh?.name || 'Main Warehouse',
        picked_qty: 0
      }));
      await db.createPickList(newOrder.id, pickItems);
    }

    return newOrder;
  },

  updateOrderStatus: async (
    orderId: string,
    newStatus: Order['status'],
    actor: User,
    meta?: { assignedStaffId?: string; deliveryRoute?: string; codCollected?: boolean; cancelReason?: string }
  ): Promise<Order> => {
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    // Items with their warehouse assignment freshly computed (primary warehouse first,
    // combined with overflow from other warehouses if the primary doesn't have enough).
    // Computed once here and reused for both stock validation and the actual deduction
    // below, so what we check is exactly what we apply.
    let autoAssigned: OrderItem[] | null = null;

    // SECURE ORDER APPROVAL TRANSACTION (STOCK VALIDATION FIRST)
    // NOTE: We bypass the approve_order_secure RPC entirely because it only checks
    // the primary warehouse and does raw stock deduction without Math.max(0) guards,
    // causing negative stock. All approval logic runs client-side via autoAssignWarehouses
    // which correctly combines all warehouses and floors at 0.
    if (order.status === 'created' && newStatus === 'approved') {

      // Client-side/LocalStorage Stock Validation.
      // Automatically combine primary warehouse stock with overflow from other
      // warehouses as needed — no manual warehouse choice required.
      const { items: assigned, insufficientProductIds, availableQtyMap } = await db.autoAssignWarehouses(order.items, orderId);
      autoAssigned = assigned;

      if (insufficientProductIds.length > 0) {
        const insufficientSet = new Set(insufficientProductIds);
        const availableItems = order.items.filter(item => !insufficientSet.has(item.product_id));
        const outOfStockItems = order.items
          .filter(item => insufficientSet.has(item.product_id))
          .map(item => {
            const avail = availableQtyMap[item.product_id];
            return { ...item, availableQty: (typeof avail === 'number' && avail > 0) ? avail : 0 };
          });
        throw new OutOfStockError("Some products are out of stock.", availableItems, outOfStockItems);
      }
    }

    const historyEntry: any = { status: newStatus, updated_at: new Date().toISOString(), updated_by_name: actor.name };
    if (meta?.cancelReason) historyEntry.notes = meta.cancelReason;

    const updated = {
      ...order,
      // Persist the auto-computed warehouse assignment onto the items (e.g. so the UI
      // can show "Combined: Main x5 + Backup x3") when we just approved the order.
      items: autoAssigned || order.items,
      status: newStatus,
      status_history: [
        ...order.status_history,
        historyEntry
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

    if (order.status === 'created' && newStatus === 'approved' && autoAssigned) {
      const pickItems: PickListItem[] = [];
      for (const item of autoAssigned) {
        const splitWh = item.split_warehouses;

        if (splitWh && splitWh.length > 1) {
          // Combined fulfillment: deduct each portion from its warehouse and
          // create a reservation per portion.
          for (const portion of splitWh) {
            if (portion.qty <= 0) continue;
            await db.createReservation({
              order_id: orderId,
              product_id: item.product_id,
              warehouse_id: portion.warehouse_id,
              qty: portion.qty,
              status: 'active'
            });
            await db.addStockAdjustment(
              item.product_id,
              -portion.qty,
              'customer_sales',
              `Order ${orderId} approved — moved to temp storage (${portion.warehouse_name})`,
              actor,
              portion.warehouse_id
            );
          }
          pickItems.push({
            product_id: item.product_id,
            name: item.name,
            qty: item.qty,
            warehouse_id: item.warehouse_id || splitWh[0].warehouse_id,
            warehouse_name: `Combined: ${splitWh.map(p => `${p.warehouse_name} ×${p.qty}`).join(' + ')}`,
            picked_qty: 0
          });
        } else {
          const finalWhId = item.warehouse_id || 'wh-main';
          const finalWhName = item.warehouse_name || 'Main Warehouse';
          await db.createReservation({
            order_id: orderId,
            product_id: item.product_id,
            warehouse_id: finalWhId,
            qty: item.qty,
            status: 'active'
          });
          await db.addStockAdjustment(
            item.product_id,
            -item.qty,
            'customer_sales',
            `Order ${orderId} approved — moved to temp storage (${finalWhName})`,
            actor,
            finalWhId
          );
          pickItems.push({
            product_id: item.product_id,
            name: item.name,
            qty: item.qty,
            warehouse_id: finalWhId,
            warehouse_name: finalWhName,
            picked_qty: 0
          });
        }
      }
      // Guard: only create pick list if one doesn't already exist for this order
      const existingPls = await db.getPickLists();
      const alreadyHasPickList = existingPls.some(p => p.order_id === orderId);
      if (!alreadyHasPickList) {
        await db.createPickList(orderId, pickItems);
      }
    }

    if (newStatus === 'packing') {
      const pls = await db.getPickLists();
      const pl = pls.find(p => p.order_id === orderId && p.status === 'pending');
      if (pl) {
        await db.updatePickList(pl.id, { status: 'picking' });
      }
    }

    if (newStatus === 'assigned') {
      const pls = await db.getPickLists();
      const pl = pls.find(p => p.order_id === orderId && ['pending', 'picking'].includes(p.status));
      if (pl) {
        const updatedItems = pl.items.map(item => ({ ...item, picked_qty: item.qty }));
        await db.updatePickList(pl.id, { status: 'completed', items: updatedItems });
      }
    }

    if (newStatus === 'out_for_delivery') {
      // Stock was already deducted from warehouse at approval (moved to temp storage).
      // At dispatch we just record the dispatch event and close out reservations.
      await db.createDispatch({
        order_id: orderId,
        status: 'dispatched',
        dispatched_by_id: actor.id,
        dispatched_by_name: actor.name,
        carrier_details: updated.delivery_route || 'Standard Route',
        notes: `Dispatched by ${actor.name}`
      });

      const reservations = await db.getReservations();
      const activeRes = reservations.filter(r => r.order_id === orderId && r.status === 'active');
      for (const r of activeRes) {
        await db.updateReservationStatus(r.id, 'completed');
      }

      // Log dispatch ledger entries (informational — no stock qty change, already deducted)
      for (const item of updated.items) {
        const splitWh = (item as any).split_warehouses as { warehouse_id: string; warehouse_name: string; qty: number }[] | undefined;
        const itemWarehouse = (item as any).warehouse_id || updated.warehouse_id;
        const whLabel = splitWh ? splitWh.map(p => p.warehouse_name).join(', ') : (itemWarehouse || 'warehouse');
        await logAction(actor.id, actor.name, actor.role, `Dispatched Order ${orderId}`, `${item.name} ×${item.qty} from ${whLabel}`);
      }

      const pls = await db.getPickLists();
      const pl = pls.find(p => p.order_id === orderId && p.status !== 'completed');
      if (pl) {
        await db.updatePickList(pl.id, { status: 'completed' });
      }
    }

    if (newStatus === 'delivered') {
      const dps = await db.getDispatches();
      const dp = dps.find(d => d.order_id === orderId && d.status === 'dispatched');
      if (dp) {
        if (supabase) {
          await supabase.from('dispatches').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', dp.id);
        } else {
          const list = getLocalTable<Dispatch>('dispatches');
          saveLocalTable('dispatches', list.map(d => d.id === dp.id ? { ...d, status: 'delivered', delivered_at: new Date().toISOString() } : d));
        }
      }
    }

    if (newStatus === 'failed') {
      const wasApproved = ['approved', 'packing', 'assigned'].includes(order.status);
      const wasDispatched = order.status === 'out_for_delivery' || order.status === 'delivered';

      if (wasApproved) {
        // Stock was deducted at approval (temp storage). Return it back to the warehouse now.
        const reservations = await db.getReservations();
        const activeRes = reservations.filter(r => r.order_id === orderId && r.status === 'active');
        for (const r of activeRes) {
          await db.updateReservationStatus(r.id, 'cancelled');
          // Return stock from temp storage back to warehouse
          await db.addStockAdjustment(
            r.product_id,
            r.qty,
            'customer_return',
            `Order ${orderId} cancelled before dispatch — stock returned to warehouse`,
            actor,
            r.warehouse_id
          );
        }

        const pls = await db.getPickLists();
        const pl = pls.find(p => p.order_id === orderId);
        if (pl) {
          await db.updatePickList(pl.id, { status: 'cancelled' });
        }

        // Write STOCK_RESTORED marker so the Returns tab sees this order as already
        // handled and does NOT show the "Return to Stock" button — preventing double-returns.
        const restoredMarker = {
          status: 'failed' as const,
          updated_at: new Date().toISOString(),
          updated_by_name: `STOCK_RESTORED:${actor.name}`
        };
        updated.status_history = [...updated.status_history, restoredMarker];
        if (supabase) {
          await supabase.from('orders').update({ status_history: updated.status_history }).eq('id', orderId);
        } else {
          const orders = getLocalTable<Order>('orders');
          saveLocalTable('orders', orders.map(o => o.id === orderId ? { ...o, status_history: updated.status_history } : o));
        }
      } else if (wasDispatched) {
        // Order was already dispatched — mark dispatch as failed.
        // Stock return handled manually via Returns tab.
        const dps = await db.getDispatches();
        const dp = dps.find(d => d.order_id === orderId && d.status === 'dispatched');
        if (dp) {
          if (supabase) {
            await supabase.from('dispatches').update({ status: 'failed' }).eq('id', dp.id);
          } else {
            const list = getLocalTable<Dispatch>('dispatches');
            saveLocalTable('dispatches', list.map(d => d.id === dp.id ? { ...d, status: 'failed' } : d));
          }
        }
      } else {
        // created status — stock was never deducted, just clean up
        const reservations = await db.getReservations();
        const activeRes = reservations.filter(r => r.order_id === orderId && r.status === 'active');
        for (const r of activeRes) {
          await db.updateReservationStatus(r.id, 'cancelled');
        }
        const pls = await db.getPickLists();
        const pl = pls.find(p => p.order_id === orderId);
        if (pl) await db.updatePickList(pl.id, { status: 'cancelled' });
      }
    }

    if (newStatus === 'delivered') {
      const customer = await db.getUserById(updated.customer_id);
      if (customer && customer.role === 'customer' && !updated.cod_tracking) {
        // Only add to outstanding balance for credit/invoice orders.
        // COD orders are paid at the door — no balance increase.
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

  updateOrderWarehouse: async (orderId: string, warehouseId: string, warehouseName: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('orders').update({ warehouse_id: warehouseId, warehouse_name: warehouseName }).eq('id', orderId);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === orderId ? { ...o, warehouse_id: warehouseId, warehouse_name: warehouseName } : o));
    }
    await logAction(actor.id, actor.name, actor.role, `Set warehouse for Order ${orderId} to: ${warehouseName}`);
  },

  saveOrderItemWarehouses: async (
    orderId: string,
    itemSelections: Record<string, { warehouseId: string; warehouseName: string; splitWarehouses?: { warehouse_id: string; warehouse_name: string; qty: number }[] }>,
    actor: User
  ): Promise<void> => {
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');
    const updatedItems = order.items.map(item => {
      const sel = itemSelections[item.product_id];
      if (!sel) return item;
      const base = { ...item, warehouse_id: sel.warehouseId, warehouse_name: sel.warehouseName };
      if (sel.splitWarehouses && sel.splitWarehouses.length > 1) {
        return { ...base, split_warehouses: sel.splitWarehouses };
      }
      // Single warehouse — clear any stale split data
      const { split_warehouses, ...clean } = base as any;
      return clean;
    });
    if (supabase) {
      await supabase.from('orders').update({ items: updatedItems }).eq('id', orderId);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === orderId ? { ...o, items: updatedItems } : o));
    }
    await logAction(actor.id, actor.name, actor.role, `Assigned per-item warehouses for Order ${orderId}`);
  },

  updateOrderItems: async (orderId: string, items: any[], actor: User): Promise<void> => {
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    // Recalculate order totals based on updated item quantities
    const newSubtotal = Number(items.reduce((sum: number, item: any) => {
      // Reconstruct subtotal from unit_price (which already has customer discount baked in)
      // We need the original selling price — approximate from unit_price and discount ratio
      // Safest: use item.total directly as the line total
      return sum + Number((item.unit_price * item.qty).toFixed(2));
    }, 0).toFixed(2));

    // Preserve original discount proportionally
    const originalRatio = order.subtotal > 0 ? order.discount / order.subtotal : 0;
    const newDiscount = Number((newSubtotal * originalRatio).toFixed(2));
    const afterDiscount = Number((newSubtotal - newDiscount).toFixed(2));
    const manualPct = Number(((afterDiscount * (order.manual_discount_pct || 0)) / 100).toFixed(2));
    const manualAmt = Number(Math.min(order.manual_discount_amt || 0, afterDiscount - manualPct).toFixed(2));
    const newTotal = Number((afterDiscount - manualPct - manualAmt).toFixed(2));

    // Update item totals to match recalculated unit_price * qty
    const recalcItems = items.map((item: any) => ({
      ...item,
      total: Number((item.unit_price * item.qty).toFixed(2))
    }));

    const updates = {
      items: recalcItems,
      subtotal: newSubtotal,
      discount: newDiscount,
      total: Math.max(0, newTotal)
    };

    if (supabase) {
      await supabase.from('orders').update(updates).eq('id', orderId);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === orderId ? { ...o, ...updates } : o));
    }
    await logAction(actor.id, actor.name, actor.role, `Updated items for Order ${orderId}`, `Partial fulfillment qty adjustment — new total: ${updates.total} SAR`);
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
    const newBalance = Number(Math.max(0, currentBalance - amount).toFixed(2));

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
    const isFullAccess = ['admin', 'superowner'].includes(actor.role);
    if (supabase) {
      const query = supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
      const { data, error } = isFullAccess ? await query : await query.eq('is_admin_only', false);
      if (error) throw error;
      return data || [];
    } else {
      const logs = getLocalTable<AuditLog>('audit_logs');
      return isFullAccess ? logs : logs.filter(l => !l.is_admin_only);
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
    if (!['admin', 'superowner'].includes(actor.role)) throw new Error('Only admins and superowners can permanently delete items.');
    if (type === 'product') await db.permanentlyDeleteProduct(id, actor);
    else if (type === 'order') await db.permanentlyDeleteOrder(id, actor);
    else if (type === 'user') await db.permanentlyDeleteUser(id, actor);
    else if (type === 'expense') await db.permanentlyDeleteExpense(id, actor);
  },

  // WAREHOUSES
  getWarehouses: async (): Promise<Warehouse[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('warehouses').select('*').eq('is_active', true);
      if (error) return getLocalTable<Warehouse>('warehouses').filter(w => w.is_active);
      return data || [];
    } else {
      const list = getLocalTable<Warehouse>('warehouses');
      if (list.length === 0) {
        const def: Warehouse[] = [{ id: 'wh-main', name: 'Main Warehouse', location: '', created_at: new Date().toISOString(), is_active: true }];
        saveLocalTable('warehouses', def);
        return def;
      }
      return list.filter(w => w.is_active);
    }
  },

  createWarehouse: async (name: string, location: string, actor: User): Promise<Warehouse> => {
    const wh: Warehouse = {
      id: `wh-${Date.now()}`,
      name,
      location,
      created_at: new Date().toISOString(),
      is_active: true
    };
    if (supabase) {
      const { error } = await supabase.from('warehouses').insert([wh]);
      if (error) throw error;
    } else {
      const list = getLocalTable<Warehouse>('warehouses');
      saveLocalTable('warehouses', [...list, wh]);
    }
    await logAction(actor.id, actor.name, actor.role, `Created Warehouse: ${name}`, `Location: ${location}`);
    return wh;
  },

  updateWarehouse: async (id: string, updates: Partial<Warehouse>, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('warehouses').update(updates).eq('id', id);
    } else {
      const list = getLocalTable<Warehouse>('warehouses');
      saveLocalTable('warehouses', list.map(w => w.id === id ? { ...w, ...updates } : w));
    }
    await logAction(actor.id, actor.name, actor.role, `Updated Warehouse ${id}`, JSON.stringify(updates));
  },

  deleteWarehouse: async (id: string, actor: User): Promise<void> => {
    if (supabase) {
      await supabase.from('warehouses').update({ is_active: false }).eq('id', id);
    } else {
      const list = getLocalTable<Warehouse>('warehouses');
      saveLocalTable('warehouses', list.map(w => w.id === id ? { ...w, is_active: false } : w));
    }
    await logAction(actor.id, actor.name, actor.role, `Deactivated Warehouse ${id}`, '', true);
  },

  getWarehouseStock: async (): Promise<WarehouseStock[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('warehouse_stock').select('*');
      if (error) throw error;
      return data || [];
    }
    return getLocalTable<WarehouseStock>('warehouse_stock');
  },

  // The PRIMARY warehouse is simply the oldest (first-created) active warehouse.
  // Everything is fulfilled from here first; any extra warehouses are only used
  // automatically as overflow when the primary doesn't have enough stock.
  getPrimaryWarehouse: async (): Promise<Warehouse | undefined> => {
    const whs = await db.getWarehouses();
    if (whs.length === 0) return undefined;
    return [...whs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
  },

  // Decides where each order item's stock should come from, automatically:
  // 1) Take as much as possible from the primary warehouse.
  // 2) If that's not enough, pull the remainder from other warehouses (the ones
  //    with the most free stock first) and combine them.
  // Returns the items annotated with warehouse_id/warehouse_name (and split_warehouses
  // when more than one warehouse was needed), plus a flag for any item that still
  // can't be fully covered even after combining every warehouse.
  autoAssignWarehouses: async (
    items: OrderItem[],
    excludeOrderId?: string
  ): Promise<{ items: OrderItem[]; insufficientProductIds: string[]; availableQtyMap: Record<string, number> }> => {
    const warehouses = await db.getWarehouses();
    const primary = await db.getPrimaryWarehouse();
    const warehouseStock = await db.getWarehouseStock();

    const freeQty = (warehouseId: string, productId: string): number => {
      const row = warehouseStock.find(ws => ws.warehouse_id === warehouseId && ws.product_id === productId);
      return row ? Math.max(0, row.qty) : 0;
    };

    const insufficientProductIds: string[] = [];
    const availableQtyMap: Record<string, number> = {}; // product_id → total available across all warehouses

    const resolvedItems = items.map(item => {
      const remainingWarehouses = warehouses
        .filter(w => w.id !== primary?.id)
        .map(w => ({ warehouse_id: w.id, warehouse_name: w.name, free: freeQty(w.id, item.product_id) }))
        .sort((a, b) => b.free - a.free);

      const portions: { warehouse_id: string; warehouse_name: string; qty: number }[] = [];
      let stillNeeded = item.qty;

      if (primary) {
        const fromPrimary = Math.min(stillNeeded, freeQty(primary.id, item.product_id));
        if (fromPrimary > 0) {
          portions.push({ warehouse_id: primary.id, warehouse_name: primary.name, qty: fromPrimary });
          stillNeeded -= fromPrimary;
        }
      }

      for (const wh of remainingWarehouses) {
        if (stillNeeded <= 0) break;
        const take = Math.min(stillNeeded, wh.free);
        if (take > 0) {
          portions.push({ warehouse_id: wh.warehouse_id, warehouse_name: wh.warehouse_name, qty: take });
          stillNeeded -= take;
        }
      }

      if (stillNeeded > 0) {
        insufficientProductIds.push(item.product_id);
        // Track how much IS available (ordered qty minus shortfall)
        availableQtyMap[item.product_id] = item.qty - stillNeeded;
      }

      if (portions.length === 0) {
        // No stock anywhere — fall back to primary (or wh-main) so the rest of the
        // pipeline has a warehouse to point at; OUT_OF_STOCK handling catches this.
        const fallback = primary || { id: 'wh-main', name: 'Main Warehouse' };
        return { ...item, warehouse_id: fallback.id, warehouse_name: fallback.name, split_warehouses: undefined };
      }

      if (portions.length === 1) {
        return { ...item, warehouse_id: portions[0].warehouse_id, warehouse_name: portions[0].warehouse_name, split_warehouses: undefined };
      }

      return {
        ...item,
        warehouse_id: portions[0].warehouse_id,
        warehouse_name: `Combined: ${portions.map(p => `${p.warehouse_name} ×${p.qty}`).join(' + ')}`,
        split_warehouses: portions
      };
    });

    return { items: resolvedItems, insufficientProductIds, availableQtyMap };
  },

  transferStock: async (productId: string, fromWarehouseId: string, toWarehouseId: string, qty: number, actor: User): Promise<void> => {
    const product = await db.getProductById(productId);
    if (!product) throw new Error('Product not found');

    const whs = await db.getWarehouses();
    const fromWh = whs.find(w => w.id === fromWarehouseId);
    const toWh = whs.find(w => w.id === toWarehouseId);

    // Compute how much of fromWarehouse stock is already reserved (active reservations)
    const allReservations = await db.getReservations();
    const reservedInSource = allReservations
      .filter(r => r.status === 'active' && r.product_id === productId && r.warehouse_id === fromWarehouseId)
      .reduce((sum, r) => sum + r.qty, 0);

    if (supabase) {
      // Check source stock — only allow transferring freely-available (unreserved) qty
      const { data: fromRows } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', fromWarehouseId).eq('product_id', productId);
      const fromStock = fromRows?.[0];
      const physicalQty = fromStock?.qty ?? 0;
      const freeQty = Math.max(0, physicalQty - reservedInSource);
      if (!fromStock || freeQty < qty) throw new Error(`Insufficient free stock in source warehouse (physical: ${physicalQty}, reserved: ${reservedInSource}, available to transfer: ${freeQty})`);

      // Deduct from source
      await supabase.from('warehouse_stock').update({ qty: fromStock.qty - qty }).eq('warehouse_id', fromWarehouseId).eq('product_id', productId);

      // Add to destination (upsert)
      const { data: toRows } = await supabase.from('warehouse_stock').select('*').eq('warehouse_id', toWarehouseId).eq('product_id', productId);
      const toStock = toRows?.[0];
      if (toStock) {
        await supabase.from('warehouse_stock').update({ qty: toStock.qty + qty }).eq('warehouse_id', toWarehouseId).eq('product_id', productId);
      } else {
        await supabase.from('warehouse_stock').insert([{
          id: `ws-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          warehouse_id: toWarehouseId,
          warehouse_name: toWh?.name || toWarehouseId,
          product_id: productId,
          qty
        }]);
      }
    } else {
      const whStockList = getLocalTable<WarehouseStock>('warehouse_stock');
      const fromStock = whStockList.find(ws => ws.warehouse_id === fromWarehouseId && ws.product_id === productId);
      const physicalQtyLocal = fromStock?.qty ?? 0;
      const freeQtyLocal = Math.max(0, physicalQtyLocal - reservedInSource);
      if (!fromStock || freeQtyLocal < qty) throw new Error(`Insufficient free stock in source warehouse (physical: ${physicalQtyLocal}, reserved: ${reservedInSource}, available to transfer: ${freeQtyLocal})`);

      // Deduct from source
      saveLocalTable('warehouse_stock', whStockList.map(ws =>
        ws.warehouse_id === fromWarehouseId && ws.product_id === productId ? { ...ws, qty: ws.qty - qty } : ws
      ));

      // Add to destination
      const updatedList = getLocalTable<WarehouseStock>('warehouse_stock');
      const toStock = updatedList.find(ws => ws.warehouse_id === toWarehouseId && ws.product_id === productId);
      if (toStock) {
        saveLocalTable('warehouse_stock', updatedList.map(ws =>
          ws.warehouse_id === toWarehouseId && ws.product_id === productId ? { ...ws, qty: ws.qty + qty } : ws
        ));
      } else {
        saveLocalTable('warehouse_stock', [...updatedList, {
          id: `ws-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
          warehouse_id: toWarehouseId,
          warehouse_name: toWh?.name || toWarehouseId,
          product_id: productId,
          qty
        }]);
      }
    }

    const ts = new Date().toISOString();
    await db.addStockLedgerEntry({ id: `stk-${Date.now()}a`, product_id: productId, product_name: product.name, qty_change: -qty, type: 'transfer_out', notes: `Transfer to ${toWh?.name}`, timestamp: ts, user_id: actor.id, user_name: actor.name, warehouse_id: fromWarehouseId, warehouse_name: fromWh?.name });
    await db.addStockLedgerEntry({ id: `stk-${Date.now()}b`, product_id: productId, product_name: product.name, qty_change: qty, type: 'transfer_in', notes: `Transfer from ${fromWh?.name}`, timestamp: ts, user_id: actor.id, user_name: actor.name, warehouse_id: toWarehouseId, warehouse_name: toWh?.name });
    await logAction(actor.id, actor.name, actor.role, `Stock Transfer: ${product.name} x${qty}`, `From: ${fromWh?.name} → To: ${toWh?.name}`);
  },

  // RESERVATIONS
  getReservations: async (): Promise<StockReservation[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('stock_reservation').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalTable<StockReservation>('stock_reservations');
    }
  },

  createReservation: async (reservation: Omit<StockReservation, 'id' | 'created_at'>): Promise<StockReservation> => {
    const newRes: StockReservation = {
      ...reservation,
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString()
    };
    if (supabase) {
      const { error } = await supabase.from('stock_reservation').insert([newRes]);
      if (error) throw error;
    } else {
      const list = getLocalTable<StockReservation>('stock_reservations');
      saveLocalTable('stock_reservations', [newRes, ...list]);
    }
    return newRes;
  },

  updateReservationStatus: async (id: string, status: StockReservation['status']): Promise<void> => {
    if (supabase) {
      const { error } = await supabase.from('stock_reservation').update({ status }).eq('id', id);
      if (error) throw error;
    } else {
      const list = getLocalTable<StockReservation>('stock_reservations');
      saveLocalTable('stock_reservations', list.map(r => r.id === id ? { ...r, status } : r));
    }
  },

  // PICK LISTS
  getPickLists: async (): Promise<PickList[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('pick_lists').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalTable<PickList>('pick_lists');
    }
  },

  createPickList: async (orderId: string, items: PickListItem[]): Promise<PickList> => {
    const newPl: PickList = {
      id: `PKL-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`,
      order_id: orderId,
      items,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    if (supabase) {
      const { error } = await supabase.from('pick_lists').insert([newPl]);
      if (error) throw error;
    } else {
      const list = getLocalTable<PickList>('pick_lists');
      saveLocalTable('pick_lists', [newPl, ...list]);
    }
    return newPl;
  },

  updatePickList: async (id: string, updates: Partial<PickList>): Promise<PickList> => {
    if (supabase) {
      const { data, error } = await supabase.from('pick_lists').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    } else {
      const list = getLocalTable<PickList>('pick_lists');
      const updatedList = list.map(pl => pl.id === id ? { ...pl, ...updates } : pl);
      saveLocalTable('pick_lists', updatedList);
      return updatedList.find(pl => pl.id === id)!;
    }
  },

  // DISPATCHES
  getDispatches: async (): Promise<Dispatch[]> => {
    if (supabase) {
      const { data, error } = await supabase.from('dispatches').select('*').order('dispatched_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } else {
      return getLocalTable<Dispatch>('dispatches');
    }
  },

  createDispatch: async (dispatch: Omit<Dispatch, 'id' | 'dispatched_at'>): Promise<Dispatch> => {
    const newDp: Dispatch = {
      ...dispatch,
      id: `DSP-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 10)}`,
      dispatched_at: new Date().toISOString()
    };
    if (supabase) {
      const { error } = await supabase.from('dispatches').insert([newDp]);
      if (error) throw error;
    } else {
      const list = getLocalTable<Dispatch>('dispatches');
      saveLocalTable('dispatches', [newDp, ...list]);
    }
    return newDp;
  },

  wipeDatabase: async (actor: User): Promise<void> => {
    if (actor.role !== 'admin') throw new Error('Only admins can wipe the database.');
    if (supabase) {
      // Clear referencing tables first to prevent foreign key errors
      await supabase.from('stock_ledger').delete().neq('id', '_none_');
      await supabase.from('customer_ledger').delete().neq('id', '_none_');
      await supabase.from('stock_reservation').delete().neq('id', '_none_');
      await supabase.from('pick_lists').delete().neq('id', '_none_');
      await supabase.from('dispatches').delete().neq('id', '_none_');
      await supabase.from('orders').delete().neq('id', '_none_');
      await supabase.from('expenses').delete().neq('id', '_none_');
      await supabase.from('audit_logs').delete().neq('id', '_none_');
      await supabase.from('warehouse_stock').delete().neq('id', '_none_');
      await supabase.from('warehouses').delete().neq('id', '_none_');
      await supabase.from('products').delete().neq('id', '_none_');
      await supabase.from('users').delete().neq('id', 'usr-admin');
      // Also clear settings
      await supabase.from('company_settings').delete().neq('id', '_none_');
      await supabase.from('customer_companies').delete().neq('customer_id', '_none_');
    } else {
      const adminUser = defaultUsers.find(u => u.username === 'sysadmin') || { id: 'usr-admin', username: 'sysadmin', password: 'cfi@2024', name: 'System Admin (CFI)', role: 'admin' };
      saveLocalTable('users', [adminUser]);
      saveLocalTable('products', []);
      saveLocalTable('stock_ledger', []);
      saveLocalTable('orders', []);
      saveLocalTable('customer_ledger', []);
      saveLocalTable('expenses', []);
      saveLocalTable('audit_logs', []);
      const defaultWh: Warehouse[] = [{ id: 'wh-main', name: 'Main Warehouse', location: '', created_at: new Date().toISOString(), is_active: true }];
      saveLocalTable('warehouses', defaultWh);
      saveLocalTable('warehouse_stock', []);
      saveLocalTable('stock_reservations', []);
      saveLocalTable('pick_lists', []);
      saveLocalTable('dispatches', []);
      saveLocalTable('company_settings', [defaultCompanySettings]);
      saveLocalTable('customer_companies', []);
    }
    await logAction(actor.id, actor.name, actor.role, `Wiped Database`, `Entire database cleared by admin.`);
  },

  getCompanySettings: async (): Promise<CompanySettings> => {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('company_settings').select('*').eq('id', 'owner-company').single();
        if (error) {
          await supabase.from('company_settings').insert([defaultCompanySettings]);
          return defaultCompanySettings;
        }
        return data;
      } catch (err) {
        return defaultCompanySettings;
      }
    } else {
      const list = getLocalTable<CompanySettings>('company_settings');
      if (list.length === 0) {
        saveLocalTable('company_settings', [defaultCompanySettings]);
        return defaultCompanySettings;
      }
      return list[0];
    }
  },

  updateCompanySettings: async (updates: Partial<CompanySettings>, actor: User): Promise<CompanySettings> => {
    if (supabase) {
      const { data, error } = await supabase.from('company_settings').update(updates).eq('id', 'owner-company').select().single();
      if (error) throw error;
      await logAction(actor.id, actor.name, actor.role, `Updated Company Settings`, JSON.stringify(updates));
      return data;
    } else {
      const list = getLocalTable<CompanySettings>('company_settings');
      const updated = { ...(list[0] || defaultCompanySettings), ...updates };
      saveLocalTable('company_settings', [updated]);
      await logAction(actor.id, actor.name, actor.role, `Updated Company Settings`, JSON.stringify(updates));
      return updated;
    }
  },

  getCustomerCompanyDetails: async (customerId: string): Promise<CustomerCompanyDetails | undefined> => {
    if (supabase) {
      const { data, error } = await supabase.from('customer_companies').select('*').eq('customer_id', customerId).single();
      if (error) return undefined;
      return data;
    } else {
      const list = getLocalTable<CustomerCompanyDetails>('customer_companies');
      return list.find(cc => cc.customer_id === customerId);
    }
  },

  updateCustomerCompanyDetails: async (customerId: string, details: Partial<CustomerCompanyDetails>, actor: User): Promise<CustomerCompanyDetails> => {
    const defaultDetails: CustomerCompanyDetails = {
      customer_id: customerId,
      company_name: '',
      contact_person: actor.name,
      address: '',
      city: '',
      country: 'Saudi Arabia',
      postal_code: '',
      vat_number: '',
      cr_number: '',
      phone: '',
      email: ''
    };

    if (supabase) {
      const { data: existing } = await supabase.from('customer_companies').select('*').eq('customer_id', customerId).single();
      let res;
      if (existing) {
        const { data, error } = await supabase.from('customer_companies').update(details).eq('customer_id', customerId).select().single();
        if (error) throw error;
        res = data;
      } else {
        const { data, error } = await supabase.from('customer_companies').insert([{ ...defaultDetails, ...details }]).select().single();
        if (error) throw error;
        res = data;
      }
      await logAction(actor.id, actor.name, actor.role, `Updated Customer Company Details for user: ${customerId}`, JSON.stringify(details));
      return res;
    } else {
      const list = getLocalTable<CustomerCompanyDetails>('customer_companies');
      const existing = list.find(cc => cc.customer_id === customerId);
      let updated: CustomerCompanyDetails;
      if (existing) {
        updated = { ...existing, ...details };
      } else {
        updated = { ...defaultDetails, ...details };
      }
      const nextList = list.filter(cc => cc.customer_id !== customerId);
      saveLocalTable('customer_companies', [...nextList, updated]);
      await logAction(actor.id, actor.name, actor.role, `Updated Customer Company Details for user: ${customerId}`, JSON.stringify(details));
      return updated;
    }
  },

  approveOrderAvailableItems: async (
    orderId: string,
    availableItems: OrderItem[],
    outOfStockItems: OrderItem[],
    actor: User
  ): Promise<Order> => {
    // Try the Supabase RPC first — but verify it actually approved the order before trusting it
    if (supabase) {
      try {
        const { data, error } = await supabase.rpc('approve_order_partial_secure', {
          p_order_id: orderId,
          p_available_items: availableItems,
          p_out_of_stock_items: outOfStockItems,
          p_actor_id: actor.id,
          p_actor_name: actor.name,
          p_actor_role: actor.role
        });
        if (error) throw error;
        // Re-fetch the order to confirm it was actually approved by the RPC
        const verified = await db.getOrderById(orderId);
        if (verified && verified.status === 'approved') {
          return verified;
        }
        // RPC ran but didn't approve — fall through to client-side logic below
        console.warn('approve_order_partial_secure RPC ran but order is still not approved — running client-side fallback');
      } catch (err) {
        console.warn("Secure partial approval RPC failed or missing, falling back to client-side database writes:", err);
      }
    }

    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const customer = await db.getUserById(order.customer_id);
    if (!customer) throw new Error('Customer not found');

    // Recalculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    const recalculatedItems: OrderItem[] = [];

    for (const item of availableItems) {
      const prod = await db.getProductById(item.product_id);
      if (!prod) throw new Error(`Product ${item.product_id} not found`);

      const defaultPrice = prod.selling_price;
      const finalPrice = db.calculateCustomerPrice(customer, prod);
      const discountVal = defaultPrice - finalPrice;

      const itemTotal = Number((finalPrice * item.qty).toFixed(2));
      subtotal += Number((defaultPrice * item.qty).toFixed(2));
      totalDiscount += Number((discountVal * item.qty).toFixed(2));

      recalculatedItems.push({
        ...item,
        unit_price: finalPrice,
        total: itemTotal
      });
    }

    const afterCustomerDiscount = Number((subtotal - totalDiscount).toFixed(2));
    const manualPctDeduction = Number(((afterCustomerDiscount * order.manual_discount_pct) / 100).toFixed(2));
    const manualAmtDeduction = Number(Math.min(order.manual_discount_amt, afterCustomerDiscount - manualPctDeduction).toFixed(2));
    const total = Number((afterCustomerDiscount - (manualPctDeduction + manualAmtDeduction)).toFixed(2));

    // Automatically decide, per item, how much comes from the primary warehouse
    // and how much (if any) needs to be combined in from other warehouses.
    const { items: assignedItems } = await db.autoAssignWarehouses(recalculatedItems, orderId);

    const removedSummary = outOfStockItems.map(i => `${i.name} ×${i.qty}`).join(', ');
    const historyEntry = {
      status: 'approved' as const,
      updated_at: new Date().toISOString(),
      updated_by_name: actor.name,
      notes: `Approved available items only. Removed out-of-stock: ${removedSummary}`
    };

    const updatedOrder: Order = {
      ...order,
      items: assignedItems,
      removed_items: outOfStockItems,
      subtotal,
      discount: totalDiscount,
      manual_discount_amt: manualAmtDeduction,
      total,
      status: 'approved',
      status_history: [...order.status_history, historyEntry]
    };

    if (supabase) {
      // Only send the fields that changed — avoids Supabase rejecting unknown/computed columns
      const { error: updateErr } = await supabase.from('orders').update({
        items: updatedOrder.items,
        removed_items: updatedOrder.removed_items,
        subtotal: updatedOrder.subtotal,
        discount: updatedOrder.discount,
        manual_discount_amt: updatedOrder.manual_discount_amt,
        total: updatedOrder.total,
        status: 'approved',
        status_history: updatedOrder.status_history,
      }).eq('id', orderId);
      if (updateErr) throw new Error(`Failed to update order: ${updateErr.message}`);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === orderId ? updatedOrder : o));
    }

    // Now perform stock adjustments and reservations for approved items
    // Guard: before deducting, verify we haven't already created reservations for this order
    // (prevents double-deduction if the Supabase RPC partially succeeded)
    const existingReservations = await db.getReservations();
    const alreadyReservedProductIds = new Set(
      existingReservations
        .filter(r => r.order_id === orderId && r.status === 'active')
        .map(r => r.product_id)
    );

    const pickItems: PickListItem[] = [];
    for (const item of assignedItems) {
      // Skip items that already have an active reservation (double-deduction guard)
      if (alreadyReservedProductIds.has(item.product_id)) continue;

      const splitWh = item.split_warehouses;
      if (splitWh && splitWh.length > 1) {
        for (const portion of splitWh) {
          if (portion.qty <= 0) continue;
          await db.createReservation({
            order_id: orderId,
            product_id: item.product_id,
            warehouse_id: portion.warehouse_id,
            qty: portion.qty,
            status: 'active'
          });
          await db.addStockAdjustment(
            item.product_id,
            -portion.qty,
            'customer_sales',
            `Order ${orderId} approved — moved to temp storage (${portion.warehouse_name})`,
            actor,
            portion.warehouse_id
          );
        }
        pickItems.push({
          product_id: item.product_id,
          name: item.name,
          qty: item.qty,
          warehouse_id: item.warehouse_id || splitWh[0].warehouse_id,
          warehouse_name: `Combined: ${splitWh.map((p: any) => `${p.warehouse_name} ×${p.qty}`).join(' + ')}`,
          picked_qty: 0
        });
      } else {
        const finalWhId = item.warehouse_id || 'wh-main';
        const finalWhName = item.warehouse_name || 'Main Warehouse';
        await db.createReservation({
          order_id: orderId,
          product_id: item.product_id,
          warehouse_id: finalWhId,
          qty: item.qty,
          status: 'active'
        });
        await db.addStockAdjustment(
          item.product_id,
          -item.qty,
          'customer_sales',
          `Order ${orderId} approved — moved to temp storage (${finalWhName})`,
          actor,
          finalWhId
        );
        pickItems.push({
          product_id: item.product_id,
          name: item.name,
          qty: item.qty,
          warehouse_id: finalWhId,
          warehouse_name: finalWhName,
          picked_qty: 0
        });
      }
    }

    // Guard: only create pick list if one doesn't already exist for this order
    const existingPlsForPartial = await db.getPickLists();
    if (!existingPlsForPartial.some(p => p.order_id === orderId)) {
      await db.createPickList(orderId, pickItems);
    }
    await logAction(actor.id, actor.name, actor.role, `Approved Order ${orderId} partially`, `Approved remaining total: ${total} SAR`);
    return updatedOrder;
  },

  approveOrderWithAdjustedItems: async (
    orderId: string,
    adjustedItems: (OrderItem & { adjustedQty: number })[],
    removedItems: OrderItem[],
    actor: User
  ): Promise<Order> => {
    const order = await db.getOrderById(orderId);
    if (!order) throw new Error('Order not found');

    const customer = await db.getUserById(order.customer_id);
    if (!customer) throw new Error('Customer not found');

    // Build the final items list: items with adjustedQty > 0 (at new qty), items that are fully available unchanged
    let subtotal = 0;
    let totalDiscount = 0;
    const recalculatedItems: OrderItem[] = [];

    for (const item of adjustedItems) {
      // adjustedQty is set for partial items; fully-available items won't have it — use their full qty
      const qtyToUse = typeof (item as any).adjustedQty === 'number' ? (item as any).adjustedQty : item.qty;
      if (qtyToUse <= 0) continue;
      const prod = await db.getProductById(item.product_id);
      if (!prod) throw new Error(`Product ${item.product_id} not found`);

      const defaultPrice = prod.selling_price;
      const finalPrice = db.calculateCustomerPrice(customer, prod);
      const discountVal = defaultPrice - finalPrice;

      const itemTotal = Number((finalPrice * qtyToUse).toFixed(2));
      subtotal += Number((defaultPrice * qtyToUse).toFixed(2));
      totalDiscount += Number((discountVal * qtyToUse).toFixed(2));

      recalculatedItems.push({ ...item, qty: qtyToUse, unit_price: finalPrice, total: itemTotal });
    }

    const afterCustomerDiscount = Number((subtotal - totalDiscount).toFixed(2));
    const manualPctDeduction = Number(((afterCustomerDiscount * order.manual_discount_pct) / 100).toFixed(2));
    const manualAmtDeduction = Number(Math.min(order.manual_discount_amt, afterCustomerDiscount - manualPctDeduction).toFixed(2));
    const total = Number((afterCustomerDiscount - (manualPctDeduction + manualAmtDeduction)).toFixed(2));

    const { items: assignedItems } = await db.autoAssignWarehouses(recalculatedItems, orderId);

    const adjustedSummary = adjustedItems
      .filter(i => typeof (i as any).adjustedQty === 'number' && (i as any).adjustedQty < i.qty && (i as any).adjustedQty > 0)
      .map(i => `${i.name} ×${i.qty}→×${(i as any).adjustedQty}`)
      .join(', ');
    const removedSummary = [...removedItems, ...adjustedItems.filter(i => typeof (i as any).adjustedQty === 'number' && (i as any).adjustedQty === 0)]
      .map(i => `${i.name} ×${i.qty}`).join(', ');

    const historyEntry = {
      status: 'approved' as const,
      updated_at: new Date().toISOString(),
      updated_by_name: actor.name,
      notes: [
        adjustedSummary && `Qty adjusted: ${adjustedSummary}`,
        removedSummary && `Removed: ${removedSummary}`
      ].filter(Boolean).join('. ')
    };

    const allRemovedItems = [
      ...removedItems,
      ...adjustedItems.filter(i => typeof (i as any).adjustedQty === 'number' && (i as any).adjustedQty === 0).map(i => ({ ...i }))
    ];

    const updatedOrder: Order = {
      ...order,
      items: assignedItems,
      removed_items: allRemovedItems,
      subtotal,
      discount: totalDiscount,
      manual_discount_amt: manualAmtDeduction,
      total,
      status: 'approved',
      status_history: [...order.status_history, historyEntry]
    };

    if (supabase) {
      const { error: updateErr } = await supabase.from('orders').update({
        items: updatedOrder.items,
        removed_items: updatedOrder.removed_items,
        subtotal: updatedOrder.subtotal,
        discount: updatedOrder.discount,
        manual_discount_amt: updatedOrder.manual_discount_amt,
        total: updatedOrder.total,
        status: 'approved',
        status_history: updatedOrder.status_history,
      }).eq('id', orderId);
      if (updateErr) throw new Error(`Failed to update order: ${updateErr.message}`);
    } else {
      const orders = getLocalTable<Order>('orders');
      saveLocalTable('orders', orders.map(o => o.id === orderId ? updatedOrder : o));
    }

    // Reserve stock for adjusted items
    const existingReservations = await db.getReservations();
    const alreadyReservedProductIds = new Set(
      existingReservations
        .filter(r => r.order_id === orderId && r.status === 'active')
        .map(r => r.product_id)
    );

    const pickItems: PickListItem[] = [];
    for (const item of assignedItems) {
      if (alreadyReservedProductIds.has(item.product_id)) continue;

      const splitWh = item.split_warehouses;
      if (splitWh && splitWh.length > 1) {
        for (const portion of splitWh) {
          if (portion.qty <= 0) continue;
          await db.createReservation({ order_id: orderId, product_id: item.product_id, warehouse_id: portion.warehouse_id, qty: portion.qty, status: 'active' });
          await db.addStockAdjustment(item.product_id, -portion.qty, 'customer_sales', `Order ${orderId} approved (qty adjusted) — ${portion.warehouse_name}`, actor, portion.warehouse_id);
        }
        pickItems.push({ product_id: item.product_id, name: item.name, qty: item.qty, warehouse_id: item.warehouse_id || splitWh[0].warehouse_id, warehouse_name: `Combined: ${splitWh.map((p: any) => `${p.warehouse_name} ×${p.qty}`).join(' + ')}`, picked_qty: 0 });
      } else {
        const finalWhId = item.warehouse_id || 'wh-main';
        const finalWhName = item.warehouse_name || 'Main Warehouse';
        await db.createReservation({ order_id: orderId, product_id: item.product_id, warehouse_id: finalWhId, qty: item.qty, status: 'active' });
        await db.addStockAdjustment(item.product_id, -item.qty, 'customer_sales', `Order ${orderId} approved (qty adjusted) — ${finalWhName}`, actor, finalWhId);
        pickItems.push({ product_id: item.product_id, name: item.name, qty: item.qty, warehouse_id: finalWhId, warehouse_name: finalWhName, picked_qty: 0 });
      }
    }

    const existingPls = await db.getPickLists();
    if (!existingPls.some(p => p.order_id === orderId)) {
      await db.createPickList(orderId, pickItems);
    }
    await logAction(actor.id, actor.name, actor.role, `Approved Order ${orderId} with adjusted quantities`, `Total: ${total} SAR`);
    return updatedOrder;
  }
};

