import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient();

function parseJson(val: any) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch (e) {
      return val;
    }
  }
  return val;
}

export const prisma = prismaClient.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const anyArgs = args as any;
        
        // 1. Before query: Stringify JSON objects before saving to SQLite
        if (anyArgs && anyArgs.data) {
          const data = anyArgs.data;
          if (model === 'ConfiguracionEmpresa' && data.formatoTicket && typeof data.formatoTicket === 'object') {
            data.formatoTicket = JSON.stringify(data.formatoTicket);
          }
          if (model === 'Producto' && data.metadatos && typeof data.metadatos === 'object') {
            data.metadatos = JSON.stringify(data.metadatos);
          }
          
          if (Array.isArray(data)) {
            for (const item of data) {
              if (model === 'ConfiguracionEmpresa' && item.formatoTicket && typeof item.formatoTicket === 'object') {
                item.formatoTicket = JSON.stringify(item.formatoTicket);
              }
              if (model === 'Producto' && item.metadatos && typeof item.metadatos === 'object') {
                item.metadatos = JSON.stringify(item.metadatos);
              }
            }
          }
        }

        // Execute query
        const result = await query(args);

        // 2. After query: Parse stored strings back to JSON objects
        const parseItem = (item: any) => {
          if (!item) return;
          if (model === 'ConfiguracionEmpresa' && 'formatoTicket' in item) {
            item.formatoTicket = parseJson(item.formatoTicket);
          }
          if (model === 'Producto' && 'metadatos' in item) {
            item.metadatos = parseJson(item.metadatos);
          }
        };

        if (Array.isArray(result)) {
          result.forEach(parseItem);
        } else {
          parseItem(result);
        }

        return result;
      }
    }
  }
});
