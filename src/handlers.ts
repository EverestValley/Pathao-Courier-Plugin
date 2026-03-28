import { NextResponse } from 'next/server';
import { PathaoClient } from './lib/pathao';
import type { Collection } from 'mongodb';

export interface PathaoHandlersConfig {
    pathaoClient: PathaoClient;
    ordersCollection?: Collection;
    pluginsCollection?: Collection;
    webhookSecret?: string;
}

export function createPathaoHandlers(config: PathaoHandlersConfig) {
    const { pathaoClient, ordersCollection, pluginsCollection, webhookSecret } = config;

    const createOrderHandler = async (request: Request) => {
        try {
            const body = await request.json();
            const { orderId, courierData } = body;

            if (!orderId) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
            if (!courierData) return NextResponse.json({ error: 'Courier data is required' }, { status: 400 });

            const requiredFields = ['recipient_name', 'recipient_phone', 'recipient_address', 'recipient_city', 'recipient_zone', 'amount_to_collect', 'item_quantity', 'item_weight'];
            for (const field of requiredFields) {
                if (courierData[field] === undefined || courierData[field] === null || courierData[field] === '') {
                    return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
                }
            }

            const payload = {
                merchant_order_id: orderId,
                recipient_name: courierData.recipient_name,
                recipient_phone: courierData.recipient_phone,
                recipient_address: courierData.recipient_address,
                recipient_city: parseInt(courierData.recipient_city),
                recipient_zone: parseInt(courierData.recipient_zone),
                recipient_area: courierData.recipient_area ? parseInt(courierData.recipient_area) : undefined,
                delivery_type: 48,
                item_type: 1,
                special_instruction: courierData.special_instruction,
                item_quantity: parseInt(courierData.item_quantity),
                item_weight: parseFloat(courierData.item_weight),
                amount_to_collect: parseInt(courierData.amount_to_collect),
                item_description: courierData.item_description,
                store_id: 0 // Will be overridden by client
            };

            const pathaoResponse = await pathaoClient.createOrder(payload);

            if (pathaoResponse.type === 'error' || pathaoResponse.errors) {
                const errorMessage = pathaoResponse.message || JSON.stringify(pathaoResponse.errors);
                return NextResponse.json({ error: `Pathao Error: ${errorMessage}`, details: pathaoResponse.errors }, { status: 400 });
            }

            const consignmentId = pathaoResponse.data?.consignment_id;
            if (consignmentId && ordersCollection) {
                await ordersCollection.updateOne(
                    { _id: orderId as any },
                    {
                        $set: {
                            tracking_id: consignmentId,
                            consignment_id: consignmentId,
                            tracking_status: 'Processing',
                            courier_provider: 'pathao',
                            courier_data: {
                                ...pathaoResponse.data,
                                created_at: new Date()
                            }
                        }
                    }
                );
            }

            return NextResponse.json({ success: true, data: pathaoResponse.data });

        } catch (error: any) {
            console.error('Create Pathao Order Error:', error);
            return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
        }
    };

    const proxyHandler = async (request: Request) => {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const parentId = searchParams.get('parentId');

        try {
            let data;
            switch (type) {
                case 'city': data = await pathaoClient.getCities(); break;
                case 'zone':
                    if (!parentId) return NextResponse.json({ error: 'parentId required for zones' }, { status: 400 });
                    data = await pathaoClient.getZones(parseInt(parentId));
                    break;
                case 'area':
                    if (!parentId) return NextResponse.json({ error: 'parentId required for areas' }, { status: 400 });
                    data = await pathaoClient.getAreas(parseInt(parentId));
                    break;
                default:
                    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
            }
            return NextResponse.json(data);
        } catch (error: any) {
            console.error('Pathao Proxy Error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    };

    const webhookHandler = async (request: Request) => {
        try {
            const signature = request.headers.get('X-PATHAO-Signature');
            const body = await request.json();

            const configuredSecret = webhookSecret || process.env.PATHAO_WEBHOOK_SECRET;
            if (configuredSecret && signature !== configuredSecret) {
                console.warn('Pathao Webhook: Invalid Signature');
            }

            const { event, consignment_id } = body;
            
            if (consignment_id && ordersCollection) {
                let status = 'Pending';
                switch (event) {
                    case 'order.created': status = 'Processing'; break;
                    case 'order.picked': status = 'Shipped'; break;
                    case 'order.delivered': status = 'Delivered'; break;
                    case 'order.delivery-failed': status = 'Failed'; break;
                    case 'order.returned': status = 'Returned'; break;
                    case 'order.cancelled': status = 'Cancelled'; break;
                    default: status = 'Processing';
                }

                await ordersCollection.updateOne(
                    { consignment_id: consignment_id },
                    {
                        $set: {
                            tracking_status: status,
                            'courier_data.last_event': event,
                            'courier_data.updated_at': new Date()
                        }
                    }
                );
            }

            const statusCode = event === 'webhook_integration' ? 202 : 200;
            return new NextResponse(JSON.stringify({ message: "Received" }), {
                status: statusCode,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Pathao-Merchant-Webhook-Integration-Secret': 'f3992ecc-59da-4cbe-a049-a13da2018d51'
                }
            });

        } catch (error) {
            console.error('Pathao Webhook Error:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    };

    const settingsGetHandler = async () => {
        try {
            if (!pluginsCollection) throw new Error("pluginsCollection is not configured for PathaoHandlers");
            const settings = await pluginsCollection.findOne({ name: 'pathao' });
            return NextResponse.json(settings || {});
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    };

    const settingsPostHandler = async (request: Request) => {
        try {
            if (!pluginsCollection) throw new Error("pluginsCollection is not configured for PathaoHandlers");
            const body = await request.json();
            
            if (!body.client_id || !body.client_secret) {
                return NextResponse.json({ error: "Client ID and Secret are required" }, { status: 400 });
            }

            await pluginsCollection.updateOne(
                { name: 'pathao' },
                { $set: { ...body, name: 'pathao', updated_at: new Date() } },
                { upsert: true }
            );

            return NextResponse.json({ success: true, message: "Settings saved successfully" });
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    };

    return {
        createOrderHandler,
        proxyHandler,
        webhookHandler,
        settingsGetHandler,
        settingsPostHandler
    };
}
