export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const {
    getDatabaseConfig,
    getStartupSummary,
    validateServerEnv,
  } = await import('@/server/config/env')
  const { checkDatabaseConnection, checkRequiredTables, checkRequiredSchema } = await import(
    '@/server/db/mysql'
  )
  const { logError, logInfo } = await import('@/server/logging/logger')

  try {
    validateServerEnv()
    const summary = getStartupSummary()
    const databaseConfig = getDatabaseConfig()

    if (databaseConfig.verifyOnStartup) {
      await checkDatabaseConnection()
      const missingTables = await checkRequiredTables()
      const missingSchema = await checkRequiredSchema()
      const problems = [
        ...missingTables.map(table => `table ${table}`),
        ...missingSchema,
      ]
      if (problems.length > 0) {
        throw new Error(
          `Missing or outdated database schema: ${problems.join(', ')}. ` +
            'Run "npm run db:migrate" before starting the application.'
        )
      }
      logInfo('startup.database_ready', summary)
    } else {
      logInfo('startup.config_loaded', summary)
    }
  } catch (error) {
    logError('startup.validation_failed', error)
    if (process.env.NODE_ENV === 'production') {
      throw error
    }
    console.warn(
      '[startup] Configuration or database checks failed. The UI will load, but API routes may return errors until MySQL is configured.',
    )
  }
}
