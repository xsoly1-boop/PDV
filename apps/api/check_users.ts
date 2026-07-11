import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const users = await prisma.usuario.findMany();
    console.log("=== USUARIOS EN LA BASE DE DATOS ===");
    users.forEach(u => {
      console.log(`ID: ${u.id} | Nombre: ${u.nombre} | Rol: ${u.rol} | PIN: ${u.pin} | Activo: ${u.activo}`);
    });
  } catch (err) {
    console.error("Error querying users:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
