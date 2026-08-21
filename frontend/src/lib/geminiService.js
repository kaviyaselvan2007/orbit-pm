// src/lib/geminiService.js
import { supabase } from './supabaseClient';
import { attachRisk } from '../utils/riskEngine';
import { answerQuestion as fallbackAnswer } from '../utils/assistant';

const STORAGE_KEY = 'orbitpm_gemini_api_key';
const MODEL_STORAGE_KEY = 'orbitpm_gemini_model';

export const GEMINI_MODELS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast & Recommended)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen)' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)' },
];

export function getStoredApiKey() {
  const localKey = localStorage.getItem(STORAGE_KEY);
  if (localKey && localKey.trim()) {
    return localKey.trim();
  }
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim()) {
    return envKey.trim();
  }
  return '';
}

export function setStoredApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getSelectedModel() {
  return localStorage.getItem(MODEL_STORAGE_KEY) || 'gemini-1.5-flash';
}

export function setSelectedModel(modelId) {
  localStorage.setItem(MODEL_STORAGE_KEY, modelId);
}

/**
 * Clean and format chat messages for Google Gemini API.
 * Rules enforced by Gemini API:
 * 1. contents[0] MUST be role: "user" (no leading model/assistant messages).
 * 2. Roles must strictly alternate between "user" and "model".
 * 3. The final message must be role: "user".
 */
export function formatMessagesForGemini(messages) {
  const formatted = [];
  let lastRole = null;

  // Find the first message sent by a user
  const firstUserIdx = messages.findIndex(m => m.role === 'user');
  if (firstUserIdx === -1) {
    return [{ role: 'user', parts: [{ text: 'Hello! How can you help me with project management?' }] }];
  }

  const validMessages = messages.slice(firstUserIdx);

  for (const msg of validMessages) {
    const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
    const text = (msg.content || '').trim();
    if (!text) continue;

    // Merge consecutive same-role messages
    if (role === lastRole && formatted.length > 0) {
      formatted[formatted.length - 1].parts[0].text += `\n\n${text}`;
    } else {
      formatted.push({
        role,
        parts: [{ text }],
      });
      lastRole = role;
    }
  }

  // Ensure last message is from user
  if (formatted.length > 0 && formatted[formatted.length - 1].role !== 'user') {
    formatted.pop();
  }

  if (formatted.length === 0) {
    formatted.push({ role: 'user', parts: [{ text: 'Hello!' }] });
  }

  return formatted;
}

/**
 * Fetch live snapshot of OrbitPM portfolio to ground the AI responses.
 */
export async function getLiveWorkspaceContext(currentUser) {
  try {
    const [projRes, empRes, cliRes] = await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('employees').select('*'),
      supabase.from('clients').select('*'),
    ]);

    const projects = projRes.data || [];
    const employees = empRes.data || [];
    const clients = cliRes.data || [];
    const projectsWithRisk = attachRisk(projects, employees);

    const highRiskProjects = projectsWithRisk.filter(p => p.risk?.level === 'High');
    const mediumRiskProjects = projectsWithRisk.filter(p => p.risk?.level === 'Medium');
    const delayedProjects = projectsWithRisk.filter(p => p.status === 'Delayed');
    const overloadedEmployees = employees.filter(e => e.workload === 'Overloaded' || (e.weekly_hours || 0) > 40);

    const contextSummary = `
LIVE PORTFOLIO & WORKSPACE DATA:
- Current Logged-in User: ${currentUser?.name || 'User'} (Role: ${currentUser?.role || 'Employee'})
- Total Active Projects: ${projects.length}
- Delayed Projects (${delayedProjects.length}): ${delayedProjects.map(p => `${p.name} (Code: ${p.project_code || 'N/A'}, Progress: ${p.progress || 0}%, Client: ${p.client_name || 'N/A'})`).join('; ') || 'None'}
- High Risk Projects (${highRiskProjects.length}): ${highRiskProjects.map(p => `${p.name} [Risk Score: ${p.risk?.score}/100, Primary Factor: ${p.risk?.reasons?.join(', ') || 'High Risk'}]`).join('; ') || 'None'}
- Medium Risk Projects (${mediumRiskProjects.length}): ${mediumRiskProjects.map(p => `${p.name} [Risk Score: ${p.risk?.score}/100]`).join('; ') || 'None'}
- Overloaded Team Members (${overloadedEmployees.length}): ${overloadedEmployees.map(e => `${e.name} (${e.weekly_hours || 0}h/wk, ${e.designation || 'Staff'}, Productivity: ${e.productivity_score || 0}%)`).join('; ') || 'None'}
- Total Employees: ${employees.length}
- Total Clients: ${clients.length}

DETAILED PROJECT LIST:
${projects.map(p => `• [${p.project_code || 'N/A'}] ${p.name} | Status: ${p.status || 'Active'} | Progress: ${p.progress || 0}% | Budget: $${p.budget || 0} | Client: ${p.client_name || 'N/A'}`).join('\n')}

DETAILED TEAM MEMBERS:
${employees.map(e => `• ${e.name} (${e.emp_code || 'N/A'}) - ${e.designation || 'Staff'}, Dept: ${e.department || 'General'}, Hours: ${e.weekly_hours || 0}h/wk, Status: ${e.workload || 'Balanced'}`).join('\n')}
    `.trim();

    return {
      raw: { projects, employees, clients, projectsWithRisk },
      contextSummary,
    };
  } catch (err) {
    console.warn('Could not fetch live workspace context for AI:', err);
    return {
      raw: { projects: [], employees: [], clients: [], projectsWithRisk: [] },
      contextSummary: 'Live workspace database snapshot currently unavailable.',
    };
  }
}

