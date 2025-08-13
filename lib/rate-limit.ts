interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
}

class AdvancedRateLimit {
  private limits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly blockDuration: number;

  constructor(windowMs = 60000, maxRequests = 5, blockDuration = 300000) {
    this.windowMs = windowMs; // 1 minute window
    this.maxRequests = maxRequests; // 5 requests per window
    this.blockDuration = blockDuration; // 5 minute block for abuse
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.limits.get(identifier);

    if (!entry) {
      // First request
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
        firstRequest: now
      });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime: now + this.windowMs };
    }

    // Check if we're in a block period
    if (entry.count > this.maxRequests * 2 && now < entry.resetTime) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    // Reset if window has passed
    if (now >= entry.resetTime) {
      this.limits.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
        firstRequest: now
      });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime: now + this.windowMs };
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      // Extend block time for repeated violations
      entry.resetTime = now + this.blockDuration;
      entry.count++;
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    // Allow request
    entry.count++;
    return { 
      allowed: true, 
      remaining: this.maxRequests - entry.count, 
      resetTime: entry.resetTime 
    };
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }

  getStats(): { totalEntries: number; activeBlocks: number } {
    const now = Date.now();
    let activeBlocks = 0;
    
    for (const entry of this.limits.values()) {
      if (entry.count > this.maxRequests && now < entry.resetTime) {
        activeBlocks++;
      }
    }

    return {
      totalEntries: this.limits.size,
      activeBlocks
    };
  }
}

// Create rate limiter instances
export const recommendationRateLimit = new AdvancedRateLimit(60000, 6, 300000); // 6 requests per minute, 5 min block
export const shareRateLimit = new AdvancedRateLimit(300000, 10, 900000); // 10 shares per 5 minutes, 15 min block

export function getClientIdentifier(req: Request): string {
  // Try multiple headers to identify the client
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  const userAgent = req.headers.get('user-agent') || '';
  
  // Use the first available IP
  const ip = forwardedFor?.split(',')[0].trim() || realIP || cfConnectingIP || 'unknown';
  
  // Create a more robust identifier combining IP and a hash of user agent
  const agentHash = userAgent.length > 0 ? 
    userAgent.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0).toString(36) : 
    'no-agent';
    
  return `${ip}-${agentHash}`;
}
