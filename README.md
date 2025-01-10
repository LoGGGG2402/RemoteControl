# Remote Control System

A comprehensive remote computer management system that allows administrators to monitor and control computers in an organization's network. This system is designed to simplify IT management tasks, enhance security, and improve efficiency in managing multiple computers across different rooms or departments.

## Project Overview

This project consists of three main components working together to provide a complete remote management solution:

### 1. Agent (Windows Client)

- Written in Python for maximum compatibility and performance
- Features:
  - System information collection
    - Hardware details (CPU, RAM, Storage)
    - Network information
    - Running processes
    - Installed software
  - File transfer capabilities
    - Secure file download
    - Remote file deletion
    - File system navigation
  - Software management via Chocolatey
    - Silent installation/uninstallation
    - Package version control
    - Dependency management
  - User-friendly installation
    - GUI-based installer
    - Automatic service registration
    - Self-updating capability
  - Comprehensive logging
    - Activity tracking
    - Error logging
    - Performance monitoring
  - System security
    - Encrypted communications
    - Access control enforcement
    - Secure credential handling

### 2. Server (Backend)

- Built with Node.js for high performance and scalability
- Key components:
  - RESTful API endpoints
    - Computer management APIs
    - Room management APIs
    - User management APIs
    - Application control APIs
    - Agent management APIs
    - File management APIs
  - Authentication system
    - JWT-based authentication
    - Role-based authorization
    - Session management
  - Database management
    - SQLite database integration
    - Efficient data querying
    - Data backup and recovery
  - Real-time features
    - WebSocket connections
    - Live system updates
    - Instant command execution
  - Security features
    - Input validation
    - Request rate limiting
    - SQL injection prevention
  - Monitoring and logging
    - System activity logs
    - Error tracking
    - Performance metrics

### 3. Client (Web Interface)

- Developed using Vite + React + Tailwind for modern, responsive design
- Features:
  - Dashboard
    - Real-time system overview
    - Resource usage graphs
    - Alert notifications
    - Activity timeline
  - Computer Management
    - Detailed system information
    - Remote command execution
    - Software installation interface
    - File management system
  - Room Management
    - Room creation and editing
    - Computer grouping
    - Batch operations
    - Floor plan visualization
  - User Interface
    - Responsive design
    - Dark/Light theme
    - Customizable layouts
    - Keyboard shortcuts
  - Administrative Tools
    - User management
    - Permission settings
    - System configurations
    - Audit logs

## System Architecture

The system follows a three-tier architecture designed for scalability and security:

1. **Agent (Windows Client)**:

   - Runs as a Windows service
   - Maintains persistent connection with server
   - Handles local system operations
   - Manages local security policies
   - Executes commands with elevated privileges

2. **Server (Central Management)**:

   - Handles client authentication
   - Manages database operations
   - Coordinates communication between agents
   - Processes and distributes commands
   - Maintains system state
   - Handles error recovery

3. **Web Client (User Interface)**:
   - Provides intuitive management interface
   - Handles real-time updates
   - Manages user sessions
   - Implements security measures
   - Supports multiple display formats

## Detailed Features

### Computer Management

- Real-time monitoring
  - CPU usage
  - Memory utilization
  - Disk space
  - Network status
  - View running applications
- Software management
  - Installation
  - Uninstallation
  - Updates
  - Version control

### Security Features

- Access Control
  - Role-based permissions
  - User authentication
  - Activity logging
  - Session management
- Data Protection
  - Secure storage
  - Audit trails


## Technical Details

### Agent Architecture

- Service-based design
- Event-driven architecture
- Modular component system
- Plugin support for extensions

### Server Components

- Express.js middleware stack
- WebSocket implementation
- Database schema design
- API documentation
- Error handling system

### Client Framework

- React component hierarchy
- State management system
- UI/UX design patterns

## Development Guide

### Setting Up Development Environment

1. **Prerequisites Installation**

   ```bash
   # Install Node.js (v14 or higher)
   # Install Python (v3.8 or higher)
   ```

2. **Repository Setup**

   ```bash
   git clone https://github.com/LoGGGG2402/RemoteControl
   cd REMOTECONTROL
   ```

3. **Server Setup**

   ```bash
   cd server
   npm install
   # Configure .env file
   npm run dev
   ```

4. **Client Setup**

   ```bash
   cd client
   npm install
   # Configure environment
   npm run dev
   ```

5. **Agent Development**
   ```bash
   cd agent
   pip install -r requirements.txt
   # Configure agent settings
   python build_installer.py
   ```


## Deployment

### Docker Deployment

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### Manual Deployment

1. Server Deployment

   ```bash
   cd server
   npm install --production
   npm start
   ```

2. Client Deployment

   ```bash
   cd client
   npm install --production
   npm run build
   ```

3. Agent Distribution
   ```bash
   cd agent
   python build_installer.py
   # Distribute generated installer
   ```


## Authors

- Initial work - Phan Phan Hai Long

## Acknowledgments

- Thanks to all contributors
- Inspired by modern IT management needs
- Built with open source technologies
