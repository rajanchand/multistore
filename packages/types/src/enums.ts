/**
 * Domain enums shared between API and frontends.
 * These mirror the Prisma enums; frontends must not import the Prisma client.
 */

export const ORDER_STATUSES = [
  'PENDING',
  'PAYMENT_PENDING',
  'PAID',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_COLLECTION',
  'DISPATCHED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'RETURNED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'REQUIRES_ACTION',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STOCK_MOVEMENT_TYPES = [
  'PURCHASE',
  'SALE',
  'RESERVATION',
  'RESERVATION_RELEASE',
  'RETURN',
  'REFUND_RESTOCK',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'DAMAGED',
  'LOST',
  'MANUAL_ADJUSTMENT',
] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const STOCK_TRANSFER_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'PREPARING',
  'IN_TRANSIT',
  'RECEIVED',
  'REJECTED',
  'CANCELLED',
] as const;
export type StockTransferStatus = (typeof STOCK_TRANSFER_STATUSES)[number];

/** Valid transitions for stock transfers; enforced server-side. */
export const STOCK_TRANSFER_TRANSITIONS: Record<StockTransferStatus, StockTransferStatus[]> = {
  REQUESTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const RETURN_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTED',
  'REFUND_APPROVED',
  'REFUNDED',
  'CLOSED',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const FULFILMENT_TYPES = ['DELIVERY', 'CLICK_AND_COLLECT'] as const;
export type FulfilmentType = (typeof FULFILMENT_TYPES)[number];

/** Order origin channel shown in admin: website, till, or cash. */
export const ORDER_SOURCES = ['ONLINE', 'POS', 'CASH'] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  ONLINE: 'Online',
  POS: 'POS',
  CASH: 'Cash',
};

export const PROMOTION_TYPES = [
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'BOGO',
  'BUY_X_GET_Y',
  'FREE_DELIVERY',
] as const;
export type PromotionType = (typeof PROMOTION_TYPES)[number];

export const BANNER_TYPES = [
  'HERO',
  'MOBILE_HERO',
  'CATEGORY',
  'PROMOTION',
  'POPUP',
  'ANNOUNCEMENT',
] as const;
export type BannerType = (typeof BANNER_TYPES)[number];

export const BULK_OPERATION_STATUSES = [
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL_FAILURE',
  'FAILED',
] as const;
export type BulkOperationStatus = (typeof BULK_OPERATION_STATUSES)[number];

export const BULK_OPERATION_ACTIONS = [
  'ADD_PRODUCT',
  'PUBLISH',
  'HIDE',
  'ARCHIVE',
  'CHANGE_PRICE',
  'SET_SALE_PRICE',
  'PERCENTAGE_ADJUSTMENT',
  'APPLY_PROMOTION',
  'REMOVE_PROMOTION',
  'CHANGE_CATEGORY',
  'CHANGE_AVAILABILITY',
] as const;
export type BulkOperationAction = (typeof BULK_OPERATION_ACTIONS)[number];

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
