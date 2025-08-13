import { describe, test, expect } from '@jest/globals';

const API_BASE = process.env.API_BASE || 'http://localhost:3002';

describe('Security Tests', () => {
  describe('Rate Limiting', () => {
    test('should block excessive recommendation requests', async () => {
      const requests = [];
      
      // Send 8 requests rapidly (exceeds 6 per minute limit)
      for (let i = 0; i < 8; i++) {
        requests.push(
          fetch(`${API_BASE}/api/recommend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: `Test request ${i}` })
          })
        );
      }
      
      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);
      
      // Should have at least one 429 rate limit response
      expect(statusCodes.filter(code => code === 429).length).toBeGreaterThan(0);
    }, 15000);

    test('should block excessive share creation requests', async () => {
      const shareData = {
        prompt: 'Test share',
        recommendations: [{ name: 'Test Game' }],
        title: 'Test Share'
      };
      
      const requests = [];
      
      // Send 12 share requests rapidly (exceeds 10 per 5 minutes)
      for (let i = 0; i < 12; i++) {
        requests.push(
          fetch(`${API_BASE}/api/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...shareData, prompt: `Test share ${i}` })
          })
        );
      }
      
      const responses = await Promise.all(requests);
      const statusCodes = responses.map(r => r.status);
      
      // Should have at least one 429 rate limit response
      expect(statusCodes.filter(code => code === 429).length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('Payload Size Limits', () => {
    test('should reject oversized share payloads', async () => {
      // Create a large payload (over 1MB)
      const largeRecommendations = Array(1000).fill(0).map((_, i) => ({
        name: `Test Game ${i}`,
        description: 'A'.repeat(1000), // 1KB each
        image: 'B'.repeat(1000) // Another 1KB
      }));

      const response = await fetch(`${API_BASE}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Large test',
          recommendations: largeRecommendations,
          title: 'Large Share Test'
        })
      });

      expect(response.status).toBe(413); // Payload Too Large
    }, 10000);

    test('should reject too many recommendations', async () => {
      const manyRecommendations = Array(15).fill(0).map((_, i) => ({
        name: `Game ${i}`,
        description: 'Test game'
      }));

      const response = await fetch(`${API_BASE}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Many games test',
          recommendations: manyRecommendations,
          title: 'Too Many Games'
        })
      });

      expect(response.status).toBe(400); // Bad Request
      const result = await response.json();
      expect(result.error).toContain('Too many recommendations');
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid share data', async () => {
      const invalidData = {
        // Missing required fields
        title: 'Test'
      };

      const response = await fetch(`${API_BASE}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData)
      });

      expect(response.status).toBe(400);
    });

    test('should reject malformed recommendation requests', async () => {
      const response = await fetch(`${API_BASE}/api/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // Missing prompt
      });

      expect(response.status).toBe(400);
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await fetch(`${API_BASE}/`);
      
      expect(response.headers.get('x-frame-options')).toBe('DENY');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('x-xss-protection')).toBe('1; mode=block');
    });

    test('should have proper CORS headers for API routes', async () => {
      const response = await fetch(`${API_BASE}/api/health`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'http://localhost:3002'
        }
      });

      expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3002');
      expect(response.headers.get('access-control-allow-methods')).toContain('GET');
    });
  });

  describe('Share Security', () => {
    test('should not accept shares without proper validation', async () => {
      const maliciousShare = {
        prompt: '<script>alert("xss")</script>',
        recommendations: [{ 
          name: '<img src=x onerror=alert(1)>',
          description: 'javascript:alert(document.cookie)'
        }],
        title: '"><script>alert("title xss")</script>'
      };

      const response = await fetch(`${API_BASE}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maliciousShare)
      });

      // Should either accept and sanitize, or reject entirely
      if (response.ok) {
        const result = await response.json();
        // Check that XSS attempts are neutralized
        expect(result.shareId).toBeDefined();
        
        // Verify the shared content doesn't contain executable scripts
        const shareResponse = await fetch(`${API_BASE}/api/share/${result.shareId}`);
        const shareData = await shareResponse.json();
        
        // Script tags should not be present in the raw data
        expect(JSON.stringify(shareData)).not.toContain('<script>');
        expect(JSON.stringify(shareData)).not.toContain('javascript:');
      }
    });

    test('should handle expired shares correctly', async () => {
      // This would require manually creating an expired share file
      // or mocking the date, but for now we'll test the endpoint exists
      const response = await fetch(`${API_BASE}/api/share/invalid-id`);
      expect(response.status).toBe(404);
    });
  });
});

describe('Performance Tests', () => {
  test('should handle concurrent requests gracefully', async () => {
    const startTime = Date.now();
    
    const requests = Array(20).fill(0).map((_, i) => 
      fetch(`${API_BASE}/api/health`)
    );
    
    const responses = await Promise.all(requests);
    const endTime = Date.now();
    
    // All requests should succeed (or be rate limited, not crash)
    responses.forEach(response => {
      expect([200, 429].includes(response.status)).toBe(true);
    });
    
    // Should complete within reasonable time
    expect(endTime - startTime).toBeLessThan(10000); // 10 seconds max
  });
});
