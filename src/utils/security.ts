export class SecurityUtils {
  // Check password strength
  static checkPasswordStrength(password: string): {
    score: number;
    feedback: string;
    color: string;
  } {
    let score = 0;
    
    // Length check
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    // Determine feedback
    let feedback = '';
    let color = '';
    
    if (score <= 2) {
      feedback = 'Very Weak';
      color = 'text-red-600';
    } else if (score <= 4) {
      feedback = 'Weak';
      color = 'text-orange-600';
    } else if (score <= 5) {
      feedback = 'Medium';
      color = 'text-yellow-600';
    } else if (score <= 6) {
      feedback = 'Strong';
      color = 'text-green-600';
    } else {
      feedback = 'Very Strong';
      color = 'text-green-700';
    }
    
    return { score, feedback, color };
  }

  // Generate secure random password
  static generateSecurePassword(length: number = 16): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Ensure at least one of each type
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Sanitize input to prevent XSS
  static sanitizeInput(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Clear clipboard after specified time
  static clearClipboardAfter(seconds: number = 30): void {
    setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch (err) {
        console.error('Failed to clear clipboard:', err);
      }
    }, seconds * 1000);
  }
}