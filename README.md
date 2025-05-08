# Caishen NestJS Starter

A robust, scalable starter project built with [NestJS](https://nestjs.com/) and TypeScript. This template is designed to streamline backend service development with a modular architecture, modern tooling, and production-ready configuration.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

## Features

- Modular, feature-based architecture
- TypeScript-first codebase
- Integrated ESLint and Prettier
- Environment variable management
- Docker support
- Ready for production deployment

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Yarn](https://yarnpkg.com/)

### Installation

```bash
git clone https://github.com/CaishenTech/caishen-nestjs-starter.git
cd caishen-nestjs-starter
yarn install
```

### Running Locally

```bash
yarn start:dev
```

### Running in Production

```bash
yarn build
yarn start:prod
```

## Project Structure

```
src/
├── shared/         # Shared utilities and services
├── crypto/         # Modules aggregating all crypto functionality 
├── fiat/           # Aggregation of all fiat functionality
├── types/          # All declaration .d.ts files
├── app.module.ts   # Root module
└── main.ts         # Application entry point
```

## Scripts

| Command         | Description                    |
|----------------|--------------------------------|
| `yarn start:dev`| Start in development mode      |
| `yarn start:prod`| Start in production mode     |
| `yarn build`     | Compile TypeScript            |
| `yarn lint`      | Lint the codebase             |
| `yarn format`    | Format the code with Prettier |

## Tech Stack

- [NestJS](https://nestjs.com/)
- [TypeScript](https://www.typescriptlang.org/)
- [Yarn](https://yarnpkg.com/)
- [Docker](https://www.docker.com/)
- [ESLint](https://eslint.org/)
- [Prettier](https://prettier.io/)

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request. For major changes, open an issue first to discuss what you'd like to change.

## License

This project is licensed under the [MIT License](LICENSE).
