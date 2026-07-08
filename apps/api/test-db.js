import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || "postgresql://postgres.lxmlcsbbfdwpxzvvktvb:FPsF3GA5DMIONfeL@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
    }
  }
});

async function main() {
  console.log("Intentando conectar con DIRECT_URL...");
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log("Conexión exitosa! Hora del servidor:", result);
  } catch (err) {
    console.error("Error al conectar:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
