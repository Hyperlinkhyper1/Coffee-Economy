# Repository Guidelines

## Project Structure & Module Organization
TitanBot is a modular Discord bot built with **Discord.js v14** and **PostgreSQL**. The architecture follows a service-based pattern with clear separation of concerns:

- **`src/app.js`**: Core entry point that initializes services, database, and the Discord client.
- **`src/commands/`**: Organized by category (Moderation, Economy, etc.). Each command is a separate module loaded dynamically.
- **`src/events/`**: Standard Discord event listeners that delegate to specific handlers.
- **`src/handlers/`**: Contains interaction logic for buttons, modals, and select menus, as well as command/event loaders.
- **`src/services/`**: Feature-specific business logic and database abstractions (e.g., `economyService.js`).
- **`src/utils/`**: Shared utilities, including `postgresDatabase.js` for primary storage and `memoryStorage.js` for fallback.
- **`scripts/`**: Utility scripts for database migrations, backups, and restoration.

## Build, Test, and Development Commands
- **`npm start`**: Launch the bot.
- **`npm test`**: Run automated tests using the native Node.js test runner.
- **`npm run migrate`**: Apply pending database migrations.
- **`npm run migrate:status`**: Check the current state of migrations.
- **`npm run backup:db`**: Create a database backup.
- **`npm run restore:db`**: Restore from a database backup.

## Coding Style & Naming Conventions
- **ES Modules**: The project uses ESM (`"type": "module"`). Use `import`/`export` syntax.
- **Async/Await**: Mandatory for all asynchronous operations, especially database and Discord API calls.
- **Validation**: Use **Zod** for schema validation and command input verification.
- **Logging**: Use the centralized logger in `src/utils/logger.js` (powered by Winston).
- **Naming**: Use `camelCase` for files, variables, and function names. Services should be suffixed with `Service`.

## Database & Persistence
The system uses a **PostgreSQL-first** approach with an automatic **memory fallback**. 
- Always implement feature logic that works with both storage types.
- Database schemas are managed via scripts in `scripts/migrate.js`.

## Testing Guidelines
- Place tests in the `tests/` directory.
- Use the native `node --test` runner.
- Ensure new features include tests for both PostgreSQL and memory storage paths.

## Commit Guidelines
- Use descriptive commit messages.
- Reference PR numbers where applicable (e.g., `Fix issue (#47)`).
- Minor fixes can use `fix:` prefix.
