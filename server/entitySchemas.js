/**
 * entitySchemas.js
 * Defines per-entity PostgreSQL table schemas.
 * Each entity gets a dedicated table with typed columns for indexed/key fields
 * plus a JSONB `data` column for remaining properties.
 *
 * This satisfies the architectural requirement of per-entity tables while
 * keeping CRUD code DRY through a schema-driven generic layer.
 */

export const ENTITY_SCHEMAS = {

  // ============================================================
  // COMERCIAL (equistpos)
  // ============================================================

  Sale: {
    table: 'entity_sale',
    typed: {
      status: 'TEXT',
      location_id: 'TEXT',
      customer_id: 'TEXT',
      invoice_number: 'TEXT',
      sale_date: 'TIMESTAMPTZ',
      total_amount: 'NUMERIC(14,2)',
      subtotal: 'NUMERIC(14,2)',
      discount_amount: 'NUMERIC(14,2)',
    },
    indexes: ['status', 'location_id', 'customer_id', 'sale_date'],
  },

  SaleItem: {
    table: 'entity_sale_item',
    typed: {
      sale_id: 'TEXT NOT NULL',
      product_id: 'TEXT',
      quantity: 'NUMERIC(14,4)',
      unit_price: 'NUMERIC(14,4)',
      line_total: 'NUMERIC(14,2)',
    },
    indexes: ['sale_id', 'product_id'],
  },

  Customer: {
    table: 'entity_customer',
    typed: {
      name: 'TEXT',
      phone: 'TEXT',
      email: 'TEXT',
      is_active: 'BOOLEAN DEFAULT true',
    },
    indexes: ['is_active'],
  },

  Product: {
    table: 'entity_product',
    typed: {
      name: 'TEXT',
      sku: 'TEXT',
      barcode: 'TEXT',
      category: 'TEXT',
      is_active: 'BOOLEAN DEFAULT true',
      sale_price: 'NUMERIC(14,4)',
      base_cost: 'NUMERIC(14,4)',
    },
    indexes: ['sku', 'category', 'is_active'],
  },

  Inventory: {
    table: 'entity_inventory',
    typed: {
      product_id: 'TEXT',
      location_id: 'TEXT',
      current_stock: 'NUMERIC(14,4) DEFAULT 0',
      available_stock: 'NUMERIC(14,4) DEFAULT 0',
      reserved_stock: 'NUMERIC(14,4) DEFAULT 0',
    },
    indexes: ['product_id', 'location_id'],
  },

  InventoryMovement: {
    table: 'entity_inventory_movement',
    typed: {
      movement_type: 'TEXT',
      product_id: 'TEXT',
      location_id: 'TEXT',
      quantity: 'NUMERIC(14,4)',
      movement_date: 'TIMESTAMPTZ',
      reference_id: 'TEXT',
    },
    indexes: ['movement_type', 'product_id', 'location_id', 'movement_date'],
  },

  Location: {
    table: 'entity_location',
    typed: {
      name: 'TEXT',
      code: 'TEXT',
      is_active: 'BOOLEAN DEFAULT true',
      is_main: 'BOOLEAN DEFAULT false',
    },
    indexes: ['is_active'],
  },

  Role: {
    table: 'entity_role',
    typed: {
      name: 'TEXT',
    },
    indexes: [],
  },

  Purchase: {
    table: 'entity_purchase',
    typed: {
      purchase_date: 'TIMESTAMPTZ',
      status: 'TEXT',
      supplier_id: 'TEXT',
      location_id: 'TEXT',
      purchase_number: 'TEXT',
      subtotal: 'NUMERIC(14,2)',
      payment_method: 'TEXT',
    },
    indexes: ['status', 'supplier_id', 'location_id', 'purchase_date'],
  },

  PurchaseItem: {
    table: 'entity_purchase_item',
    typed: {
      purchase_id: 'TEXT NOT NULL',
      product_id: 'TEXT',
      quantity_ordered: 'NUMERIC(14,4)',
      quantity_received: 'NUMERIC(14,4)',
      unit_cost: 'NUMERIC(14,4)',
      line_total: 'NUMERIC(14,2)',
    },
    indexes: ['purchase_id', 'product_id'],
  },

  Expense: {
    table: 'entity_expense',
    typed: {
      expense_date: 'TIMESTAMPTZ',
      category: 'TEXT',
      location_id: 'TEXT',
      amount: 'NUMERIC(14,2)',
      payment_method: 'TEXT',
    },
    indexes: ['expense_date', 'category', 'location_id'],
  },

  ExpenseTask: {
    table: 'entity_expense_task',
    typed: {
      status: 'TEXT',
      location_id: 'TEXT',
      amount: 'NUMERIC(14,2)',
      due_day: 'INTEGER',
      month: 'TEXT',
    },
    indexes: ['status', 'location_id'],
  },

  Credit: {
    table: 'entity_credit',
    typed: {
      customer_id: 'TEXT',
      sale_id: 'TEXT',
      status: 'TEXT',
      total_amount: 'NUMERIC(14,2)',
      pending_amount: 'NUMERIC(14,2)',
      paid_amount: 'NUMERIC(14,2)',
      due_date: 'TIMESTAMPTZ',
    },
    indexes: ['customer_id', 'status', 'due_date'],
  },

  BankAccount: {
    table: 'entity_bank_account',
    typed: {
      name: 'TEXT',
      account_type: 'TEXT',
      is_active: 'BOOLEAN DEFAULT true',
    },
    indexes: ['is_active'],
  },

  AccountPayable: {
    table: 'entity_account_payable',
    typed: {
      supplier_id: 'TEXT',
      purchase_id: 'TEXT',
      status: 'TEXT',
      due_date: 'TIMESTAMPTZ',
      pending_amount: 'NUMERIC(14,2)',
      paid_amount: 'NUMERIC(14,2)',
      location_id: 'TEXT',
    },
    indexes: ['supplier_id', 'status', 'due_date', 'location_id'],
  },

  FixedExpense: {
    table: 'entity_fixed_expense',
    typed: {
      nombre: 'TEXT',
      monto: 'NUMERIC(14,2)',
      dia_vencimiento: 'INTEGER',
      periodicidad: 'TEXT',
      categoria: 'TEXT',
      is_active: 'BOOLEAN DEFAULT true',
      ultima_generacion: 'TEXT',
    },
    indexes: ['is_active', 'periodicidad'],
  },

  PayableInstallment: {
    table: 'entity_payable_installment',
    typed: {
      payable_id: 'TEXT NOT NULL',
      sequence_number: 'INTEGER',
      status: 'TEXT',
      due_date: 'TIMESTAMPTZ',
      amount: 'NUMERIC(14,2)',
      paid_amount: 'NUMERIC(14,2)',
      location_id: 'TEXT',
    },
    indexes: ['payable_id', 'status'],
  },

  PayablePayment: {
    table: 'entity_payable_payment',
    typed: {},
    indexes: [],
  },

  PriceList: {
    table: 'entity_price_list',
    typed: {
      name: 'TEXT',
      code: 'TEXT',
      is_default: 'BOOLEAN DEFAULT false',
    },
    indexes: [],
  },

  SyncInbox: {
    table: 'entity_sync_inbox',
    typed: {
      event_type: 'TEXT',
      source: 'TEXT',
      processed: 'BOOLEAN DEFAULT false',
      received_at: 'TIMESTAMPTZ',
    },
    indexes: ['processed', 'event_type'],
  },

  SystemSettings: {
    table: 'entity_system_settings',
    typed: {},
    indexes: [],
  },

  Supplier: {
    table: 'entity_proveedor',
    typed: {
      nombre: 'TEXT',
      activo: 'BOOLEAN DEFAULT true',
      ciudad: 'TEXT',
    },
    indexes: ['activo'],
  },

  CashControl: {
    table: 'entity_cash_control',
    typed: {
      location_id: 'TEXT',
      control_date: 'TEXT',
      cash_amount: 'NUMERIC(14,2) DEFAULT 0',
      transfer_amount: 'NUMERIC(14,2) DEFAULT 0',
      card_amount: 'NUMERIC(14,2) DEFAULT 0',
      cash_collected: 'BOOLEAN DEFAULT false',
      transfers_verified: 'BOOLEAN DEFAULT false',
    },
    indexes: ['location_id', 'control_date', 'cash_collected', 'transfers_verified'],
  },

  Exchange: {
    table: 'entity_exchange',
    typed: {
      status: 'TEXT',
      location_id: 'TEXT',
    },
    indexes: ['status'],
  },

  HoldCart: {
    table: 'entity_hold_cart',
    typed: {
      location_id: 'TEXT',
      status: 'TEXT',
    },
    indexes: ['location_id'],
  },

  InventoryAudit: {
    table: 'entity_inventory_audit',
    typed: {
      location_id: 'TEXT',
      status: 'TEXT',
      audit_date: 'TIMESTAMPTZ',
    },
    indexes: ['location_id', 'status'],
  },

  InventoryAuditItem: {
    table: 'entity_inventory_audit_item',
    typed: {
      audit_id: 'TEXT NOT NULL',
      product_id: 'TEXT',
    },
    indexes: ['audit_id', 'product_id'],
  },

  StockMovement: {
    table: 'entity_stock_movement',
    typed: {
      product_id: 'TEXT',
      location_id: 'TEXT',
      movement_type: 'TEXT',
      quantity: 'NUMERIC(14,4)',
      movement_date: 'TIMESTAMPTZ',
      reference_id: 'TEXT',
    },
    indexes: ['product_id', 'location_id', 'movement_type', 'movement_date'],
  },

  // ============================================================
  // OPERARIOS (produccionequist)
  // ============================================================

  Employee: {
    table: 'entity_employee',
    typed: {
      name: 'TEXT',
      position: 'TEXT',
      is_active: 'BOOLEAN DEFAULT true',
      hire_date: 'TIMESTAMPTZ',
      phone: 'TEXT',
    },
    indexes: ['is_active', 'position'],
  },

  Devolucion: {
    table: 'entity_devolucion',
    typed: {
      employee_id: 'TEXT',
      product_reference: 'TEXT',
      quantity_sent: 'NUMERIC(14,4)',
      quantity_returned: 'NUMERIC(14,4)',
      date_sent: 'TIMESTAMPTZ',
      defect_type: 'TEXT',
      notes: 'TEXT',
      status: 'TEXT',
      date_returned: 'TIMESTAMPTZ',
    },
    indexes: ['employee_id', 'status', 'date_sent'],
  },

  Delivery: {
    table: 'entity_delivery',
    typed: {
      employee_id: 'TEXT',
      status: 'TEXT',
      delivery_date: 'TIMESTAMPTZ',
      product_reference: 'TEXT',
      quantity: 'NUMERIC(14,4)',
      total_amount: 'NUMERIC(14,2)',
      unit_price: 'NUMERIC(14,4)',
    },
    indexes: ['employee_id', 'status', 'delivery_date'],
  },

  Dispatch: {
    table: 'entity_dispatch',
    typed: {
      employee_id: 'TEXT',
      status: 'TEXT',
      dispatch_date: 'TEXT',
      product_reference: 'TEXT',
      quantity: 'NUMERIC(14,4)',
    },
    indexes: ['employee_id', 'status', 'dispatch_date'],
  },

  Payment: {
    table: 'entity_payment',
    typed: {
      employee_id: 'TEXT',
      payment_date: 'TIMESTAMPTZ',
      payment_type: 'TEXT',
      amount: 'NUMERIC(14,2)',
      status: 'TEXT',
    },
    indexes: ['employee_id', 'payment_date', 'status'],
  },

  PaymentRequest: {
    table: 'entity_payment_request',
    typed: {
      employee_id: 'TEXT',
      status: 'TEXT',
      request_date: 'TIMESTAMPTZ',
      requested_amount: 'NUMERIC(14,2)',
    },
    indexes: ['employee_id', 'status'],
  },

  EmployeePurchase: {
    table: 'entity_employee_purchase',
    typed: {
      employee_id: 'TEXT',
      status: 'TEXT',
    },
    indexes: ['employee_id'],
  },

  // ============================================================
  // PRODUCCION (chaquetas-pro)
  // ============================================================

  Color: {
    table: 'entity_color',
    typed: {
      nombre: 'TEXT',
      activo: 'BOOLEAN DEFAULT true',
      codigo_hex: 'TEXT',
    },
    indexes: ['activo'],
  },

  MateriaPrima: {
    table: 'entity_materia_prima',
    typed: {
      nombre: 'TEXT',
      tipo_material: 'TEXT',
      unidad_medida: 'TEXT',
      precio_por_unidad: 'NUMERIC(14,4)',
    },
    indexes: ['tipo_material'],
  },

  Operacion: {
    table: 'entity_operacion',
    typed: {
      nombre: 'TEXT',
      activa: 'BOOLEAN DEFAULT true',
    },
    indexes: ['activa'],
  },

  Presupuesto: {
    table: 'entity_presupuesto',
    typed: {
      estado: 'TEXT',
      cliente: 'TEXT',
      numero_presupuesto: 'TEXT',
      fecha_entrega: 'TIMESTAMPTZ',
      total_general: 'NUMERIC(14,2)',
    },
    indexes: ['estado', 'cliente'],
  },

  Producto: {
    table: 'entity_producto_produccion',
    typed: {
      nombre: 'TEXT',
      tipo_diseno: 'TEXT',
      reference: 'TEXT',
      costo_mano_obra: 'NUMERIC(14,4)',
    },
    indexes: ['tipo_diseno'],
  },

  Proveedor: {
    table: 'entity_proveedor',
    typed: {
      nombre: 'TEXT',
      activo: 'BOOLEAN DEFAULT true',
      ciudad: 'TEXT',
    },
    indexes: ['activo'],
  },

  Remision: {
    table: 'entity_remision',
    typed: {
      numero_remision: 'TEXT',
      tipo_remision: 'TEXT',
      estado: 'TEXT',
      fecha_inicio: 'TIMESTAMPTZ',
      fecha_entrega: 'TIMESTAMPTZ',
      operario_asignado: 'TEXT',
      presupuesto_id: 'TEXT',
    },
    indexes: ['estado', 'tipo_remision', 'operario_asignado'],
  },

  Compra: {
    table: 'entity_compra',
    typed: {
      estado: 'TEXT',
      proveedor_id: 'TEXT',
    },
    indexes: ['estado'],
  },

  Factura: {
    table: 'entity_factura',
    typed: {
      estado: 'TEXT',
      proveedor_id: 'TEXT',
      compra_id: 'TEXT',
      total: 'NUMERIC',
      saldo_pendiente: 'NUMERIC',
    },
    indexes: ['estado', 'proveedor_id'],
  },

  Pago: {
    table: 'entity_pago',
    typed: {
      factura_id: 'TEXT',
      proveedor_id: 'TEXT',
      monto: 'NUMERIC',
      metodo_pago: 'TEXT',
    },
    indexes: ['factura_id', 'proveedor_id'],
  },

  MerchandiseEntry: {
    table: 'entity_merchandise_entry',
    typed: {
      entry_date: 'TEXT',
      status: "TEXT DEFAULT 'pendiente'",
      total_units: 'NUMERIC(14,4) DEFAULT 0',
      assigned_date: 'TEXT',
    },
    indexes: ['status', 'entry_date'],
  },

  AppConfig: {
    table: 'entity_app_config',
    typed: {
      key: 'TEXT',
      value: 'TEXT',
    },
    indexes: ['key'],
  },
};