/**
 * Test Gemini API connection with a given key.
 */
export async function testGeminiConnection(keyToTest, modelId) {
  const apiKey = (keyToTest || getStoredApiKey()).trim();
  const selectedModel = modelId || getSelectedModel();

  if (!apiKey) {
    throw new Error('API key is empty. Please enter your Google Gemini API key.');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Hello, respond with the single word "CONNECTED".' }] }],
      generationConfig: { maxOutputTokens: 10 },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `HTTP ${response.status} ${response.statusText}`);
  }

  return true;
}

/**
 * Send a prompt / conversation to Gemini API with live workspace context grounding.
 */
export async function sendGeminiMessage({
  messages,
  currentUser,
  customApiKey = null,
  model = null,
}) {
  const apiKey = (customApiKey || getStoredApiKey()).trim();
  const selectedModel = model || getSelectedModel();

  // Load live data for context grounding
  const { raw, contextSummary } = await getLiveWorkspaceContext(currentUser);

  // If no API Key is provided, use the local intelligent fallback
  if (!apiKey) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const fallbackReply = fallbackAnswer(lastUserMessage, raw);
    
    return {
      text: `${fallbackReply}\n\n*(Note: Running in Local Intelligence Mode. Add your Gemini API key in ⚙️ Settings to unlock full generative reasoning & free-form chat!)*`,
      isFallback: true,
    };
  }

  const systemInstructionText = `
You are "OrbitPM AI Assistant", a world-class AI Project Management & Risk Analyst deeply integrated into the OrbitPM platform.
You are sharp, highly intelligent, articulate, and empathetic. You can discuss any project management topic, analyze risks, suggest mitigation roadmaps, draft emails/tickets, optimize resource distribution, and give executive-level portfolio summaries.

CORE RESPONSIBILITIES:
1. When asked about specific projects, deadlines, workloads, or risks, refer directly to the live portfolio data below.
2. Provide actionable, insightful, and well-structured answers using clear Markdown (bullet points, bold key terms, mini-tables if helpful).
3. If asked general software engineering, agile, or productivity questions, answer with deep technical and managerial expertise.
4. Address the user respectfully as ${currentUser?.name || 'User'} (${currentUser?.role || 'Team Member'}).

${contextSummary}
  `.trim();

  // Properly sanitize and format contents for Gemini API (user starts, alternating roles)
  const contents = formatMessagesForGemini(messages);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstructionText }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 1500,
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      
      console.error('Gemini API Error Response:', errData);
      throw new Error(`Gemini API Error: ${errMsg}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const outputText = candidate?.content?.parts?.map(p => p.text).join('') || 'No response generated from Gemini.';

    return {
      text: outputText,
      isFallback: false,
    };
  } catch (error) {
    console.error('Gemini call failed:', error);
    
    // Provide a clear explanation of what went wrong rather than masking it as local rules
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const fallbackReply = fallbackAnswer(lastUserMessage, raw);

    return {
      text: `⚠️ **Gemini Connection Issue**: ${error.message}\n\n**Local Analysis Fallback:**\n${fallbackReply}\n\n*Please check your Gemini API key in ⚙️ Settings or verify your Google AI Studio quota.*`,
      isFallback: true,
      error: error.message,
    };
  }
}
