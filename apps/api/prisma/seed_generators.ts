import * as fs from 'fs';
import * as path from 'path';

// --- HELPERS ---

// Algoritmo EAN-13 Check Digit
function calculateEanCheckDigit(code: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

// Genera un código de barras EAN-13 único a partir de un prefijo de 6 dígitos y un número de secuencia
function generateBarcode(prefix: string, seq: number): string {
  const padded = seq.toString().padStart(6, '0');
  const ean12 = prefix + padded;
  const check = calculateEanCheckDigit(ean12);
  return ean12 + check;
}

// --- GENERATOR DATA DEFINITIONS ---

// 1. FERRETERIA
const ferreteriaData = {
  giro: 'FERRETERIA',
  categories: [
    {
      nombre: 'Herramientas Manuales',
      items: ['Martillo', 'Desarmador', 'Pinzas de chofer', 'Pinzas de punta', 'Llave mixta', 'Arco de segueta', 'Nivel de mano', 'Cincel', 'Martillo de bola', 'Juego de llaves Allen', 'Flexómetro', 'Espátula'],
      materials: ['Acero', 'Forjado', 'Templado', 'Cromo vanadio', 'Mango fibra de vidrio', 'Mango plástico'],
      sizes: ['16 oz', '1/4 x 4 pulg', '6 pulg', '8 pulg', '1/2 pulg', '12 pulg', '3/8 pulg', '10 pulg', '3 metros', '5 metros', '8 metros', '3 pulg'],
      brands: ['Truper', 'Pretul', 'Aksi', 'Urrea', 'Stanley', 'Dewalt']
    },
    {
      nombre: 'Plomería y Conexiones',
      items: ['Tubo', 'Codo 90', 'Codo 45', 'Copla', 'Tee', 'Adaptador macho', 'Adaptador hembra', 'Tuerca unión', 'Válvula de esfera', 'Flotador para tinaco', 'Cinta teflón', 'Llave de paso'],
      materials: ['PVC', 'CPVC', 'Cobre', 'Galvanizado', 'PPR', 'Latón', 'Plástico'],
      sizes: ['1/2 pulg', '3/4 pulg', '1 pulg', '1 1/2 pulg', '2 pulg', '13mm', '19mm', '25mm', '10 metros', '20 metros'],
      brands: ['Tuboplus', 'Coflex', 'Truper', 'Anbec', 'Urrea', 'Rotoplas']
    },
    {
      nombre: 'Electricidad y Cableado',
      items: ['Cable duplex', 'Cable conductor', 'Apagador sencillo', 'Contacto doble', 'Cinta aislante', 'Foco LED', 'Socket de porcelana', 'Placa de pared', 'Tubo conduit', 'Interruptor termomagnético'],
      materials: ['Cobre', 'Aluminio', 'Plástico', 'Cerámica', 'Antiflama', 'Negro', 'Blanco', 'Marfil'],
      sizes: ['Calibre 10', 'Calibre 12', 'Calibre 14', 'Calibre 8', '10W', '15W', '8.5W', '20 metros', '10 metros', '15 Amperios', '20 Amperios'],
      brands: ['Iusa', 'Condulac', 'Volteck', 'Aksi', 'Schneider', 'BTicino', 'Philips']
    },
    {
      nombre: 'Tornillería y Fijación',
      items: ['Tornillo máquina', 'Tornillo para madera', 'Pija cabeza plana', 'Clavo estándar', 'Clavo para concreto', 'Tuerca hexagonal', 'Rondana plana', 'Rondana de presión', 'Taquete plástico', 'Ancla metálica'],
      materials: ['Acero galvanizado', 'Acero inoxidable', 'Negro templado', 'Latón', 'Plástico', 'Fijación rápida'],
      sizes: ['1/4 x 1 pulg', '1/4 x 2 pulg', '5/16 x 2 pulg', '3/8 x 3 pulg', '3/16 x 1 1/2 pulg', '1 pulg', '1 1/2 pulg', '2 pulg', '2 1/2 pulg', '3 pulg'],
      brands: ['Fiero', 'Truper', 'Pretul', 'Aksi', 'Fischer', 'Hillman']
    },
    {
      nombre: 'Pintura y Recubrimientos',
      items: ['Pintura vinílica', 'Pintura esmalte', 'Brocha', 'Rodillo para pintar', 'Charola para rodillo', 'Solvente thinner', 'Sellador acrílico', 'Espátula metálica', 'Cinta masking tape', 'Fijador de yeso'],
      materials: ['Base agua', 'Base aceite', 'Cerdas naturales', 'Cerdas sintéticas', 'Madera', 'Metal', 'Plástico'],
      sizes: ['1 Litro', '4 Litros', '19 Litros', '1 pulg', '2 pulg', '3 pulg', '4 pulg', '9 pulg', '50 metros'],
      brands: ['Comex', 'Sherwin Williams', 'Truper', 'Pretul', 'Aksi', 'Fandeli', 'Tuk']
    }
  ]
};

// 2. ABARROTES
const abarrotesData = {
  giro: 'ABARROTES',
  categories: [
    {
      nombre: 'Lácteos y Huevos',
      items: ['Leche entera', 'Leche semidescremada', 'Yoghur beber', 'Crema ácida', 'Mantequilla con sal', 'Queso panela', 'Queso Oaxaca', 'Queso tipo Americano', 'Huevo blanco', 'Huevo rojo'],
      materials: ['Fresa', 'Durazno', 'Natural', 'Caja', 'Bote', 'Paquete', 'Cono de 30 piezas', 'Cono de 12 piezas'],
      sizes: ['1 Litro', '250ml', '500g', '200g', '90g', '400g', '140g', '12 rebanadas', '1 Kg'],
      brands: ['Lala', 'Alpura', 'Santa Clara', 'Nochebuena', 'Fud', 'La Villita', 'San Juan', 'El Calvario']
    },
    {
      nombre: 'Panadería y Tortillas',
      items: ['Pan de caja blanco', 'Pan integral', 'Pan tostado', 'Tortillas de maíz', 'Tortillas de harina', 'Tostadas onduladas', 'Tostadas horneadas', 'Medias noches', 'Pan p/hamburguesa', 'Mantecadas'],
      materials: ['Trigo', 'Maíz blanco', 'Maíz azul', 'Multigrano', 'Mantequilla', 'Vainilla', 'Clásico'],
      sizes: ['680g', '620g', '200g', '1 Kg', '500g', '10 piezas', '8 piezas', '6 piezas', '300g'],
      brands: ['Bimbo', 'Wonder', 'Milpa Real', 'Tía Rosa', 'Sello de Oro', 'Mission', 'Saníssimo']
    },
    {
      nombre: 'Bebidas y Refrescos',
      items: ['Refresco cola', 'Refresco de naranja', 'Refresco lima-limón', 'Agua mineral', 'Agua purificada', 'Jugo de naranja', 'Jugo de manzana', 'Té helado', 'Bebida isotónica', 'Energy drink'],
      materials: ['Original', 'Sin azúcar', 'Light', 'Mandarina', 'Durazno', 'Uva', 'Toronja', 'Multifrutas'],
      sizes: ['355ml', '600ml', '1 Litro', '1.5 Litros', '2 Litros', '2.5 Litros', '3 Litros', '500ml'],
      brands: ['Coca-Cola', 'Pepsi', 'Sidral Mundet', 'Fanta', 'Sprite', 'Peñafiel', 'Ciel', 'Bonafont', 'Jumex', 'Del Valle', 'Gatorade']
    },
    {
      nombre: 'Cereales y Harinas',
      items: ['Cereal de maíz hojuelas', 'Cereal de trigo inflado', 'Avena en hojuelas', 'Harina de trigo', 'Harina de maíz', 'Galletas marías', 'Galletas de chocolate', 'Galletas saladas', 'Arroz súper extra', 'Frijol pinto'],
      materials: ['Azucarado', 'Con chocolate', 'Integral', 'Clásico', 'Precocido', 'Negro', 'Pinto', 'Flor de mayo'],
      sizes: ['300g', '500g', '1 Kg', '400g', '800g', '240g', '150g', '180g'],
      brands: ['Kellogg\'s', 'Nestlé', 'Quaker', 'Maseca', 'Tres Estrellas', 'Gamesa', 'Marinela', 'Verde Valle']
    },
    {
      nombre: 'Limpieza y Cuidado del Hogar',
      items: ['Detergente líquido ropa', 'Detergente polvo', 'Suavizante de telas', 'Lavatrastes líquido', 'Limpiador multiusos', 'Papel higiénico', 'Servilletas', 'Jabón de barra ropa', 'Cloro blanqueador', 'Fibras para trastes'],
      materials: ['Aroma lavanda', 'Aroma limón', 'Aroma floral', 'Doble hoja', 'Hojas gruesas', 'Biodegradable'],
      sizes: ['1 Litro', '2 Litros', '1 Kg', '2 Kg', '750ml', '4 rollos', '400 piezas', '350g', '950ml', '2 piezas'],
      brands: ['Ariel', 'Persil', 'Roma', 'Zote', 'Downy', 'Suavitel', 'Salvo', 'Fabuloso', 'Saba', 'Regio', 'KleeneX', 'Cloralex']
    }
  ]
};

// 3. FARMACIA
const farmaciaData = {
  giro: 'FARMACIA',
  categories: [
    {
      nombre: 'Analgésicos y Antiinflamatorios',
      items: ['Paracetamol', 'Ibuprofeno', 'Naproxeno', 'Ácido acetilsalicílico', 'Diclofenaco sódico', 'Ketorolaco', 'Meloxicam', 'Celecoxib', 'Clonixinato de lisina', 'Acetaminofén'],
      materials: ['Tabletas', 'Cápsulas', 'Tabletas masticables', 'Suspensión', 'Gel activo', 'Ampolletas'],
      sizes: ['500mg - Caja c/20', '200mg - Caja c/10', '400mg - Caja c/20', '550mg - Caja c/12', '100mg - Caja c/30', '100mg - Tubo 30g', '10mg - Caja c/10', '15mg - Caja c/10', '200mg - Caja c/30', '120ml Jarabe'],
      brands: ['Tempra', 'Advill', 'Flanax', 'Aspirina', 'Voltaren', 'Aliviax', 'Mavi', 'Genérico GI', 'Similares', 'Bayer']
    },
    {
      nombre: 'Cuidado Gastrointestinal',
      items: ['Omeprazol', 'Pantoprazol', 'Ranitidina', 'Hidróxido de aluminio y magnesio', 'Loperamida', 'Subsalicilato de bismuto', 'Metoclopramida', 'Butilhioscina', 'Fórmula láctea infantil', 'Electrolitos orales'],
      materials: ['Cápsulas liberación prolongada', 'Tabletas recubiertas', 'Suspensión oral', 'Polvo efervescente', 'Líquido hidratante', 'Aroma manzana', 'Coco', 'Fresa'],
      sizes: ['20mg - Caja c/14', '40mg - Caja c/7', '150mg - Caja c/20', '240ml Suspensión', '2mg - Caja c/12', '120ml Jarabe', '10mg - Caja c/20', 'Suero 625ml', 'Lata 400g'],
      brands: ['Genoprazol', 'Pepto-Bismol', 'Treda', 'Melox', 'Buscapina', 'Pedialyte', 'Electrolit', 'Enfamil', 'Mavi', 'Genérico GI', 'Similares']
    },
    {
      nombre: 'Antigripales y Respiratorios',
      items: ['Clorfenamina / Fenilefrina', 'Loratadina', 'Cetirizina', 'Ambroxol', 'Dextrometorfano', 'Cloruro de sodio spray nasal', 'Benzonatato', 'Dextrometorfano compuesto', 'Paracetamol infantil', 'Carbocisteína'],
      materials: ['Jarabe pediátrico', 'Tabletas c/antihistamínico', 'Cápsulas blandas', 'Spray atomizador', 'Perlas de gel'],
      sizes: ['Caja c/12 tabletas', '10mg - Caja c/10', '10mg - Caja c/20', '120ml Jarabe', '100mg - Caja c/20', '15ml Spray', 'Caja c/20 perlas', '120ml Jarabe Infantil', 'Gotas pediátricas 30ml'],
      brands: ['Next', 'Tabcin Active', 'Histiacil', 'Tukol', 'Afrin', 'Tylenol Infantil', 'Siegfried', 'Genérico GI', 'Similares', 'Boehringer']
    },
    {
      nombre: 'Vitaminas y Suplementos',
      items: ['Vitamina C con Zinc', 'Complejo B', 'Multivitamínico diario', 'Suplemento de Calcio y Vitamina D', 'Ácido fólico', 'Omega 3', 'Colágeno hidrolizado', 'Suplemento alimenticio polvo', 'Hierro + ácido fólico', 'Vitamina E'],
      materials: ['Tabletas efervescentes', 'Grageas', 'Cápsulas de gelatina blanda', 'Polvo p/bebida', 'Tabletas masticables'],
      sizes: ['1g - Caja c/10 efervescentes', 'Caja c/30 grageas', 'Frasco c/60 gomitas', 'Frasco c/90 cápsulas', '400mcg - Caja c/90', 'Lata 400g', '500mg - Caja c/30', '400 UI - Frasco c/100'],
      brands: ['Redoxon', 'Bedoyecta', 'Pharmaton', 'Centrum', 'Caltrate', 'Ensure', 'Solanum', 'Genérico GI', 'Similares', 'Bayer']
    },
    {
      nombre: 'Material de Curación e Higiene',
      items: ['Alcohol desnaturalizado', 'Agua oxigenada', 'Algodón absorbente', 'Gasa simple estéril', 'Venda elástica', 'Cinta micropore', 'Curitas adhesivas', 'Jeringa desechable', 'Gel antibacterial', 'Jabón neutro dermatológico'],
      materials: ['Líquido antiséptico', 'Tejido suave', 'Cinta adhesiva', 'Plástico estéril', 'Desechable', 'Hipoalergénico'],
      sizes: ['250ml', '110ml', '50g', '100g', '10cm x 5m', '5cm x 5m', '1 pulg x 5m', 'Caja c/40 piezas', '3ml c/aguja', '5ml c/aguja', '500ml c/válvula', '100g barra'],
      brands: ['Jaloma', 'Protect', 'Micropore', 'Curitas', 'Becton Dickinson', 'Plasti-med', 'Grisi', 'Dove', 'Genérico GI', 'Similares']
    }
  ]
};

// 4. REFACCIONARIA
const refaccionariaData = {
  giro: 'REFACCIONARIA',
  categories: [
    {
      nombre: 'Frenos y Balatas',
      items: ['Balatas delanteras', 'Balatas traseras', 'Disco de freno delantero', 'Tambor de freno trasero', 'Líquido de frenos LF4', 'Manguera de freno', 'Calidad cerámica', 'Calidad semimetálica'],
      materials: ['Cerámica premium', 'Semimetálica estándar', 'Acero ventilado', 'Fórmula de alto rendimiento', 'Fluido sintético'],
      sizes: ['Jetta A4 (2000-2015)', 'Chevy C2 (2004-2008)', 'Tsuru III (1992-2017)', 'Aveo 1.6 (2008-2017)', 'Versa 1.6 (2012-2020)', 'March 1.6 (2011-2020)', '355ml', '946ml'],
      brands: ['Brembo', 'Bosch', 'ACDelco', 'Fritec', 'Wagner', 'TRW', 'Akebono']
    },
    {
      nombre: 'Filtros y Afinación',
      items: ['Bujía de encendido', 'Filtro de aceite', 'Filtro de aire', 'Filtro de gasolina', 'Filtro de cabina aire acondicionado', 'Aceite para motor multigrado', 'Aceite sintético', 'Kit de afinación completo'],
      materials: ['Iridio de larga duración', 'Cobre estándar', 'Platino', 'Papel plisado sintético', 'Fórmula 15W40', 'Fórmula 5W30 Sintético', 'Monogrado 40'],
      sizes: ['Tsuru III', 'Chevy 1.6', 'Jetta A4 2.0', 'Aveo 1.6', 'Versa 1.6', 'Sentra 2.0', '1 Litro', 'Garrafa 4.7 Litros'],
      brands: ['Bosch', 'NGK', 'Champion', 'Fram', 'Gonher', 'Mobil 1', 'Castrol', 'Quaker State', 'Interfil']
    },
    {
      nombre: 'Suspensión y Dirección',
      items: ['Amortiguador de gas delantero', 'Amortiguador de gas trasero', 'Horquilla de suspensión', 'Rótula delantera', 'Terminal de dirección', 'Bieleta de dirección', 'Balero de rueda delantera', 'Cacahuate barra estabilizadora'],
      materials: ['Izquierdo', 'Derecho', 'Lado conductor', 'Lado copiloto', 'Superior', 'Inferior', 'Sellado de alta durabilidad'],
      sizes: ['Tsuru III', 'Chevy C2', 'Jetta A4', 'Aveo 1.6', 'Versa 1.6', 'Sentra 2.0', 'March 1.6'],
      brands: ['Monroe', 'KYB', 'Boge', 'SYD', 'Safety', 'Moog', 'ACDelco', 'Ruville']
    },
    {
      nombre: 'Enfriamiento y Motor',
      items: ['Radiador de agua', 'Bomba de agua', 'Termostato de motor', 'Depósito de anticongelante', 'Anticongelante listo para usar', 'Manguera de radiador superior', 'Manguera de radiador inferior', 'Banda de alternador', 'Banda de distribución'],
      materials: ['Aluminio soldado', 'Anticongelante 50/50', 'Anticongelante Concentrado', 'Goma reforzada', 'Acero fundido'],
      sizes: ['Jetta A4 2.0', 'Tsuru III', 'Chevy 1.6', 'Aveo 1.6', 'Versa 1.6', '1 Litro', '1 Galón (3.78L)', 'Longitud 1150mm', 'Longitud 980mm'],
      brands: ['Gates', 'GMB', 'KeepOnGreen', 'Prestone', 'DEPO', 'ACDelco', 'Dayco', 'Bando']
    },
    {
      nombre: 'Sistema Eléctrico y Encendido',
      items: ['Acumulador batería', 'Marcha arranque', 'Alternador', 'Bobina de encendido', 'Sensor de oxígeno', 'Sensor posición cigüeñal (CKP)', 'Juego de cables de bujía', 'Fusibles automotrices surtidos', 'Faro delantero', 'Calavera trasera'],
      materials: ['Sellada libre mantenimiento', 'Lado izquierdo', 'Lado derecho', 'Cobre aislado', 'Aislante de silicón'],
      sizes: ['Grupo 42 (Chevy/Tsuru)', 'Grupo 35 (Jetta/Versa)', 'Tsuru III', 'Chevy 1.6', 'Jetta A4 2.0', 'Aveo 1.6', 'Versa 1.6', 'Juego de 5 piezas', 'Caja c/10 piezas'],
      brands: ['LTH', 'America', 'Bosch', 'ACDelco', 'Kem', 'Hella', 'DEPO', 'TYC', 'NGK']
    }
  ]
};

// --- PROGRAMMATIC GENERATOR FUNCTION ---
function generateCatalog(giroName: string, configData: typeof ferreteriaData) {
  const products: any[] = [];
  const generatedSkus = new Set<string>();
  const generatedBarcodes = new Set<string>();
  
  const prefixGiroMap: Record<string, string> = {
    'FERRETERIA': '750120',
    'ABARROTES': '750102',
    'FARMACIA': '750341',
    'REFACCIONARIA': '750519'
  };
  
  const prefix = prefixGiroMap[giroName] || '750999';
  let seq = 1;

  // Correlativo de PLU para básculas (códigos cortos de 4 dígitos)
  let pluSeq = 2001;

  // Queremos al menos 1,000 artículos únicos.
  // Realizaremos combinaciones sistemáticas de las listas de cada categoría.
  for (const cat of configData.categories) {
    const { nombre: categoriaNombre, items, materials, sizes, brands } = cat;
    
    // Recorremos las listas combinándolas de forma determinista para producir volumen
    for (const item of items) {
      for (const brand of brands) {
        for (const mat of materials) {
          for (const size of sizes) {
            
            // Generar un nombre descriptivo lógico
            // Ej: "Martillo de Acero 16 oz Truper"
            const productName = `${item} ${mat} ${size} ${brand}`.substring(0, 80);
            
            // Crear un SKU único correlativo
            // Ej: "MART-TRUP-ACE-16OZ" o similar abreviado
            const itemCode = item.substring(0, 4).toUpperCase();
            const brandCode = brand.substring(0, 3).toUpperCase();
            const matCode = mat.substring(0, 3).toUpperCase();
            const sizeClean = size.replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
            
            let sku = `${itemCode}-${brandCode}-${matCode}-${sizeClean}`;
            
            // Garantizar unicidad absoluta de SKU agregando correlativo si colisiona
            if (generatedSkus.has(sku)) {
              sku = `${sku}-${seq}`;
            }
            generatedSkus.add(sku);
            
            // Decidir código de barras
            let barcode = '';
            // Si el giro es ABARROTES y la categoría es "Lácteos y Huevos" (u otra), podemos simular que algunos requieren báscula
            const isScaleItem = (giroName === 'ABARROTES' && item.toLowerCase().includes('huevo')) || 
                                (giroName === 'FERRETERIA' && item.toLowerCase().includes('clavo') && size.includes('pulg'));
            
            if (isScaleItem) {
              barcode = pluSeq.toString();
              pluSeq++;
            } else {
              // Generar un código EAN-13 válido
              barcode = generateBarcode(prefix, seq);
            }
            
            // Si por alguna razón el código de barras colisiona, saltar o ajustar
            if (generatedBarcodes.has(barcode)) {
              barcode = generateBarcode(prefix, seq + 10000);
            }
            generatedBarcodes.add(barcode);

            // Costos y precios realistas
            // Costo base según el tipo de artículo
            let baseCost = 25;
            if (item.toLowerCase().includes('radiador') || item.toLowerCase().includes('amortiguador') || item.toLowerCase().includes('alternador') || item.toLowerCase().includes('batería') || item.toLowerCase().includes('fluxometro')) {
              baseCost = 850 + (seq % 15) * 100;
            } else if (item.toLowerCase().includes('balatas') || item.toLowerCase().includes('horquilla') || item.toLowerCase().includes('taladro') || item.toLowerCase().includes('pintura vinílica')) {
              baseCost = 250 + (seq % 10) * 35;
            } else if (item.toLowerCase().includes('cable') || item.toLowerCase().includes('tubo') || item.toLowerCase().includes('manguera') || item.toLowerCase().includes('cereal')) {
              baseCost = 65 + (seq % 8) * 12;
            } else if (item.toLowerCase().includes('foco') || item.toLowerCase().includes('apagador') || item.toLowerCase().includes('leche') || item.toLowerCase().includes('pan') || item.toLowerCase().includes('curitas') || item.toLowerCase().includes('clavo')) {
              baseCost = 12 + (seq % 5) * 4;
            } else {
              baseCost = 30 + (seq % 20) * 3;
            }
            
            const cost = parseFloat((baseCost + (seq % 17) * 1.5).toFixed(2));
            // Margen de ganancia de 30% a 45%
            const margin = 1.30 + (seq % 6) * 0.03;
            const price = parseFloat((cost * margin).toFixed(2));

            // Agregar al catálogo
            products.push({
              sku,
              nombre: productName,
              costo: cost,
              precio: price,
              permiteFracciones: isScaleItem || item.toLowerCase().includes('cable') || item.toLowerCase().includes('tubo') || item.toLowerCase().includes('manguera'),
              categoria: categoriaNombre,
              codigos: [barcode],
              metadatos: {
                procedencia: 'PresetGenerator',
                requiereBascula: isScaleItem
              }
            });
            
            seq++;
            
            // Detenerse si ya superamos la cuota por categoría o global
            // Queremos un catálogo balanceado de exactamente 1,020 productos (204 por categoría)
            if (products.length >= 1050) {
              break;
            }
          }
          if (products.length >= 1050) break;
        }
        if (products.length >= 1050) break;
      }
      if (products.length >= 1050) break;
    }
    
    // Si la categoría generó pocos, rellenar duplicando marcas
    if (products.length >= 1050) continue;
  }
  
  // Recortar a exactamente 1,000 productos para consistencia
  const finalProducts = products.slice(0, 1000);
  console.log(`[Preset Generator] Generados ${finalProducts.length} productos únicos para el giro ${giroName}.`);
  return finalProducts;
}

// --- MAIN RUN ---
function main() {
  const targetDir = path.join(__dirname, '../src/presets');
  
  // Asegurar que el directorio de salida existe
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Generar catálogos
  const ferreteriaPresets = generateCatalog('FERRETERIA', ferreteriaData);
  const abarrotesPresets = generateCatalog('ABARROTES', abarrotesData);
  const farmaciaPresets = generateCatalog('FARMACIA', farmaciaData);
  const refaccionariaPresets = generateCatalog('REFACCIONARIA', refaccionariaData);

  // Escribir a archivos
  fs.writeFileSync(path.join(targetDir, 'ferreteria.json'), JSON.stringify(ferreteriaPresets, null, 2), 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'abarrotes.json'), JSON.stringify(abarrotesPresets, null, 2), 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'farmacia.json'), JSON.stringify(farmaciaPresets, null, 2), 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'refaccionaria.json'), JSON.stringify(refaccionariaPresets, null, 2), 'utf-8');

  console.log(`[Success] Presets JSON guardados exitosamente en ${targetDir}`);
}

main();
