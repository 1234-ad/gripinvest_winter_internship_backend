const OpenAI = require('openai');
const logger = require('./logger');

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

class AIService {
  static isEnabled() {
    return !!openai;
  }

  static async analyzePasswordStrength(password) {
    if (!this.isEnabled()) {
      return this.getFallbackPasswordAnalysis(password);
    }

    try {
      const prompt = `Analyze the password strength and provide suggestions for improvement. Password: "${password}"
      
      Provide response in JSON format:
      {
        "strength": "weak|moderate|strong",
        "score": 0-100,
        "suggestions": ["suggestion1", "suggestion2"],
        "issues": ["issue1", "issue2"]
      }`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error('AI password analysis failed:', error);
      return this.getFallbackPasswordAnalysis(password);
    }
  }

  static getFallbackPasswordAnalysis(password) {
    const length = password.length;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    let score = 0;
    let strength = 'weak';
    const issues = [];
    const suggestions = [];

    if (length >= 8) score += 25;
    else issues.push('Password too short');

    if (hasUpper) score += 20;
    else suggestions.push('Add uppercase letters');

    if (hasLower) score += 20;
    else suggestions.push('Add lowercase letters');

    if (hasNumbers) score += 20;
    else suggestions.push('Add numbers');

    if (hasSpecial) score += 15;
    else suggestions.push('Add special characters');

    if (score >= 80) strength = 'strong';
    else if (score >= 60) strength = 'moderate';

    return { strength, score, suggestions, issues };
  }

  static async generateProductDescription(product) {
    if (!this.isEnabled()) {
      return this.getFallbackProductDescription(product);
    }

    try {
      const prompt = `Generate a compelling product description for this investment product:
      
      Name: ${product.name}
      Type: ${product.investment_type}
      Annual Yield: ${product.annual_yield}%
      Risk Level: ${product.risk_level}
      Tenure: ${product.tenure_months} months
      Min Investment: ₹${product.min_investment}
      
      Make it professional, informative, and appealing to investors. Keep it under 200 words.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250,
        temperature: 0.7
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error('AI product description generation failed:', error);
      return this.getFallbackProductDescription(product);
    }
  }

  static getFallbackProductDescription(product) {
    const typeDescriptions = {
      bond: 'secure government or corporate bonds',
      fd: 'fixed deposit with guaranteed returns',
      mf: 'professionally managed mutual fund',
      etf: 'exchange-traded fund with market exposure',
      other: 'specialized investment product'
    };

    return `${product.name} is a ${product.risk_level}-risk ${typeDescriptions[product.investment_type]} offering ${product.annual_yield}% annual returns over ${product.tenure_months} months. Minimum investment starts at ₹${product.min_investment}. Perfect for investors seeking ${product.risk_level === 'low' ? 'stable' : product.risk_level === 'moderate' ? 'balanced' : 'high-growth'} investment opportunities.`;
  }

  static async getPortfolioInsights(portfolioData) {
    if (!this.isEnabled()) {
      return this.getFallbackPortfolioInsights(portfolioData);
    }

    try {
      const prompt = `Analyze this investment portfolio and provide insights:
      
      Total Invested: ₹${portfolioData.totalInvested}
      Current Value: ₹${portfolioData.currentValue}
      Total Gain: ₹${portfolioData.totalGain}
      Gain Percentage: ${portfolioData.totalGainPercentage.toFixed(2)}%
      Number of Investments: ${portfolioData.investmentCount}
      
      Provide 2-3 key insights about portfolio performance and diversification in a friendly, professional tone.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.6
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error('AI portfolio insights failed:', error);
      return this.getFallbackPortfolioInsights(portfolioData);
    }
  }

  static getFallbackPortfolioInsights(portfolioData) {
    const insights = [];
    
    if (portfolioData.totalGainPercentage > 10) {
      insights.push("🎉 Excellent performance! Your portfolio is generating strong returns.");
    } else if (portfolioData.totalGainPercentage > 0) {
      insights.push("📈 Your portfolio is performing well with positive returns.");
    } else {
      insights.push("📊 Consider reviewing your investment strategy for better returns.");
    }

    if (portfolioData.investmentCount < 3) {
      insights.push("💡 Consider diversifying with more investment products to reduce risk.");
    } else {
      insights.push("✅ Good diversification with multiple investment products.");
    }

    return insights.join(' ');
  }

  static async summarizeErrors(errors) {
    if (!this.isEnabled() || !errors.length) {
      return "No recent errors to analyze.";
    }

    try {
      const errorSummary = errors.map(e => 
        `${e.endpoint} (${e.http_method}): ${e.error_message} - ${e.count} times`
      ).join('\n');

      const prompt = `Summarize these API errors and provide actionable insights:
      
      ${errorSummary}
      
      Provide a brief summary and 2-3 recommendations to reduce these errors.`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.4
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error('AI error summarization failed:', error);
      return `Found ${errors.length} error types. Most common: ${errors[0]?.endpoint} with ${errors[0]?.count} occurrences.`;
    }
  }

  static async getInvestmentRecommendations(userProfile, products) {
    if (!this.isEnabled()) {
      return this.getFallbackRecommendations(userProfile, products);
    }

    try {
      const prompt = `Recommend investment products for this user:
      
      User Risk Appetite: ${userProfile.risk_appetite}
      
      Available Products:
      ${products.map(p => `- ${p.name}: ${p.annual_yield}% yield, ${p.risk_level} risk, ${p.investment_type}`).join('\n')}
      
      Recommend top 3 products with brief reasons (2-3 sentences each).`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.6
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      logger.error('AI recommendations failed:', error);
      return this.getFallbackRecommendations(userProfile, products);
    }
  }

  static getFallbackRecommendations(userProfile, products) {
    const filtered = products.filter(p => p.risk_level === userProfile.risk_appetite);
    const sorted = filtered.sort((a, b) => b.annual_yield - a.annual_yield);
    const top3 = sorted.slice(0, 3);

    return top3.map(p => 
      `${p.name}: Offers ${p.annual_yield}% returns matching your ${p.risk_level} risk preference.`
    ).join('\n\n');
  }
}

module.exports = AIService;