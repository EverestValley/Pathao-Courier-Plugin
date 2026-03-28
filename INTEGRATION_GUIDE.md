# Pathao Plugin Integration Guide

This guide details how to integrate the newly refactored `pathao-nextjs` NPM package into your application.

## 1. Installation

```bash
npm install pathao-nextjs
```

Ensure your project also has `lucide-react`, `react-hot-toast`, and `mongodb` if using the built-in integrations.

## 2. Setting Up the Global API Handlers

Create a catch-all route handler to let the plugin manage API logic.

`app/api/pathao/[...pathao]/route.ts`:
```typescript
import { createPathaoHandlers, PathaoClient } from 'pathao-nextjs';
import clientPromise from '@/lib/mongodb';

// Initialize the Pathao API client
const pathaoClient = new PathaoClient();

const getHandlers = async () => {
    const db = (await clientPromise).db();
    return createPathaoHandlers({
        pathaoClient,
        ordersCollection: db.collection('orders'),
        pluginsCollection: db.collection('plugins')
    });
};

export async function POST(req: Request, { params }: { params: { pathao: string[] } }) {
    const handlers = await getHandlers();
    const route = params.pathao[0];
    
    if (route === 'create-order') return handlers.createOrderHandler(req);
    if (route === 'webhook') return handlers.webhookHandler(req);
    if (route === 'settings') return handlers.settingsPostHandler(req);
    
    return new Response("Not Found", { status: 404 });
}

export async function GET(req: Request, { params }: { params: { pathao: string[] } }) {
    const handlers = await getHandlers();
    const route = params.pathao[0];
    
    if (route === 'proxy') return handlers.proxyHandler(req);
    if (route === 'settings') return handlers.settingsGetHandler();
    
    return new Response("Not Found", { status: 404 });
}
```

## 3. Webhook Configuration
Deploy your application, go to Pathao Developer Portal / Merchant Dashboard, and set your Webhook URL to `https://your-domain.com/api/pathao/webhook`.
Grab the Secret key provided by Pathao and save it in your `.env.local` as `PATHAO_WEBHOOK_SECRET`.

## 4. UI Components

### Settings Form

```tsx
import { PathaoSettingsForm } from 'pathao-nextjs';

export default function SettingsPage() {
    return (
        <div>
           <PathaoSettingsForm apiBaseUrl="/api/pathao/settings" />
        </div>
    )
}
```

### Shipping Modal

```tsx
import { PathaoShippingModal } from 'pathao-nextjs';

<PathaoShippingModal 
    isOpen={showModal}
    onClose={() => setShowModal(false)}
    orderId={order._id}
    customerName={order.recipient.name}
    customerPhone={order.recipient.phone}
    customerAddress={order.recipient.address}
    amountToCollect={order.total}
    apiBaseUrl="/api/pathao"
/>
```

---
**Enjoy your seamless Pathao Integration!**
