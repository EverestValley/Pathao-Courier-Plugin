'use client';

import React, { useState, useEffect } from 'react';
import { Search, MapPin, Truck, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { PATHAO_LOCATIONS } from '../lib/pathao-locations-list';

export interface PathaoShippingModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    estimatedWeight?: number;
    amountToCollect?: number;
    onSuccess?: (data: any) => void;
    apiBaseUrl?: string;
}

export function PathaoShippingModal({
    isOpen,
    onClose,
    orderId,
    customerName,
    customerPhone,
    customerAddress,
    estimatedWeight = 1,
    amountToCollect = 0,
    onSuccess,
    apiBaseUrl = '/api/pathao'
}: PathaoShippingModalProps) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        recipient_name: customerName,
        recipient_phone: customerPhone,
        recipient_address: customerAddress,
        amount_to_collect: amountToCollect,
        item_quantity: 1,
        item_weight: estimatedWeight,
        item_description: '',
        special_instruction: ''
    });

    // Location State
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
    const [resolvingDetails, setResolvingDetails] = useState(false);

    // Resolved IDs
    const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
    const [selectedZoneId, setSelectedZoneId] = useState<number | null>(null);
    const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

    // Filter locations based on search
    useEffect(() => {
        if (searchTerm.length > 2) {
            const results = PATHAO_LOCATIONS.filter(loc =>
                loc.toLowerCase().includes(searchTerm.toLowerCase())
            ).slice(0, 10); // Limit results
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    }, [searchTerm]);

    // Handle inputs
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Location Resolution Logic
    const resolveLocationIds = async (locationString: string) => {
        setResolvingDetails(true);
        const [cityName, zoneName, areaName] = locationString.split(' / ').map(s => s?.trim());

        try {
            // 1. Fetch Cities
            const cityRes = await fetch(`${apiBaseUrl}/proxy?type=city`);
            if (!cityRes.ok) throw new Error("Failed to fetch cities.");
            const cityData = await cityRes.json();

            // Pathao API response structure check
            const cityList = cityData.data?.data || cityData.data || [];
            const city = cityList.find((c: any) => c.city_name?.toLowerCase() === cityName?.toLowerCase());

            if (!city) throw new Error(`City '${cityName}' not found.`);
            setSelectedCityId(city.city_id);

            // 2. Fetch Zones
            const zoneRes = await fetch(`${apiBaseUrl}/proxy?type=zone&parentId=${city.city_id}`);
            const zoneData = await zoneRes.json();
            const zoneList = zoneData.data?.data || zoneData.data || [];
            const zone = zoneList.find((z: any) => z.zone_name?.toLowerCase() === zoneName?.toLowerCase());

            if (!zone) throw new Error(`Zone '${zoneName}' not found.`);
            setSelectedZoneId(zone.zone_id);

            // 3. Fetch Areas (Optional)
            let areaId = null;
            if (areaName) {
                const areaRes = await fetch(`${apiBaseUrl}/proxy?type=area&parentId=${zone.zone_id}`);
                const areaData = await areaRes.json();
                const areaList = areaData.data?.data || areaData.data || [];
                const area = areaList.find((a: any) => a.area_name?.toLowerCase() === areaName?.toLowerCase());
                if (area) areaId = area.area_id;
            }
            setSelectedAreaId(areaId);

            toast.success("Location verified!");
        } catch (error: any) {
            console.error("Resolution Error:", error);
            toast.error(error.message || "Failed to resolve location.");
            setSelectedCityId(null);
            setSelectedZoneId(null);
            setSelectedAreaId(null);
        } finally {
            setResolvingDetails(false);
        }
    };

    const handleLocationSelect = (loc: string) => {
        setSelectedLocation(loc);
        setSearchTerm(loc);
        setSearchResults([]);
        resolveLocationIds(loc);
    };

    const handleSubmit = async () => {
        if (!selectedCityId || !selectedZoneId) {
            toast.error("Please select a valid location first.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                orderId,
                courierData: {
                    ...formData,
                    recipient_city: selectedCityId,
                    recipient_zone: selectedZoneId,
                    recipient_area: selectedAreaId
                }
            };

            const res = await fetch(`${apiBaseUrl}/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to create order');

            toast.success("Order shipped via Pathao!");
            if (onSuccess) onSuccess(data.data);
            onClose();

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm text-black">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-red-600 text-white rounded-t-xl">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Truck size={24} /> Ship with Pathao
                    </h2>
                    <button onClick={onClose} className="hover:bg-red-700 p-1 rounded">✕</button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 flex-1">
                    {/* Location Search */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Destination Location (Type to search)
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                placeholder="e.g. Kathmandu / Koteshwor..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setSelectedLocation(null);
                                    setSelectedCityId(null);
                                }}
                            />
                        </div>
                        {/* Dropdown */}
                        {searchResults.length > 0 && (
                            <ul className="absolute z-10 w-full bg-white border rounded-b-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                                {searchResults.map((loc, idx) => (
                                    <li
                                        key={idx}
                                        onClick={() => handleLocationSelect(loc)}
                                        className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                    >
                                        <MapPin className="inline-block w-4 h-4 mr-2 text-gray-400" />
                                        {loc}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {resolvingDetails && <p className="text-xs text-blue-500 mt-1">Verifying location details...</p>}
                        {selectedLocation && selectedCityId && (
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                <MapPin size={12} /> Verified: {selectedLocation}
                            </p>
                        )}
                    </div>

                    {/* Recipient Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Recipient Name</label>
                            <input
                                name="recipient_name"
                                value={formData.recipient_name}
                                onChange={handleChange}
                                className="w-full mt-1 p-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Phone</label>
                            <input
                                name="recipient_phone"
                                value={formData.recipient_phone}
                                onChange={handleChange}
                                className="w-full mt-1 p-2 border rounded-lg"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Full Address</label>
                            <input
                                name="recipient_address"
                                value={formData.recipient_address}
                                onChange={handleChange}
                                className="w-full mt-1 p-2 border rounded-lg"
                            />
                        </div>
                    </div>

                    {/* Packet Details */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">COD Amount</label>
                            <input
                                type="number"
                                name="amount_to_collect"
                                value={formData.amount_to_collect}
                                onChange={handleChange}
                                className="w-full mt-1 p-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Weight (kg)</label>
                            <input
                                type="number"
                                step="0.1"
                                name="item_weight"
                                value={formData.item_weight}
                                onChange={handleChange}
                                className="w-full mt-1 p-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Quantity</label>
                            <input
                                type="number"
                                name="item_quantity"
                                value={formData.item_quantity}
                                onChange={handleChange}
                                className="w-full mt-1 p-2 border rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !selectedCityId}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Confirm Shipment
                    </button>
                </div>
            </div>
        </div>
    );
}

