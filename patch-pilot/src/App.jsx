import React, { useState } from 'react';
import { 
  GitBranch, 
  BookOpen, 
  Map, 
  FileDiff, 
  CheckCircle2, 
  RefreshCcw, 
  Activity, 
  ChevronRight, 
  ChevronDown, 
  Terminal, 
  AlertCircle, 
  Check, 
  Play, 
  Pause, 
  Search,
  Layout,
  Cpu,
  ArrowRight,
  FileCode,
  Upload,
  Github,
  Settings,
  Layers,
  FileJson,
  Database,
  Code
} from 'lucide-react';

// --- Mock Data ---

const PROJECT_INFO = {
  name: "fintech-core-services",
  status: "Analysis Complete",
  files: 243,
  languages: ["TypeScript", "Python"],
  dependencies: 42
};

const MOCK_DISCOVERY = [
  { id: "MIG-001", library: "auth-sdk-legacy", current: "v1.2.4", target: "v2.0.0", confidence: 0.98, enabled: true },
  { id: "MIG-002", library: "database-connector", current: "v4.1.0", target: "v5.0.0", confidence: 0.85, enabled: true },
  { id: "MIG-003", library: "ui-components", current: "v3.2.1", target: "v4.0.0", confidence: 0.62, enabled: false },
];

const MOCK_KNOWLEDGE = [
  { id: "KNOW-101", target: "auth-sdk-legacy", type: "Docs", summary: "Auth token format changed from Bearer to Token prefix.", relevance: 0.99, citation: "docs.auth-sdk.com/v2/migration" },
  { id: "KNOW-102", target: "auth-sdk-legacy", type: "GitHub Issue", summary: "Legacy session cleanup method removed.", relevance: 0.88, citation: "github.com/auth-sdk/issues/402" },
  { id: "KNOW-201", target: "database-connector", type: "Release Note", summary: "Connection pool config schema flattened.", relevance: 0.95, citation: "db-conn v5.0.0 Release Notes" },
];

const MOCK_PLAN = [
  { id: 1, target: "auth-sdk-legacy", step: "Token Header Update", status: "complete", details: "Scan and replace Authorization header construction.", rules: ["RULE-AUTH-01"] },
  { id: 2, target: "auth-sdk-legacy", step: "Session Handling", status: "in-progress", details: "Refactor session.destroy() to session.invalidate().", rules: ["RULE-AUTH-02"] },
  { id: 3, target: "database-connector", step: "Config Schema Flattening", status: "pending", details: "Update DB connection dictionaries.", rules: ["RULE-DB-05"] },
];

const MOCK_DIFF_OLD = `import { AuthClient } from 'auth-sdk-legacy';

const client = new AuthClient({
  baseUrl: 'https://api.internal',
  headers: {
    'Authorization': \`Bearer \${token}\`
  }
});

await client.session.destroy();`;

const MOCK_DIFF_NEW = `import { AuthClient } from 'auth-sdk-legacy';

const client = new AuthClient({
  baseUrl: 'https://api.internal',
  headers: {
    'Authorization': \`Token \${token}\`
  }
});

await client.session.invalidate();`;

const MOCK_VERIFICATION = [
  { id: 1, target: "auth-sdk-legacy", check: "Authentication Flow Test", status: "pass", file: "tests/integration/auth_test.ts" },
  { id: 2, target: "auth-sdk-legacy", check: "Session Invalidation", status: "fail", file: "tests/unit/session_test.ts", error: "TypeError: invalidate() is async, detected missing await" },
  { id: 3, target: "database-connector", check: "Connection Pooling", status: "skipped", file: "tests/db/pool_test.ts" },
];

const MOCK_REFLECTION = [
  { id: 1, target: "auth-sdk-legacy", attempt: 1, trigger: "TypeError: client.session.destroy is not a function", diagnosis: "Deprecated method usage detected despite plan.", fix: "Applied RULE-AUTH-02 transformation to catch remaining instances.", outcome: "Resolved" },
];

