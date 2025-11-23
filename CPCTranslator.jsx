import React, { useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  Code,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const CPCTranslator = () => {
  const [mode, setMode] = useState('nl-to-cpc');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mapping, setMapping] = useState({});
  const [customMapping, setCustomMapping] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Motor NL → CPC
  const nlToCpc = (text, customMappings = {}) => {
    let formula = text.toLowerCase().trim();
    const propositions = {};
    let varCounter = 0;
    const getNextVar = () => String.fromCharCode(80 + varCounter++); // P, Q, R...

    formula = formula.replace(/[.!?]+$/, '');

    const patterns = [
      { regex: /se\s+(.+?)\s*,?\s*entao\s+(.+)/i, transform: (m, p1, p2) => `(${p1}) → (${p2})` },
      { regex: /se\s+(.+?)\s*,?\s*(.+)/i, transform: (m, p1, p2) => `(${p1}) → (${p2})` },
      { regex: /(.+?)\s+se\s+e\s+somente\s+se\s+(.+)/i, transform: (m, p1, p2) => `(${p1}) ↔ (${p2})` },
      { regex: /(.+?)\s+somente\s+se\s+(.+)/i, transform: (m, p1, p2) => `(${p1}) → (${p2})` },
      { regex: /(.+?)\s+e\s+(.+)/i, transform: (m, p1, p2) => `(${p1}) ∧ (${p2})` },
      { regex: /(.+?)\s+ou\s+(.+)/i, transform: (m, p1, p2) => `(${p1}) ∨ (${p2})` },
      { regex: /nao\s+(.+)/i, transform: (m, p1) => `¬(${p1})` },
    ];

    let matched = false;
    for (const pattern of patterns) {
      const match = formula.match(pattern.regex);
      if (match) {
        formula = pattern.transform(...match);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const varName = customMappings[formula] || getNextVar();
      propositions[varName] = formula;
      return { formula: varName, propositions };
    }

    const atomicRegex = /\(([^()→∧∨↔¬]+)\)/g;
    let atomMatch;
    const atoms = new Set();

    while ((atomMatch = atomicRegex.exec(formula)) !== null) {
      atoms.add(atomMatch[1].trim());
    }

    atoms.forEach((atom) => {
      const cleanAtom = atom.trim();
      let varName;

      if (Object.keys(customMappings).length > 0) {
        const customKey = Object.keys(customMappings).find(
          (k) => cleanAtom.includes(k) || k.includes(cleanAtom)
        );
        varName = (customKey && customMappings[customKey]) || getNextVar();
      } else {
        varName = getNextVar();
      }

      propositions[varName] = cleanAtom;

      const escaped = cleanAtom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      formula = formula.replace(new RegExp(`\$begin:math:text$\$\{escaped\}\\$end:math:text$`, 'g'), varName);
    });

    formula = formula.replace(/\s+/g, ' ').trim();

    return { formula, propositions };
  };

  // Motor CPC → NL
  const cpcToNl = (formula, customMappings = {}) => {
    const parse = (expr) => {
      expr = expr.trim();

      if (expr.startsWith('(') && expr.endsWith(')')) {
        expr = expr.slice(1, -1);
      }

      const operators = [
        { symbol: '↔', text: ' se e somente se ' },
        { symbol: '→', text: ' implica que ' },
        { symbol: '∨', text: ' ou ' },
        { symbol: '∧', text: ' e ' },
      ];

      for (const op of operators) {
        let depth = 0;
        for (let i = expr.length - 1; i >= 0; i--) {
          if (expr[i] === ')') depth++;
          if (expr[i] === '(') depth--;
          if (depth === 0 && expr.slice(i, i + op.symbol.length) === op.symbol) {
            const left = parse(expr.slice(0, i));
            const right = parse(expr.slice(i + op.symbol.length));
            return `${left}${op.text}${right}`;
          }
        }
      }

      if (expr.startsWith('¬')) {
        return `não ${parse(expr.slice(1))}`;
      }

      const varMatch = expr.match(/^[A-Z]$/i);
      if (varMatch) {
        return customMappings[expr.toUpperCase()] || expr.toUpperCase();
      }

      return expr;
    };

    return parse(formula);
  };

  const handleTranslate = () => {
    setError('');
    setLoading(true);

    try {
      const mappings = {};
      if (customMapping.trim()) {
        customMapping.split('\n').forEach((line) => {
          const [key, value] = line.split('=').map((s) => s.trim());
          if (key && value) {
            mappings[key] = value;
          }
        });
      }

      setTimeout(() => {
        if (mode === 'nl-to-cpc') {
          const result = nlToCpc(input, mappings);
          setOutput(result.formula);
          setMapping(result.propositions);
        } else {
          const result = cpcToNl(input, mappings);
          setOutput(result);
          setMapping({});
        }
        setLoading(false);
      }, 300);
    } catch {
      setError('Erro ao processar entrada. Verifique a sintaxe.');
      setLoading(false);
    }
  };

  const examples =
    mode === 'nl-to-cpc'
      ? [
          { text: 'Se chover então a grama ficara molhada', desc: 'Implicação simples' },
          { text: 'Joao estuda e Maria trabalha', desc: 'Conjunção' },
          { text: 'Nao esta chovendo', desc: 'Negação' },
          { text: 'Se estudar e praticar então passarei na prova', desc: 'Implicação composta' },
        ]
      : [
          { text: 'P → Q', desc: 'Implicação simples' },
          { text: '(P ∧ Q) → R', desc: 'Conjunção com implicação' },
          { text: '¬P ∨ Q', desc: 'Negação com disjunção' },
          { text: 'P ↔ Q', desc: 'Bicondicional' },
        ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">

        <div className="text-center mb-8 pt-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Tradutor NL ↔ CPC</h1>
          <p className="text-gray-600">Agente de IA para Cálculo Proposicional Clássico</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setMode('nl-to-cpc')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                mode === 'nl-to-cpc'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <BookOpen size={20} />
              Português para Lógica
            </button>

            <button
              onClick={() => setMode('cpc-to-nl')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                mode === 'cpc-to-nl'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Code size={20} />
              Lógica para Português
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">

          {/* INPUT */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {mode === 'nl-to-cpc' ? 'Entrada (Português)' : 'Entrada (Fórmula CPC)'}
            </h2>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                mode === 'nl-to-cpc'
                  ? 'Ex: Se chover então a grama ficara molhada'
                  : 'Ex: (P ∧ Q) → R'
              }
              className="w-full h-32 p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 resize-none"
            />

            <div className="mt-4">
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                Mapeamento Customizado (opcional)
              </label>

              <textarea
                value={customMapping}
                onChange={(e) => setCustomMapping(e.target.value)}
                placeholder={
                  mode === 'nl-to-cpc'
                    ? 'chover = P\na grama ficara molhada = Q'
                    : 'P = chover\nQ = a grama ficara molhada'
                }
                className="w-full h-20 p-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 resize-none text-sm"
              />
            </div>

            <button
              onClick={handleTranslate}
              disabled={!input.trim() || loading}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={20} className="animate-spin" />
                  Traduzindo...
                </>
              ) : (
                <>
                  {mode === 'nl-to-cpc' ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
                  Traduzir
                </>
              )}
            </button>
          </div>

          {/* OUTPUT */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {mode === 'nl-to-cpc' ? 'Saída (CPC)' : 'Saída (Português)'}
            </h2>

            {error ? (
              <div className="flex items-center gap-2 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700">
                <AlertCircle size={20} />
                {error}
              </div>
            ) : output ? (
              <>
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200 mb-4">
                  <p className="text-2xl font-mono font-bold text-gray-800">{output}</p>
                </div>

                {Object.keys(mapping).length > 0 && (
                  <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200">
                    <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <CheckCircle size={18} className="text-green-600" />
                      Mapeamento de Proposições
                    </h3>

                    <div className="space-y-1">
                      {Object.entries(mapping).map(([key, value]) => (
                        <p key={key} className="text-sm text-gray-700">
                          <span className="font-mono font-bold text-blue-600">{key}</span> ={' '}
                          {value}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="h-32 flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                O resultado aparecerá aqui
              </div>
            )}
          </div>
        </div>

        {/* EXEMPLOS */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Exemplos</h3>

          <div className="grid md:grid-cols-2 gap-3">
            {examples.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => setInput(ex.text)}
                className="p-3 bg-gray-50 hover:bg-blue-50 rounded-xl text-left border-2 border-gray-200 hover:border-blue-300 transition"
              >
                <p className="font-mono text-sm text-gray-800">{ex.text}</p>
                <p className="text-xs text-gray-500 mt-1">{ex.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* REFERÊNCIA DE CONECTIVOS */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6 mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Conectivos Lógicos</h3>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { symbol: '∧', name: 'Conjunção (E)', example: 'P ∧ Q' },
              { symbol: '∨', name: 'Disjunção (OU)', example: 'P ∨ Q' },
              { symbol: '¬', name: 'Negação (NÃO)', example: '¬P' },
              { symbol: '→', name: 'Implicação', example: 'P → Q' },
              { symbol: '↔', name: 'Bicondicional', example: 'P ↔ Q' },
            ].map((op, idx) => (
              <div
                key={idx}
                className="p-3 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200"
              >
                <p className="text-3xl text-center mb-1">{op.symbol}</p>
                <p className="text-xs text-gray-700 font-semibold text-center">{op.name}</p>
                <p className="text-xs text-gray-500 text-center font-mono mt-1">{op.example}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CPCTranslator;
