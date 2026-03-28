'use client';

import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Database, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export interface PathaoSettingsFormProps {
    apiBaseUrl?: string;
}

export function PathaoSettingsForm({ apiBaseUrl = '/api/settings' }: PathaoSettingsFormProps) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState({
        enabled: false,
        env: 'sandbox',
        credential_storage: 'database',
        client_id: '',
        client_secret: '',
        username: '',
        password: '',
        store_id: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch(apiBaseUrl);
            if (res.ok) {
                const data = await res.json();
                if (data && Object.keys(data).length > 0) {
                    setSettings(prev => ({ ...prev, ...data }));
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        setSettings({ ...settings, [e.target.name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch(apiBaseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Settings saved successfully");
            } else {
                toast.error(data.error || "Failed to save");
            }
        } catch (error) {
            toast.error("Error saving settings");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Loading settings...</div>;

    const isEnvStorage = settings.credential_storage === 'env';

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-sm border max-w-4xl mx-auto text-black">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <img src="https://pathao.com/wp-content/uploads/2019/02/Pathao-Logo-Icon-RGB.png" alt="Pathao" className="w-8 h-8 rounded" />
                    Pathao Configuration
                </h2>
                <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            name="enabled"
                            checked={settings.enabled}
                            onChange={handleChange}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none ring-4 ring-transparent rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-red-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900">Enable</span>
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* General Settings */}
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold border-b pb-2">Environment</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
                        <select
                            name="env"
                            value={settings.env}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-lg focus:ring-red-500"
                        >
                            <option value="sandbox">Sandbox (Test)</option>
                            <option value="production">Production (Live)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Credential Storage</label>
                        <div className="flex gap-4">
                            <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 ${!isEnvStorage ? 'bg-red-50 border-red-500' : ''}`}>
                                <input
                                    type="radio"
                                    name="credential_storage"
                                    value="database"
                                    checked={!isEnvStorage}
                                    onChange={handleChange}
                                    className="text-red-600"
                                />
                                <Database size={18} />
                                <div>
                                    <div className="font-medium">Database</div>
                                    <div className="text-xs text-gray-500">Store in DB (Easier)</div>
                                </div>
                            </label>
                            <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 ${isEnvStorage ? 'bg-blue-50 border-blue-500' : ''}`}>
                                <input
                                    type="radio"
                                    name="credential_storage"
                                    value="env"
                                    checked={isEnvStorage}
                                    onChange={handleChange}
                                    className="text-blue-600"
                                />
                                <Lock size={18} />
                                <div>
                                    <div className="font-medium">Environment Variables</div>
                                    <div className="text-xs text-gray-500">Use .env (More Secure)</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Credentials */}
                <div className="space-y-6">
                    <h3 className="text-lg font-semibold border-b pb-2">API Credentials</h3>

                    {isEnvStorage ? (
                        <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm flex items-start gap-2">
                            <AlertCircle size={18} className="mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium">Using Environment Variables</p>
                                <p className="mt-1">Please add the following to your <code>.env.local</code> file:</p>
                                <pre className="bg-blue-100 p-2 mt-2 rounded text-xs overflow-x-auto">
                                    PATHAO_CLIENT_ID=...{'\n'}
                                    PATHAO_CLIENT_SECRET=...{'\n'}
                                    PATHAO_USERNAME=...{'\n'}
                                    PATHAO_PASSWORD=...{'\n'}
                                    PATHAO_STORE_ID=...{'\n'}
                                    PATHAO_WEBHOOK_SECRET=...
                                </pre>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Client ID</label>
                                <input
                                    name="client_id"
                                    value={settings.client_id}
                                    onChange={handleChange}
                                    className="w-full mt-1 p-2 border rounded-lg"
                                    disabled={isEnvStorage}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Client Secret</label>
                                <input
                                    type="password"
                                    name="client_secret"
                                    value={settings.client_secret}
                                    onChange={handleChange}
                                    className="w-full mt-1 p-2 border rounded-lg"
                                    disabled={isEnvStorage}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Username (Email)</label>
                                <input
                                    name="username"
                                    value={settings.username}
                                    onChange={handleChange}
                                    className="w-full mt-1 p-2 border rounded-lg"
                                    disabled={isEnvStorage}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={settings.password}
                                        onChange={handleChange}
                                        className="w-full mt-1 p-2 border rounded-lg"
                                        disabled={isEnvStorage}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Store ID</label>
                                    <input
                                        name="store_id"
                                        value={settings.store_id}
                                        onChange={handleChange}
                                        className="w-full mt-1 p-2 border rounded-lg"
                                        disabled={isEnvStorage}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-8 pt-6 border-t flex justify-end">
                <button
                    type="submit"
                    disabled={saving}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </form>
    );
}

