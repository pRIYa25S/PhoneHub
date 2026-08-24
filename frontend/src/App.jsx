import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Bot, X, Send, Search, Trash2, CheckCircle, Mic, MicOff, User as UserIcon, LogOut } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);
  
  // Auth State
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('ph_user')) || null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Chat State
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hi! I am the PhoneHub AI Assistant. Ask me about phones, accessories, or recommendations!' },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const chatEndRef = useRef(null);

  const fetchProducts = () => {
    fetch('https://phonehub-ka2n.onrender.com/api/products')
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isChatOpen]);

  // Text-To-Speech
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Speech-To-Text
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.start();
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setIsListening(false);
      handleSendMessage(transcript);
    };

    recognition.onerror = () => setIsListening(false);
  };

  // Auth Handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = authMode === 'login' ? 'login' : 'register';
    
    try {
      const res = await fetch(`https://phonehub-ka2n.onrender.com/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Authentication failed');

      localStorage.setItem('ph_user', JSON.stringify(data));
      setUser(data);
      setIsAuthOpen(false);
      setAuthForm({ username: '', email: '', password: '' });
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ph_user');
    setUser(null);
  };

  // Cart Handlers
  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleCheckout = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user?.token) headers['Authorization'] = `Bearer ${user.token}`;

      const res = await fetch('https://phonehub-ka2n.onrender.com/api/checkout', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          items: cart.map((i) => ({ id: i.id, quantity: i.qty })),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        alert(errorData.detail || "Checkout failed");
        return;
      }

      setIsCheckoutSuccess(true);
      fetchProducts(); // Refresh inventory
      setTimeout(() => {
        setCart([]);
        setIsCheckoutSuccess(false);
        setIsCartOpen(false);
      }, 2000);
    } catch (err) {
      alert("Checkout failed: " + err.message);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const getMentionedProducts = (text) => {
    if (!products || products.length === 0) return [];
    return products.filter((p) => text.toLowerCase().includes(p.name.toLowerCase()));
  };

  const handleSendMessage = async (customMessage) => {
    const messageToSend = customMessage || inputMessage;
    if (!messageToSend.trim() || isLoading) return;

    const newHistory = [...messages, { sender: 'user', text: messageToSend }];
    setMessages(newHistory);
    if (!customMessage) setInputMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('https://phonehub-ka2n.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: newHistory }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { sender: 'ai', text: data.reply }]);
      speakText(data.reply);
    } catch (err) {
      setMessages((prev) => [...prev, { sender: 'ai', text: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight text-blue-400">PhoneHub</h1>
          <div className="flex items-center space-x-6">
            {user ? (
              <div className="flex items-center space-x-3 text-sm">
                <span className="text-gray-300">Hi, <b>{user.username}</b></span>
                <button onClick={handleLogout} className="text-red-400 hover:text-red-300 flex items-center gap-1">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={() => setIsAuthOpen(true)} className="flex items-center space-x-1 text-sm font-semibold hover:text-blue-300">
                <UserIcon className="w-4 h-4" /> <span>Login / Sign Up</span>
              </button>
            )}

            <button onClick={() => setIsCartOpen(true)} className="relative flex items-center hover:text-blue-300 transition">
              <ShoppingCart className="w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-blue-500 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.reduce((a, b) => a + b.qty, 0)}
                </span>
              )}
            </button>

            <button onClick={() => setIsChatOpen(true)} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow transition">
              <Bot className="w-5 h-5" />
              <span>AI Support</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input type="text" placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div className="flex space-x-2 overflow-x-auto">
            {['all', 'phone', 'accessory', 'wearable'].map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-100'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <img src={p.image_url} alt={p.name} className="w-full h-48 object-cover" />
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-blue-600 uppercase">{p.category}</span>
                    <span className={`text-xs font-bold ${p.stock_quantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {p.stock_quantity > 0 ? `In Stock (${p.stock_quantity})` : 'Out of Stock'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mt-1">{p.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{p.description}</p>
                  <p className="text-xs text-gray-400 italic mt-2">{p.specs}</p>
                </div>
                <div className="mt-6 flex justify-between items-center">
                  <span className="text-xl font-bold text-gray-900">₹{p.price.toLocaleString('en-IN')}</span>
                  <button onClick={() => addToCart(p)} disabled={p.stock_quantity === 0} className="bg-slate-900 hover:bg-slate-800 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2 rounded-lg transition">
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Login Modal */}
      {isAuthOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 relative">
            <button onClick={() => setIsAuthOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
            <h2 className="text-xl font-bold mb-4">{authMode === 'login' ? 'Sign In to PhoneHub' : 'Create an Account'}</h2>
            {authError && <p className="text-xs text-red-500 mb-3">{authError}</p>}
            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <input type="text" placeholder="Username" required value={authForm.username} onChange={(e) => setAuthForm({...authForm, username: e.target.value})} className="w-full border p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              {authMode === 'register' && (
                <input type="email" placeholder="Email Address" required value={authForm.email} onChange={(e) => setAuthForm({...authForm, email: e.target.value})} className="w-full border p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              )}
              <input type="password" placeholder="Password" required value={authForm.password} onChange={(e) => setAuthForm({...authForm, password: e.target.value})} className="w-full border p-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
            </form>
            <p className="text-xs text-gray-500 mt-4 text-center">
              {authMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
              <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-blue-600 font-bold underline">
                {authMode === 'login' ? 'Sign Up' : 'Login'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col border-l">
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
            <h3 className="font-bold flex items-center gap-2"><ShoppingCart className="w-5 h-5"/> Your Cart</h3>
            <button onClick={() => setIsCartOpen(false)}><X className="w-5 h-5"/></button>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {cart.length === 0 ? <p className="text-gray-500 text-center py-8">Your cart is empty.</p> : cart.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center space-x-3">
                  <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded-md" />
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-blue-600 font-semibold">₹{item.price.toLocaleString('en-IN')} x {item.qty}</p>
                  </div>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
              </div>
            ))}
          </div>
          {cart.length > 0 && (
            <div className="p-4 border-t">
              <div className="flex justify-between items-center mb-4 text-lg font-bold">
                <span>Total:</span><span>₹{cartTotal.toLocaleString('en-IN')}</span>
              </div>
              {isCheckoutSuccess ? (
                <div className="bg-green-100 text-green-700 p-3 rounded-lg flex items-center justify-center gap-2 font-bold">
                  <CheckCircle className="w-5 h-5"/> Order Placed! Inventory Updated.
                </div>
              ) : (
                <button onClick={handleCheckout} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
                  Checkout Now
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI Assistant */}
      {isChatOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col border-l">
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold">PhoneHub Voice Assistant</h3>
            </div>
            <button onClick={() => setIsChatOpen(false)}><X className="w-5 h-5"/></button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                  {msg.sender === 'ai' ? (
                    <div className="space-y-1 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4">
                      <ReactMarkdown>
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
                {msg.sender === 'ai' && getMentionedProducts(msg.text).map((p) => (
                  <div key={p.id} className="mt-2 w-[85%] bg-blue-50 border border-blue-200 rounded-xl p-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <img src={p.image_url} alt={p.name} className="w-8 h-8 object-cover rounded-md"/>
                      <div>
                        <p className="text-xs font-bold">{p.name}</p>
                        <p className="text-xs text-blue-600 font-semibold">₹{p.price.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <button onClick={() => addToCart(p)} disabled={p.stock_quantity === 0} className="bg-blue-600 disabled:bg-gray-300 text-white text-xs px-2 py-1 rounded">
                      + Add
                    </button>
                  </div>
                ))}
              </div>
            ))}
            {isLoading && <div className="text-xs text-gray-400 animate-pulse">Assistant is thinking...</div>}
            <div ref={chatEndRef} />
          </div>

          {/* Voice & Input Controls */}
          <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="p-3 border-t flex items-center gap-2">
            <button type="button" onClick={toggleListening} className={`p-2 rounded-full ${isListening ? 'bg-red-500 text-white animate-bounce' : 'bg-gray-100 text-gray-600'}`}>
              {isListening ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>}
            </button>
            <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} placeholder="Type or click microphone..." className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none"/>
            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white p-2 rounded-lg">
              <Send className="w-4 h-4"/>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}