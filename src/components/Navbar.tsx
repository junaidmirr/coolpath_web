import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Sun, 
  Moon, 
  Globe, 
  Navigation, 
  Settings,
  ChevronDown
} from 'lucide-react';

type Language = 'en' | 'es' | 'bn' | 'ur' | 'hi' | 'zh';

const languages: { code: Language; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'bn', name: 'Bangla' },
  { code: 'ur', name: 'Urdu' },
  { code: 'hi', name: 'Hindi' },
  { code: 'zh', name: 'Chinese' },
];

export const Navbar: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  };

  const handleLanguageChange = (code: Language) => {
    setCurrentLang(code);
    setIsLangOpen(false);
    // প্রয়োজনীয় কোনো i18n বা global state থাকলে এখানে কল করতে পারেন
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <nav className={`w-full px-6 py-3 flex items-center justify-between shadow-lg transition-colors duration-200 ${
      theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-white text-gray-800 border-b border-gray-200'
    }`}>
      {/* Brand Logo & Name */}
      <Link to="/" className="flex items-center space-x-2 cursor-pointer">
        <div className="p-2 bg-teal-400 rounded-full text-gray-900">
          <Navigation className="w-5 h-5 fill-current" />
        </div>
        <span className="text-xl font-bold tracking-wide">CoolPath</span>
      </Link>

      {/* Main Navigation Links */}
      <div className="flex items-center space-x-8 font-medium">
        <Link 
          to="/" 
          className="flex items-center gap-1.5 hover:text-teal-400 transition-colors"
        >
          🗺 Map
        </Link>
        
        <Link 
          to="/history" 
          className="flex items-center gap-1.5 hover:text-teal-400 transition-colors"
        >
          📜 History
        </Link>

        <Link 
          to="/assistant" 
          className="flex items-center gap-1.5 hover:text-teal-400 transition-colors"
        >
          🤖 Assistant
        </Link>
      </div>

      {/* Right Controls: Theme Toggle, Language Select & Settings */}
      <div className="flex items-center space-x-3">
        {/* Dark/Light Mode Toggle */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Language Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
              theme === 'dark' 
                ? 'border-gray-700 bg-gray-800 text-white hover:bg-gray-700' 
                : 'border-gray-300 bg-gray-50 text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Globe className="w-4 h-4 text-teal-400" />
            <span className="uppercase text-sm font-semibold">{currentLang}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
          </button>

          {isLangOpen && (
            <div className={`absolute right-0 mt-2 w-36 rounded-lg shadow-xl py-2 z-50 border ${
              theme === 'dark' ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-800'
            }`}>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                    theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-teal-50'
                  } ${
                    currentLang === lang.code ? 'font-bold text-teal-400' : ''
                  }`}
                >
                  <span>{lang.name}</span>
                  {currentLang === lang.code && <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings Navigation Link */}
        <Link
          to="/settings"
          className={`p-2 rounded-lg transition-colors ${
            theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
          }`}
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </Link>
      </div>
    </nav>
  );
};