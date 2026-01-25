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
    {
        priority: "high",
        query: "auth migration",
        title: "Auth SDK Migration Guide", 
        url: "docs.auth-sdk.com/v2/migration",
        content: "Auth token format changed from Bearer to Token prefix. Legacy session cleanup method removed.", 
        score: 0.99,
        chunk: "Auth token format changed from Bearer to Token prefix...",
        status: "works"
    },
    {
        priority: "medium",
        query: "session cleanup",
        title: "Legacy session cleanup method removed",
        url: "github.com/auth-sdk/issues/402",
        content: "Legacy session cleanup method removed.",
        score: 0.88,
        chunk: "Legacy session cleanup method removed...",
        status: "works"
    },
    {
        priority: "high",
        query: "connection pool",
        title: "Connection pool config schema flattened",
        url: "db-conn v5.0.0 Release Notes",
        content: "Connection pool config schema flattened.",
        score: 0.95,
        chunk: "Connection pool config schema flattened...",
        status: "works"
    }
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
    { id: "TR-002", agent: "RetrievalAgent", target: "auth-sdk-legacy", input: "Target: v2.0.0", output: "Fetched 12 relevant docs", state: { sources: ["docs", "github"], embedding_model: "text-embedding-3-small" } },
];

// Mock dependency data for "shows what the depended files depend to what file"
const DEPENDENCY_MAP = {
    "auth-sdk-legacy": [
        { file: "src/services/api_client.ts", dependsOn: "AuthClient", type: "import" },
        { file: "src/components/LoginForm.tsx", dependsOn: "AuthSession", type: "usage" },
        { file: "src/utils/token.ts", dependsOn: "TokenTypes", type: "type" }
    ],
    "database-connector": [
        { file: "src/db/connection.ts", dependsOn: "PoolConfig", type: "interface" },
        { file: "src/models/User.ts", dependsOn: "BaseModel", type: "extends" }
    ],
    "ui-components": [
        { file: "src/App.tsx", dependsOn: "Button", type: "component" }
    ]
};

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
                disabled={!data || isGeneratingPlan}
                className={`px-6 py-2 font-medium rounded text-sm flex items-center gap-2 ${!data ? 'bg-gray-800 text-gray-600 cursor-not-allowed' :
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

const OverviewView = ({ onNavigate, discoveryData, planData, onGeneratePlan, isGeneratingPlan, runId, onUpdateData }) => {
    const [expandedRows, setExpandedRows] = useState({});
    const [chatMessage, setChatMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sendStatus, setSendStatus] = useState(null); // 'success', 'error'

    const toggleExpand = (id) => {
        setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSendInstruction = async (e) => {
        e.preventDefault();
        console.log("Sending instruction...", { runId, chatMessage });
        
        if (!chatMessage.trim()) {
            console.warn("Message empty");
            return;
        }
        if (!runId) {
            console.error("No runId available for OverviewView");
            alert("Session Error: No active analysis run found. Please re-run analysis.");
            return;
        }

        setIsSending(true);
        setSendStatus(null);
        try {
            const updatedData = await api.sendOverviewInstruction(runId, chatMessage);
            console.log("Received updated data:", updatedData);
            
            if (onUpdateData) {
                 if (Array.isArray(updatedData)) {
                    console.log("Updating discovery data with array of length:", updatedData.length);
                    onUpdateData(updatedData);
                 } else {
                    console.warn("Updated data is not an array:", updatedData);
                 }
            } else {
                console.warn("onUpdateData prop missing");
            }
            
            setSendStatus('success');
            setChatMessage("");
            setTimeout(() => setSendStatus(null), 3000);
        } catch (error) {
            console.error("Failed to send instruction:", error);
            setSendStatus('error');
            alert("Failed to send instruction: " + (error.message || "Unknown error"));
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-8 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-white">Migration Overview</h2>
                    <p className="text-sm text-gray-400 mt-1">Review discovered libraries and dependencies.</p>
                </div>
                <StatusBadge status={planData ? "Running" : "Pending"} />
            </div>

            {/* Stepper (Simplified for clarity) */}
            <div className="flex items-center w-full text-xs font-mono mb-8 opacity-70">
                 {["Discover", "Retrieve", "Plan", "Patch", "Verify"].map((step, idx) => (
                    <div key={step} className="flex items-center gap-2 mr-4">
                        <div className={`w-2 h-2 rounded-full ${idx < 1 ? 'bg-purple-500' : 'bg-gray-700'}`} />
                        <span className={idx < 1 ? 'text-purple-400' : 'text-gray-600'}>{step}</span>
                    </div>
                 ))}
            </div>

            <div className="flex-1 overflow-auto border border-gray-800 rounded-lg bg-gray-900/20 mb-6">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-900 border-b border-gray-800 text-gray-400 font-mono text-xs uppercase sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-3 font-medium">Library</th>
                            <th className="px-6 py-3 font-medium">Current Version</th>
                            <th className="px-6 py-3 font-medium">Target Version</th>
                            <th className="px-6 py-3 font-medium">Dependencies</th>
                            <th className="px-6 py-3 font-medium text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {discoveryData && discoveryData.length > 0 ? discoveryData.map(mig => (
                            <React.Fragment key={mig.id}>
                                <tr className={`hover:bg-gray-800/30 transition-colors`}>
                                    <td className="px-6 py-4 font-medium text-white">{mig.library}</td>
                                    <td className="px-6 py-4 font-mono text-gray-400">{mig.current}</td>
                                    <td className="px-6 py-4 font-mono text-purple-400">
                                        {mig.target} <span className="text-xs text-gray-600 px-1 ml-2 border border-gray-700 rounded">LATEST</span>
                                    </td>
                                    <td className="px-6 py-4">
                                         <button 
                                            onClick={() => toggleExpand(mig.id)}
                                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            <Layers size={12} />
                                            {DEPENDENCY_MAP[mig.library]?.length || 0} Files
                                            {expandedRows[mig.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <StatusBadge status={'Detected'} />
                                    </td>
                                </tr>
                                {expandedRows[mig.id] && (
                                    <tr className="bg-black/20">
                                        <td colSpan="5" className="px-6 py-4 shadow-inner">
                                            <div className="ml-10 p-4 bg-gray-900/50 rounded border border-gray-800">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                                    <FileCode size={12} /> Dependent Files Analysis
                                                </h4>
                                                <div className="space-y-2">
                                                    {DEPENDENCY_MAP[mig.library]?.map((dep, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs font-mono border-b border-gray-800 pb-2 last:border-0 last:pb-0">
                                                            <span className="text-gray-300">{dep.file}</span>
                                                            <div className="flex items-center gap-2 text-gray-500">
                                                                <span>depends on</span>
                                                                <span className="text-purple-400 bg-purple-900/10 px-1.5 rounded">{dep.dependsOn}</span>
                                                                <span className="text-[10px] uppercase border border-gray-700 px-1 rounded">{dep.type}</span>
                                                            </div>
                                                        </div>
                                                    )) || <div className="text-gray-500 italic">No direct dependencies found.</div>}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        )) : (
                            <tr>
                                <td colSpan="5" className="text-center py-12 text-gray-500 italic">No libraries detected. Please analyze a project first.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Chatbot Interface */}
            <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 mt-auto">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                         <Activity size={12} className="text-purple-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Migration Assistant</h3>
                    <span className="text-xs text-gray-500">- Guide the update process</span>
                </div>
                
                <form onSubmit={handleSendInstruction} className="flex gap-3">
                    <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Describe what you want to update (e.g., 'Upgrade auth-sdk and fix breaking changes')..."
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-purple-500 transition-colors"
                        disabled={isSending}
                    />
                    <button
                        type="submit"
                        disabled={isSending || !chatMessage.trim()}
                        className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${
                            isSending || !chatMessage.trim() 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                    >
                        {isSending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        Send
                    </button>
                </form>
                {sendStatus === 'success' && (
                     <div className="mt-2 text-xs text-green-400 flex items-center gap-1 animate-in fade-in">
                         <CheckCircle2 size={12} /> Instruction received. The agent will consider this context.
                     </div>
                )}
                {sendStatus === 'error' && (
                     <div className="mt-2 text-xs text-red-400 flex items-center gap-1 animate-in fade-in">
                         <AlertCircle size={12} /> Failed to send instruction.
                     </div>
                )}
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={onGeneratePlan}
                    disabled={isGeneratingPlan}
                    className={`px-6 py-3 font-medium rounded-lg text-sm flex items-center gap-2 transition-all shadow-lg ${
                        isGeneratingPlan ? 'bg-gray-200 text-gray-800 cursor-wait' : 'bg-white text-gray-900 hover:bg-gray-100 hover:scale-[1.02]'
                        }`}
                >
                    {isGeneratingPlan ? (
                        <><Loader2 size={16} className="animate-spin" /> Generating Plan...</>
                    ) : (
                        <><Map size={16} /> Generate Migration Plan</>
                    )}
                </button>
            </div>
        </div>
    );
};

const KnowledgeView = ({ onSelect, data }) => (
    <div className="flex flex-col h-full">
        <div className="p-6 border-b border-gray-800 bg-gray-900/20 flex justify-between items-center">
            <div>
                <h2 className="text-lg font-semibold text-white mb-1">Retrieved Knowledge Context</h2>
                <p className="text-sm text-gray-400">RAG output derived from official docs, GitHub issues, and release notes.</p>
            </div>
        </div>
        <div className="overflow-auto flex-1 p-6">
            <div className="space-y-2">
                {data.map((item, index) => (
                    <div
                        key={index}
                        onClick={() => onSelect(item, 'knowledge')}
                        className="bg-gray-900/40 border border-gray-800 hover:border-gray-600 hover:bg-gray-800/30 p-4 rounded-lg cursor-pointer transition-all group"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${item.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                                    {item.priority || 'Doc'}
                                </span>
                                <span className="text-xs font-mono text-purple-400 truncate max-w-[300px]" title={item.title}>{item.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Score: {item.score}</span>
                                <div className={`w-2 h-2 rounded-full ${item.score > 0.9 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            </div>
                        </div>
                        <p className="text-gray-200 text-sm font-medium mb-1 group-hover:text-white line-clamp-2">{item.content}</p>
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-xs text-gray-500 font-mono truncate max-w-[400px]">{item.url}</p>
                             <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.status === 'works' ? 'border-green-800 text-green-500 bg-green-900/10' : 'border-red-800 text-red-500 bg-red-900/10'}`}>
                                {item.status}
                            </span>
                        </div>
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

const DiffView = ({ onSelect, changesData }) => {
    // Flatten all files from the dependency map to create the selectable list
    const inputFiles = changesData?.Initial_code ? Object.keys(changesData.Initial_code).sort() : [];
    
    // Fallback if no real data
    const allFiles = inputFiles.length > 0 ? inputFiles : React.useMemo(() => {
        const files = [];
        Object.values(DEPENDENCY_MAP).forEach(list => {
            list.forEach(item => {
               if (!files.includes(item.file)) files.push(item.file);
            });
        });
        return files.sort();
    }, []);

    const [selectedFile, setSelectedFile] = useState(allFiles[0] || "src/services/api_client.ts");

    // Derived state for diff content - in a real app this would come from an API
    const isMockedFile = !changesData && selectedFile === "src/services/api_client.ts";
    const oldLines = changesData?.Initial_code?.[selectedFile] 
        ? changesData.Initial_code[selectedFile].split('\n') 
        : (isMockedFile ? INITIAL_DIFF_OLD.split('\n') : ["// Original content not available for preview"]);
        
    const newLines = changesData?.Generated_code?.[selectedFile]
        ? changesData.Generated_code[selectedFile].split('\n')
        : (isMockedFile ? INITIAL_DIFF_NEW.split('\n') : ["// Modified content not available or unchanged"]);

    return (
        <div className="flex h-full bg-[#0d1117]">
             {/* Text-Based File Selector / List Sidebar */}
            <div className="w-64 border-r border-gray-800 bg-gray-950/50 flex flex-col">
                <div className="p-4 border-b border-gray-800">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Modified Files ({allFiles.length})</h3>
                </div>
                <div className="flex-1 overflow-auto py-2">
                    {allFiles.map(file => (
                        <button
                            key={file}
                            onClick={() => setSelectedFile(file)}
                            className={`w-full text-left px-4 py-2 text-xs font-mono transition-colors truncate ${
                                selectedFile === file 
                                ? "bg-purple-500/10 text-purple-300 border-r-2 border-purple-500" 
                                : "text-gray-400 hover:text-gray-200 hover:bg-gray-900"
                            }`}
                            title={file}
                        >
                            {file}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Diff Area */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/50">
                    <div className="flex items-center gap-2">
                        <FileCode size={16} className="text-gray-400" />
                        <span className="text-sm font-mono text-gray-300">{selectedFile}</span>
                    </div>
                    {isMockedFile && (
                        <div className="flex gap-2 text-xs">
                            <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded">- 1 line</span>
                            <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded">+ 1 line</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto flex font-mono text-xs leading-6">
                    <div className="w-1/2 border-r border-gray-800 select-none bg-[#0d1117]">
                        {oldLines.map((line, i) => (
                            <div key={i} className="flex hover:bg-gray-800/30 group">
                                <span className="w-10 text-right pr-3 text-gray-600 select-none opacity-50">{i + 1}</span>
                                <pre className={`flex-1 pl-2 pr-2 whitespace-pre-wrap ${isMockedFile && (line.includes('Bearer') || line.includes('destroy')) ? 'bg-red-900/20' : ''}`}>
                                    <span className={isMockedFile && (line.includes('Bearer') || line.includes('destroy')) ? 'bg-red-900/40 text-gray-300' : 'text-gray-500'}>{line}</span>
                                </pre>
                            </div>
                        ))}
                    </div>
                    <div className="w-1/2 bg-[#0d1117]">
                        {newLines.map((line, i) => (
                            <div
                                key={i}
                                onClick={() => isMockedFile && onSelect({ type: 'diff', line: i + 1, content: line })}
                                className={`flex hover:bg-gray-800/30 group ${isMockedFile ? 'cursor-pointer' : ''}`}
                            >
                                <span className="w-10 text-right pr-3 text-gray-600 select-none border-r border-gray-800/50 group-hover:border-gray-700 opacity-50">{i + 1}</span>
                                <pre className={`flex-1 pl-2 pr-2 whitespace-pre-wrap ${isMockedFile && (line.includes('Token') || line.includes('invalidate')) ? 'bg-green-900/20' : ''}`}>
                                    <span className={isMockedFile && (line.includes('Token') || line.includes('invalidate')) ? 'bg-green-900/40 text-green-100' : 'text-gray-300'}>
                                        {line}
                                        {isMockedFile && (line.includes('Token') || line.includes('invalidate')) && (
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

const ReflectionView = ({ data }) => {
    return (
        <div className="max-w-6xl mx-auto p-8 h-full flex flex-col">
            <div className="flex items-center justify-between mb-8">
                <div>
                     <h2 className="text-2xl font-bold text-white">Docker Verification Reflection</h2>
                     <p className="text-sm text-gray-400 mt-1">Review build and runtime errors captured during verification.</p>
                </div>
                 <StatusBadge status={data && Object.keys(data).length > 0 ? "Issues Found" : "Clean"} />
            </div>

            <div className="flex-1 overflow-auto space-y-4">
                {data && Object.keys(data).length > 0 ? (
                    Object.entries(data).map(([file, error], idx) => (
                        <div key={idx} className="bg-gray-900/40 border border-red-900/30 rounded-lg overflow-hidden">
                             <div className="bg-red-900/10 px-4 py-3 border-b border-red-900/20 flex items-center gap-2">
                                <AlertCircle size={16} className="text-red-400" />
                                <span className="font-mono text-sm text-red-200">{file}</span>
                             </div>
                             <div className="p-4 bg-black/40">
                                 <pre className="text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre-wrap">
                                    {typeof error === 'string' ? error : JSON.stringify(error, null, 2)}
                                 </pre>
                             </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 border border-gray-800 border-dashed rounded-lg bg-gray-900/20 text-gray-500">
                        <CheckCircle2 size={48} className="mb-4 text-green-500/20" />
                        <p>No verification errors reported.</p>
                        <p className="text-xs opacity-60 mt-2">Any Docker build or runtime failures will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const TraceView = ({ onSelect, traceData }) => (
    <div className="max-w-3xl mx-auto p-8 h-full">
        <SectionHeader title="LangGraph Trace" subtitle="Agent orchestration and state transitions." />

        <div className="relative">
            <div className="absolute left-[19px] top-4 bottom-0 w-0.5 bg-gray-800" />

            <div className="space-y-8">
                {traceData && traceData.length > 0 ? traceData.map((node, i) => (
                    <div key={i} className="relative pl-14 cursor-pointer group" onClick={() => onSelect(node, 'trace')}>
                         <div className={`absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-gray-950 flex items-center justify-center z-10 transition-colors ${i === traceData.length - 1 ? 'bg-purple-500 text-white animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-gray-800 text-gray-400 group-hover:bg-gray-700'
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
                )) : (
                    <div className="pl-14 text-gray-500 italic">No trace recording available. Run analysis to generate trace.</div>
                )}
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
                            <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                            <div className="flex flex-col gap-2 mb-4">
                                <div className="flex items-center gap-2">
                                     <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs rounded uppercase font-bold">{item.priority}</span>
                                     <span className="text-xs text-gray-500 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">Score: {item.score}</span>
                                </div>
                                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 truncate font-mono block">
                                    {item.url}
                                </a>
                            </div>
                            
                            <div className="bg-gray-900/50 p-4 rounded border border-gray-800 mb-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Content</h4>
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                            </div>

                             <div className="bg-gray-900/50 p-4 rounded border border-gray-800">
                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Retrieved Chunk</h4>
                                <p className="text-gray-400 text-xs font-mono leading-relaxed">{item.chunk}</p>
                            </div>
                        </div>
                         <div className="border-t border-gray-800 pt-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">MetaData</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="text-gray-600">Query:</span> <span className="text-gray-300">{item.query}</span></div>
                                <div><span className="text-gray-600">Status:</span> <span className={`${item.status === 'works' ? 'text-green-400' : 'text-red-400'}`}>{item.status}</span></div>
                            </div>
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

