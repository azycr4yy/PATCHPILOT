import React, { useState, useEffect } from 'react';
import {
    GitBranch, BookOpen, Map, FileDiff, CheckCircle2, RefreshCcw, Activity,
    ChevronRight, ChevronDown, Terminal, AlertCircle, Check, Play, Pause,
    Search, Layout, Cpu, ArrowRight, FileCode, Upload, Github, Settings,
    Layers, FileJson, Database, Code, Loader2, FolderOpen, AlertTriangle
} from 'lucide-react';
import { api } from './services/api';

// --- Mock Data (Initial States) ---
// These serve as the "empty" or "loading" states before API returns
const INITIAL_KNOWLEDGE = [
    { id: "KNOW-101", target: "auth-sdk-legacy", type: "Docs", summary: "Auth token format changed from Bearer to Token prefix.", relevance: 0.99, citation: "docs.auth-sdk.com/v2/migration" },
    { id: "KNOW-102", target: "auth-sdk-legacy", type: "GitHub Issue", summary: "Legacy session cleanup method removed.", relevance: 0.88, citation: "github.com/auth-sdk/issues/402" },
    { id: "KNOW-201", target: "database-connector", type: "Release Note", summary: "Connection pool config schema flattened.", relevance: 0.95, citation: "db-conn v5.0.0 Release Notes" },
];

const INITIAL_DIFF_OLD = `import { AuthClient } from 'auth-sdk-legacy';

const client = new AuthClient({
  baseUrl: 'https://api.internal',
  headers: {
    'Authorization': \`Bearer \${token}\`
  }
});

await client.session.destroy();`;

const INITIAL_DIFF_NEW = `import { AuthClient } from 'auth-sdk-legacy';

const client = new AuthClient({
  baseUrl: 'https://api.internal',
  headers: {
    'Authorization': \`Token \${token}\`
  }
});

await client.session.invalidate();`;

const INITIAL_VERIFICATION = [
    { id: 1, target: "auth-sdk-legacy", check: "Authentication Flow Test", status: "pass", file: "tests/integration/auth_test.ts" },
    { id: 2, target: "auth-sdk-legacy", check: "Session Invalidation", status: "fail", file: "tests/unit/session_test.ts", error: "TypeError: invalidate() is async, detected missing await" },
    { id: 3, target: "database-connector", check: "Connection Pooling", status: "skipped", file: "tests/db/pool_test.ts" },
];

const INITIAL_REFLECTION = [
    { id: 1, target: "auth-sdk-legacy", attempt: 1, trigger: "TypeError: client.session.destroy is not a function", diagnosis: "Deprecated method usage detected despite plan.", fix: "Applied RULE-AUTH-02 transformation to catch remaining instances.", outcome: "Resolved" },
];

