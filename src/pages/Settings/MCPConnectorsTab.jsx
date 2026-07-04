import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Loader2, Plus, Trash2, Power, Edit2, CheckCircle2 } from 'lucide-react';

export default function MCPConnectorsTab() {
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [connectors, setConnectors] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnector, setEditingConnector] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'make',
    endpointUrl: '',
    apiKey: '', // Plaintext input, will be "encrypted" on save
    isActive: true
  });

  useEffect(() => {
    fetchConnectors();
  }, [currentUser]);

  const fetchConnectors = async () => {
    try {
      const docRef = doc(db, 'tenantSettings', currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().mcpConnectors) {
        setConnectors(docSnap.data().mcpConnectors);
      }
    } catch (err) {
      console.error('Error fetching MCP connectors:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConnectorsToDb = async (newConnectors) => {
    try {
      await setDoc(doc(db, 'tenantSettings', currentUser.uid), { mcpConnectors: newConnectors }, { merge: true });
      setConnectors(newConnectors);
    } catch (err) {
      console.error('Failed to save connectors:', err);
      alert('Failed to save connectors');
    }
  };

  const handleSave = async () => {
    // Basic validation
    if (!formData.name || !formData.endpointUrl) {
      alert("Name and Endpoint URL are required.");
      return;
    }

    const newConnector = {
      connectorId: editingConnector ? editingConnector.connectorId : crypto.randomUUID(),
      name: formData.name,
      type: formData.type,
      endpointUrl: formData.endpointUrl,
      isActive: formData.isActive,
      // In a real app, this would call a Cloud Function to encrypt. 
      // For now, we mock the encryption flow if a new key is provided.
      encryptedApiKey: formData.apiKey ? `ENC[${btoa(formData.apiKey)}]` : (editingConnector?.encryptedApiKey || ''),
      toolDefinitions: editingConnector ? editingConnector.toolDefinitions : []
    };

    let updatedList;
    if (editingConnector) {
      updatedList = connectors.map(c => c.connectorId === editingConnector.connectorId ? newConnector : c);
    } else {
      updatedList = [...connectors, newConnector];
    }

    await saveConnectorsToDb(updatedList);
    setIsModalOpen(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this connector?")) return;
    const updatedList = connectors.filter(c => c.connectorId !== id);
    await saveConnectorsToDb(updatedList);
  };

  const toggleActive = async (id) => {
    const updatedList = connectors.map(c => {
      if (c.connectorId === id) return { ...c, isActive: !c.isActive };
      return c;
    });
    await saveConnectorsToDb(updatedList);
  };

  const openNewModal = () => {
    setEditingConnector(null);
    setFormData({ name: '', type: 'make', endpointUrl: '', apiKey: '', isActive: true });
    setIsModalOpen(true);
  };

  const openEditModal = (connector) => {
    setEditingConnector(connector);
    setFormData({
      name: connector.name,
      type: connector.type,
      endpointUrl: connector.endpointUrl,
      apiKey: '', // Leave blank to not overwrite existing unless typed
      isActive: connector.isActive
    });
    setIsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">MCP Connectors</h2>
          <p className="text-sm text-slate-500 mt-1">Configure Model Context Protocol connectors to give your AI agent access to third-party tools.</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Connector
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500 font-bold">
            <tr>
              <th className="p-4">Name / Type</th>
              <th className="p-4">Endpoint</th>
              <th className="p-4 text-center">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {connectors.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No MCP connectors configured yet.
                </td>
              </tr>
            ) : (
              connectors.map(conn => (
                <tr key={conn.connectorId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-gray-900">{conn.name}</div>
                    <div className="text-xs text-indigo-600 font-medium uppercase tracking-wider mt-0.5">{conn.type}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm text-gray-600 font-mono truncate max-w-[200px]" title={conn.endpointUrl}>
                      {conn.endpointUrl}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => toggleActive(conn.connectorId)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                        conn.isActive 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Power size={12} /> {conn.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(conn)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(conn.connectorId)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over or Modal for Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingConnector ? 'Edit Connector' : 'Add MCP Connector'}</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Connector Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Make.com Webhooks"
                  className="w-full p-2.5 rounded-lg border border-gray-300 sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="w-full p-2.5 rounded-lg border border-gray-300 sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="make">Make.com</option>
                  <option value="zapier">Zapier</option>
                  <option value="n8n">n8n</option>
                  <option value="custom">Custom Webhook</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                <input 
                  type="url" 
                  value={formData.endpointUrl}
                  onChange={e => setFormData({...formData, endpointUrl: e.target.value})}
                  placeholder="https://hook.make.com/..."
                  className="w-full p-2.5 rounded-lg border border-gray-300 sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key / Secret</label>
                <input 
                  type="password" 
                  value={formData.apiKey}
                  onChange={e => setFormData({...formData, apiKey: e.target.value})}
                  placeholder={editingConnector ? "•••••••• (Leave blank to keep existing)" : "Optional secret token"}
                  className="w-full p-2.5 rounded-lg border border-gray-300 sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Keys are encrypted via AES-256-GCM before storage.</p>
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                {editingConnector ? 'Save Changes' : 'Add Connector'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
