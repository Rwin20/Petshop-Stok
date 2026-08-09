import React, { useState, useEffect } from 'react';
import { PawPrint, Lock, User, Delete } from 'lucide-react';

export default function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        handleNumpadClick(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter') {
        if (pin.length === 4) {
          handleLogin();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin]);

  const handleNumpadClick = (num) => {
    setError('');
    if (pin.length < 4) {
      setPin((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setError('');
    setPin((prev) => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (pin.length !== 4) {
      setError('Lütfen 4 haneli PIN kodunu giriniz.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await window.api.auth.login(pin);
      if (response.success) {
        onLogin(response.user); // pass user object to parent
      } else {
        setError(response.error || 'Giriş başarısız.');
        setPin(''); // clear on error
      }
    } catch (err) {
      setError('Sunucu hatası oluştu.');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Automatically trigger login when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4) {
      handleLogin();
    }
  }, [pin]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 overflow-hidden relative">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/20 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[100px]" />
      </div>

      <div className="z-10 bg-slate-800/60 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl w-full max-w-sm flex flex-col items-center">
        {/* Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center glow-purple mb-4">
          <PawPrint className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Petshop Stok</h1>
        <p className="text-slate-400 mb-8 text-center text-sm">Lütfen Devam Etmek İçin PIN Giriniz</p>

        {/* PIN Display */}
        <div className="flex gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`w-12 h-14 rounded-xl flex items-center justify-center text-2xl font-bold border-2 transition-all duration-300 ${
                i < pin.length
                  ? 'border-purple-500 bg-purple-500/20 text-white'
                  : 'border-slate-700 bg-slate-800/50 text-slate-500'
              }`}
            >
              {i < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        {error && (
            <div className="text-red-400 text-sm mb-4 bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20 text-center w-full">
                {error}
            </div>
        )}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleNumpadClick(num.toString())}
              disabled={loading}
              className="h-14 rounded-xl bg-slate-800 border border-slate-700 text-xl font-semibold text-white hover:bg-slate-700 active:scale-95 transition-all"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setPin('')}
            disabled={loading}
            className="h-14 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center"
          >
            Sil
          </button>
          <button
            disabled={loading}
            onClick={() => handleNumpadClick('0')}
            className="h-14 rounded-xl bg-slate-800 border border-slate-700 text-xl font-semibold text-white hover:bg-slate-700 active:scale-95 transition-all"
          >
            0
          </button>
          <button
            disabled={loading}
            onClick={handleBackspace}
            className="h-14 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
