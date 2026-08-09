'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Boxes,
  Building2,
  CreditCard,
  FileBarChart2,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Package,
  Puzzle,
  Search,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  Tags,
  UserCircle,
  Users,
  Warehouse,
  Shield,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@repo/ui';
import { BranchSwitcher } from '@/components/branch-switcher';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'analytics.read' },
      { href: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.read' },
      { href: '/reports', label: 'Reports', icon: FileBarChart2, permission: 'report.read' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/products', label: 'Products', icon: Package, permission: 'product.read' },
      { href: '/categories', label: 'Categories', icon: Tags, permission: 'category.read' },
      { href: '/brands', label: 'Brands', icon: Tag, permission: 'brand.read' },
      { href: '/inventory', label: 'Inventory', icon: Warehouse, permission: 'inventory.read' },
      {
        href: '/inventory/transfers',
        label: 'Transfers',
        icon: ArrowLeftRight,
        permission: 'inventory.transfer',
      },
      { href: '/bulk-operations', label: 'Bulk Operations', icon: Boxes, permission: 'product.bulk_manage' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/pos', label: 'POS', icon: Store, permission: 'pos.use' },
      { href: '/orders', label: 'Orders', icon: ShoppingCart, permission: 'order.read' },
      { href: '/payments', label: 'Payments', icon: CreditCard, permission: 'payment.read' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/promotions', label: 'Promotions', icon: Tag, permission: 'promotion.manage' },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaign.manage' },
      { href: '/banners', label: 'Banners', icon: ImageIcon, permission: 'banner.manage' },
      { href: '/sms', label: 'SMS', icon: MessageSquare, permission: 'sms.send' },
    ],
  },
  {
    label: 'Customers',
    items: [{ href: '/customers', label: 'Customers', icon: Users, permission: 'customer.read' }],
  },
  {
    label: 'Staff',
    items: [
      { href: '/users', label: 'Users & Roles', icon: Users, permission: 'user.manage' },
      { href: '/sessions', label: 'Login sessions', icon: Shield, permission: 'settings.manage' },
      { href: '/profile', label: 'My profile', icon: UserCircle },
      { href: '/activity', label: 'Activity Logs', icon: Activity, permission: 'audit.read' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/branches', label: 'Branches', icon: Building2, permission: 'branch.read' },
      { href: '/settings', label: 'Store settings', icon: Settings, permission: 'settings.manage' },
    ],
  },
  {
    label: 'Apps',
    items: [{ href: '/apps', label: 'Integrations', icon: Puzzle, permission: 'settings.manage' }],
  },
];

export function AdminShell({
  children,
  user,
  branches = [],
  selectedBranchId = null,
}: {
  children: React.ReactNode;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    permissions: string[];
    isGlobal?: boolean;
  };
  branches?: Array<{ id: string; name: string; code: string }>;
  selectedBranchId?: string | null;
}) {
  const pathname = usePathname();
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || user.permissions.includes(item.permission),
    ),
  })).filter((group) => group.items.length > 0);

  const showBranchSwitcher = branches.length > 0;
  const scopeLabel =
    user.isGlobal || branches.length !== 1
      ? user.isGlobal
        ? 'HQ Admin'
        : 'Branch Admin'
      : branches[0]!.name;

  return (
    <div className="flex min-h-screen bg-[#f4f6f8] text-foreground">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            MultiBranch
          </p>
          <p className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{scopeLabel}</p>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                        active
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-4 py-4 text-sm">
          <Link href="/profile" className="block rounded-md px-1 py-1 transition hover:bg-slate-50">
            <p className="font-medium text-slate-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-slate-500">{user.email}</p>
            <p className="mt-1 text-xs text-slate-400">View profile</p>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            {showBranchSwitcher ? (
              <BranchSwitcher
                branches={branches}
                selectedId={selectedBranchId}
                isGlobal={Boolean(user.isGlobal)}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search products, orders, customers…</span>
              </div>
            )}
          </div>
          <form action="/api/logout" method="post">
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