const MOCK_TRACE = [
  { id: "TR-001", agent: "DiscoveryAgent", target: "All", input: "Project Source Code", output: "Identified 3 migration targets", state: { files_scanned: 243, duration_ms: 4500 } },
  { id: "TR-002", agent: "RetrievalAgent", target: "auth-sdk-legacy", input: "Target: v2.0.0", output: "Fetched 12 relevant docs", state: { sources: ["docs", "github"], embedding_model: "text-embedding-3-small" } },
  { id: "TR-003", agent: "PlanningAgent", target: "auth-sdk-legacy", input: "Knowledge Graph", output: "Generated 5-step plan", state: { steps: 5, dependency_graph_nodes: 12 } },
  { id: "TR-004", agent: "CodingAgent", target: "auth-sdk-legacy", input: "Step 1: Header Update", output: "Modified 14 files", state: { changes: 14, tokens_used: 1250 } },
];

// --- Components ---

const StatusBadge = ({ status }) => {
  const colors = {
    running: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
    verified: "bg-green-500/10 text-green-400 border-green-500/20",
    pass: "bg-green-500/10 text-green-400 border-green-500/20",
    fail: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    complete: "bg-green-500/10 text-green-400 border-green-500/20",
    skipped: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    resolved: "bg-green-500/10 text-green-400 border-green-500/20",
    "in-progress": "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${colors[status.toLowerCase()] || colors.pending} uppercase tracking-wide`}>
      {status}
    </span>
  );
};

const NavItem = ({ icon: Icon, label, id, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-medium transition-colors border-l-2 ${
      active 
        ? "border-purple-500 bg-purple-500/5 text-white" 
        : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800"
    }`}
  >
    <Icon size={16} />
    <span>{label}</span>
  </button>
);

const SectionHeader = ({ title, subtitle }) => (
  <div className="mb-6">
    <h2 className="text-xl font-semibold text-white tracking-tight">{title}</h2>
    {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
  </div>
);

// --- View Components ---

const ProjectInputView = () => (
  <div className="max-w-4xl mx-auto p-8">
    <SectionHeader title="Project Ingestion" subtitle="Upload or link a codebase to begin analysis." />
    
    <div className="grid grid-cols-2 gap-6 mb-8">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-purple-500/50 hover:bg-gray-900/50 transition-all group">
        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
            <Upload size={24} className="text-gray-400 group-hover:text-purple-400" />
        </div>
        <h3 className="text-white font-medium mb-1">Upload ZIP Archive</h3>
        <p className="text-xs text-gray-500">Max size 500MB</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-purple-500/50 hover:bg-gray-900/50 transition-all group">
        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
            <Github size={24} className="text-gray-400 group-hover:text-purple-400" />
        </div>
        <h3 className="text-white font-medium mb-1">Import from GitHub</h3>
        <p className="text-xs text-gray-500">Public or Private (via token)</p>
      </div>
    </div>

    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 mb-6">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Search size={16} className="text-blue-400" /> Analysis Summary
      </h3>
      <div className="grid grid-cols-3 gap-8">
        <div>
           <div className="text-xs text-gray-500 uppercase font-bold mb-1">Total Files</div>
           <div className="text-2xl font-mono text-white">{PROJECT_INFO.files}</div>
        </div>
        <div>
           <div className="text-xs text-gray-500 uppercase font-bold mb-1">Languages</div>
           <div className="flex gap-2">
               {PROJECT_INFO.languages.map(l => (
                   <span key={l} className="px-2 py-1 bg-gray-800 text-gray-300 text-[10px] rounded border border-gray-700">{l}</span>
               ))}
           </div>
        </div>
        <div>
           <div className="text-xs text-gray-500 uppercase font-bold mb-1">Dependencies</div>
           <div className="text-2xl font-mono text-white">{PROJECT_INFO.dependencies}</div>
        </div>
      </div>
    </div>

    <button className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
        <Activity size={18} /> Analyze Project Dependencies
    </button>
  </div>
);

const DiscoveryView = () => (
  <div className="max-w-5xl mx-auto p-8 h-full flex flex-col">
    <SectionHeader title="Migration Discovery" subtitle="PatchPilot identified the following migration targets based on dependency analysis." />
    
    <div className="flex-1 overflow-auto border border-gray-800 rounded-lg bg-gray-900/20">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-900 border-b border-gray-800 text-gray-400 font-mono text-xs uppercase sticky top-0">
          <tr>
            <th className="px-6 py-3 font-medium w-10"></th>
            <th className="px-6 py-3 font-medium">Library / Framework</th>
            <th className="px-6 py-3 font-medium">Current Version</th>
            <th className="px-6 py-3 font-medium">Target Version</th>
            <th className="px-6 py-3 font-medium">Confidence</th>
            <th className="px-6 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
            {MOCK_DISCOVERY.map(mig => (
                <tr key={mig.id} className={`hover:bg-gray-800/30 transition-colors ${!mig.enabled ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                        <input type="checkbox" checked={mig.enabled} readOnly className="rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500" />
                    </td>
                    <td className="px-6 py-4 font-medium text-white">{mig.library}</td>
                    <td className="px-6 py-4 font-mono text-gray-400">{mig.current}</td>
                    <td className="px-6 py-4 font-mono text-purple-400 flex items-center gap-2">
                        {mig.target} 
                        <span className="text-xs text-gray-600 px-1.5 py-0.5 border border-gray-700 rounded">LATEST</span>
                    </td>
                    <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div className={`h-full ${mig.confidence > 0.8 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${mig.confidence * 100}%` }} />
                            </div>
                            <span className="text-xs font-mono text-gray-500">{Math.round(mig.confidence * 100)}%</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`text-xs ${mig.enabled ? 'text-green-400' : 'text-gray-500'}`}>{mig.enabled ? 'Ready' : 'Disabled'}</span>
                    </td>
                </tr>
            ))}
        </tbody>
      </table>
    </div>

    <div className="mt-6 flex justify-end">
        <button className="px-6 py-2 bg-white text-gray-900 hover:bg-gray-200 font-medium rounded text-sm flex items-center gap-2">
            <Map size={16} /> Generate Migration Plan
        </button>
    </div>
  </div>
);

