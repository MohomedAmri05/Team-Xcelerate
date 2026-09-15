<div align="center">

<!-- Animated typing -->
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=32&pause=1000&color=36BCF7&center=true&vCenter=true&width=600&lines=High+Street+Admin+Dashboard;Authentication+%26+Authorization;React+%2B+Node.js" alt="Typing SVG" /></a>

<!-- Badges -->
<img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
<img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
<img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
<img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white" alt="JWT" />
<img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge" alt="License: MIT" />

</div>

---

# High Street — Admin Dashboard & Authentication Module

A secure administration and identity-management module developed for the *High Street vehicle sales platform*. It provides authentication, authorization, staff permissions, user administration, profile management and active-session control across the React frontend and Node.js backend.

## Contributor

| Detail                       | Information                      |
| ---------------------------- | -------------------------------- |
| Name                         | M.R. Ahamed                      |
| Student ID                   | SA24611013                       |
| Assigned module              | Admin Dashboard & Authentication |
| Development branch           | feature/ahamed-admin-auth      |

---

## 📋 Table of Contents
- [✨ Features](#-features)
- [🛠️ Tech Stack](#️-tech-stack)
- [🔐 Authentication Flow](#-authentication-flow)
- [📊 Module Distribution](#-module-distribution)
- [🚀 Getting Started](#-getting-started)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📬 Contact](#-contact)

## ✨ Features
- 🔐 **Secure Authentication** – JWT-based login and session management.
- 🛡️ **Role-Based Authorization** – Granular staff permissions and access control.
- 👥 **User Administration** – CRUD operations for staff and users.
- 📝 **Profile Management** – Update personal information and settings.
- ⏱️ **Active Session Control** – Monitor and revoke active sessions.
- 📱 **Responsive UI** – Built with React for seamless cross-device experience.

## 🛠️ Tech Stack
<div align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white" alt="JWT" />
  <img src="https://img.shields.io/badge/Redux-593D88?style=for-the-badge&logo=redux&logoColor=white" alt="Redux" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind" />
</div>

## 🔐 Authentication Flow

```mermaid
flowchart TD
    A["👤 User"] -->|Login Request| B["🔐 Auth Service"]
    B --> C{"Valid Credentials?"}
    C -->|Yes| D["🎫 Generate JWT"]
    C -->|No| E["❌ Return 401 Error"]
    D --> F["🏠 Access Admin Dashboard"]
    F --> G{"Check Permissions"}
    G -->|Authorized| H["✅ Allow Access"]
    G -->|Unauthorized| I["🚫 Deny Access"]
