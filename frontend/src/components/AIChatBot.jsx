// src/components/AIChatBot.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Bot, X, Send, Trash2, Maximize2, Minimize2,
  Settings as SettingsIcon, Copy, Check, ShieldAlert, Users,
  FolderKanban, AlertCircle, RefreshCw, Key, HelpCircle, ChevronRight, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  sendGeminiMessage,
  getStoredApiKey,
  setStoredApiKey,
  getSelectedModel,
  setSelectedModel,
  GEMINI_MODELS
} from '../lib/geminiService';

const SUGGESTIONS = [
  { label: '🚨 High Risk Projects', prompt: 'Which projects are currently at high risk and why?' },
  { label: '👥 Team Overload', prompt: 'Are any team members overloaded or logging more than 40 hours?' },
  { label: '⏳ Delayed Projects', prompt: 'Show me all delayed projects with their progress and clients.' },
  { label: '📊 Portfolio Health', prompt: 'Give me a comprehensive summary of our overall project portfolio health.' },
  { label: '💡 Risk Mitigation Plan', prompt: 'What concrete steps should we take to reduce project risk this week?' },
];

/**
 * Lightweight Markdown & Formatter component for AI responses.
 */
function MarkdownContent({ content }) {
  if (!content) return null;

  // Split by line breaks to render paragraphs, lists, and headings
  const lines = content.split('\n');

  return (
    <div className="text-[13.5px] leading-relaxed space-y-1.5 break-words">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Heading 3 / 2 / 1
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-bold text-[14px] text-teal-light dark:text-teal pt-1">
              {formatInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-bold text-[15px] text-slate-900 dark:text-white pt-1.5 border-b border-slate-200 dark:border-navy-700 pb-0.5">
              {formatInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={idx} className="font-extrabold text-[16px] text-slate-900 dark:text-white pt-2">
              {formatInline(trimmed.slice(2))}
            </h2>
          );
        }

        // Bullet point
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-teal font-bold text-base leading-none">•</span>
              <span className="flex-1">{formatInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-teal font-mono font-semibold text-xs pt-0.5">{numMatch[1]}.</span>
              <span className="flex-1">{formatInline(numMatch[2])}</span>
            </div>
          );
        }

        // Blockquote
        if (trimmed.startsWith('> ')) {
          return (
            <div key={idx} className="border-l-2 border-teal pl-3 py-1 bg-teal/5 dark:bg-teal/10 rounded-r text-slate-700 dark:text-slate-300 italic text-[13px]">
              {formatInline(trimmed.slice(2))}
            </div>
          );
        }

        return <p key={idx}>{formatInline(line)}</p>;
      })}
    </div>
  );
}

/**
 * Format inline bold, code, and links.
 */
function formatInline(text) {
  if (!text) return '';

  // Regex split for **bold**, `code`, and *italic*
  const parts = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    // Code: `code`
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Italic: *text* (single asterisk)
    const italicMatch = remaining.match(/(?<!\*)\*([^*]+)\*(?!\*)/);

    // Find nearest match
    let earliest = null;
    let type = null;

    if (boldMatch && (earliest === null || boldMatch.index < earliest.index)) {
      earliest = boldMatch;
      type = 'bold';
    }
    if (codeMatch && (earliest === null || codeMatch.index < earliest.index)) {
      earliest = codeMatch;
      type = 'code';
    }
    if (italicMatch && (earliest === null || italicMatch.index < earliest.index)) {
      earliest = italicMatch;
      type = 'italic';
    }

    if (!earliest) {
      parts.push(<React.Fragment key={keyIdx++}>{remaining}</React.Fragment>);
      break;
    }

    // Push text before match
    if (earliest.index > 0) {
      parts.push(<React.Fragment key={keyIdx++}>{remaining.slice(0, earliest.index)}</React.Fragment>);
    }

    // Push formatted element
    if (type === 'bold') {
      parts.push(
        <strong key={keyIdx++} className="font-semibold text-slate-900 dark:text-white">
          {earliest[1]}
        </strong>
      );
    } else if (type === 'code') {
      parts.push(
        <code key={keyIdx++} className="px-1.5 py-0.5 bg-slate-100 dark:bg-navy-800 text-teal-light font-mono text-[12px] rounded border border-slate-200 dark:border-navy-700">
          {earliest[1]}
        </code>
      );
    } else if (type === 'italic') {
      parts.push(
        <em key={keyIdx++} className="italic text-slate-600 dark:text-slate-400">
          {earliest[1]}
        </em>
      );
    }

    remaining = remaining.slice(earliest.index + earliest[0].length);
  }

  return parts;
}

