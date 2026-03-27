const { PrismaClient } = require('@prisma/client');

async function testConnection() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: process.env.DATABASE_URL
            }
        }
    });

    try {
        console.log('Attempting to connect to:', process.env.DATABASE_URL.split('@')[1]);
        const result = await prisma.$queryRaw`SELECT 1 as result`;
        console.log('Connection successful:', result);
    } catch (error) {
        console.error('Connection failed:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testConnection();
