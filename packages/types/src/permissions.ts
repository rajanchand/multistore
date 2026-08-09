/**
 * Permission catalogue — the single source of truth for RBAC.
 * The database seed, API guards, and admin UI all derive from this file.
 */
export const PERMISSIONS = {
  // Branches
  'branch.read': 'View branches',
  'branch.create': 'Create branches',
  'branch.update': 'Update branches',
  'branch.archive': 'Archive branches',

  // Products / catalogue
  'product.read': 'View products',
  'product.create': 'Create products',
  'product.update': 'Update products',
  'product.archive': 'Archive products',
  'product.publish': 'Publish/hide products',
  'product.bulk_manage': 'Run bulk product operations',

  // Categories & brands
  'category.read': 'View categories',
  'category.manage': 'Manage categories',
  'brand.read': 'View brands',
  'brand.manage': 'Manage brands',

  // Inventory
  'inventory.read': 'View inventory',
  'inventory.adjust': 'Adjust inventory',
  'inventory.transfer': 'Manage stock transfers',

  // Orders
  'order.read': 'View orders',
  'order.update': 'Update order status',
  'order.cancel': 'Cancel orders',

  // Point of sale
  'pos.use': 'Use the in-store POS till',

  // Payments & refunds
  'payment.read': 'View payments',
  'refund.create': 'Request refunds',
  'refund.approve': 'Approve refunds',

  // Marketing
  'promotion.manage': 'Manage promotions & coupons',
  'banner.manage': 'Manage banners',
  'campaign.manage': 'Manage marketing campaigns',
  'sms.send': 'Send SMS messages',

  // Customers
  'customer.read': 'View customers',
  'customer.manage': 'Manage customers',

  // Administration
  'user.manage': 'Manage users',
  'role.manage': 'Manage roles & permissions',
  'analytics.read': 'View analytics',
  'report.read': 'View HQ reports',
  'audit.read': 'View audit logs',
  'settings.manage': 'Manage settings',
  'export.create': 'Export data',
  'import.create': 'Import data',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** System role definitions seeded into the database. Custom roles can be added at runtime. */
export const SYSTEM_ROLES: Record<string, { description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: {
    description: 'Platform-wide administration (HQ)',
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    description: 'HQ administrator — manage staff, catalogue, orders, and settings',
    permissions: ALL_PERMISSIONS.filter((p) => p !== 'role.manage'),
  },
  BRANCH_MANAGER: {
    description: 'Full management of assigned branches',
    permissions: [
      'branch.read',
      'product.read',
      'product.update',
      'product.publish',
      'category.read',
      'brand.read',
      'inventory.read',
      'inventory.adjust',
      'inventory.transfer',
      'order.read',
      'order.update',
      'order.cancel',
      'pos.use',
      'payment.read',
      'refund.create',
      'customer.read',
      'analytics.read',
      'report.read',
      'export.create',
    ],
  },
  INVENTORY_STAFF: {
    description: 'Inventory operations for assigned branches',
    permissions: [
      'branch.read',
      'product.read',
      'category.read',
      'brand.read',
      'inventory.read',
      'inventory.adjust',
      'inventory.transfer',
    ],
  },
  MARKETING: {
    description: 'Marketing management (promotions, banners, campaigns, SMS)',
    permissions: [
      'branch.read',
      'product.read',
      'category.read',
      'brand.read',
      'customer.read',
      'promotion.manage',
      'banner.manage',
      'campaign.manage',
      'sms.send',
      'analytics.read',
      'report.read',
    ],
  },
  SUPPORT: {
    description: 'Customer support (read orders/customers, request refunds)',
    permissions: ['branch.read', 'order.read', 'customer.read', 'refund.create', 'payment.read'],
  },
} as const;

export type SystemRoleName = keyof typeof SYSTEM_ROLES;
