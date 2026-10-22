import 'dotenv/config'
import app from './app.js'
import { dbConfig } from '@config/database.js'
import { getJwtSecret } from '@config/jwt.js'

const PORT = process.env.PORT || 3000

const startServer = async () => {
    try {
        getJwtSecret()
        await dbConfig.initialize()
        console.log('Database initialized successfully.')

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        console.error('Failed to start the server:', error)
        process.exit(1)
    }
}

startServer()
