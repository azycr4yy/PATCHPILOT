const API_BASE_URL = 'http://localhost:8000';

export const api = {
    /**
     * Fetches the dynamic input configuration from the backend.
     */
    getInputConfig: async () => {
        const response = await fetch(`${API_BASE_URL}/config/inputs`);
        if (!response.ok) {
            throw new Error('Failed to fetch input configuration');
        }
        return response.json();
    },

    /**
     * Uploads a file for analysis.
     * @param {File} file 
     */
    uploadFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'File upload failed');
        }
        return response.json();
    },

    /**
     * Triggers analysis for a GitHub URL.
     * @param {string} url 
     * @param {string} depth 
     */
    analyzeGithub: async (url, depth) => {
        const formData = new FormData();
        formData.append('url', url);
        formData.append('depth', depth);

        const response = await fetch(`${API_BASE_URL}/analyze/github`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error('GitHub analysis request failed');
        }
        return response.json();
    },

    // Keep existing mock methods for parts not yet refactored on backend to ensure app doesn't crash completely
    // In a full refactor, these would also be replaced.
    getDiscovery: async () => {
        await new Promise(r => setTimeout(r, 1500));
        return [
            { id: "MIG-001", library: "auth-sdk-legacy", current: "v1.2.4", target: "v2.0.0", confidence: 0.98, enabled: true },
            { id: "MIG-002", library: "database-connector", current: "v4.1.0", target: "v5.0.0", confidence: 0.85, enabled: true },
            { id: "MIG-003", library: "ui-components", current: "v3.2.1", target: "v4.0.0", confidence: 0.62, enabled: false },
        ];
    },
    generatePlan: async (selectedMigrations) => {
        await new Promise(r => setTimeout(r, 2000));
        return [
            { id: 1, target: "auth-sdk-legacy", step: "Token Header Update", status: "complete", details: "Scan and replace Authorization header construction.", rules: ["RULE-AUTH-01"] },
            { id: 2, target: "auth-sdk-legacy", step: "Session Handling", status: "in-progress", details: "Refactor session.destroy() to session.invalidate().", rules: ["RULE-AUTH-02"] },
            { id: 3, target: "database-connector", step: "Config Schema Flattening", status: "pending", details: "Update DB connection dictionaries.", rules: ["RULE-DB-05"] },
        ];
    },
    requestFix: async (verificationId) => {
        await new Promise(r => setTimeout(r, 1000));
        return { status: "resolved", outcome: "AI Fix Applied" };
    }
};
