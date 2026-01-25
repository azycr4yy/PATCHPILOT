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
            const error = await response.json().catch(() => ({}));
            const e = new Error(error.detail || 'GitHub analysis request failed');
            e.status = response.status;
            throw e;
        }
        return response.json();
    },

    getAnalysisStatus: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/analyze?run_id=${runId}`, {
             headers: api.getAuthHeaders()
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const e = new Error(error.detail || 'Analysis status check failed');
            e.status = response.status;
            throw e;
        }
        return response.json();
    },

    sendOverviewInstruction: async (runId, instruction) => {
        const formData = new FormData();
        formData.append('instruction', instruction);
        
        const response = await fetch(`${API_BASE_URL}/run/${runId}/overview`, {
             method: 'POST',
             headers: api.getAuthHeaders(), // Assuming we want auth
             body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to send instruction');
        }
        return response.json();
    },

    getReflectData: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/run/${runId}/reflect`, {
             headers: api.getAuthHeaders()
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to fetch reflection data');
        }
        return response.json();
    },

    getDiscovery: async (runId) => {
        const formData = new FormData();
        // The endpoint accepts an optional 'instruction' form field.
        // For initial discovery, we send empty or just rely on defaults.
        const response = await fetch(`${API_BASE_URL}/run/${runId}/overview`, {
             method: 'POST',
             headers: api.getAuthHeaders(),
             body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Failed to fetch discovery data');
        }
        return response.json();
    },
    generatePlan: async (runId, selectedMigrations) => {
        // The backend currently generates a plan for the whole state.
        // We pass runId. selectedMigrations might need to be sent if we want to filter, 
        // but for now we follow the backend signature: POST /{runId}/generate_migration_plan
        const response = await fetch(`${API_BASE_URL}/run/${runId}/generate_migration_plan`, {
            method: 'POST',
             headers: api.getAuthHeaders()
        });

        if (!response.ok) {
             const error = await response.json().catch(() => ({}));
             throw new Error(error.detail || 'Plan generation failed');
        }
        // The backend returns graph state/result. 
        // We might want to return it, or fetch the formatted plan via getPlan after this.
        return response.json();
    },

    requestFix: async (verificationId) => {
        // Backend does not yet have a granular "fix this specific ID" endpoint exposed in app.py
        // We will mock a success for UI responsiveness or log it.
        console.warn("Granular fix request not yet implemented on backend.");
        await new Promise(r => setTimeout(r, 500));
        return { status: "resolved", outcome: "fix_queued" };
    },

    /**
     * Authenticates the user.
     * @param {string} email
     * @param {string} password
     */
    login: async (email, password) => {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_BASE_URL}/token`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const e = new Error(error.detail || 'Login failed');
            e.status = response.status;
            throw e;
        }
        return response.json(); // Returns { access_token, token_type }
    },

    /**
     * Registers a new user.
     * @param {string} username
     * @param {string} email
     * @param {string} password
     * @param {string} companyName
     */
    register: async (username, email, password, companyName) => {
        // Using query parameters as defined in the backend
        const params = new URLSearchParams({
            Username: username,
            Email: email,
            Password: password,
            Company_Name: companyName || "Student"
        });

        const response = await fetch(`${API_BASE_URL}/register?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
            }
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || 'Registration failed');
        }
        return response.json();
    },

    // --- Agent Data Fetching ---

    getAuthHeaders: () => {
        const token = localStorage.getItem('access_token');
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    },

    getKnowledge: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/run/${runId}/knowledge`, {
            headers: api.getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch knowledge');
        return response.json();
    },

    getPlan: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/run/${runId}/plan`, {
            headers: api.getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch plan');
        return response.json();
    },

    getChanges: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/run/${runId}/changes`, {
            headers: api.getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch changes');
        return response.json();
    },

    getVerify: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/run/${runId}/verify`, {
            headers: api.getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch verify data');
        return response.json();
    },

    getReflect: async (runId) => {
        const response = await fetch(`${API_BASE_URL}/run/${runId}/reflect`, {
            headers: api.getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch reflection data');
        return response.json();
    },

    getTrace: async (runId, action) => {
        const params = new URLSearchParams({ action });
        const response = await fetch(`${API_BASE_URL}/run/${runId}/trace?${params.toString()}`, {
            headers: api.getAuthHeaders()
        });
        if (!response.ok) throw new Error('Failed to fetch trace data');
        return response.json();
    }
};
