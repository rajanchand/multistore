/**
 * Development seed.
 *
 * Creates: permissions, system roles, branches, dev accounts, categories,
 * products + variants, branch product configs, inventory, customers, and
 * ~90 days of realistic orders for analytics.
 *
 * DEVELOPMENT ONLY. All accounts use the documented dev password.
 * Never run against production.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';
import argon2 from 'argon2';
import { ALL_PERMISSIONS, PERMISSIONS, SYSTEM_ROLES } from '@repo/types';
import { BRANCHES, CATEGORIES, PRODUCTS, CUSTOMERS } from './data';

const prisma = new PrismaClient();

const DEV_PASSWORD = 'DevPassword123!';
/** Super Admin seed credentials (username login supported). */
const SUPERADMIN_USERNAME = 'rajan.chand';
const SUPERADMIN_PASSWORD = 'Rajan33555@';

async function hash(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2 });
}

async function seedPermissionsAndRoles() {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key, description: PERMISSIONS[key] },
      update: { description: PERMISSIONS[key] },
    });
  }
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));

  for (const [name, def] of Object.entries(SYSTEM_ROLES)) {
    const role = await prisma.role.upsert({
      where: { name },
      create: { name, description: def.description, isSystem: true },
      update: { description: def.description, isSystem: true },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((p) => ({
        roleId: role.id,
        permissionId: permByKey.get(p)!,
      })),
    });
  }
  console.log(`Seeded ${ALL_PERMISSIONS.length} permissions, ${Object.keys(SYSTEM_ROLES).length} system roles`);
}

async function seedBranches() {
  for (const b of BRANCHES) {
    await prisma.branch.upsert({
      where: { code: b.code },
      create: b,
      update: {
        name: b.name,
        postcode: b.postcode,
        city: b.city,
        latitude: b.latitude ?? null,
        longitude: b.longitude ?? null,
        deliveryFee: b.deliveryFee,
        freeDeliveryThreshold: 'freeDeliveryThreshold' in b ? b.freeDeliveryThreshold ?? null : undefined,
      },
    });
  }
  console.log(`Seeded ${BRANCHES.length} branches`);
}

interface DevAccount {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: string;
  isGlobal: boolean;
  branchCodes: string[];
}

const DEV_ACCOUNTS: DevAccount[] = [
  { email: 'superadmin@dev.local', username: SUPERADMIN_USERNAME, firstName: 'Sam', lastName: 'Admin', role: 'SUPER_ADMIN', isGlobal: true, branchCodes: [] },
  { email: 'admin@dev.local', username: 'admin', firstName: 'Alex', lastName: 'Admin', role: 'ADMIN', isGlobal: true, branchCodes: [] },
  { email: 'manager.glasgow@dev.local', username: 'manager.gla', firstName: 'Gina', lastName: 'Glasgow', role: 'BRANCH_MANAGER', isGlobal: false, branchCodes: ['GLA'] },
  { email: 'manager.edinburgh@dev.local', username: 'manager.edi', firstName: 'Ewan', lastName: 'Edinburgh', role: 'BRANCH_MANAGER', isGlobal: false, branchCodes: ['EDI'] },
  { email: 'manager.paisley@dev.local', username: 'manager.pai', firstName: 'Paula', lastName: 'Paisley', role: 'BRANCH_MANAGER', isGlobal: false, branchCodes: ['PAI'] },
  { email: 'manager.manchester@dev.local', username: 'manager.man', firstName: 'Mark', lastName: 'Manchester', role: 'BRANCH_MANAGER', isGlobal: false, branchCodes: ['MAN'] },
  { email: 'manager.london@dev.local', username: 'manager.lon', firstName: 'Lena', lastName: 'London', role: 'BRANCH_MANAGER', isGlobal: false, branchCodes: ['LON'] },
  { email: 'inventory.glasgow@dev.local', username: 'inventory.gla', firstName: 'Iain', lastName: 'Stock', role: 'INVENTORY_STAFF', isGlobal: false, branchCodes: ['GLA'] },
  { email: 'marketing@dev.local', username: 'marketing', firstName: 'Mia', lastName: 'Marketing', role: 'MARKETING', isGlobal: true, branchCodes: [] },
  { email: 'support@dev.local', username: 'support', firstName: 'Sue', lastName: 'Support', role: 'SUPPORT', isGlobal: true, branchCodes: [] },
];

