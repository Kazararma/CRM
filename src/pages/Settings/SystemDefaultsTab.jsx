import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Loader2, Key, Save, RefreshCw, Copy, Check } from 'lucide-react';

export default function SystemDefaultsTab() {
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const [settings, setSettings] = useState({
    defaultImportMode: 'manual',
    defaultExecutionMode: 'manual',
    webhookEnabled: false,
    websiteWebhookSecret: ''
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'tenantSettings', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [currentUser]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, 'tenantSettings', currentUser.uid), settings, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const generateSecret = () => {
    const randomSecret = 'whsec_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    setSettings(prev => ({ ...prev, websiteWebhookSecret: randomSecret }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(settings.websiteWebhookSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8 animate-in fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900">System Defaults</h2>
        <p className="text-sm text-slate-500 mt-1">Configure global default behaviors for imports and autonomous workflows.</p>
      </div>

      <div className="space-y-6 bg-white border border-gray-200 rounded-xl p-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2">Import & Execution Defaults</h3>
          <div className="space-y-5">
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Import Mode</label>
              <select
                value={settings.defaultImportMode}
                onChange={(e) => setSettings({ ...settings, defaultImportMode: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              >
                <option value="manual">Manual (Always review in staging)</option>
                <option value="automatic">Automatic (Auto-commit if 0 errors)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Execution Mode (for new leads)</label>
              <select
                value={settings.defaultExecutionMode}
                onChange={(e) => setSettings({ ...settings, defaultExecutionMode: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
              >
                <option value="manual">Manual</option>
                <option value="hybrid">Hybrid (Human approval required per prompt)</option>
                <option value="automatic">Automatic (Fully autonomous)</option>
              </select>
            </div>

          </div>
        </div>

        <div className="pt-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b pb-2">Website Webhook Intake</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="webhookEnabled"
                checked={settings.webhookEnabled}
                onChange={(e) => setSettings({ ...settings, webhookEnabled: e.target.checked })}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="webhookEnabled" className="text-sm font-medium text-gray-700">Enable Webhook Intake (POST to /api/webhook/lead-intake)</label>
            </div>

            {settings.webhookEnabled && (
              <div className="pl-6 space-y-3">
                <label className="block text-sm font-medium text-gray-700">Webhook Secret Key (HMAC-SHA256)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={settings.websiteWebhookSecret}
                    className="flex-1 rounded-md border-gray-300 bg-gray-50 text-gray-500 sm:text-sm p-2 border font-mono"
                    placeholder="Click generate to create a secret..."
                  />
                  <button 
                    onClick={copyToClipboard}
                    disabled={!settings.websiteWebhookSecret}
                    className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
                    title="Copy Secret"
                  >
                    {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} className="text-gray-600" />}
                  </button>
                  <button 
                    onClick={generateSecret}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                  >
                    <RefreshCw size={16} /> Generate
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Use this secret to sign your incoming webhook requests via the `X-Webhook-Secret` header.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Save Settings
          </button>
          
          {saveSuccess && (
            <span className="text-emerald-600 text-sm font-bold flex items-center gap-1 animate-in fade-in">
              <Check size={18} /> Saved successfully!
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
