import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface ChatProps {
  userId: Id<'users'>;
  username: string;
}

export function Chat({ userId, username }: ChatProps) {
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const users = useQuery(api.myFunctions.getUsers) ?? [];
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'>>(userId);

  // Keep selector in sync if prop changes
  useEffect(() => {
    setSelectedUserId(userId);
  }, [userId]);

  const messages = useQuery(api.myFunctions.getMessages, { limit: 50 });
  const sendMessage = useMutation(api.myFunctions.sendMessage);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && selectedUserId) {
      void sendMessage({ userId: selectedUserId, text: message.trim() });
      setMessage('');
    }
  };

  return (
    <div
      className={`fixed bottom-0 right-0 m-4 bg-white dark:bg-slate-800 rounded-lg shadow-xl
                  border-2 border-gray-200 dark:border-gray-700 transition-all duration-300
                  z-50 ${isExpanded ? 'w-96 h-[500px]' : 'w-96 h-14'}`}
      style={{ zIndex: 9999 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 border-b-2 border-gray-200
                    dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="font-semibold text-gray-900 dark:text-white">Chat</span>
          {/* Sender selector in header */}
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value as Id<'users'>)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="ml-2 text-xs px-2 py-0.5 border rounded bg-white dark:bg-slate-700 dark:text-white"
          >
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.username}
              </option>
            ))}
          </select>
          {messages && messages.length > 0 && !isExpanded && (
            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">{messages.length}</span>
          )}
        </div>
        <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Chat Content */}
      {isExpanded && (
        <>
          {/* Messages */}
          <div className="h-[380px] overflow-y-auto p-4 space-y-3">
            {messages?.map((msg, idx) => {
              const isOwnMessage = msg.userId === userId;
              return (
                <div key={idx} className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{msg.username}</div>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg ${
                      isOwnMessage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-slate-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t-2 border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                         focus:outline-none focus:border-blue-500 dark:bg-slate-700 dark:text-white text-sm"
                maxLength={500}
              />
              <button
                type="submit"
                disabled={!message.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                         text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