async function seedUsers() {
  const passwordHash = await hash(DEV_PASSWORD);
  const superAdminPasswordHash = await hash(SUPERADMIN_PASSWORD);
  const roles = await prisma.role.findMany();
  const roleByName = new Map(roles.map((r) => [r.name, r.id]));
  const branches = await prisma.branch.findMany();
  const branchByCode = new Map(branches.map((b) => [b.code, b.id]));

  for (const account of DEV_ACCOUNTS) {
    const accountPasswordHash =
      account.role === 'SUPER_ADMIN' ? superAdminPasswordHash : passwordHash;
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        username: account.username,
        passwordHash: accountPasswordHash,
        firstName: account.firstName,
        lastName: account.lastName,
        isGlobal: account.isGlobal,
        isActive: true,
      },
      update: {
        isGlobal: account.isGlobal,
        username: account.username,
        ...(account.role === 'SUPER_ADMIN' ? { passwordHash: accountPasswordHash } : {}),
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleByName.get(account.role)! } },
      create: { userId: user.id, roleId: roleByName.get(account.role)! },
      update: {},
    });
    for (const code of account.branchCodes) {
      const branchId = branchByCode.get(code);
      if (!branchId) continue;
      await prisma.userBranch.upsert({
        where: { userId_branchId: { userId: user.id, branchId } },
        create: { userId: user.id, branchId },
        update: {},
      });
      if (account.role === 'BRANCH_MANAGER') {
        await prisma.branch.update({ where: { id: branchId }, data: { managerUserId: user.id } });
      }
    }
  }
  console.log(`Seeded ${DEV_ACCOUNTS.length} dev accounts (password: see docs — development only)`);
}

async function seedCategories() {
  for (const c of CATEGORIES) {
    const image = `https://picsum.photos/seed/cat-${c.slug}/640/480`;
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: { ...c, image, isVisible: true, allBranches: true },
      update: { name: c.name, sortOrder: c.sortOrder, image },
    });
  }
  console.log(`Seeded ${CATEGORIES.length} categories`);
}

async function seedBrands() {
  const products = await prisma.product.findMany({
    where: { brand: { not: null }, deletedAt: null },
    select: { id: true, brand: true },
  });
  const names = [...new Set(products.map((p) => p.brand!).filter(Boolean))];
  for (const [i, name] of names.entries()) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const brand = await prisma.brand.upsert({
      where: { slug },
      create: {
        name,
        slug,
        image: `https://picsum.photos/seed/brand-${slug}/640/480`,
        sortOrder: i,
        isVisible: true,
        allBranches: true,
      },
      update: { name },
    });
    await prisma.product.updateMany({
      where: { brand: name, brandId: null },
      data: { brandId: brand.id },
    });
  }
  console.log(`Seeded ${names.length} brands from product catalogue`);
}

