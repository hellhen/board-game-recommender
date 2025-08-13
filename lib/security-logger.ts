interface SecurityEvent {
  timestamp: string;
  type: 'rate_limit' | 'large_payload' | 'invalid_input' | 'suspicious_activity' | 'error';
  clientId: string;
  endpoint: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

class SecurityLogger {
  private events: SecurityEvent[] = [];
  private readonly maxEvents = 10000; // Keep last 10k events in memory
  private readonly alertThresholds = {
    rate_limit: 10, // Alert if same client hit rate limit 10 times
    large_payload: 5, // Alert if same client tried large payloads 5 times
    suspicious_activity: 3, // Alert on 3 suspicious activities
  };

  log(event: Omit<SecurityEvent, 'timestamp'>) {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };

    this.events.push(securityEvent);
    
    // Keep memory usage bounded
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Console log for immediate visibility
    const logLevel = this.getLogLevel(event.severity);
    console[logLevel](`🔒 SECURITY [${event.type.toUpperCase()}] ${event.endpoint}:`, {
      client: event.clientId.substring(0, 12) + '...',
      details: event.details,
      severity: event.severity,
      timestamp: securityEvent.timestamp
    });

    // Check for patterns that require alerts
    this.checkForAlerts(securityEvent);
  }

  private getLogLevel(severity: SecurityEvent['severity']): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      default:
        return 'log';
    }
  }

  private checkForAlerts(event: SecurityEvent) {
    const recentEvents = this.getRecentEventsByClient(event.clientId, event.type, 300000); // Last 5 minutes
    const threshold = this.alertThresholds[event.type as keyof typeof this.alertThresholds] || 999;

    if (recentEvents.length >= threshold) {
      this.alertSecurityTeam({
        type: 'repeated_violations',
        clientId: event.clientId,
        violationType: event.type,
        count: recentEvents.length,
        timeWindow: '5 minutes',
        severity: 'high',
        firstViolation: recentEvents[0].timestamp,
        latestViolation: event.timestamp,
        endpoints: [...new Set(recentEvents.map(e => e.endpoint))]
      });
    }
  }

  private getRecentEventsByClient(clientId: string, type: string, windowMs: number): SecurityEvent[] {
    const cutoff = Date.now() - windowMs;
    return this.events.filter(event => 
      event.clientId === clientId && 
      event.type === type && 
      new Date(event.timestamp).getTime() > cutoff
    );
  }

  private alertSecurityTeam(alert: any) {
    console.error('🚨 SECURITY ALERT 🚨', alert);
    
    // In production, this would send to your monitoring system:
    // - Send to Slack/Discord webhook
    // - Create incident in monitoring tool
    // - Send email to security team
    // - Log to external security system
    
    // Example webhook (commented out for development):
    /*
    fetch(process.env.SECURITY_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Security Alert: ${alert.type}`,
        attachments: [{
          color: 'danger',
          fields: Object.entries(alert).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          }))
        }]
      })
    }).catch(console.error);
    */
  }

  getStats(timeWindowMs = 3600000): {
    totalEvents: number;
    eventsByType: Record<string, number>;
    topClients: Array<{ clientId: string; count: number }>;
    severityBreakdown: Record<string, number>;
  } {
    const cutoff = Date.now() - timeWindowMs;
    const recentEvents = this.events.filter(event => 
      new Date(event.timestamp).getTime() > cutoff
    );

    const eventsByType: Record<string, number> = {};
    const clientCounts: Record<string, number> = {};
    const severityBreakdown: Record<string, number> = {};

    recentEvents.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
      clientCounts[event.clientId] = (clientCounts[event.clientId] || 0) + 1;
      severityBreakdown[event.severity] = (severityBreakdown[event.severity] || 0) + 1;
    });

    const topClients = Object.entries(clientCounts)
      .map(([clientId, count]) => ({ clientId: clientId.substring(0, 12) + '...', count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      topClients,
      severityBreakdown
    };
  }

  // Get events for a specific client (for debugging)
  getClientEvents(clientId: string, limit = 50): SecurityEvent[] {
    return this.events
      .filter(event => event.clientId === clientId)
      .slice(-limit)
      .reverse();
  }
}

// Singleton instance
export const securityLogger = new SecurityLogger();

// Helper functions for common security events
export const logRateLimit = (clientId: string, endpoint: string, details: Record<string, any>) => {
  securityLogger.log({
    type: 'rate_limit',
    clientId,
    endpoint,
    details,
    severity: 'medium'
  });
};

export const logLargePayload = (clientId: string, endpoint: string, size: number) => {
  securityLogger.log({
    type: 'large_payload',
    clientId,
    endpoint,
    details: { payloadSize: size, limit: '1MB' },
    severity: 'medium'
  });
};

export const logInvalidInput = (clientId: string, endpoint: string, error: string) => {
  securityLogger.log({
    type: 'invalid_input',
    clientId,
    endpoint,
    details: { error, message: 'Malformed request data' },
    severity: 'low'
  });
};

export const logSuspiciousActivity = (clientId: string, endpoint: string, reason: string, details: Record<string, any>) => {
  securityLogger.log({
    type: 'suspicious_activity',
    clientId,
    endpoint,
    details: { reason, ...details },
    severity: 'high'
  });
};

export const logError = (clientId: string, endpoint: string, error: any) => {
  securityLogger.log({
    type: 'error',
    clientId,
    endpoint,
    details: { 
      error: error.message || String(error),
      stack: error.stack || 'No stack trace available'
    },
    severity: 'medium'
  });
};
