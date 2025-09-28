# Mini Investment Platform - Grip Invest Winter Internship 2025

A full-stack investment platform with AI-powered features, built with Node.js, React, and MySQL.

## 🚀 Features

### Backend
- **Authentication**: JWT-based auth with password reset
- **Investment Products**: CRUD operations with AI-generated descriptions
- **Portfolio Management**: Investment tracking with AI insights
- **Transaction Logging**: Comprehensive API logging with AI error analysis
- **AI Integration**: Password strength, product recommendations, portfolio insights

### Frontend
- **Modern UI**: React with TailwindCSS
- **Dashboard**: Portfolio overview with AI insights
- **Product Management**: Browse and invest in products
- **Transaction History**: Detailed logs with AI summaries
- **Responsive Design**: Mobile-friendly interface

### DevOps
- **Docker**: Containerized deployment
- **Health Checks**: Service monitoring
- **Logging**: Comprehensive request/error logging

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express.js
- MySQL with Sequelize ORM
- JWT Authentication
- Jest for testing
- OpenAI API for AI features

**Frontend:**
- React.js with Vite
- TailwindCSS for styling
- Recharts for data visualization
- Axios for API calls
- Jest + React Testing Library

**DevOps:**
- Docker & Docker Compose
- MySQL 8.0
- Health monitoring

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for development)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/1234-ad/gripinvest_winter_internship_backend.git
cd gripinvest_winter_internship_backend
```

### 2. Environment Setup
```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Update backend/.env with your settings
```

### 3. Run with Docker
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 4. Access Services
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health
- **MySQL**: localhost:3306

## 📊 Database Schema

The project uses predefined MySQL schemas for:
- `users` - User authentication and profiles
- `investment_products` - Available investment options
- `investments` - User portfolio tracking
- `transaction_logs` - API request logging

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# Coverage reports
npm run test:coverage
```

## 📝 API Documentation

Import the Postman collection from `docs/postman_collection.json` for complete API documentation.

### Key Endpoints
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/products` - List investment products
- `POST /api/investments` - Create investment
- `GET /api/portfolio` - User portfolio
- `GET /api/logs` - Transaction logs

## 🤖 AI Features

### How AI Enhanced This Project

1. **Password Security**: Real-time strength analysis and suggestions
2. **Product Descriptions**: Auto-generated from structured data
3. **Smart Recommendations**: Risk-based product suggestions
4. **Portfolio Insights**: AI-powered investment analysis
5. **Error Analysis**: Intelligent error summarization
6. **Code Quality**: AI-assisted development and testing

### AI Tools Used
- **OpenAI GPT-4**: Content generation and analysis
- **GitHub Copilot**: Code completion and suggestions
- **AI-powered testing**: Automated test case generation
- **Smart documentation**: AI-enhanced README and comments

## 🏗️ Development

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Management
```bash
# Run migrations
cd backend && npm run migrate

# Seed data
npm run seed

# Reset database
npm run db:reset
```

## 📁 Project Structure

```
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── models/          # Database models
│   │   ├── middleware/      # Custom middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   └── utils/           # Helper functions
│   ├── tests/               # Jest test files
│   └── Dockerfile
├── frontend/                # React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom hooks
│   │   └── utils/           # Helper functions
│   ├── tests/               # React tests
│   └── Dockerfile
├── docs/                    # Documentation
├── docker-compose.yml       # Docker orchestration
└── README.md
```

## 🔧 Configuration

### Environment Variables

**Backend (.env):**
```env
NODE_ENV=development
PORT=5000
DB_HOST=mysql
DB_PORT=3306
DB_NAME=gripinvest
DB_USER=root
DB_PASSWORD=password
JWT_SECRET=your-secret-key
OPENAI_API_KEY=your-openai-key
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:5000/api
```

## 🚀 Deployment

### Production Build
```bash
# Build frontend
cd frontend && npm run build

# Build backend
cd backend && npm run build

# Production containers
docker-compose -f docker-compose.prod.yml up -d
```

## 📈 Monitoring

- **Health Endpoint**: `/health` - Service and DB status
- **Logs**: Comprehensive request/error logging
- **Metrics**: Performance and usage tracking

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is part of the Grip Invest Winter Internship 2025 program.

## 📞 Contact

For questions about this internship project, contact: prayas@gripinvest.in

---

**Built with ❤️ for Grip Invest Winter Internship 2025**