async function seedProducts() {
  const categories = await prisma.category.findMany();
  const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));
  const branches = await prisma.branch.findMany({ where: { code: { not: 'HQ' } } });
  const superAdmin = await prisma.user.findUnique({ where: { email: 'superadmin@dev.local' } });

  let productCount = 0;
  let imagesUpdated = 0;
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: { images: p.images },
      });
      imagesUpdated += 1;
      continue;
    }

    const product = await prisma.product.create({
      data: {
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        description: p.description,
        brand: p.brand,
        status: 'ACTIVE',
        taxClass: p.taxClass ?? 'STANDARD',
        images: p.images,
        tags: p.tags,
        seoTitle: p.name,
        seoDescription: p.shortDescription,
        createdById: superAdmin?.id,
        categories: {
          create: p.categorySlugs
            .filter((s) => catBySlug.has(s))
            .map((s) => ({ categoryId: catBySlug.get(s)! })),
        },
      },
    });

    const variantSpecs =
      p.variants.length > 0
        ? p.variants
        : [{ suffix: '', name: p.name, attributes: {}, priceDelta: 0, isDefault: true }];

    for (const v of variantSpecs) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: v.suffix ? `${p.sku}-${v.suffix}` : p.sku,
          name: v.name,
          attributes: v.attributes,
          costPrice: Math.round(p.basePrice * 0.6),
          defaultPrice: p.basePrice + (v.priceDelta ?? 0),
          isDefault: v.isDefault ?? false,
          status: 'ACTIVE',
        },
      });

      // Branch configs: price varies slightly per branch; Paisley hides a few products.
      for (const [bi, branch] of branches.entries()) {
        const priceVariation = [0, 10, 0, 6, 20][bi % 5] ?? 0;
        const hidden = branch.code === 'PAI' && productCount % 7 === 0;
        await prisma.branchProduct.create({
          data: {
            branchId: branch.id,
            productId: product.id,
            variantId: variant.id,
            sellingPrice: p.basePrice + (v.priceDelta ?? 0) + priceVariation,
            salePrice: productCount % 5 === 0 ? Math.round((p.basePrice + (v.priceDelta ?? 0)) * 0.85) : null,
            isVisible: !hidden,
            isAvailable: true,
          },
        });
        const available = hidden ? 0 : ((productCount * 13 + bi * 29) % 180) + 5;
        await prisma.inventory.create({
          data: {
            branchId: branch.id,
            productId: product.id,
            variantId: variant.id,
            available,
            reserved: 0,
            lowStockThreshold: 10,
          },
        });
      }
    }
    productCount += 1;
  }
  console.log(
    `Seeded ${productCount} products; refreshed images on ${imagesUpdated} existing products`,
  );
}

async function seedCustomers() {
  const passwordHash = await hash(DEV_PASSWORD);
  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { email: c.email },
      create: {
        email: c.email,
        passwordHash,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        emailVerifiedAt: new Date(),
        marketingOptIn: c.marketingOptIn,
      },
      update: {},
    });
    if (c.address) {
      const hasAddress = await prisma.address.findFirst({ where: { customerId: customer.id } });
      if (!hasAddress) {
        await prisma.address.create({
          data: {
            customerId: customer.id,
            label: 'Home',
            recipientName: `${c.firstName} ${c.lastName}`,
            line1: c.address.line1,
            city: c.address.city,
            postcode: c.address.postcode,
            country: 'GB',
            isDefault: true,
          },
        });
      }
    }
  }
  console.log(`Seeded ${CUSTOMERS.length} customers`);
}

