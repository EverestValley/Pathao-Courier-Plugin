import { Collection } from 'mongodb';

export interface PathaoSettings {
    enabled?: boolean;
    credential_storage?: 'database' | 'env';
    client_id?: string;
    client_secret?: string;
    username?: string;
    password?: string;
    store_id?: string;
    env?: 'sandbox' | 'production';
}

export interface PathaoTokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

export interface PathaoOrderPayload {
    store_id: number;
    merchant_order_id?: string;
    recipient_name: string;
    recipient_phone: string;
    recipient_secondary_phone?: string;
    recipient_address: string;
    recipient_city: number;
    recipient_zone: number;
    recipient_area?: number;
    delivery_type: number; // 48 | 24
    item_type: number; // 1 | 2
    special_instruction?: string;
    item_quantity: number;
    item_weight: number;
    item_description?: string;
    amount_to_collect: number;
}

export interface PathaoStorePayload {
    name: string;
    contact_name: string;
    contact_number: string;
    secondary_contact?: string;
    otp_number?: string;
    address: string;
    city_id: number;
    zone_id: number;
    area_id: number;
}

export interface PathaoPricePlanPayload {
    store_id?: number | string;
    item_type: number;
    delivery_type: number;
    item_weight: number;
    recipient_city: number;
    recipient_zone: number;
}

export interface PathaoClientConfig {
    pluginsCollection?: Collection;
    settings?: PathaoSettings;
}

export class PathaoClient {
    private pluginsCollection?: Collection;
    private envSettings?: PathaoSettings;
    private cachedToken: string | null = null;
    private tokenExpiry: number | null = null;

    constructor(config?: PathaoClientConfig) {
        if (config?.pluginsCollection) {
            this.pluginsCollection = config.pluginsCollection;
        }
        if (config?.settings) {
            this.envSettings = config.settings;
        }
    }

    async getSettings(): Promise<PathaoSettings> {
        let settings: Partial<PathaoSettings> = {};

        if (this.envSettings) {
            settings = { ...this.envSettings };
        } else if (this.pluginsCollection) {
            const dbSettings = await this.pluginsCollection.findOne({ name: 'pathao' });
            if (dbSettings) {
                settings = {
                    enabled: dbSettings.enabled,
                    credential_storage: dbSettings.credential_storage || 'database',
                    env: dbSettings.env || 'sandbox',
                    client_id: dbSettings.client_id,
                    client_secret: dbSettings.client_secret,
                    username: dbSettings.username,
                    password: dbSettings.password,
                    store_id: dbSettings.store_id,
                };
            }
        }

        const config: PathaoSettings = {
            enabled: settings.enabled ?? true,
            credential_storage: settings.credential_storage || 'env',
            env: settings.env || 'sandbox',
            ...settings
        };

        if (config.credential_storage === 'env') {
            config.client_id = process.env.PATHAO_CLIENT_ID || config.client_id;
            config.client_secret = process.env.PATHAO_CLIENT_SECRET || config.client_secret;
            config.username = process.env.PATHAO_USERNAME || config.username;
            config.password = process.env.PATHAO_PASSWORD || config.password;
            config.store_id = process.env.PATHAO_STORE_ID || config.store_id;
        }

        // We only enforce full credentials when actually building a request
        return config;
    }

    private getBaseUrl(env: string = 'sandbox') {
        return env === 'production' ? 'https://api-hermes.pathao.com' : 'https://courier-api-sandbox.pathao.com';
    }

    async getAccessToken(): Promise<string> {
        if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.cachedToken;
        }

        const settings = await this.getSettings();
        if (!settings.client_id || !settings.client_secret || !settings.username || !settings.password) {
            throw new Error('Pathao configuration is incomplete (Missing credentials).');
        }

        const baseUrl = this.getBaseUrl(settings.env);
        const response = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: settings.client_id,
                client_secret: settings.client_secret,
                grant_type: 'password',
                username: settings.username,
                password: settings.password,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Pathao Auth Failed: ${JSON.stringify(data)}`);
        }

        this.cachedToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 300000; // buffer 5 mins
        return this.cachedToken as string;
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const settings = await this.getSettings();
        const token = await this.getAccessToken();
        const baseUrl = this.getBaseUrl(settings.env);

        const headers = new Headers(options.headers || {});
        headers.set('Authorization', `Bearer ${token}`);
        headers.set('Content-Type', 'application/json');

        const response = await fetch(`${baseUrl}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json();
        return data;
    }

    async getCities() {
        return this.request('/aladdin/api/v1/city-list');
    }

    async getZones(cityId: number) {
        return this.request(`/aladdin/api/v1/cities/${cityId}/zone-list`);
    }

    async getAreas(zoneId: number) {
        return this.request(`/aladdin/api/v1/zones/${zoneId}/area-list`);
    }

    async createOrder(orderData: Partial<PathaoOrderPayload>) {
        const settings = await this.getSettings();
        const payload = {
            ...orderData,
            store_id: typeof settings.store_id === 'string' ? parseInt(settings.store_id) : settings.store_id
        };
        return this.request('/aladdin/api/v1/orders', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async createBulkOrder(orders: Partial<PathaoOrderPayload>[]) {
        const settings = await this.getSettings();
        const payload = {
            orders: orders.map(o => ({
                ...o,
                store_id: typeof settings.store_id === 'string' ? parseInt(settings.store_id) : settings.store_id
            }))
        };
        return this.request('/aladdin/api/v1/orders/bulk', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async getOrderInfo(consignmentId: string) {
        return this.request(`/aladdin/api/v1/orders/${consignmentId}/info`);
    }

    async calculatePrice(payload: PathaoPricePlanPayload) {
        const settings = await this.getSettings();
        const storeId = payload.store_id || settings.store_id;
        const data = {
            ...payload,
            store_id: typeof storeId === 'string' ? parseInt(storeId) : storeId
        };
        return this.request('/aladdin/api/v1/merchant/price-plan', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getStores() {
        return this.request('/aladdin/api/v1/stores');
    }

    async createStore(payload: PathaoStorePayload) {
        return this.request('/aladdin/api/v1/stores', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    // Retained from original source for compatibility if needed.
    async cancelOrder(consignmentId: string, reason: string = "Cancelled by Admin") {
        const settings = await this.getSettings();
        const payload = {
            store_id: typeof settings.store_id === 'string' ? parseInt(settings.store_id) : settings.store_id,
            reason
        };
        return this.request(`/aladdin/api/v1/orders/${consignmentId}/cancel`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }
}
