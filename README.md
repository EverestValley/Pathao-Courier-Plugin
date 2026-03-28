# Pathao Courier Plugin for Next.js

A production-ready, open-source Next.js plugin for seamlessly integrating the Pathao Courier Merchant API.

## Features
-   **Full API Coverage**: Includes Bulk Orders, Price Calculation, Store Management.
-   **Authentication**: Secure OAuth 2.0 token management with caching and expiration handling.
-   **Proxy API Handlers**: Securely expose City/Zone/Area data to the frontend.
-   **Webhooks**: Real-time order status updates with secure signature verification.
-   **Admin UI**: Ready-to-use React Server Components (Settings Form, Shipping Modal).
-   **Universal Support**: Decoupled from hardcoded database paths, fully injectible MongoDB support.

## Installation

```bash
# Add to your project
npm install pathao-nextjs
```

## Environment Variables
Create a `.env.local` to securely store your variables:

```env
PATHAO_CLIENT_ID=your_client_id
PATHAO_CLIENT_SECRET=your_client_secret
PATHAO_USERNAME=your_email
PATHAO_PASSWORD=your_password
PATHAO_STORE_ID=your_store_id
PATHAO_WEBHOOK_SECRET=your_generated_secret
```

## Setup API Routes

Create a Next.js API route that registers the plugin handlers.

```typescript
// app/api/pathao/...
import { createPathaoHandlers, PathaoClient } from 'pathao-nextjs';
import clientPromise from '@/lib/mongodb'; // Your existing DB setup

const client = new PathaoClient();

export async function GET(req: Request) {
    const db = (await clientPromise).db();
    const handlers = createPathaoHandlers({
        pathaoClient: client,
        ordersCollection: db.collection('orders'),
        pluginsCollection: db.collection('plugins')
    });
    
    // Choose the right handler based on pathname
    return handlers.proxyHandler(req);
}
```

Please see `INTEGRATION_GUIDE.md` for full implementation examples.

## Community & Support
If you have any questions, run into issues, or just want to connect, feel free to reach out!
- 💬 **Discord Community:** [Join the server](https://discord.com/invite/5Fh6UZRp)
- 🤝 **Connect with the Author:** [Yogesh Singh on LinkedIn](https://www.linkedin.com/in/yogesh-singh-479a38262)

## Legal Disclaimer & Official Credits
This is an unofficial, community-driven project and is **not** officially affiliated with, maintained by, or endorsed by **[Pathao Ltd](https://pathao.com/)**. 
All trademarks, logos, and brand names are the property of their respective owners. The official Pathao Developer API documentation can be found [here](https://parcel.pathao.com/courier/developer-api). Please use this package responsibly and in full compliance with Pathao's official Terms of Service.