/** Deterministic pseudo-random for reproducible seed data. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedOrders() {
  const existingOrders = await prisma.order.count();
  if (existingOrders > 0) {
    // Dev convenience: if every order is still the migration default ONLINE, mix channels.
    const onlineOnly = await prisma.order.count({ where: { source: 'ONLINE' } });
    if (onlineOnly === existingOrders) {
      const ids = await prisma.order.findMany({ select: { id: true }, orderBy: { placedAt: 'asc' } });
      for (const [i, row] of ids.entries()) {
        const source = i % 5 === 0 ? 'CASH' : i % 3 === 0 ? 'POS' : 'ONLINE';
        if (source === 'ONLINE') continue;
        await prisma.order.update({ where: { id: row.id }, data: { source } });
        await prisma.payment.updateMany({
          where: { orderId: row.id },
          data: {
            provider: source === 'CASH' ? 'cash' : 'pos',
            paymentMethodSummary:
              source === 'CASH'
                ? { type: 'cash' }
                : { type: 'card', brand: 'visa', last4: '1234', channel: 'pos' },
          },
        });
      }
      console.log('Backfilled order sources (Online / POS / Cash) on existing orders');
    } else {
      console.log('Orders already seeded, skipping');
    }
    return;
  }

  const rand = mulberry32(42);
  const branches = await prisma.branch.findMany({ where: { code: { not: 'HQ' } } });
  const customers = await prisma.customer.findMany({ include: { addresses: true } });
  const branchProducts = await prisma.branchProduct.findMany({
    where: { isVisible: true },
    include: { variant: { include: { product: true } } },
  });
  const bpByBranch = new Map<string, typeof branchProducts>();
  for (const bp of branchProducts) {
    const list = bpByBranch.get(bp.branchId) ?? [];
    list.push(bp);
    bpByBranch.set(bp.branchId, list);
  }

  const now = Date.now();
  const DAY = 86_400_000;
  let orderSeq = 1;

  const terminalStatuses: OrderStatus[] = [
    'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED',
    'DELIVERED', 'DISPATCHED', 'CONFIRMED', 'CANCELLED', 'REFUNDED',
  ];

  for (let i = 0; i < 220; i++) {
    const branch = branches[Math.floor(rand() * branches.length)]!;
    const customer = customers[Math.floor(rand() * customers.length)]!;
    const pool = bpByBranch.get(branch.id) ?? [];
    if (pool.length === 0) continue;

    const itemCount = 1 + Math.floor(rand() * 4);
    const chosen = new Map<string, (typeof pool)[number]>();
    for (let j = 0; j < itemCount; j++) {
      const bp = pool[Math.floor(rand() * pool.length)]!;
      chosen.set(bp.variantId, bp);
    }

    const placedAt = new Date(now - Math.floor(rand() * 90) * DAY - Math.floor(rand() * DAY));
    // Mix of channels: online website, POS till, and cash counter sales.
    const sourceRoll = rand();
    const source = sourceRoll < 0.55 ? 'ONLINE' : sourceRoll < 0.8 ? 'POS' : 'CASH';
    const fulfilment =
      source === 'ONLINE'
        ? rand() < 0.6
          ? 'DELIVERY'
          : 'CLICK_AND_COLLECT'
        : 'CLICK_AND_COLLECT';
    const status = terminalStatuses[Math.floor(rand() * terminalStatuses.length)]!;

    let subtotal = 0;
    const items: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    for (const bp of chosen.values()) {
      const qty = 1 + Math.floor(rand() * 3);
      const unitPrice = bp.salePrice ?? bp.sellingPrice;
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;
      // VAT-inclusive pricing: tax portion = line * rate / (10000 + rate)
      const taxAmount = Math.round((lineTotal * branch.taxRateBps) / (10000 + branch.taxRateBps));
      items.push({
        productName: bp.variant.product.name,
        variantName: bp.variant.name,
        sku: bp.variant.sku,
        quantity: qty,
        unitPrice,
        originalUnitPrice: bp.sellingPrice,
        lineTotal,
        taxAmount,
        variant: { connect: { id: bp.variantId } },
        productId: bp.productId,
      });
    }

    const deliveryFee =
      fulfilment === 'DELIVERY'
        ? branch.freeDeliveryThreshold && subtotal >= branch.freeDeliveryThreshold
          ? 0
          : branch.deliveryFee
        : 0;
    const taxTotal = items.reduce((s, it) => s + (it.taxAmount ?? 0), 0);
    const total = subtotal + deliveryFee;
    const address = customer.addresses[0];

    const isPaid = status !== 'CANCELLED';
    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${String(orderSeq++).padStart(6, '0')}`,
        branchId: branch.id,
        customerId: customer.id,
        status,
        source,
        fulfilmentType: fulfilment,
        deliveryAddressId: fulfilment === 'DELIVERY' ? address?.id : null,
        deliveryAddress: address
          ? {
              recipientName: address.recipientName,
              line1: address.line1,
              city: address.city,
              postcode: address.postcode,
              country: address.country,
            }
          : Prisma.JsonNull,
        contactEmail: customer.email,
        contactPhone: customer.phone,
        subtotal,
        discountTotal: 0,
        taxTotal,
        deliveryFee,
        total,
        currency: 'GBP',
        placedAt,
        paidAt: isPaid ? new Date(placedAt.getTime() + 60_000) : null,
        createdAt: placedAt,
        items: { create: items },
        statusHistory: {
          create: [
            { to: 'PENDING', isSystem: true, createdAt: placedAt },
            ...(isPaid
              ? [{ to: 'PAID' as OrderStatus, isSystem: true, createdAt: new Date(placedAt.getTime() + 60_000) }]
              : []),
            { to: status, isSystem: true, createdAt: new Date(placedAt.getTime() + 120_000) },
          ],
        },
      },
    });

    if (isPaid) {
      const refunded = status === 'REFUNDED';
      const provider = source === 'CASH' ? 'cash' : source === 'POS' ? 'pos' : 'stripe';
      const paymentMethodSummary =
        source === 'CASH'
          ? { type: 'cash' }
          : source === 'POS'
            ? { type: 'card', brand: 'visa', last4: '1234', channel: 'pos' }
            : { type: 'card', brand: 'visa', last4: '4242', channel: 'online' };
      await prisma.payment.create({
        data: {
          orderId: order.id,
          status: refunded ? 'REFUNDED' : 'SUCCEEDED',
          provider,
          providerPaymentId: `${provider}_seed_${order.id}`,
          amount: total,
          amountRefunded: refunded ? total : 0,
          currency: 'GBP',
          paymentMethodSummary,
          createdAt: placedAt,
        },
      });
    }
  }
  console.log('Seeded 220 orders across 90 days');
}

async function seedContentAndCampaigns() {
  const faqs = [
    {
      question: 'How do click & collect orders work?',
      answer:
        'Choose Click & Collect at checkout, pick your branch, and we will notify you when your order is ready for collection.',
      category: 'Orders',
      sortOrder: 1,
    },
    {
      question: 'Can prices differ between branches?',
      answer:
        'Yes. Each branch can set its own selling price and availability while sharing the same master catalogue.',
      category: 'Shopping',
      sortOrder: 2,
    },
    {
      question: 'How do I track my order?',
      answer: 'Use Track order with your order number and the email used at checkout.',
      category: 'Orders',
      sortOrder: 3,
    },
  ];

  for (const faq of faqs) {
    const existing = await prisma.faq.findFirst({ where: { question: faq.question, deletedAt: null } });
    if (!existing) await prisma.faq.create({ data: faq });
  }

  const aboutSections = [
    {
      sectionKey: 'company',
      title: 'About Neighbourhood Market',
      body: 'We are a multi-branch convenience retailer serving local neighbourhoods across the UK with branch-aware pricing and stock.',
      sortOrder: 1,
    },
    {
      sectionKey: 'mission',
      title: 'Our mission',
      body: 'Make local retail feel personal — the right products, at the right branch, with transparent fulfilment options.',
      sortOrder: 2,
    },
    {
      sectionKey: 'contact',
      title: 'Contact HQ',
      body: 'Email support@neighbourhood.market or call your preferred store during opening hours.',
      sortOrder: 3,
    },
  ];

  for (const section of aboutSections) {
    await prisma.aboutContent.upsert({
      where: { sectionKey: section.sectionKey },
      create: { ...section, isPublished: true },
      update: { title: section.title, body: section.body, sortOrder: section.sortOrder },
    });
  }

  const methods = [
    {
      code: 'CARD',
      name: 'Card (Stripe)',
      description: 'Visa, Mastercard and Amex via Stripe',
      provider: 'stripe',
      sortOrder: 1,
    },
    {
      code: 'APPLE_PAY',
      name: 'Apple Pay',
      description: 'Available where Stripe wallets are enabled',
      provider: 'stripe',
      sortOrder: 2,
    },
    {
      code: 'GOOGLE_PAY',
      name: 'Google Pay',
      description: 'Available where Stripe wallets are enabled',
      provider: 'stripe',
      sortOrder: 3,
    },
  ];

  for (const method of methods) {
    await prisma.paymentMethodConfig.upsert({
      where: { code: method.code },
      create: { ...method, isEnabled: true },
      update: {
        name: method.name,
        description: method.description,
        provider: method.provider,
        sortOrder: method.sortOrder,
      },
    });
  }

  await seedStoreSettingsAndPlugins();

  const spring = await prisma.campaign.upsert({
    where: { slug: 'spring-energy-push' },
    create: {
      name: 'Spring energy push',
      slug: 'spring-energy-push',
      description: 'Promote energy drinks across all retail branches.',
      channel: 'MULTI',
      status: 'ACTIVE',
      content: {
        subject: 'Fuel your week — local deals in store',
        body: 'Stock up on energy favourites with branch-exclusive pricing this week.',
        ctaLabel: 'Shop now',
        ctaUrl: '/products',
      },
      audience: { segment: 'marketing_opt_in' },
    },
    update: { status: 'ACTIVE' },
  });

  const heroBanners = [
    {
      title: 'Your local shop, online',
      body: 'Pick your branch for accurate prices and stock. Delivery or click & collect from stores across the UK.',
      ctaLabel: 'Browse categories',
      ctaUrl: '/categories/energy-drinks',
      image:
        'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=1800&q=80',
      mobileImage:
        'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=900&q=80',
      priority: 10,
    },
    {
      title: 'Fresh deals at your branch',
      body: 'Energy drinks, snacks, and everyday essentials — priced for the store you shop.',
      ctaLabel: 'Shop deals',
      ctaUrl: '/products',
      image:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1800&q=80',
      mobileImage:
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80',
      priority: 20,
    },
    {
      title: 'Click & collect made easy',
      body: 'Order online and pick up from your nearest Neighbourhood Market when it suits you.',
      ctaLabel: 'Start shopping',
      ctaUrl: '/products',
      image:
        'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1800&q=80',
      mobileImage:
        'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=900&q=80',
      priority: 30,
    },
  ];

  for (const banner of heroBanners) {
    const existing = await prisma.banner.findFirst({
      where: { title: banner.title, type: 'HERO', deletedAt: null },
    });
    if (existing) {
      await prisma.banner.update({
        where: { id: existing.id },
        data: {
          ...banner,
          type: 'HERO',
          status: 'ACTIVE',
          isGlobal: true,
          startsAt: new Date('2020-01-01T00:00:00.000Z'),
          endsAt: null,
        },
      });
    } else {
      await prisma.banner.create({
        data: {
          ...banner,
          type: 'HERO',
          status: 'ACTIVE',
          isGlobal: true,
          startsAt: new Date('2020-01-01T00:00:00.000Z'),
          endsAt: null,
        },
      });
    }
  }

  console.log(
    `Seeded FAQs, about sections, payment methods, ${heroBanners.length} HERO banners, and campaign ${spring.slug}`,
  );
}

async function seedStoreSettingsAndPlugins() {
  const settings = [
    {
      key: 'store.details',
      value: {
        storeName: 'Neighbourhood Market',
        legalName: 'Neighbourhood Market Ltd',
        supportEmail: 'support@neighbourhood.market',
        supportPhone: '+44 20 7946 0000',
        addressLine1: '1 Market Square',
        addressLine2: '',
        city: 'London',
        postcode: 'EC1A 1BB',
        country: 'GB',
        website: '',
        logoUrl: '',
        timezone: 'Europe/London',
        currency: 'GBP',
        vatNumber: '',
        companyNumber: '',
        tagline: 'Your local shop, online',
      },
    },
    {
      key: 'social.links',
      value: {
        facebook: 'https://www.facebook.com/',
        instagram: 'https://www.instagram.com/',
        x: '',
        tiktok: '',
        youtube: '',
        linkedin: '',
      },
    },
    {
      key: 'delivery.defaults',
      value: {
        defaultDeliveryFee: 399,
        defaultFreeDeliveryThreshold: 2500,
        deliveryNotes:
          'Delivery fees are set per branch. Free delivery applies when the basket meets the branch threshold.',
        estimatedDeliveryHours: '2–4 hours (same day where available)',
        minOrderForDelivery: null,
      },
    },
  ];

  for (const item of settings) {
    const existing = await prisma.setting.findFirst({ where: { key: item.key, branchId: null } });
    if (existing) {
      await prisma.setting.update({ where: { id: existing.id }, data: { value: item.value } });
    } else {
      await prisma.setting.create({ data: { key: item.key, branchId: null, value: item.value } });
    }
  }

  const plugins = [
    {
      code: 'whatsapp_chat',
      name: 'WhatsApp chat',
      description: 'Floating WhatsApp button on the storefront for customer support.',
      category: 'chat',
      provider: 'whatsapp',
      sortOrder: 1,
      isEnabled: true,
      config: {
        phoneE164: '+447700900123',
        prefilledMessage: 'Hi, I need help with my order',
        buttonLabel: 'Chat on WhatsApp',
      },
    },
    {
      code: 'facebook_chat',
      name: 'Facebook / Messenger',
      description: 'Link customers to your Facebook Page or Messenger.',
      category: 'social',
      provider: 'facebook',
      sortOrder: 2,
      isEnabled: true,
      config: {
        pageUrl: 'https://www.facebook.com/',
        messengerUrl: '',
        showFloatingButton: false,
      },
    },
    {
      code: 'dpd_uk',
      name: 'DPD UK',
      description: 'UK parcel delivery partner (DPD).',
      category: 'delivery',
      provider: 'dpd',
      sortOrder: 10,
      config: { accountNumber: '', trackingBaseUrl: 'https://www.dpd.co.uk/tracking', notes: '' },
    },
    {
      code: 'evri_uk',
      name: 'Evri (Hermes)',
      description: 'UK nationwide parcel network formerly Hermes.',
      category: 'delivery',
      provider: 'evri',
      sortOrder: 11,
      config: { clientId: '', trackingBaseUrl: 'https://www.evri.com/track', notes: '' },
    },
    {
      code: 'royal_mail',
      name: 'Royal Mail',
      description: 'Royal Mail Tracked / Special Delivery for UK online orders.',
      category: 'delivery',
      provider: 'royal_mail',
      sortOrder: 12,
      config: {
        accountNumber: '',
        trackingBaseUrl: 'https://www.royalmail.com/track-your-item',
        notes: '',
      },
    },
    {
      code: 'yodel_uk',
      name: 'Yodel',
      description: 'Yodel UK parcel delivery partner.',
      category: 'delivery',
      provider: 'yodel',
      sortOrder: 13,
      config: { accountNumber: '', trackingBaseUrl: 'https://www.yodel.co.uk/track', notes: '' },
    },
    {
      code: 'stuart_uk',
      name: 'Stuart',
      description: 'On-demand urban courier for same-day local delivery in UK cities.',
      category: 'delivery',
      provider: 'stuart',
      sortOrder: 14,
      config: { clientId: '', city: 'london', notes: 'API keys stay in environment variables (STUART_*).' },
    },
    {
      code: 'gophr_uk',
      name: 'Gophr',
      description: 'London / UK same-day courier API for grocery-style fulfilment.',
      category: 'delivery',
      provider: 'gophr',
      sortOrder: 15,
      config: { apiKeyHint: 'Set GOPHR_API_KEY in environment', notes: '' },
    },
    {
      code: 'ups_uk',
      name: 'UPS UK',
      description: 'UPS domestic and international shipping from UK branches.',
      category: 'delivery',
      provider: 'ups',
      sortOrder: 16,
      config: { accountNumber: '', trackingBaseUrl: 'https://www.ups.com/track', notes: '' },
    },
    {
      code: 'dhl_express_uk',
      name: 'DHL Express',
      description: 'DHL Express for next-day / international parcels.',
      category: 'delivery',
      provider: 'dhl',
      sortOrder: 17,
      config: {
        accountNumber: '',
        trackingBaseUrl: 'https://www.dhl.com/gb-en/home/tracking.html',
        notes: '',
      },
    },
    {
      code: 'uber_eats',
      name: 'Uber Eats',
      description: 'Connect your stores to Uber Eats for marketplace orders and menu sync.',
      category: 'marketplace',
      provider: 'uber_eats',
      sortOrder: 20,
      config: {
        storeId: '',
        merchantId: '',
        sandbox: true,
        webhookPath: '/api/v1/webhooks/uber-eats',
        docsUrl: 'https://developer.uber.com/docs/eats',
        envVars: ['UBER_EATS_CLIENT_ID', 'UBER_EATS_CLIENT_SECRET', 'UBER_EATS_WEBHOOK_SECRET'],
        setupSteps: [
          'Create an Uber Eats developer app and note Client ID / Secret',
          'Set UBER_EATS_* environment variables and restart the API',
          'Enter your Uber Eats store / merchant IDs below',
          'Register the webhook URL in the Uber developer console',
          'Enable this app and map branches to Uber store IDs',
        ],
      },
    },
    {
      code: 'uber_direct',
      name: 'Uber Direct',
      description: 'On-demand courier delivery via Uber Direct for your own online orders.',
      category: 'marketplace',
      provider: 'uber',
      sortOrder: 21,
      config: {
        customerId: '',
        sandbox: true,
        webhookPath: '/api/v1/webhooks/uber-direct',
        docsUrl: 'https://developer.uber.com/docs/direct',
        envVars: ['UBER_DIRECT_CUSTOMER_ID', 'UBER_DIRECT_CLIENT_ID', 'UBER_DIRECT_CLIENT_SECRET'],
        setupSteps: [
          'Apply for Uber Direct and create API credentials',
          'Set UBER_DIRECT_* environment variables',
          'Enter Customer ID below and enable the app',
          'Test a quote + delivery create in sandbox before going live',
        ],
      },
    },
    {
      code: 'deliveroo',
      name: 'Deliveroo',
      description: 'Partner with Deliveroo for marketplace orders across UK cities.',
      category: 'marketplace',
      provider: 'deliveroo',
      sortOrder: 22,
      config: {
        brandId: '',
        siteId: '',
        sandbox: true,
        webhookPath: '/api/v1/webhooks/deliveroo',
        docsUrl: 'https://developers.deliveroo.com/',
        envVars: ['DELIVEROO_API_KEY', 'DELIVEROO_WEBHOOK_SECRET'],
        setupSteps: [
          'Request Deliveroo partner / developer access',
          'Set DELIVEROO_API_KEY and webhook secret in environment',
          'Add brand and site IDs for each branch mapping',
          'Enable the app and verify menu sync in sandbox',
        ],
      },
    },
    {
      code: 'just_eat',
      name: 'Just Eat',
      description: 'Just Eat Takeaway.com restaurant / grocery marketplace integration.',
      category: 'marketplace',
      provider: 'just_eat',
      sortOrder: 23,
      config: {
        restaurantId: '',
        partnerId: '',
        sandbox: true,
        webhookPath: '/api/v1/webhooks/just-eat',
        docsUrl: 'https://developer.just-eat.com/',
        envVars: ['JUST_EAT_API_KEY', 'JUST_EAT_WEBHOOK_SECRET'],
        setupSteps: [
          'Register as a Just Eat partner and create API credentials',
          'Set JUST_EAT_* environment variables',
          'Enter restaurant / partner IDs below',
          'Point webhooks at your API and enable the app',
        ],
      },
    },
    {
      code: 'doordash_drive',
      name: 'DoorDash Drive',
      description: 'DoorDash Drive white-label delivery for your own checkout orders.',
      category: 'marketplace',
      provider: 'doordash',
      sortOrder: 24,
      config: {
        developerId: '',
        externalStoreId: '',
        sandbox: true,
        webhookPath: '/api/v1/webhooks/doordash',
        docsUrl: 'https://developer.doordash.com/en-US/docs/drive/',
        envVars: ['DOORDASH_DEVELOPER_ID', 'DOORDASH_KEY_ID', 'DOORDASH_SIGNING_SECRET'],
        setupSteps: [
          'Create a DoorDash Drive developer account',
          'Set DOORDASH_* environment variables (JWT signing)',
          'Map external store IDs to branches',
          'Enable and run a sandbox delivery quote test',
        ],
      },
    },
    {
      code: 'getir',
      name: 'Getir',
      description: 'Getir grocery / quick commerce marketplace partnership.',
      category: 'marketplace',
      provider: 'getir',
      sortOrder: 25,
      config: {
        merchantId: '',
        warehouseId: '',
        sandbox: true,
        webhookPath: '/api/v1/webhooks/getir',
        docsUrl: 'https://developers.getir.com/',
        envVars: ['GETIR_API_KEY', 'GETIR_WEBHOOK_SECRET'],
        setupSteps: [
          'Request Getir partner API access',
          'Set GETIR_* secrets in environment',
          'Enter merchant / warehouse IDs',
          'Enable the app after webhook verification',
        ],
      },
    },
  ];

  for (const plugin of plugins) {
    await prisma.plugin.upsert({
      where: { code: plugin.code },
      create: {
        ...plugin,
        isEnabled: 'isEnabled' in plugin ? Boolean(plugin.isEnabled) : false,
      },
      update: {
        name: plugin.name,
        description: plugin.description,
        category: plugin.category,
        provider: plugin.provider,
        sortOrder: plugin.sortOrder,
        config: plugin.config,
      },
    });
  }

  console.log(`Seeded store settings and ${plugins.length} plugins`);
}

async function main() {
  console.log('Seeding database (development data)...');
  await seedPermissionsAndRoles();
  await seedBranches();
  await seedUsers();
  await seedCategories();
  await seedProducts();
  await seedBrands();
  await seedCustomers();
  await seedOrders();
  await seedContentAndCampaigns();
  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
