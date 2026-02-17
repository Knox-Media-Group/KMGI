'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Lightbulb,
  ChevronRight,
  Loader2,
  Wand2,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { copilotApi, CopilotMessage, CopilotAction, CopilotResponse } from '@/lib/api';
import type { SiteSettings, Page, Section } from '@builder/shared';

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  siteSettings: SiteSettings;
  currentPage: Page;
  selectedSection?: Section;
  onApplyAction: (action: CopilotAction) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: CopilotAction[];
  suggestions?: string[];
  timestamp: Date;
}

export function AICopilot({
  isOpen,
  onClose,
  token,
  siteSettings,
  currentPage,
  selectedSection,
  onApplyAction,
}: AICopilotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `Hi! I'm your AI Co-Pilot. I can help you improve "${siteSettings.businessName}". Try asking me to improve your headlines, add sections, or suggest changes.`,
          suggestions: [
            'Improve my headline',
            'Suggest improvements for this page',
            'Add a testimonials section',
          ],
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, siteSettings.businessName]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const buildContext = () => ({
    siteSettings,
    currentPage,
    selectedSection,
  });

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chatHistory: CopilotMessage[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user', content: messageText });

      const response = await copilotApi.chat(chatHistory, buildContext(), token);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        actions: response.actions,
        suggestions: response.suggestions,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (response.suggestions) {
        setSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error('Copilot error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const handleApplyAction = (action: CopilotAction) => {
    onApplyAction(action);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: '✓ Applied the change. How does it look?',
        suggestions: ['Looks great!', 'Try something else', 'Undo this change'],
        timestamp: new Date(),
      },
    ]);
  };

  const handleGetSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await copilotApi.suggest(buildContext(), token);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.message,
          suggestions: response.suggestions,
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Suggestion error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-indigo-600">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white">AI Co-Pilot</h2>
            <p className="text-xs text-white/80">Your editing assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/20 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-b border-gray-100 bg-gray-50">
        <div className="flex gap-2">
          <button
            onClick={handleGetSuggestions}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-purple-300 transition-all disabled:opacity-50"
          >
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Get Suggestions
          </button>
          <button
            onClick={() => handleSend('Improve the selected section')}
            disabled={isLoading || !selectedSection}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-purple-300 transition-all disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4 text-purple-500" />
            Improve Section
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>

              {/* Actions */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleApplyAction(action)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-white/90 hover:bg-white rounded-lg text-sm font-medium text-purple-700 border border-purple-200 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Apply: {action.type.replace('_', ' ')}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              )}

              {/* Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="px-3 py-1.5 bg-white/80 hover:bg-white rounded-full text-xs font-medium text-gray-700 border border-gray-200 hover:border-purple-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Context Indicator */}
      {selectedSection && (
        <div className="px-4 py-2 bg-purple-50 border-t border-purple-100">
          <p className="text-xs text-purple-600 flex items-center gap-2">
            <MessageSquare className="w-3 h-3" />
            Editing: <span className="font-medium capitalize">{selectedSection.type}</span> section
          </p>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all disabled:opacity-50"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className="p-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Press Enter to send • AI suggestions are just starting points
        </p>
      </div>
    </div>
  );
}

// Add animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}