/**
 * Returns the CREATE TABLE SQL for a given entity schema.
 */
export function buildCreateTableSQL(entityType, schema) {
  const typedCols = Object.entries(schema.typed)
    .map(([col, type]) => `  ${col} ${type}`)
    .join(',\n');
  const colSection = typedCols ? typedCols + ',\n' : '';
  return `
    CREATE TABLE IF NOT EXISTS ${schema.table} (
      id TEXT PRIMARY KEY,
${colSection}      data JSONB NOT NULL DEFAULT '{}',
      created_date TIMESTAMPTZ DEFAULT NOW(),
      updated_date TIMESTAMPTZ DEFAULT NOW(),
      created_by_id TEXT
    );
  `;
}

/**
 * Returns CREATE INDEX statements for a given entity schema.
 */
export function buildIndexSQL(schema) {
  const stmts = [];
  for (const col of schema.indexes) {
    const idxName = `idx_${schema.table}_${col}`;
    stmts.push(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${schema.table}(${col});`);
  }
  return stmts;
}

/**
 * Split a record's fields into typed columns and remaining JSONB data.
 * Returns { typedValues, dataRest } where typedValues is an object of {col: value}
 * and dataRest is everything else.
 */
export function splitRecord(schema, record) {
  const typedValues = {};
  const dataRest = {};
  const typedCols = new Set(Object.keys(schema.typed));

  for (const [k, v] of Object.entries(record)) {
    if (k === 'id' || k === 'created_date' || k === 'updated_date' || k === 'created_by_id') continue;
    if (typedCols.has(k)) {
      typedValues[k] = v !== undefined ? v : null;
    } else {
      dataRest[k] = v;
    }
  }
  return { typedValues, dataRest };
}

/**
 * Merge typed columns and JSONB data into a flat record for API response.
 */
export function mergeRecord(row, schema) {
  const typedCols = Object.keys(schema.typed);
  const typed = {};
  for (const col of typedCols) {
    if (row[col] !== undefined) typed[col] = row[col];
  }
  // Typed columns take priority over JSONB so updates to typed fields
  // are not silently overwritten by stale JSONB values.
  return {
    ...(row.data || {}),
    ...typed,
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by_id: row.created_by_id,
  };
}