const INITIAL_TRACE = [
    { id: "TR-001", agent: "DiscoveryAgent", target: "All", input: "Project Source Code", output: "Identified 3 migration targets", state: { files_scanned: 243, duration_ms: 4500 } },
    { id: "TR-002", agent: "RetrievalAgent", target: "auth-sdk-legacy", input: "Target: v2.0.0", output: "Fetched 12 relevant docs", state: { sources: ["docs", "github"], embedding_model: "text-embedding-3-small" } },
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
        <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${colors[status?.toLowerCase()] || colors.pending} uppercase tracking-wide`}>
            {status}
        </span>
    );
};

const NavItem = ({ icon: Icon, label, id, active, onClick }) => (
    <button
        onClick={() => onClick(id)}
        className={`w-full flex items-center gap-3 px-4 py-2 text-xs font-medium transition-colors border-l-2 ${active
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

const DynamicInputView = ({ onAnalyze, isAnalyzing, projectData }) => {
    const [inputConfig, setInputConfig] = useState(null);
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);
    const [configError, setConfigError] = useState(null);
    const [formValues, setFormValues] = useState({});
    const [dragActive, setDragActive] = useState(false);

    useEffect(() => {
        api.getInputConfig()
            .then(data => {
                setInputConfig(data.inputs);
                setIsLoadingConfig(false);
            })
            .catch(err => {
                console.error("Failed to load input config:", err);
                setConfigError("Could not load input configuration from backend.");
                setIsLoadingConfig(false);
            });
    }, []);

    const handleFileDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            try {
                // Determine which input accepts files (assuming first file input for simplicity)
                const fileInput = inputConfig.find(input => input.type === 'file');
                if (fileInput) {
                    // Update UI immediately
                    setFormValues(prev => ({ ...prev, [fileInput.id]: file.name }));

                    // Trigger upload
                    const result = await api.uploadFile(file);
                    // Pass run_id back to parent or store in form values
                    if (result.run_id) {
                        onAnalyze({ run_id: result.run_id }); // Or handle differently
                    }
                }
            } catch (error) {
                console.error("Upload failed:", error);
                alert("Upload failed: " + error.message);
            }
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleInputChange = (id, value) => {
        setFormValues(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = () => {
        // Collect all values and trigger analysis
        // Note: For file uploads, we might have already uploaded, or we might send the URL here.
        // This logic depends on specific backend flow. Assuming we pass gathered data to parent.
        onAnalyze(formValues);
    };

    if (isLoadingConfig) return <div className="p-8 text-gray-400 flex justify-center"><Loader2 className="animate-spin mr-2" /> Loading configuration...</div>;
    if (configError) return <div className="p-8 text-red-400 flex justify-center"><AlertTriangle className="mr-2" /> {configError}</div>;

    return (
        <div className="max-w-4xl mx-auto p-8">
            <SectionHeader title="Project Ingestion" subtitle="Configure analysis parameters." />

            <div className="grid gap-6 mb-8">
                {inputConfig.map(input => (
                    <div key={input.id} className="bg-gray-900/50 p-6 rounded-lg border border-gray-800">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">
                            {input.label} {input.required && <span className="text-red-500">*</span>}
                        </label>

                        {input.type === 'file' && (
                            <div
                                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${dragActive ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-500'}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleFileDrop}
                            >
                                <div className="flex flex-col items-center justify-center">
                                    <Upload size={32} className="text-gray-400 mb-4" />
                                    <p className="text-sm text-gray-300">Drag and drop your {input.accepted_formats?.join(', ')} file here</p>
                                    {formValues[input.id] && (
                                        <div className="mt-4 flex items-center gap-2 text-green-400 bg-green-900/20 px-3 py-1 rounded-full">
                                            <CheckCircle2 size={14} /> {formValues[input.id]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {input.type === 'text' && (
                            <input
                                type="text"
                                placeholder={input.placeholder}
                                className="w-full bg-gray-950 border border-gray-700 rounded px-4 py-3 text-gray-200 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
                                value={formValues[input.id] || ''}
                                onChange={(e) => handleInputChange(input.id, e.target.value)}
                            />
                        )}

                        {input.type === 'select' && (
                            <select
                                className="w-full bg-gray-950 border border-gray-700 rounded px-4 py-3 text-gray-200 focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
                                value={formValues[input.id] || ''}
                                onChange={(e) => handleInputChange(input.id, e.target.value)}
                            >
                                <option value="" disabled>Select an option</option>
                                {input.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        )}
                    </div>
                ))}
            </div>

            <button
                onClick={handleSubmit}
                disabled={isAnalyzing}
                className={`w-full py-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm ${isAnalyzing ? 'bg-purple-900/50 text-purple-200 cursor-wait' :
                    'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20'
                    }`}
            >
                {isAnalyzing ? (
                    <>
                        <Loader2 size={18} className="animate-spin" /> Analyzing...
                    </>
                ) : (
                    <>
                        <Activity size={18} /> Start Analysis
                    </>
                )}
            </button>
        </div>
    );
};

const DiscoveryView = ({ data, onGeneratePlan, isGeneratingPlan, toggleMigration }) => (
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
                    {data && data.length > 0 ? data.map(mig => (
                        <tr key={mig.id} className={`hover:bg-gray-800/30 transition-colors ${!mig.enabled ? 'opacity-50' : ''}`}>
                            <td className="px-6 py-4">
                                <input
                                    type="checkbox"
                                    checked={mig.enabled}
                                    onChange={() => toggleMigration(mig.id)}
                                    className="rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-purple-500 cursor-pointer"
                                />
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
                    )) : (
                        <tr>
                            <td colSpan="6" className="text-center py-8 text-gray-500 italic">No migrations discovered yet. Please analyze a project.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        <div className="mt-6 flex justify-end">
            <button
                onClick={onGeneratePlan}
                disabled={!data || data.length === 0 || isGeneratingPlan}
                className={`px-6 py-2 font-medium rounded text-sm flex items-center gap-2 ${!data || data.length === 0 ? 'bg-gray-800 text-gray-600 cursor-not-allowed' :
                    isGeneratingPlan ? 'bg-gray-200 text-gray-800 cursor-wait' : 'bg-white text-gray-900 hover:bg-gray-200'
                    }`}
            >
                {isGeneratingPlan ? (
                    <><Loader2 size={16} className="animate-spin" /> Generating...</>
                ) : (
                    <><Map size={16} /> Generate Migration Plan</>
                )}
            </button>
        </div>
    </div>
);

const OverviewView = ({ onNavigate, discoveryData, planData }) => (
    <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white">Migration Overview</h2>
            <StatusBadge status={planData ? "Running" : "Pending"} />
        </div>

        {/* Stepper */}
        <div className="flex items-center w-full text-xs font-mono mb-12">
            {["Discover", "Retrieve", "Plan", "Patch", "Verify", "Reflect"].map((step, idx) => (
                <React.Fragment key={step}>
                    <div className={`flex flex-col items-center gap-2 ${idx <= 2 ? 'text-purple-400' : 'text-gray-600'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${idx < 2 ? 'bg-green-500/10 border-green-500 text-green-500' :
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
            {discoveryData && discoveryData.filter(m => m.enabled).map(mig => (
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
            {(!discoveryData || discoveryData.length === 0) && (
                <div className="col-span-2 text-center text-gray-500 py-12 border border-dashed border-gray-800 rounded-lg">
                    No active migrations. Start by analyzing a project.
                </div>
            )}
        </div>
    </div>
);

const KnowledgeView = ({ onSelect, data }) => (
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
                {data.map(item => (
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

const PlanView = ({ onSelect, plan }) => (
    <div className="max-w-4xl mx-auto p-8">
        <SectionHeader title="Migration Plan" subtitle="AI-generated execution steps grouped by target." />

        {plan ? ['auth-sdk-legacy', 'database-connector'].map(target => (
            <div key={target} className="mb-8">
                <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">{target}</h3>
                <div className="space-y-4">
                    {plan.filter(p => p.target === target).map(step => (
                        <div
                            key={step.id}
                            onClick={() => onSelect(step, 'plan')}
                            className={`border rounded-lg p-4 transition-all cursor-pointer ${step.status === 'in-progress'
                                ? 'bg-purple-500/5 border-purple-500/30'
                                : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold ${step.status === 'in-progress' ? 'bg-purple-500 text-white' : 'bg-gray-800 text-gray-400'
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
                    {plan.filter(p => p.target === target).length === 0 && (
                        <div className="text-sm text-gray-600 italic px-4">No steps generated yet.</div>
                    )}
                </div>
            </div>
        )) : (
            <div className="text-center py-12 text-gray-500">Plan has not been generated yet.</div>
        )}
    </div>
);

const DiffView = ({ onSelect }) => {
    const oldLines = INITIAL_DIFF_OLD.split('\n');
    const newLines = INITIAL_DIFF_NEW.split('\n');

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

const VerificationView = ({ verificationData, onRequestFix }) => (
    <div className="max-w-5xl mx-auto p-8">
        <SectionHeader title="Verification Matrix" subtitle="Automated test results and static analysis checks." />

        {['auth-sdk-legacy', 'database-connector'].map(target => (
            <div key={target} className="mb-8">
                <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">{target}</h3>
                <div className="space-y-1">
                    {verificationData.filter(v => v.target === target).map((item) => (
                        <div key={item.id} className="group bg-gray-900/40 border border-gray-800 hover:border-gray-700 rounded overflow-hidden">
                            <div className="flex items-center px-4 py-3 gap-4">
                                <div className="w-6">
                                    {item.status === 'pass' || item.status === 'resolved' ? <CheckCircle2 size={18} className="text-green-500" /> :
                                        item.status === 'fail' ? <AlertCircle size={18} className="text-red-500" /> :
                                            <div className="w-4 h-4 rounded-full border-2 border-gray-600 border-dashed" />}
                                </div>
                                <div className="flex-1 font-mono text-sm text-gray-300">{item.check}</div>
                                <div className="text-xs text-gray-500 font-mono">{item.file}</div>
                                <StatusBadge status={item.status} />
                            </div>
                            {item.error && item.status === 'fail' && (
                                <div className="bg-red-950/20 border-t border-red-900/30 px-12 py-3">
                                    <code className="text-xs font-mono text-red-300 block mb-2">{item.error}</code>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => onRequestFix(item.id)}
                                            className="text-[10px] text-white bg-red-600/20 hover:bg-red-600/40 px-3 py-1.5 rounded border border-red-500/30 transition-colors uppercase font-bold tracking-wide"
                                        >
                                            Request AI Fix
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {verificationData.filter(v => v.target === target).length === 0 && (
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

            {INITIAL_REFLECTION.map((item, idx) => (
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
                {INITIAL_TRACE.map((node, i) => (
                    <div key={node.id} className="relative pl-14 cursor-pointer group" onClick={() => onSelect(node, 'trace')}>
                        <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-gray-950 flex items-center justify-center z-10 transition-colors ${i === INITIAL_TRACE.length - 1 ? 'bg-purple-500 text-white animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'
                            }`}>
                            <div className="text-[10px] font-bold">{i + 1}</div>
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

    // --- Backend State ---
    const [projectInfo, setProjectInfo] = useState(null);
    const [discoveryData, setDiscoveryData] = useState([]);
    const [planData, setPlanData] = useState(null);
    const [verificationData, setVerificationData] = useState(INITIAL_VERIFICATION);
    const [loading, setLoading] = useState({
        analyzing: false,
        generatingPlan: false,
    });

    const handleAnalysis = async (data) => {
        setLoading(prev => ({ ...prev, analyzing: true }));
        try {
            // For now, handling both github and upload trigger via same local state update
            // In real app, we would maybe poll for status if using run_id
            if (data.url) {
                await api.analyzeGithub(data.url, data.depth || "Quick Scan");
            }
            // Mocking the completion of analysis for the UX
            setTimeout(() => {
                setProjectInfo({
                    files: 154,
                    languages: ["Python", "JavaScript"],
                    dependencies: 28,
                    status: "Analysis Complete"
                });
                setLoading(prev => ({ ...prev, analyzing: false }));
                // Trigger discovery fetch
                fetchDiscovery();
                setActiveView('overview');
            }, 2000);

        } catch (error) {
            console.error("Analysis failed:", error);
            alert("Analysis failed: " + error.message);
            setLoading(prev => ({ ...prev, analyzing: false }));
        }
    };

    const fetchDiscovery = async () => {
        try {
            const data = await api.getDiscovery();
            setDiscoveryData(data);
        } catch (e) { console.error(e); }
    };

    const handleGeneratePlan = async () => {
        setLoading(prev => ({ ...prev, generatingPlan: true }));
        const selected = discoveryData.filter(m => m.enabled);
        const plan = await api.generatePlan(selected);
        setPlanData(plan);
        setLoading(prev => ({ ...prev, generatingPlan: false }));
        setActiveView('plan');
    };

    const handleRequestFix = async (id) => {
        api.requestFix(id).then(res => {
            setVerificationData(prev => prev.map(item =>
                item.id === id ? { ...item, status: 'resolved', error: null } : item
            ));
        });
    };

    const handleViewDetails = (item, type) => {
        setSelectedItem(item);
        setSelectionType(type);
        setPanelOpen(true);
    };

    const toggleMigration = (id) => {
        setDiscoveryData(prev => prev.map(m =>
            m.id === id ? { ...m, enabled: !m.enabled } : m
        ));
    };

    return (
        <div className="flex h-screen bg-[#09090b] text-white font-sans selection:bg-purple-500/30">
            {/* Sidebar Navigation */}
            <div className="w-64 border-r border-gray-800 flex flex-col bg-black/40">
                <div className="p-6">
                    <div className="flex items-center gap-3 text-purple-500 mb-8">
                        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                            <GitBranch size={20} />
                        </div>
                        <span className="font-bold tracking-tight text-lg text-white">PatchPilot</span>
                    </div>

                    <div className="space-y-1">
                        <div className="text-xs font-bold text-gray-500 uppercase px-4 mb-2 tracking-wider">Pipeline</div>
                        <NavItem icon={Upload} label="Project Input" id="input" active={activeView === 'input'} onClick={setActiveView} />
                        <NavItem icon={Search} label="Overview" id="overview" active={activeView === 'overview'} onClick={setActiveView} />
                    </div>

                    <div className="mt-8 space-y-1">
                        <div className="text-xs font-bold text-gray-500 uppercase px-4 mb-2 tracking-wider">Agents</div>
                        <NavItem icon={BookOpen} label="Knowledge" id="knowledge" active={activeView === 'knowledge'} onClick={setActiveView} />
                        <NavItem icon={Map} label="Plan" id="plan" active={activeView === 'plan'} onClick={setActiveView} />
                        <NavItem icon={FileDiff} label="Changes" id="diffs" active={activeView === 'diffs'} onClick={setActiveView} />
                        <NavItem icon={CheckCircle2} label="Verify" id="verify" active={activeView === 'verify'} onClick={setActiveView} />
                        <NavItem icon={RefreshCcw} label="Reflect" id="reflect" active={activeView === 'reflect'} onClick={setActiveView} />
                        <NavItem icon={Activity} label="Trace" id="trace" active={activeView === 'trace'} onClick={setActiveView} />
                    </div>
                </div>

                <div className="mt-auto p-4 border-t border-gray-800">
                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-800 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center font-bold text-xs">
                            AI
                        </div>
                        <div>
                            <div className="text-xs font-medium text-white">Pilot Active</div>
                            <div className="text-[10px] text-gray-500">v2.4.0-beta</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Header */}
                <header className="h-14 border-b border-gray-800 flex items-center justify-between px-8 bg-black/20 backdrop-blur-sm">
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="text-gray-600">Context:</span>
                        <div className="flex items-center gap-2 text-gray-200 bg-gray-900 px-2 py-1 rounded">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            fintech-core-services
                        </div>
                        <ChevronRight size={14} />
                        <span className="text-gray-200">{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-400 hover:text-white transition-colors">
                            <Terminal size={18} />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-white transition-colors">
                            <Settings size={18} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-auto bg-grid-pattern relative">
                    {/* View Router */}
                    {activeView === 'input' && (
                        <DynamicInputView
                            onAnalyze={handleAnalysis}
                            isAnalyzing={loading.analyzing}
                            projectData={projectInfo}
                        />
                    )}
                    {activeView === 'overview' && (
                        <OverviewView
                            onNavigate={setActiveView}
                            discoveryData={discoveryData}
                            planData={planData}
                        />
                    )}
                    {activeView === 'knowledge' && <KnowledgeView onSelect={handleViewDetails} data={INITIAL_KNOWLEDGE} />}
                    {activeView === 'plan' && <PlanView onSelect={handleViewDetails} plan={planData} />}
                    {activeView === 'diffs' && <DiffView onSelect={handleViewDetails} />}
                    {activeView === 'verify' && <VerificationView verificationData={verificationData} onRequestFix={handleRequestFix} />}
                    {activeView === 'reflect' && <ReflectionView />}
                    {activeView === 'trace' && <TraceView onSelect={handleViewDetails} />}
                </main>
            </div>

            {/* Slide-over Panel */}
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