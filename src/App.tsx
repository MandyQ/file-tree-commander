import { FileTreeCommander } from './components/FileTreeCommander';
import { Sparkles } from 'lucide-react';
import './index.css';

function App() {
  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 shadow-sm">
        <div className="px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text">
                  FileTree Commander
                </h1>
                <p className="text-sm text-gray-600 mt-0.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Drag and drop files to reorganize your project structure
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-96px)] p-8">
        <FileTreeCommander />
      </main>
    </div>
  );
}

export default App;