const OverviewView = ({ onNavigate }) => (
    <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Migration Overview</h2>
            <StatusBadge status="Running" />
        </div>

        {/* Stepper */}
        <div className="flex items-center w-full text-xs font-mono mb-12">
            {["Discover", "Retrieve", "Plan", "Patch", "Verify", "Reflect"].map((step, idx) => (
                <React.Fragment key={step}>
                    <div className={`flex flex-col items-center gap-2 ${idx <= 2 ? 'text-purple-400' : 'text-gray-600'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                            idx < 2 ? 'bg-green-500/10 border-green-500 text-green-500' : 
                            idx === 2 ? 'bg-purple-500/10 border-purple-500 text-purple-400 animate-pulse' : 
                            'bg-gray-900 border-gray-700'
                        }`}>
                            {idx < 2 ? <Check size={14} /> : idx + 1}
                        </div>
                        <span>{step}</span>
                    </div>
                    {idx < 5 && (
                        <div className={`h-[2px] flex-1 mx-4 mb-6 ${idx < 2 ? 'bg-green-900' : 'bg-gray-800'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
            {MOCK_DISCOVERY.filter(m => m.enabled).map(mig => (
                <div key={mig.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="font-semibold text-white text-lg">{mig.library}</h3>
                        <StatusBadge status={mig.library.includes('auth') ? 'Running' : 'Pending'} />
                    </div>
                    <div className="text-sm text-gray-400 mb-6 flex items-center gap-2 font-mono">
                        {mig.current} <ArrowRight size={14} /> {mig.target}
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Files Affected</span>
                            <span className="text-gray-300">14</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Knowledge Items</span>
                            <span className="text-gray-300">12</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Plan Steps</span>
                            <span className="text-gray-300">5</span>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-800 flex justify-end">
                        <button onClick={() => onNavigate('diffs')} className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1">
                            View Details <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const KnowledgeView = ({ onSelect }) => (
    <div className="flex flex-col h-full">
        <div className="p-6 border-b border-gray-800 bg-gray-900/20 flex justify-between items-center">
            <div>
                <h2 className="text-lg font-semibold text-white mb-1">Retrieved Knowledge Context</h2>
                <p className="text-sm text-gray-400">RAG output derived from official docs, GitHub issues, and release notes.</p>
            </div>
            <div className="flex gap-2">
                <select className="bg-gray-800 border-gray-700 text-gray-300 text-xs rounded px-2 py-1">
                    <option>All Targets</option>
                    <option>auth-sdk-legacy</option>
                    <option>database-connector</option>
                </select>
            </div>
        </div>
        <div className="overflow-auto flex-1 p-6">
            <div className="space-y-2">
                {MOCK_KNOWLEDGE.map(item => (
                    <div 
                        key={item.id} 
                        onClick={() => onSelect(item, 'knowledge')}
                        className="bg-gray-900/40 border border-gray-800 hover:border-gray-600 hover:bg-gray-800/30 p-4 rounded-lg cursor-pointer transition-all group"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <span className="px-2 py-0.5 bg-gray-800 text-gray-400 rounded text-[10px] uppercase font-bold border border-gray-700">{item.type}</span>
                                <span className="text-xs font-mono text-purple-400">{item.target}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Score: {item.relevance}</span>
                                <div className={`w-2 h-2 rounded-full ${item.relevance > 0.9 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            </div>
                        </div>
                        <p className="text-gray-200 text-sm font-medium mb-1 group-hover:text-white">{item.summary}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">{item.citation}</p>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

const PlanView = ({ onSelect }) => (
    <div className="max-w-4xl mx-auto p-8">
        <SectionHeader title="Migration Plan" subtitle="AI-generated execution steps grouped by target." />
        
        {['auth-sdk-legacy', 'database-connector'].map(target => (
            <div key={target} className="mb-8">
                <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">{target}</h3>
                <div className="space-y-4">
                    {MOCK_PLAN.filter(p => p.target === target).map(step => (
                        <div 
                            key={step.id} 
                            onClick={() => onSelect(step, 'plan')}
                            className={`border rounded-lg p-4 transition-all cursor-pointer ${
                                step.status === 'in-progress' 
                                ? 'bg-purple-500/5 border-purple-500/30' 
                                : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold ${
                                        step.status === 'in-progress' ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'
                                    }`}>
                                        {step.id}
                                    </div>
                                    <h3 className={`font-medium ${step.status === 'in-progress' ? 'text-purple-200' : 'text-gray-300'}`}>
                                        {step.step}
                                    </h3>
                                </div>
                                <StatusBadge status={step.status} />
                            </div>
                            <p className="text-sm text-gray-400 pl-9 mb-3">{step.details}</p>
                            <div className="pl-9 flex gap-2">
                                {step.rules.map(r => (
                                    <span key={r} className="text-[10px] font-mono bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">
                                        {r}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                    {MOCK_PLAN.filter(p => p.target === target).length === 0 && (
                        <div className="text-sm text-gray-600 italic px-4">No steps generated yet.</div>
                    )}
                </div>
            </div>
        ))}
    </div>
);

const DiffView = ({ onSelect }) => {
    const oldLines = MOCK_DIFF_OLD.split('\n');
    const newLines = MOCK_DIFF_NEW.split('\n');

    return (
        <div className="flex flex-col h-full bg-[#0d1117]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
                <div className="flex items-center gap-2">
                    <FileCode size={16} className="text-gray-400" />
                    <span className="text-sm font-mono text-gray-300">src/services/api_client.ts</span>
                </div>
                <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded">- 1 line</span>
                    <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">+ 1 line</span>
                </div>
            </div>
            
            <div className="flex-1 overflow-auto flex font-mono text-xs leading-6">
                <div className="w-1/2 border-r border-gray-800 select-none">
                    {oldLines.map((line, i) => (
                        <div key={i} className="flex hover:bg-gray-800/30 group">
                            <span className="w-10 text-right pr-3 text-gray-600 select-none opacity-50">{i + 1}</span>
                            <pre className={`flex-1 pl-2 pr-2 whitespace-pre-wrap ${line.includes('Bearer') || line.includes('destroy') ? 'bg-red-900/20' : ''}`}>
                                <span className={line.includes('Bearer') || line.includes('destroy') ? 'bg-red-900/40 text-gray-300' : 'text-gray-500'}>{line}</span>
                            </pre>
                        </div>
                    ))}
                </div>
                <div className="w-1/2">
                    {newLines.map((line, i) => (
                        <div 
                            key={i} 
                            onClick={() => onSelect({ type: 'diff', line: i + 1, content: line })}
                            className="flex hover:bg-gray-800/30 cursor-pointer group"
                        >
                            <span className="w-10 text-right pr-3 text-gray-600 select-none border-r border-gray-800/50 group-hover:border-gray-700 opacity-50">{i + 1}</span>
                            <pre className={`flex-1 pl-2 pr-2 whitespace-pre-wrap ${line.includes('Token') || line.includes('invalidate') ? 'bg-green-900/20' : ''}`}>
                                <span className={line.includes('Token') || line.includes('invalidate') ? 'bg-green-900/40 text-green-100' : 'text-gray-300'}>
                                    {line}
                                    {(line.includes('Token') || line.includes('invalidate')) && (
                                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-600 text-white font-sans opacity-0 group-hover:opacity-100 transition-opacity">
                                            AI-MOD
                                        </span>
                                    )}
                                </span>
                            </pre>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const VerificationView = () => (
    <div className="max-w-5xl mx-auto p-8">
        <SectionHeader title="Verification Matrix" subtitle="Automated test results and static analysis checks." />
        
        {['auth-sdk-legacy', 'database-connector'].map(target => (
             <div key={target} className="mb-8">
                <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">{target}</h3>
                <div className="space-y-1">
                    {MOCK_VERIFICATION.filter(v => v.target === target).map((item) => (
                        <div key={item.id} className="group bg-gray-900/40 border border-gray-800 hover:border-gray-700 rounded overflow-hidden">
                            <div className="flex items-center px-4 py-3 gap-4">
                                <div className="w-6">
                                    {item.status === 'pass' ? <CheckCircle2 size={18} className="text-green-500" /> : 
                                     item.status === 'fail' ? <AlertCircle size={18} className="text-red-500" /> :
                                     <div className="w-4 h-4 rounded-full border-2 border-gray-600 border-dashed" />}
                                </div>
                                <div className="flex-1 font-mono text-sm text-gray-300">{item.check}</div>
                                <div className="text-xs text-gray-500 font-mono">{item.file}</div>
                                <StatusBadge status={item.status} />
                            </div>
                            {item.error && (
                                <div className="bg-red-950/20 border-t border-red-900/30 px-12 py-3">
                                    <code className="text-xs font-mono text-red-300 block mb-2">{item.error}</code>
                                    <div className="flex gap-2 mt-2">
                                        <button className="text-[10px] text-white bg-red-600/20 hover:bg-red-600/40 px-3 py-1.5 rounded border border-red-500/30 transition-colors uppercase font-bold tracking-wide">
                                            Request AI Fix
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {MOCK_VERIFICATION.filter(v => v.target === target).length === 0 && (
                         <div className="text-sm text-gray-600 italic px-4">No checks run.</div>
                    )}
                </div>
            </div>
        ))}
    </div>
);

const ReflectionView = () => (
    <div className="max-w-5xl mx-auto p-8 h-full flex flex-col">
        <SectionHeader title="Reflection Loop" subtitle="Autonomous retry attempts triggered by verification failures." />
        
        <div className="flex-1 relative">
            <div className="absolute left-6 top-4 bottom-0 w-0.5 bg-gray-800" />

            {MOCK_REFLECTION.map((item, idx) => (
                <div key={item.id} className="relative pl-20 pb-12">
                     {/* Node */}
                     <div className="absolute left-[15px] top-0 w-8 h-8 rounded-full bg-gray-950 border-4 border-gray-800 flex items-center justify-center z-10">
                        <span className="text-gray-500 font-bold text-xs">{item.attempt}</span>
                    </div>

                    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-white">Attempt #{item.attempt}</h3>
                                <div className="text-xs text-gray-500 font-mono mt-1">{item.target}</div>
                            </div>
                            <StatusBadge status={item.outcome === 'Resolved' ? 'resolved' : 'failed'} />
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Triggering Failure</div>
                                <div className="bg-black/30 p-2 rounded border border-red-900/20 text-red-400 font-mono text-xs">
                                    {item.trigger}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Diagnosis</div>
                                    <p className="text-sm text-gray-300">{item.diagnosis}</p>
                                </div>
                                <div>
                                    <div className="text-[10px] uppercase text-gray-500 font-bold mb-1">Applied Fix</div>
                                    <p className="text-sm text-blue-300">{item.fix}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const TraceView = ({ onSelect }) => (
    <div className="max-w-3xl mx-auto p-8 h-full">
         <SectionHeader title="LangGraph Trace" subtitle="Agent orchestration and state transitions." />

         <div className="relative">
             <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-gray-800" />
             
             <div className="space-y-8">
                 {MOCK_TRACE.map((node, i) => (
                     <div key={node.id} className="relative pl-14 cursor-pointer group" onClick={() => onSelect(node, 'trace')}>
                         <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-gray-950 flex items-center justify-center z-10 transition-colors ${
                             i === MOCK_TRACE.length - 1 ? 'bg-purple-500 text-white animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'
                         }`}>
                             <div className="text-[10px] font-bold">{i+1}</div>
                         </div>
                         
                         <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 group-hover:border-purple-500/30 transition-colors">
                             <div className="flex justify-between items-start mb-2">
                                 <span className="text-sm font-semibold text-white">{node.agent}</span>
                                 <span className="text-[10px] font-mono text-gray-500">{node.target}</span>
                             </div>
                             <div className="grid grid-cols-2 gap-4 text-xs">
                                 <div>
                                     <div className="text-gray-500 uppercase font-bold text-[10px] mb-1">Input</div>
                                     <div className="text-gray-400 truncate">{node.input}</div>
                                 </div>
                                 <div>
                                     <div className="text-gray-500 uppercase font-bold text-[10px] mb-1">Output</div>
                                     <div className="text-gray-300 truncate">{node.output}</div>
                                 </div>
                             </div>
                         </div>
                     </div>
                 ))}
             </div>
         </div>
    </div>
);

// --- Context Panel ---

const ContextPanel = ({ isOpen, item, type, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="w-[450px] border-l border-gray-800 bg-gray-950 flex flex-col shadow-2xl z-20 shrink-0 transition-all">
      <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900/50">
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {type === 'trace' ? 'Agent State' : 'Inspector'}
            </span>
            {item?.id && <span className="text-xs font-mono text-gray-600 bg-gray-900 px-1.5 py-0.5 rounded">{item.id}</span>}
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><ChevronRight size={18} /></button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {type === 'trace' && item && (
            <div className="space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{item.agent}</h3>
                    <p className="text-xs text-gray-400 font-mono mb-4">Node ID: {item.id}</p>
                    
                    <div className="bg-black p-4 rounded border border-gray-800 font-mono text-xs text-green-400 overflow-x-auto">
                        <pre>{JSON.stringify(item.state, null, 2)}</pre>
                    </div>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Prompt Context</h4>
                    <div className="bg-gray-900 p-3 rounded text-gray-400 text-xs italic">
                        "Analyze the provided dependency graph and identify migration paths for {item.target}..."
                    </div>
                </div>
            </div>
        )}

        {type === 'knowledge' && item && (
            <div className="space-y-6">
                <div>
                   <h3 className="text-lg font-semibold text-white mb-2">Knowledge Source</h3>
                   <div className="flex items-center gap-2 mb-4">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs rounded uppercase font-bold">{item.type}</span>
                        <span className="text-xs text-gray-500">{item.citation}</span>
                   </div>
                   <p className="text-gray-300 text-sm leading-relaxed">{item.summary}</p>
                </div>
                <div className="border-t border-gray-800 pt-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Supported Rules</h4>
                    <div className="text-sm font-mono text-gray-400">RULE-AUTH-01, RULE-AUTH-02</div>
                </div>
            </div>
        )}

        {type === 'diff' && item && (
             <div className="space-y-6">
                 <div className="flex items-center gap-2 mb-4">
                     <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                     <span className="text-sm font-bold text-white">AI Annotation</span>
                 </div>
                 
                 <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                     <p className="text-sm text-gray-200 mb-2">
                        Legacy session destruction detected. Replaced with invalidation method to clear server-side tokens.
                     </p>
                     <div className="flex gap-2 mt-3">
                         <span className="text-[10px] bg-gray-900 text-gray-500 px-2 py-1 rounded border border-gray-700 font-mono">CONFIDENCE: 99%</span>
                         <span className="text-[10px] bg-gray-900 text-purple-400 px-2 py-1 rounded border border-gray-700 font-mono">RULE-AUTH-02</span>
                     </div>
                 </div>
             </div>
        )}

        {!item && (
            <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4">
                <Layout size={48} className="opacity-20" />
                <p className="text-sm text-center px-8">Select an item to view detailed diagnostics.</p>
            </div>
        )}
      </div>
    </div>
  );
};

// --- Main App Shell ---

const App = () => {
  const [activeView, setActiveView] = useState('input');
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectionType, setSelectionType] = useState(null);

  const handleSelect = (item, type = 'details') => {
      setSelectedItem(item);
      setSelectionType(item.type === 'diff' ? 'diff' : type);
      setPanelOpen(true);
  };

  const handleNavigate = (viewId) => {
      setActiveView(viewId);
      setPanelOpen(false); // Close panel on nav change usually feels cleaner
  };

  return (
    <div className="flex h-screen bg-gray-950 text-gray-200 font-sans selection:bg-purple-500/30">
      
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-gray-800 flex flex-col bg-gray-950 flex-shrink-0 z-10">
        <div className="h-14 flex items-center px-5 border-b border-gray-800 bg-gray-950">
           <Terminal className="text-purple-500 mr-2" size={20} />
           <span className="font-bold tracking-tight text-white">PatchPilot</span>
        </div>
        
        <div className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-4 py-2 text-[10px] font-bold uppercase text-gray-600 tracking-wider">Configuration</div>
          <NavItem id="input" label="Project Input" icon={Upload} active={activeView === 'input'} onClick={handleNavigate} />
          <NavItem id="discovery" label="Migration Discovery" icon={Search} active={activeView === 'discovery'} onClick={handleNavigate} />
          
          <div className="mt-6 px-4 py-2 text-[10px] font-bold uppercase text-gray-600 tracking-wider">Execution</div>
          <NavItem id="overview" label="Overview" icon={Layout} active={activeView === 'overview'} onClick={handleNavigate} />
          <NavItem id="knowledge" label="Retrieved Knowledge" icon={BookOpen} active={activeView === 'knowledge'} onClick={handleNavigate} />
          <NavItem id="plan" label="Execution Plan" icon={Map} active={activeView === 'plan'} onClick={handleNavigate} />
          <NavItem id="diffs" label="Code Diffs" icon={FileDiff} active={activeView === 'diffs'} onClick={handleNavigate} />
          <NavItem id="verify" label="Verification" icon={CheckCircle2} active={activeView === 'verify'} onClick={handleNavigate} />
          <NavItem id="reflect" label="Reflection Loop" icon={RefreshCcw} active={activeView === 'reflect'} onClick={handleNavigate} />
          
          <div className="mt-6 px-4 py-2 text-[10px] font-bold uppercase text-gray-600 tracking-wider">System</div>
          <NavItem id="trace" label="Trace Timeline" icon={Activity} active={activeView === 'trace'} onClick={handleNavigate} />
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-900/20">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-xs font-bold text-white">F</div>
                <div className="text-xs overflow-hidden">
                    <div className="text-white truncate font-medium">fintech-core</div>
                    <div className="text-gray-500 truncate">Branch: feature/mig-v2</div>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-gray-950">
        {/* Top Bar */}
        <div className="h-14 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">Project /</span>
                <span className="text-gray-200 font-medium">fintech-core-services</span>
                <span className="text-gray-600 mx-2">|</span>
                <span className="flex items-center gap-2 text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    <Activity size={12} /> Analysis Phase
                </span>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-xs text-gray-500 font-mono">v1.2.0-beta</div>
                <button className="text-gray-400 hover:text-white"><Settings size={18} /></button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            {activeView === 'input' && <ProjectInputView />}
            {activeView === 'discovery' && <DiscoveryView />}
            {activeView === 'overview' && <OverviewView onNavigate={handleNavigate} />}
            {activeView === 'knowledge' && <KnowledgeView onSelect={handleSelect} />}
            {activeView === 'plan' && <PlanView onSelect={handleSelect} />}
            {activeView === 'diffs' && <DiffView onSelect={handleSelect} />}
            {activeView === 'verify' && <VerificationView />}
            {activeView === 'reflect' && <ReflectionView />}
            {activeView === 'trace' && <TraceView onSelect={handleSelect} />}
        </div>
      </div>

      {/* Context Panel */}
      <ContextPanel 
        isOpen={panelOpen} 
        item={selectedItem} 
        type={selectionType}
        onClose={() => setPanelOpen(false)} 
      />

    </div>
  );
};

export default App;