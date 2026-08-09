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
  Search,
  Settings,
  ShoppingCart,
  Tag,
  Tags,
  Users,
  Warehouse,
  Shield,
} from 'lucide-react';
import { cn } from '@repo/ui';
import { BranchSwitcher } from '@/components/branch-switcher';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'analytics.read' },
  { href: '/branches', label: 'Branches', icon: Building2, permission: 'branch.read' },
  { href: '/products', label: 'Products', icon: Package, permission: 'product.read' },
  { href: '/categories', label: 'Categories', icon: Tags, permission: 'category.read' },
  { href: '/brands', label: 'Brands', icon: Tag, permission: 'brand.read' },
  { href: '/inventory', label: 'Inventory', icon: Warehouse, permission: 'inventory.read' },
  { href: '/orders', label: 'Orders', icon: ShoppingCart, permission: 'order.read' },
  { href: '/customers', label: 'Customers', icon: Users, permission: 'customer.read' },
  { href: '/promotions', label: 'Promotions', icon: Tag, permission: 'promotion.manage' },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaign.manage' },
  { href: '/banners', label: 'Banners', icon: ImageIcon, permission: 'banner.manage' },
  { href: '/sms', label: 'SMS', icon: MessageSquare, permission: 'sms.send' },
  { href: '/payments', label: 'Payments', icon: CreditCard, permission: 'payment.read' },
  { href: '/reports', label: 'Reports', icon: FileBarChart2, permission: 'report.read' },
  { href: '/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.read' },
  { href: '/users', label: 'Users & Roles', icon: Users, permission: 'user.manage' },
  { href: '/sessions', label: 'Login sessions', icon: Shield, permission: 'settings.manage' },
  { href: '/bulk-operations', label: 'Bulk Operations', icon: Boxes, permission: 'product.bulk_manage' },
  { href: '/activity', label: 'Activity Logs', icon: Activity, permission: 'audit.read' },
  { href: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
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
  const items = NAV.filter((item) => !item.permission || user.permissions.includes(item.permission));
  const showBranchSwitcher = branches.length > 0;

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-sidebar-border px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-sidebar-foreground/60">
            MultiBranch
          </p>
          <p className="mt-1 text-lg font-semibold">HQ Admin</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border px-4 py-4 text-sm">
          <p className="font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-sidebar-foreground/60">{user.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-6">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            {showBranchSwitcher ? (
              <BranchSwitcher branches={branches} selectedId={selectedBranchId} />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search products, orders, customers…</span>
              </div>
            )}
          </div>
          <form action="/api/logout" method="post">
            <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