// --- Login View ---

const LoginView = ({ onLogin }) => {
    const [isRegistering, setIsRegistering] = useState(false);
    const [email, setEmail] = useState("demo@patchpilot.ai");
    const [password, setPassword] = useState("password");
    // Registration only fields
    const [username, setUsername] = useState("");
    const [companyName, setCompanyName] = useState("");
    
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccessMsg(null);
        setIsLoading(true);

        try {
            if (isRegistering) {
                await api.register(username, email, password, companyName);
                setSuccessMsg("Registration successful! Please sign in.");
                setIsRegistering(false);
            } else {
                const data = await api.login(email, password);
                if (data.access_token) localStorage.setItem('access_token', data.access_token);
                onLogin(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#09090b] flex items-center justify-center relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-purple-900/10 rounded-full blur-[120px]" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[70vw] h-[70vw] bg-blue-900/10 rounded-full blur-[120px]" />
            </div>

            <div className="w-full max-w-md p-8 z-10">
                <div className="bg-black/40 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl relative">
                    <div className="absolute inset-0 rounded-2xl border border-white/5 pointer-events-none" />
                    
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-16 h-16 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 rounded-2xl border border-purple-500/30 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                            <GitBranch size={32} className="text-purple-400" />
                        </div>
                        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">PatchPilot</h1>
                        <p className="text-gray-500 text-sm">Autonomous Agentic Coding Assistant</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-900/20 border border-red-500/30 text-red-200 text-xs p-3 rounded flex items-center gap-2">
                                <AlertCircle size={14} className="text-red-500" />
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="bg-green-900/20 border border-green-500/30 text-green-200 text-xs p-3 rounded flex items-center gap-2">
                                <CheckCircle2 size={14} className="text-green-500" />
                                {successMsg}
                            </div>
                        )}

                        {isRegistering && (
                            <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-300">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <span className="text-gray-600 group-focus-within:text-purple-500 transition-colors">#</span>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-gray-900/50 border border-gray-800 rounded-lg py-3 pl-10 pr-4 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-gray-900 focus:ring-1 focus:ring-purple-500/20 transition-all text-sm font-mono"
                                        placeholder="jdoe"
                                        required={isRegistering}
                                    />
                                </div>
                            </div>
                        )}
                        
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Work Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-600 group-focus-within:text-purple-500 transition-colors">@</span>
                                </div>
                                <input 
                                    type="email" 
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-800 rounded-lg py-3 pl-10 pr-4 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-gray-900 focus:ring-1 focus:ring-purple-500/20 transition-all text-sm font-mono"
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Code size={16} className="text-gray-600 group-focus-within:text-purple-500 transition-colors" />
                                </div>
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-800 rounded-lg py-3 pl-10 pr-4 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-gray-900 focus:ring-1 focus:ring-purple-500/20 transition-all text-sm font-mono"
                                    required
                                />
                            </div>
                        </div>

                        {isRegistering && (
                             <div className="space-y-1.5 animate-in slide-in-from-top-2 fade-in duration-300">
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1">Company (Optional)</label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Layers size={16} className="text-gray-600 group-focus-within:text-purple-500 transition-colors" />
                                    </div>
                                    <input 
                                        type="text" 
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        className="w-full bg-gray-900/50 border border-gray-800 rounded-lg py-3 pl-10 pr-4 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-gray-900 focus:ring-1 focus:ring-purple-500/20 transition-all text-sm font-mono"
                                        placeholder="Student"
                                    />
                                </div>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className={`w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-medium py-3 rounded-lg shadow-lg shadow-purple-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4 ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>{isRegistering ? 'Creating Account...' : 'Authenticating...'}</span>
                                </>
                            ) : (
                                <>
                                    <span>{isRegistering ? 'Create Account' : 'Initialize Pilot'}</span>
                                    <ChevronRight size={16} />
                                </>
                            )}
                        </button>

                        <div className="text-center pt-2">
                             <button
                                type="button"
                                onClick={() => {
                                    setIsRegistering(!isRegistering);
                                    setError(null);
                                    setSuccessMsg(null);
                                }}
                                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                             >
                                {isRegistering ? "Already have an account? Sign In" : "Need an account? Sign Up"}
                             </button>
                        </div>
                    </form>

                    <div className="mt-6 pt-6 border-t border-gray-800/50 text-center">
                        <p className="text-xs text-gray-600">
                            By accessing this system, you agree to the <a href="#" className="text-gray-500 hover:text-gray-400 underline decoration-gray-700">Internal Protocol</a>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main App Shell ---

// --- Main App Shell ---

const App = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [activeView, setActiveView] = useState('input');
    const [panelOpen, setPanelOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectionType, setSelectionType] = useState(null);
    const [currentRunId, setCurrentRunId] = useState(() => sessionStorage.getItem('patch_pilot_run_id'));

    useEffect(() => {
        if (currentRunId) {
            sessionStorage.setItem('patch_pilot_run_id', currentRunId);
        }
    }, [currentRunId]);

    // --- Backend State ---
    const [projectInfo, setProjectInfo] = useState(null);
    const [discoveryData, setDiscoveryData] = useState([]);
    const [planData, setPlanData] = useState(null);
    const [knowledgeData, setKnowledgeData] = useState(null);
    const [changesData, setChangesData] = useState(null);

    const [verificationData, setVerificationData] = useState(null);
    const [reflectData, setReflectData] = useState(null);
    const [traceData, setTraceData] = useState(null); // New state for trace
    const [loading, setLoading] = useState({
        analyzing: false,
        generatingPlan: false,
    });

    const handleAnalysis = async (data) => {
        setLoading(prev => ({ ...prev, analyzing: true }));
        try {
            let runId = data.run_id;

            // Map backend config field naming to API parameters
            const url = data.github_url || data.url; 
            const depth = data.analysis_depth || data.depth || "Quick Scan";

            if (url) {
                console.log("Starting analysis for:", url);
                const res = await api.analyzeGithub(url, depth);
                console.log("Analysis Result:", res);
                runId = res.run_id;
            } else if (!runId) {
                // If no URL provided and no existing runId, we cannot proceed.
                console.warn("Analysis skipped: No URL or Run ID provided.");
                setLoading(prev => ({ ...prev, analyzing: false }));
                alert("Please provide a valid GitHub URL to start analysis.");
                return;
            }
            
            if (runId) setCurrentRunId(runId);
            
            // Trigger status check to validate permissions (e.g. Deep Research requires login)
            if (runId) {
                await api.getAnalysisStatus(runId);
            }

            // Real Analysis Flow:
            // 1. analyzeGithub has already returned (meaning cloning is done or queued).
            // 2. We now trigger discovery (ingestion) via get_overview.
            setLoading(prev => ({ ...prev, analyzing: false }));
            
            // Trigger discovery fetch with REAL runId and wait for it
            await fetchDiscovery(runId);
            setActiveView('overview');

        } catch (error) {
            console.error("Analysis failed:", error);
            const msg = error.message || "Unknown error";
            if (error.status === 401) {
                // Redirect to login
                setIsLoggedIn(false);
            } else {
                alert("Analysis failed: " + msg);
            }
            setLoading(prev => ({ ...prev, analyzing: false }));
        }
    };

    const fetchDiscovery = async (runId) => {
        if (!runId) return;
        try {
            const data = await api.getDiscovery(runId);
            setDiscoveryData(data);
            // Optional: update project info based on real data count?
            if (data) {
                 setProjectInfo(prev => ({...prev, dependencies: data.length, status: "Analysis Complete"}));
            }
        } catch (e) {
            console.error("Discovery fetch failed:", e); 
            // alert("Failed to fetch project overview."); 
        }
    };

    const handleGeneratePlan = async () => {
        setLoading(prev => ({ ...prev, generatingPlan: true }));
        const selected = discoveryData.filter(m => m.enabled);
        try {
            // Trigger generation on backend
            await api.generatePlan(currentRunId, selected);
            // Fetch the generated plan
            const plan = await api.getPlan(currentRunId);
             
            // Adapt the tuple [rules, risks] to the UI format if needed
            if (Array.isArray(plan) && typeof plan[0] === 'string') {
                 setPlanData([{
                     id: 'PLAN', target: 'General', step: 'Migration Rules', status: 'complete',
                     details: plan[0], rules: []
                 }, {
                     id: 'RISKS', target: 'General', step: 'Risks', status: 'pending',
                     details: plan[1], rules: []
                 }]);
            } else {
                setPlanData(plan);
            }
        } catch(e) {
            console.error("Plan generation failed", e);
            alert("Plan generation failed: " + e.message);
        }
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

    // --- Data Fetching Effect ---
    useEffect(() => {
        if (!currentRunId) return;

        const fetchData = async () => {
            try {
                if (activeView === 'knowledge' && !knowledgeData) {
                    const data = await api.getKnowledge(currentRunId);
                    setKnowledgeData(data);
                } else if (activeView === 'plan' && !planData) {
                    // Try to fetch plan if not already set by generatePlan
                    try {
                        const data = await api.getPlan(currentRunId);
                        // api.getPlan returns [migration_rules_str, risks_str]
                         // If we want to display it in PlanView, we might need to adapt PlanView or parse it.
                         // For now, let's assume we store it. PlanView logic below will need adjustment.
                         // But if planData is null, we can try to use this.
                         if (Array.isArray(data) && typeof data[0] === 'string') {
                             // It's the string tuple. Create a dummy step to show the text.
                             setPlanData([{
                                 id: 'PLAN', target: 'General', step: 'Migration Rules', status: 'complete',
                                 details: data[0], rules: []
                             }, {
                                 id: 'RISKS', target: 'General', step: 'Risks', status: 'pending',
                                 details: data[1], rules: []
                             }]);
                         }
                    } catch (e) { console.log('Plan not ready yet'); }
                } else if (activeView === 'diffs' && !changesData) {
                    const data = await api.getChanges(currentRunId);
                    setChangesData(data);
                } else if (activeView === 'trace') {
                     try {
                        const kData = await api.getKnowledge(currentRunId);
                        const pData = await api.getPlan(currentRunId);
                        const vData = await api.getVerify(currentRunId);
                        
                        const trace = [
                            { agent: 'Input Agent', target: 'Project', input: 'GitHub URL', output: 'Source Code Ingested', status: 'completed' },
                            { agent: 'Knowledge Agent', target: 'RAG', input: 'Dependencies', output: `${kData ? kData.length : 0} documents retrieved`, status: kData ? 'completed' : 'pending' },
                            { agent: 'Plan Agent', target: 'Migration', input: 'Docs + Rules', output: pData ? 'Migration Plan Generated' : 'Pending', status: pData ? 'completed' : 'pending' },
                            { agent: 'Verify Agent', target: 'Validation', input: 'Plan', output: vData ? `${vData.length} checks run` : 'Pending', status: vData ? 'completed' : 'pending' }
                        ];
                        setTraceData(trace);
                     } catch(e) { console.error("Trace fetch failed", e); }
                } else if (activeView === 'verify' && verificationData === INITIAL_VERIFICATION) {
                     try {
                        const data = await api.getVerify(currentRunId);
                        if (data && data.length > 0) setVerificationData(data);
                     } catch(e) { console.error("Verify fetch failed", e); }
                } else if (activeView === 'reflect' && !reflectData) {
                    const data = await api.getReflectData(currentRunId);
                    setReflectData(data);
                }
            } catch (err) {
                console.error(`Failed to fetch data for ${activeView}`, err);
            }
        };

        fetchData();
    }, [activeView, currentRunId]);

    if (!isLoggedIn) {
        return <LoginView onLogin={() => setIsLoggedIn(true)} />;
    }

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
                            // toggleMigration={toggleMigration} // No longer needed
                            onGeneratePlan={handleGeneratePlan}
                            isGeneratingPlan={loading.generatingPlan}
                            runId={currentRunId}
                            onUpdateData={setDiscoveryData}
                        />
                    )}
                    {activeView === 'knowledge' && <KnowledgeView onSelect={handleViewDetails} data={knowledgeData || []} />}
                    {activeView === 'plan' && <PlanView onSelect={handleViewDetails} plan={planData} />}
                    {activeView === 'diffs' && <DiffView onSelect={handleViewDetails} changesData={changesData} />}
                    {activeView === 'verify' && <VerificationView verificationData={verificationData || []} onRequestFix={handleRequestFix} />}
    {activeView === 'reflect' && <ReflectionView data={reflectData} />}
    {activeView === 'trace' && <TraceView onSelect={handleViewDetails} traceData={traceData} />}
                </main>

            <ContextPanel
                isOpen={panelOpen}
                item={selectedItem}
                type={selectionType}
                onClose={() => setPanelOpen(false)}
            />
        </div>
    </div>
    );
};

export default App;