export default function AIChatBot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedModelId, setSelectedModelId] = useState(getSelectedModel());
  const [keySavedToast, setKeySavedToast] = useState(false);
  
  const [messages, setMessages] = useState(() => {
    const saved = sessionStorage.getItem('orbitpm_ai_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `👋 Hello **${user?.name || 'there'}**! I am **OrbitPM AI**, powered by Google Gemini.\n\nI have real-time access to your project portfolio, risk engines, team workloads, and client data. How can I assist you today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [hasPromptedTip, setHasPromptedTip] = useState(true);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Sync apiKey state with localStorage
  useEffect(() => {
    setApiKeyInput(getStoredApiKey());
    setSelectedModelId(getSelectedModel());
  }, [showSettings]);

  // Persist messages in session
  useEffect(() => {
    try {
      sessionStorage.setItem('orbitpm_ai_messages', JSON.stringify(messages));
    } catch (e) {
      console.warn('Could not persist chat history:', e);
    }
  }, [messages]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !showSettings) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, showSettings]);

  const handleSendMessage = async (textToSend) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await sendGeminiMessage({
        messages: newHistory,
        currentUser: user,
        model: selectedModelId,
      });

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        isFallback: response.isFallback,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `⚠️ Failed to get answer: ${err.message || 'Unknown network error'}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    const defaultMsg = [
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Chat history cleared. I'm ready to assist with your portfolio analysis, risk forecasts, and team questions!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(defaultMsg);
  };

  const handleCopyMessage = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setStoredApiKey(apiKeyInput);
    setSelectedModel(selectedModelId);
    setKeySavedToast(true);
    setTimeout(() => {
      setKeySavedToast(false);
      setShowSettings(false);
    }, 1200);
  };

  const activeApiKey = getStoredApiKey();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Welcome Banner / Notification Toast (Dismissible) */}
      {!isOpen && hasPromptedTip && (
        <div className="mb-3 mr-1 bg-white dark:bg-navy-900 text-slate-800 dark:text-slate-100 shadow-xl border border-teal/30 dark:border-teal/40 rounded-2xl p-3 pr-8 max-w-xs text-[12.5px] animate-bounce relative group backdrop-blur-md">
          <button
            onClick={() => setHasPromptedTip(false)}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5"
            title="Dismiss"
          >
            <X size={13} />
          </button>
          <div className="flex items-center gap-2 font-semibold text-teal dark:text-teal-light mb-1">
            <Sparkles size={14} className="animate-spin text-amber" />
            <span>AI Project Assistant</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300">
            Need live insights on high-risk projects or team workloads? Ask OrbitPM AI!
          </p>
        </div>
      )}

      {/* Main Chatbot Window */}
      {isOpen && (
        <div
          className={`bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out mb-3 backdrop-blur-xl ${
            isExpanded
              ? 'w-[92vw] sm:w-[580px] h-[80vh] max-h-[760px]'
              : 'w-[92vw] sm:w-[420px] h-[540px] max-h-[85vh]'
          }`}
          style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.22)' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-teal/90 text-white px-4 py-3.5 flex items-center justify-between border-b border-navy-800">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-xl bg-teal/30 border border-teal-light/40 flex items-center justify-center text-teal-light">
                  <Bot size={19} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green border-2 border-navy-950"></span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[14.5px] tracking-tight">OrbitPM AI</h3>
                  <span className="px-1.5 py-0.2 bg-teal/40 text-teal-light border border-teal-light/30 rounded text-[10px] font-mono uppercase font-semibold">
                    Gemini
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green animate-pulse"></span>
                  Portfolio Grounded
                </p>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 text-slate-300">
              <button
                onClick={() => setShowSettings(!showSettings)}
                title="AI Settings & API Key"
                className={`p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors ${
                  showSettings ? 'bg-white/20 text-white' : ''
                }`}
              >
                <SettingsIcon size={16} />
              </button>
              <button
                onClick={handleClearHistory}
                title="Clear Chat"
                className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Collapse' : 'Expand'}
                className="hidden sm:block p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors"
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 rounded-lg hover:bg-red/40 hover:text-white transition-colors ml-1"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Settings Drawer / Overlay */}
          {showSettings ? (
            <div className="p-4 bg-slate-50 dark:bg-navy-950 flex-1 overflow-y-auto flex flex-col justify-between">
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Key size={16} className="text-teal" />
                    <h4 className="font-semibold text-[14px] text-slate-900 dark:text-white">Google Gemini API Key</h4>
                  </div>
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 mb-2">
                    Enter your Gemini API key to enable full AI reasoning. If left empty, local intelligence mode will run.
                  </p>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full text-[13px] px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white focus:outline-none focus:border-teal"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11.5px] text-teal hover:underline flex items-center gap-1"
                    >
                      Get free Gemini API key <ExternalLink size={11} />
                    </a>
                    {activeApiKey ? (
                      <span className="text-[11px] text-green font-medium flex items-center gap-1">
                        <Check size={12} /> Key is active
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber font-medium">Using fallback mode</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-slate-900 dark:text-white mb-1">
                    Gemini Model Provider
                  </label>
                  <div className="space-y-2">
                    {GEMINI_MODELS.map((model) => (
                      <label
                        key={model.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-[12.5px] transition-all ${
                          selectedModelId === model.id
                            ? 'border-teal bg-teal/5 dark:bg-teal/10 font-semibold text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-navy-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="model"
                          value={model.id}
                          checked={selectedModelId === model.id}
                          onChange={(e) => setSelectedModelId(e.target.value)}
                          className="text-teal"
                        />
                        <span>{model.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 bg-teal hover:bg-teal-light text-white font-semibold text-[13px] rounded-lg transition-all shadow"
                  >
                    {keySavedToast ? 'Saved Successfully!' : 'Save Configuration'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="px-3.5 py-2 border border-slate-300 dark:border-navy-700 hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-700 dark:text-slate-300 text-[13px] rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>

              <div className="mt-4 p-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-xl text-[11.5px] text-slate-500 dark:text-slate-400">
                🔒 <strong>Privacy Note:</strong> Your API key is stored locally in your browser session/storage and sent directly to Google Gemini's secure API.
              </div>
            </div>
          ) : (
            /* Chat Messages Container */
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50 dark:bg-navy-950/60 notif-scroll">
              {messages.map((msg) => {
                const isAssistant = msg.role === 'assistant';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                  >
                    {isAssistant && (
                      <div className="w-7 h-7 rounded-lg bg-teal text-white flex items-center justify-center flex-none mt-0.5 shadow-sm">
                        <Bot size={15} />
                      </div>
                    )}

                    <div
                      className={`relative group max-w-[84%] sm:max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                        isAssistant
                          ? 'bg-white dark:bg-navy-900 border border-slate-200/80 dark:border-navy-800 text-slate-800 dark:text-slate-100 rounded-tl-sm'
                          : 'bg-gradient-to-r from-teal to-teal-light text-white rounded-tr-sm'
                      }`}
                    >
                      <MarkdownContent content={msg.content} />

                      {/* Footer info: timestamp & copy button */}
                      <div
                        className={`flex items-center justify-between gap-2 mt-1 pt-1 text-[10.5px] ${
                          isAssistant
                            ? 'text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-navy-800'
                            : 'text-white/70'
                        }`}
                      >
                        <span>{msg.timestamp}</span>

                        {isAssistant && (
                          <button
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            title="Copy response"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-teal dark:hover:text-teal-light"
                          >
                            {copiedId === msg.id ? (
                              <span className="flex items-center gap-0.5 text-green">
                                <Check size={11} /> Copied
                              </span>
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {!isAssistant && (
                      <div className="w-7 h-7 rounded-lg bg-navy-800 text-teal-light flex items-center justify-center flex-none mt-0.5 font-bold text-xs shadow-sm">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Typing / Thinking Indicator */}
              {loading && (
                <div className="flex items-start gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-teal text-white flex items-center justify-center flex-none mt-0.5 shadow-sm animate-pulse">
                    <Sparkles size={14} />
                  </div>
                  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                    <span className="text-[12.5px] text-slate-500 dark:text-slate-400 font-medium">
                      Gemini is analyzing portfolio...
                    </span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 rounded-full bg-teal animate-bounce"></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {/* Quick Suggestions Chips */}
          {!showSettings && (
            <div className="px-3 py-2 bg-slate-100/70 dark:bg-navy-950 border-t border-slate-200/60 dark:border-navy-800 flex items-center gap-1.5 overflow-x-auto notif-scroll no-scrollbar">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex-none mr-1">
                Suggested:
              </span>
              {SUGGESTIONS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.prompt)}
                  disabled={loading}
                  className="flex-none px-2.5 py-1 bg-white dark:bg-navy-900 hover:bg-teal hover:text-white dark:hover:bg-teal border border-slate-200 dark:border-navy-700 rounded-full text-[11.5px] font-medium text-slate-700 dark:text-slate-300 transition-all shadow-xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Box */}
          {!showSettings && (
            <div className="p-3 bg-white dark:bg-navy-900 border-t border-slate-200 dark:border-navy-800">
              <div className="flex items-end gap-2 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl p-1.5 focus-within:border-teal dark:focus-within:border-teal transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask OrbitPM AI anything about projects, risk, workloads..."
                  rows={1}
                  className="flex-1 bg-transparent resize-none outline-none text-[13px] px-2 py-1 max-h-24 min-h-[36px] text-slate-800 dark:text-slate-100 placeholder-slate-400"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || loading}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    input.trim() && !loading
                      ? 'bg-teal hover:bg-teal-light text-white shadow-md'
                      : 'bg-slate-200 dark:bg-navy-800 text-slate-400 cursor-not-allowed'
                  }`}
                  title="Send message (Enter)"
                >
                  <Send size={15} />
                </button>
              </div>
              <div className="flex items-center justify-between px-1 mt-1 text-[10.5px] text-slate-400">
                <span>Press <strong>Enter ↵</strong> to send, <strong>Shift + Enter</strong> for new line</span>
                <span>Powered by Gemini</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setHasPromptedTip(false);
        }}
        className={`group relative flex items-center justify-center rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 ${
          isOpen
            ? 'w-13 h-13 p-3.5 bg-navy-900 text-white border-2 border-slate-600 hover:bg-navy-850'
            : 'w-14 h-14 p-3.5 bg-gradient-to-tr from-teal via-teal-light to-blue text-white hover:shadow-teal/40 hover:scale-105'
        }`}
        style={{
          boxShadow: isOpen
            ? '0 10px 25px rgba(0,0,0,0.3)'
            : '0 10px 30px rgba(15, 110, 124, 0.45), 0 0 20px rgba(62, 111, 217, 0.25)',
        }}
        aria-label="OrbitPM AI Chatbot Launcher"
      >
        {/* Pulsing ring when closed */}
        {!isOpen && (
          <span className="absolute inset-0 rounded-full bg-teal-light opacity-35 animate-ping -z-10"></span>
        )}

        {isOpen ? (
          <X size={22} strokeWidth={2.5} className="transition-transform duration-200 group-hover:rotate-90" />
        ) : (
          <div className="relative">
            <Bot size={26} strokeWidth={2.2} className="transition-transform duration-200 group-hover:scale-110" />
            <Sparkles
              size={12}
              className="absolute -top-1 -right-1 text-amber fill-amber animate-pulse"
            />
          </div>
        )}
      </button>
    </div>
  );
}
