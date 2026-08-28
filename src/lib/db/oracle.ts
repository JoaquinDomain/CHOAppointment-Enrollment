import oracledb from 'oracledb'

// Oracle DB configuration with mock fallback
const oracleConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
}

let isOracleAvailable = false

// Check if Oracle credentials are available
if (oracleConfig.user && oracleConfig.password && oracleConfig.connectString) {
  isOracleAvailable = true
  // Configure Oracle in thin mode
  oracledb.initOracleClient({ libDir: process.env.ORACLE_CLIENT_LIB_DIR })
}

/**
 * Oracle database connection manager with mock fallback
 */
export class OracleDB {
  private connection: oracledb.Connection | null = null

  /**
   * Connect to Oracle database
   */
  async connect(): Promise<void> {
    if (!isOracleAvailable) {
      console.log('Oracle credentials not configured, using mock data')
      return
    }

    try {
      this.connection = await oracledb.getConnection(oracleConfig)
      console.log('Connected to Oracle database')
    } catch (error) {
      console.error('Oracle connection failed, falling back to mock data:', error)
      isOracleAvailable = false
    }
  }

  /**
   * Execute a query
   */
  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!isOracleAvailable || !this.connection) {
      return this.mockQuery(sql, params)
    }

    try {
      const result = await this.connection.execute(sql, params, {
        outFormat: oracledb.OUT_FORMAT_OBJECT
      })
      return result.rows
    } catch (error) {
      console.error('Oracle query failed, falling back to mock data:', error)
      return this.mockQuery(sql, params)
    }
  }

  /**
   * Mock query fallback for when Oracle is not available
   */
  private mockQuery(sql: string, params: any[]): any {
    // Simple mock implementation - return empty array for now
    // This can be expanded with actual mock data based on the query
    console.log('Using mock data for query:', sql.substring(0, 50) + '...')
    return []
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.close()
        console.log('Oracle connection closed')
      } catch (error) {
        console.error('Error closing Oracle connection:', error)
      }
      this.connection = null
    }
  }

  /**
   * Check if Oracle is available
   */
  static isAvailable(): boolean {
    return isOracleAvailable
  }
}

// Singleton instance
let oracleInstance: OracleDB | null = null

export async function getOracleDB(): Promise<OracleDB> {
  if (!oracleInstance) {
    oracleInstance = new OracleDB()
    await oracleInstance.connect()
  }
  return oracleInstance
}