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
  return localStorage.getItem(STORAGE_KEY) || import.meta.env.VITE_GEMINI_API_KEY || '';
}

export function setStoredApiKey(key) {
  if (key) {
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
CURRENT LIVE SYSTEM DATA:
- Current User: ${currentUser?.name || 'User'} (Role: ${currentUser?.role || 'Employee'})
- Total Projects: ${projects.length}
- Delayed Projects (${delayedProjects.length}): ${delayedProjects.map(p => `${p.name} (${p.progress || 0}%, Client: ${p.client_name || 'N/A'})`).join('; ') || 'None'}
- High Risk Projects (${highRiskProjects.length}): ${highRiskProjects.map(p => `${p.name} [Score: ${p.risk?.score}/100, Reason: ${p.risk?.reasons?.join(', ') || 'N/A'}]`).join('; ') || 'None'}
- Medium Risk Projects (${mediumRiskProjects.length}): ${mediumRiskProjects.map(p => `${p.name} [Score: ${p.risk?.score}/100]`).join('; ') || 'None'}
- Overloaded Staff (${overloadedEmployees.length}): ${overloadedEmployees.map(e => `${e.name} (${e.weekly_hours || 0}h/wk, ${e.designation || 'Staff'}, Score: ${e.productivity_score || 0}%)`).join('; ') || 'None'}
- Total Employees: ${employees.length}
- Total Clients: ${clients.length}
- Key Projects Summary:
${projects.slice(0, 10).map(p => `  • ${p.name} (${p.project_code || 'N/A'}): Status=${p.status || 'Active'}, Progress=${p.progress || 0}%, Budget=$${p.budget || 0}, Client=${p.client_name || 'N/A'}`).join('\n')}
    `.trim();

    return {
      raw: { projects, employees, clients, projectsWithRisk },
      contextSummary,
    };
  } catch (err) {
    console.warn('Could not fetch live workspace context for AI:', err);
    return {
      raw: { projects: [], employees: [], clients: [], projectsWithRisk: [] },
      contextSummary: 'Live workspace data currently unavailable.',
    };
  }
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
  const apiKey = customApiKey || getStoredApiKey();
  const selectedModel = model || getSelectedModel();

  // Load live data for context grounding
  const { raw, contextSummary } = await getLiveWorkspaceContext(currentUser);

  // If no API Key is provided, use the smart local fallback
  if (!apiKey) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const fallbackReply = fallbackAnswer(lastUserMessage, raw);
    
    return {
      text: `${fallbackReply}\n\n*(Tip: Add your Google Gemini API key in the chat settings ⚙️ above to unlock full generative AI insights and natural conversations!)*`,
      isFallback: true,
    };
  }

  const systemInstructionText = `
You are "OrbitPM AI Assistant", an advanced, friendly, and expert Project Management & Risk Analyst embedded inside the ORBITPM enterprise platform.
Your mission is to help project managers, executives, and team members analyze project health, mitigate timeline/budget risks, optimize employee workload, and answer platform queries.

GUIDELINES:
1. Ground your answers using the live data provided below whenever relevant.
2. If asked about delayed projects, high risk items, or team workload, cite specific names, percentages, and actionable mitigation advice.
3. Be concise, structured, and professional. Use markdown formatting (bullet points, bold text, concise tables if helpful).
4. If a question is outside the scope of OrbitPM or general project management, answer politely and offer helpful PM tips.
5. Address the user respectfully. Current user is ${currentUser?.name || 'User'} with role "${currentUser?.role || 'Employee'}".

${contextSummary}
  `.trim();

  // Format messages into Gemini's contents format
  const contents = messages
    .filter(m => m.role === 'user' || m.role === 'assistant' || m.role === 'model')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));

  // Ensure there is at least one content part
  if (contents.length === 0) {
    contents.push({
      role: 'user',
      parts: [{ text: 'Hello! What can you help me with?' }],
    });
  }

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
          temperature: 0.65,
          topP: 0.95,
          maxOutputTokens: 1200,
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
      
      // If quota or invalid key, throw descriptive error
      if (response.status === 400 || response.status === 403) {
        throw new Error(`Gemini API Error: ${errMsg}. Please verify your API key in Settings.`);
      }
      throw new Error(`Gemini Error: ${errMsg}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const outputText = candidate?.content?.parts?.map(p => p.text).join('') || 'No response generated from Gemini.';

    return {
      text: outputText,
      isFallback: false,
    };
  } catch (error) {
    console.error('Gemini API call error:', error);
    
    // Graceful fallback to local engine on network/key failure
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const fallbackReply = fallbackAnswer(lastUserMessage, raw);

    return {
      text: `⚠️ **Gemini Service Notice**: ${error.message}\n\n**Local Analysis Result:**\n${fallbackReply}`,
      isFallback: true,
      error: error.message,
    };
  }
}
