(async function() {
    // Configuration: Tier definitions (externally configurable)
    const defaultTierConfig = {
        T1: new Set(["US", "GB", "CA", "AU", "DE", "CH", "NO"]),
        T2: new Set(["SG", "JP", "AE", "FR", "NL", "IE", "ES"]),
        T3: new Set(["ID", "TH", "PH", "VN", "MY", "BR", "MX"])
    };

    // Convert plain objects to Sets if needed
    const tierConfig = window.ROUTER_TIER_CONFIG || defaultTierConfig;
    const TIER_CONFIG = Object.fromEntries(
        Object.entries(tierConfig).map(([key, countries]) => [
            key,
            countries instanceof Set ? countries : new Set(countries)
        ])
    );

    const BOT_SIGNATURES = new Set([
        "swiftshader", "llvmpipe", "virtualbox", 
        "vmware", "mesa offscreen", "microsoft basic render"
    ]);

    // Required: Define links object (assumed external)
    // Example: window.ROUTER_LINKS = { bots, tier1, tier2, tier3, other };
    const links = window.ROUTER_LINKS || {};

    /**
     * Detects headless/VPS environments and automation
     * @returns {boolean} True if bot/headless detected
     */
    function isBot() {
        // Fast automation flags (no DOM access needed)
        if (navigator.webdriver) return true;
        if (!navigator.languages?.length) return true;

        // WebGL detection (can fail gracefully)
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            if (!gl) return true; // No GPU

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) return false; // Safe fallback

            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)?.toLowerCase() || '';
            return Array.from(BOT_SIGNATURES).some(sig => renderer.includes(sig));
        } catch {
            return false; // Silently fail (error ≠ bot)
        }
    }

    /**
     * Parses Cloudflare trace endpoint
     * @returns {Promise<string|null>} Country code or null on failure
     */
    async function getCountry() {
        try {
            const response = await fetch('/cdn-cgi/trace', { 
                signal: AbortSignal.timeout(3000) // 3s timeout
            });
            
            if (!response.ok) return null;

            const text = await response.text();
            const lines = text.split('\n').filter(Boolean);
            
            for (const line of lines) {
                const [key, value] = line.split('=');
                if (key === 'loc') return value;
            }
        } catch {
            // Network error, timeout, or parse error
        }
        return null;
    }

    /**
     * Routes user based on bot detection and geolocation
     */
    async function route() {
        // Bot check first (synchronous, fast fail)
        if (isBot()) {
            window.location.replace(links.bots);
            return;
        }

        // Geolocation (async, with fallback)
        const country = await getCountry();
        
        if (!country) {
            // Fallback: no geolocation data
            window.location.replace(links.other);
            return;
        }

        // Tier lookup
        for (const [tier, countries] of Object.entries(TIER_CONFIG)) {
            if (countries.has(country)) {
                const linkKey = tier.toLowerCase(); // "T1" → "tier1"
                window.location.replace(links[linkKey]);
                return;
            }
        }

        // Default: unmapped country
        window.location.replace(links.other);
    }

    // Execute
    route();

})();