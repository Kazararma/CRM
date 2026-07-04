const { getFirestore } = require('firebase-admin/firestore');
const axios = require('axios');
const { decryptField } = require('../utils/decryptField');
const crypto = require('crypto');

/**
 * A10: MCPRouter — Model Context Protocol Connector Router
 *
 * Routes tool calls from the AI agent to configured third-party connectors.
 * All API keys are decrypted in-memory; never logged or persisted.
 *
 * Built-in connector types: vapi, twilio, make, zapier, n8n, custom
 */
class MCPRouter {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.db = getFirestore();
  }

  /**
   * Fetch all active MCP connectors for this tenant from Firestore.
   */
  async getActiveConnectors() {
    const snap = await this.db
      .collection('tenants')
      .doc(this.tenantId)
      .collection('config')
      .doc('aiSettings')
      .get();

    if (!snap.exists) return [];
    const settings = snap.data();
    return (settings.mcpConnectors ?? []).filter((c) => c.isActive);
  }

  /**
   * Get a specific connector by ID.
   */
  async getActiveConnector(connectorId) {
    const connectors = await this.getActiveConnectors();
    const connector = connectors.find((c) => c.connectorId === connectorId);
    if (!connector) {
      throw new Error(`MCP connector "${connectorId}" not found or inactive.`);
    }
    return connector;
  }

  /**
   * List all available tool definitions across all active connectors.
   * Used to inject tool list into AI system prompts.
   */
  async listAvailableTools() {
    const connectors = await this.getActiveConnectors();
    return connectors.flatMap((c) =>
      (c.toolDefinitions ?? []).map((tool) => ({
        ...tool,
        connectorId: c.connectorId,
        connectorName: c.name,
        connectorType: c.type,
      }))
    );
  }

  /**
   * Format available tools as a text block for injection into AI prompts.
   */
  async getToolsPromptBlock() {
    const tools = await this.listAvailableTools();
    if (tools.length === 0) return '';

    const lines = tools.map(
      (t) =>
        `- Tool: "${t.name}" (${t.connectorName})\n  Description: ${t.description}\n  Required inputs: ${Object.keys(t.inputSchema?.properties ?? {}).join(', ')}`
    );

    return `## AVAILABLE TOOLS\nYou have access to the following tools. To use one, include a JSON block in your response:\n{"tool_call": {"connectorId": "...", "toolName": "...", "input": {...}}}\n\n${lines.join('\n\n')}`;
  }

  /**
   * Execute a tool call from the AI agent.
   * Validates input schema, decrypts API key, and POSTs to the connector endpoint.
   */
  async callTool(connectorId, toolName, input) {
    const connector = await this.getActiveConnector(connectorId);
    const toolDef = connector.toolDefinitions?.find((t) => t.name === toolName);

    if (!toolDef) {
      throw new Error(`Tool "${toolName}" not found in connector "${connectorId}".`);
    }

    // Decrypt API key if present
    let apiKey = null;
    if (connector.encryptedApiKey) {
      const secretStr = process.env.ENCRYPTION_SECRET || '';
      const secret = /^[0-9a-fA-F]{64}$/.test(secretStr)
        ? Buffer.from(secretStr, 'hex')
        : crypto.createHash('sha256').update(secretStr).digest();

      apiKey = decryptField(JSON.parse(connector.encryptedApiKey), secret);
    }

    // Route to built-in handler or generic HTTP
    switch (connector.type) {
      case 'vapi':
        return this._callVapiTool(toolName, input, apiKey);
      case 'twilio':
        return this._callTwilioTool(toolName, input, connector);
      case 'make':
      case 'zapier':
      case 'n8n':
      case 'custom':
      default:
        return this._callGenericHttpTool(connector.endpointUrl, toolName, input, apiKey);
    }
  }

  // ── Built-in Vapi connector ───────────────────────────────────────────────
  async _callVapiTool(toolName, input, apiKey) {
    switch (toolName) {
      case 'initiate_voice_call':
        return axios.post(
          'https://api.vapi.ai/call/phone',
          {
            phoneNumberId: input.phoneNumberId,
            customer: { number: input.phoneNumber },
            assistantOverrides: {
              systemPrompt: input.systemPrompt,
            },
            metadata: input.metadata ?? {},
          },
          { headers: { Authorization: `Bearer ${apiKey}` } }
        ).then((r) => r.data);

      case 'get_call_recording':
        return axios
          .get(`https://api.vapi.ai/call/${input.callId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          })
          .then((r) => r.data);

      default:
        throw new Error(`Unknown Vapi tool: ${toolName}`);
    }
  }

  // ── Built-in Twilio connector ─────────────────────────────────────────────
  async _callTwilioTool(toolName, input, connector) {
    const Twilio = require('twilio');
    // Twilio credentials come from tenantSettings (already encrypted separately)
    const tenantKeysSnap = await this.db.collection('tenantSettings').doc(this.tenantId).get();
    const tenantKeys = tenantKeysSnap.exists ? tenantKeysSnap.data() : {};

    const secretStr = process.env.ENCRYPTION_SECRET || '';
    const secret = /^[0-9a-fA-F]{64}$/.test(secretStr)
      ? Buffer.from(secretStr, 'hex')
      : crypto.createHash('sha256').update(secretStr).digest();

    const authToken = decryptField(
      {
        cipher: tenantKeys.twilio.authTokenCipher,
        iv: tenantKeys.twilio.authTokenIv,
        tag: tenantKeys.twilio.authTokenTag,
      },
      secret
    );

    const client = new Twilio(tenantKeys.twilio.accountSid, authToken);

    switch (toolName) {
      case 'send_whatsapp_message':
        return client.messages.create({
          from: `whatsapp:${tenantKeys.twilio.whatsappNumber}`,
          to: `whatsapp:${input.toNumber}`,
          body: input.messageBody,
          ...(input.templateSid ? { messagingServiceSid: input.templateSid } : {}),
        });

      default:
        throw new Error(`Unknown Twilio tool: ${toolName}`);
    }
  }

  // ── Generic HTTP connector (Make, Zapier, n8n, Custom) ───────────────────
  async _callGenericHttpTool(endpointUrl, toolName, input, apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const response = await axios.post(
      endpointUrl,
      { tool: toolName, input },
      { headers, timeout: 30000 }
    );

    return response.data;
  }
}

module.exports = { MCPRouter };
