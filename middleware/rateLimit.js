// middleware/rateLimit.js
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanup();
  }

  cleanup() {
    // Pulizia automatica ogni 5 minuti
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.requests.entries()) {
        // Rimuovi entry più vecchie di 1 ora
        data.timestamps = data.timestamps.filter(time => now - time < 60 * 60 * 1000);
        if (data.timestamps.length === 0) {
          this.requests.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  checkLimit(identifier, limits = {}) {
    const {
      maxRequests = 10,
      windowMs = 60 * 1000, // 1 minuto
      maxRequestsPerHour = 100
    } = limits;

    const now = Date.now();
    const windowStart = now - windowMs;
    const hourStart = now - (60 * 60 * 1000);

    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, { timestamps: [] });
    }

    const userData = this.requests.get(identifier);
    
    // Pulisci timestamps vecchi
    userData.timestamps = userData.timestamps.filter(time => time > hourStart);

    // Controlla limiti
    const recentRequests = userData.timestamps.filter(time => time > windowStart);
    const hourlyRequests = userData.timestamps.length;

    if (recentRequests.length >= maxRequests) {
      const resetTime = Math.ceil((userData.timestamps[0] + windowMs) / 1000);
      return {
        allowed: false,
        resetTime,
        remaining: 0,
        error: `Rate limit exceeded. Try again in ${Math.ceil((windowStart + windowMs - now) / 1000)} seconds`
      };
    }

    if (hourlyRequests >= maxRequestsPerHour) {
      return {
        allowed: false,
        resetTime: Math.ceil((userData.timestamps[0] + 60 * 60 * 1000) / 1000),
        remaining: 0,
        error: 'Hourly limit exceeded. Try again later'
      };
    }

    // Registra la richiesta
    userData.timestamps.push(now);
    
    return {
      allowed: true,
      remaining: maxRequests - recentRequests.length - 1,
      resetTime: Math.ceil((now + windowMs) / 1000)
    };
  }
}

const rateLimiter = new RateLimiter();

export function withRateLimit(limits = {}) {
  return (req, res, next) => {
    // Identificatore basato su IP e User-Agent per evitare evasioni semplici
    const identifier = req.headers['x-forwarded-for'] || 
                      req.connection.remoteAddress || 
                      req.ip || 'unknown';

    const result = rateLimiter.checkLimit(identifier, limits);

// Headers informativi
res.setHeader('X-RateLimit-Remaining', result.remaining || 0);
res.setHeader('X-RateLimit-Reset', result.resetTime || Math.ceil(Date.now() / 1000) + 60);

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: result.error,
        resetTime: result.resetTime
      });
    }

    if (next) next();
    return true;
  };
}

// Rate limits specifici per endpoint
export const RATE_LIMITS = {
  upload: { maxRequests: 5, windowMs: 60 * 1000, maxRequestsPerHour: 50 },
  transcription: { maxRequests: 3, windowMs: 60 * 1000, maxRequestsPerHour: 20 },
  generation: { maxRequests: 8, windowMs: 60 * 1000, maxRequestsPerHour: 60 },
  extraction: { maxRequests: 10, windowMs: 60 * 1000, maxRequestsPerHour: 80 }
};
