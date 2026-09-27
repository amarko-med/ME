// ============================================================
// products.js — Données produits & catégories + fonctions
// ============================================================

const initialCategories = [
    { id: 'mode', name: 'Mode', icon: 'fa-tshirt', image: '', description: 'Vêtements et accessoires', active: true },
    { id: 'electronique', name: 'Électronique', icon: 'fa-laptop', image: '', description: 'Appareils high-tech', active: true },
    { id: 'maison', name: 'Maison & Déco', icon: 'fa-couch', image: '', description: 'Meubles et décoration', active: true },
    { id: 'beaute', name: 'Beauté & Soins', icon: 'fa-spa', image: '', description: 'Cosmétiques et parfums', active: true },
    { id: 'sport', name: 'Sport & Loisirs', icon: 'fa-futbol', image: '', description: 'Équipement sportif', active: true },
    { id: 'jouets', name: 'Jouets & Jeux', icon: 'fa-gamepad', image: '', description: 'Jeux pour enfants', active: true },
    { id: 'bricolage', name: 'Bricolage', icon: 'fa-tools', image: '', description: 'Outils et quincaillerie', active: true },
    { id: 'cuisine', name: 'Cuisine', icon: 'fa-utensils', image: '', description: 'Ustensiles de cuisine', active: true },
    { id: 'accessoires', name: 'Accessoires', icon: 'fa-clock', image: '', description: 'Montres, sacs, lunettes', active: true },
    { id: 'livres', name: 'Livres & Papeterie', icon: 'fa-book', image: '', description: 'Romans, BD, fournitures', active: true },
    { id: 'telephones', name: 'Téléphones & Tablettes', icon: 'fa-mobile-alt', image: '', description: 'Smartphones et accessoires', active: true },
    { id: 'animaux', name: 'Animaux', icon: 'fa-paw', image: '', description: 'Alimentation et accessoires pour animaux', active: true },
    { id: 'bebe', name: 'Bébé & Enfant', icon: 'fa-baby', image: '', description: 'Puériculture et jouets', active: true },
    { id: 'auto', name: 'Auto & Moto', icon: 'fa-car', image: '', description: 'Accessoires et entretien', active: true },
    { id: 'sante', name: 'Santé & Bien-être', icon: 'fa-heartbeat', image: '', description: 'Compléments et soins', active: true },
    { id: 'jardin', name: 'Jardin & Plein air', icon: 'fa-seedling', image: '', description: 'Plantes et outils', active: true },
    { id: 'informatique', name: 'Informatique', icon: 'fa-laptop-code', image: '', description: 'PC, périphériques', active: true },
    { id: 'autres', name: 'Autres', icon: 'fa-plus-circle', image: '', description: 'Divers', active: true }
];
// Helper pour construire les URLs d'images
const u = (id, w = 600, h = 400) => `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&auto=format`;

const initialProducts = [
    {
        id: 'p1', name: 'Montre connectée Sport', category: 'accessoires', subcategory: 'montres',
        description: 'Montre connectée avec suivi cardiaque, GPS intégré et autonomie allant jusqu\'à 7 jours. Étanche IP68, compatible iOS et Android.',
        price: 299, oldPrice: 399, discount: 25,
        image: u('1546868871-7041f2a55e12', 300, 200),
        additionalImages: [u('1546868871-7041f2a55e12', 800, 600), u('1523275335684-37898b6baf30', 800, 600)],
        stock: 45, sku: 'MCS-001', rating: 4.5, reviewCount: 124,
        featured: true, bestseller: true, newProduct: false, active: true,
        specs: { 'Batterie': '7 jours', 'Étanchéité': 'IP68', 'GPS': 'Oui', 'Compatibilité': 'iOS / Android' }
    },
    {
        id: 'p2', name: 'Sac à main cuir premium', category: 'mode', subcategory: 'sacs',
        description: 'Sac à main en cuir véritable, finitions soignées, plusieurs compartiments intérieurs et bandoulière amovible.',
        price: 450, oldPrice: null, discount: 0,
        image: u('1585386959984-a4155224a1ad', 300, 200),
        additionalImages: [u('1585386959984-a4155224a1ad', 800, 600), u('1548036328-c9fa89d128fa', 800, 600)],
        stock: 23, sku: 'MCS-002', rating: 4.0, reviewCount: 89,
        featured: false, bestseller: true, newProduct: false, active: true,
        specs: { 'Matière': 'Cuir véritable', 'Dimensions': '30 × 20 × 10 cm', 'Bandoulière': 'Amovible' }
    },
    {
        id: 'p3', name: 'Casque Bluetooth Pro', category: 'electronique', subcategory: 'audio',
        description: 'Casque sans fil à réduction de bruit active, son haute fidélité, coussinets confortables pour un usage prolongé.',
        price: 549, oldPrice: 699, discount: 21,
        image: u('1583394838336-acd977736f90', 300, 200),
        additionalImages: [u('1583394838336-acd977736f90', 800, 600), u('1505740420928-5e560c06d30e', 800, 600)],
        stock: 67, sku: 'MCS-003', rating: 5.0, reviewCount: 210,
        featured: true, bestseller: true, newProduct: false, active: true,
        specs: { 'Bluetooth': '5.2', 'Autonomie': '30h', 'Réduction de bruit': 'Active', 'Poids': '250 g' }
    },
    {
        id: 'p4', name: 'Sneakers running homme', category: 'sport', subcategory: 'chaussures',
        description: 'Chaussures de running légères avec amorti réactif et tige respirante. Idéales pour l\'entraînement quotidien.',
        price: 399, oldPrice: null, discount: 0,
        image: u('1600185365483-26d7a4cc7519', 300, 200),
        additionalImages: [u('1600185365483-26d7a4cc7519', 800, 600), u('1542291026-7eec264c27ff', 800, 600)],
        stock: 34, sku: 'MCS-004', rating: 4.5, reviewCount: 156,
        featured: false, bestseller: true, newProduct: false, active: true,
        specs: { 'Pointures': '39 → 45', 'Semelle': 'Caoutchouc', 'Poids': '280 g' }
    },
    {
        id: 'p5', name: 'Montre classique homme', category: 'accessoires', subcategory: 'montres',
        description: 'Montre à quartz avec bracelet en acier inoxydable, cadran minimaliste et verre minéral anti-rayures.',
        price: 799, oldPrice: null, discount: 0,
        image: u('1523275335684-37898b6baf30', 300, 200),
        additionalImages: [u('1523275335684-37898b6baf30', 800, 600), u('1524592094714-0f0654e20314', 800, 600)],
        stock: 12, sku: 'MCS-005', rating: 4.0, reviewCount: 45,
        featured: false, bestseller: false, newProduct: true, active: true,
        specs: { 'Mouvement': 'Quartz', 'Étanchéité': '50 m', 'Bracelet': 'Acier inoxydable' }
    },
    {
        id: 'p6', name: 'Lunettes de soleil tendance', category: 'accessoires', subcategory: 'lunettes',
        description: 'Lunettes de soleil UV400, monture légère en acétate, design moderne adapté à tous les visages.',
        price: 199, oldPrice: 299, discount: 33,
        image: u('1572635196237-14b3f281503f', 300, 200),
        additionalImages: [u('1572635196237-14b3f281503f', 800, 600), u('1511499767150-a48a237f0083', 800, 600)],
        stock: 56, sku: 'MCS-006', rating: 5.0, reviewCount: 78,
        featured: true, bestseller: false, newProduct: true, active: true,
        specs: { 'Protection': 'UV400', 'Monture': 'Acétate', 'Verres': 'Polarisés' }
    },
    {
        id: 'p7', name: 'Enceinte portable Bluetooth', category: 'electronique', subcategory: 'audio',
        description: 'Enceinte compacte avec basses puissantes, résistante à l\'eau (IPX7), autonomie 12h. Idéale pour les sorties.',
        price: 349, oldPrice: null, discount: 0,
        image: u('1587829741301-dc798b83add3', 300, 200),
        additionalImages: [u('1587829741301-dc798b83add3', 800, 600), u('1608043152269-423dbba4e7e1', 800, 600)],
        stock: 41, sku: 'MCS-007', rating: 4.5, reviewCount: 32,
        featured: false, bestseller: false, newProduct: true, active: true,
        specs: { 'Bluetooth': '5.0', 'Autonomie': '12h', 'Étanchéité': 'IPX7', 'Puissance': '20 W' }
    },
    {
        id: 'p8', name: 'Sneakers casual femme', category: 'mode', subcategory: 'chaussures',
        description: 'Baskets décontractées pour femme, semelle souple et confort optimal pour un usage quotidien.',
        price: 299, oldPrice: null, discount: 0,
        image: u('1542291026-7eec264c27ff', 300, 200),
        additionalImages: [u('1542291026-7eec264c27ff', 800, 600), u('1600185365483-26d7a4cc7519', 800, 600)],
        stock: 28, sku: 'MCS-008', rating: 4.0, reviewCount: 63,
        featured: false, bestseller: false, newProduct: true, active: true,
        specs: { 'Pointures': '36 → 41', 'Couleur': 'Blanc', 'Semelle': 'Caoutchouc' }
    },
    {
        id: 'p9', name: 'Ordinateur portable 14"', category: 'electronique', subcategory: 'ordinateurs',
        description: 'PC portable performant, SSD 512 Go, 16 Go RAM, écran Full HD antireflet. Parfait pour le travail et les études.',
        price: 6999, oldPrice: 7999, discount: 12,
        image: u('1517336714731-489689fd1ca8', 300, 200),
        additionalImages: [u('1517336714731-489689fd1ca8', 800, 600), u('1496181133206-80ce9b88a853', 800, 600)],
        stock: 8, sku: 'MCS-009', rating: 5.0, reviewCount: 29,
        featured: true, bestseller: false, newProduct: false, active: true,
        specs: { 'Processeur': 'Intel i5', 'RAM': '16 Go', 'Stockage': '512 Go SSD', 'Écran': '14" Full HD' }
    },
    {
        id: 'p10', name: 'Lampe de table design', category: 'maison', subcategory: 'luminaires',
        description: 'Lampe de chevet au style scandinave, lumière chaude réglable, base en bois et métal.',
        price: 249, oldPrice: null, discount: 0,
        image: u('1586023492125-27b2c045efd7', 300, 200),
        additionalImages: [u('1586023492125-27b2c045efd7', 800, 600), u('1507473885765-e6ed057f782c', 800, 600)],
        stock: 19, sku: 'MCS-010', rating: 4.0, reviewCount: 41,
        featured: true, bestseller: false, newProduct: false, active: true,
        specs: { 'Matière': 'Métal et bois', 'Hauteur': '35 cm', 'Ampoule': 'E27 LED' }
    },
    {
        id: 'p11', name: 'Eau de parfum 100ml', category: 'beaute', subcategory: 'parfums',
        description: 'Parfum boisé et oriental, notes de tête fraîches, tenue longue durée. Idéal pour toutes les occasions.',
        price: 599, oldPrice: null, discount: 0,
        image: u('1596462502278-27bfdc403348', 300, 200),
        additionalImages: [u('1596462502278-27bfdc403348', 800, 600), u('1541643600914-78b084683601', 800, 600)],
        stock: 52, sku: 'MCS-011', rating: 4.5, reviewCount: 97,
        featured: true, bestseller: false, newProduct: false, active: true,
        specs: { 'Volume': '100 ml', 'Famille': 'Boisée orientale', 'Tenue': '8-10 h' }
    },
    {
        id: 'p12', name: 'Set de cuisine 5 pièces', category: 'cuisine', subcategory: 'ustensiles',
        description: 'Ensemble de casseroles et poêles anti-adhésives, compatible toutes plaques dont induction.',
        price: 449, oldPrice: 549, discount: 18,
        image: u('1556909114-f6e7ad7d3136', 300, 200),
        additionalImages: [u('1556909114-f6e7ad7d3136', 800, 600), u('1584990347449-a2d4c2e0b1c4', 800, 600)],
        stock: 15, sku: 'MCS-012', rating: 5.0, reviewCount: 54,
        featured: true, bestseller: false, newProduct: false, active: true,
        specs: { 'Pièces': '5', 'Matériau': 'Aluminium anti-adhésif', 'Compatibilité': 'Toutes plaques' }
    }
];

// ---------- INITIALISATION ----------
function initProductsAndCategories() {
    if (!getFromStorage(STORAGE_KEYS.CATEGORIES, null)) saveToStorage(STORAGE_KEYS.CATEGORIES, initialCategories);
    if (!getFromStorage(STORAGE_KEYS.PRODUCTS, null)) saveToStorage(STORAGE_KEYS.PRODUCTS, initialProducts);
}

// ---------- ACCESSEURS ----------
function getProducts() { return getFromStorage(STORAGE_KEYS.PRODUCTS, []); }
function setProducts(p) { saveToStorage(STORAGE_KEYS.PRODUCTS, p); }
function getCategories() { return getFromStorage(STORAGE_KEYS.CATEGORIES, []); }
function setCategories(c) { saveToStorage(STORAGE_KEYS.CATEGORIES, c); }
function getProductById(id) { return getProducts().find(p => p.id === id) || null; }
function getCategoryById(id) { return getCategories().find(c => c.id === id) || null; }
function getActiveProducts() { return getProducts().filter(p => p.active !== false); }
function getActiveCategories() { return getCategories().filter(c => c.active !== false); }
function isProductAvailable(product) {
    return typeof product.available === 'boolean' ? product.available : product.stock > 0;
}

// ---------- FILTRES & TRI ----------
function filterAndSortProducts(products, filters = {}) {
    let result = [...products];

    if (filters.category) result = result.filter(p => p.category === filters.category);
    if (filters.subcategory) result = result.filter(p => p.subcategory === filters.subcategory);

    if (typeof filters.minPrice === 'number' && !isNaN(filters.minPrice))
        result = result.filter(p => p.price >= filters.minPrice);
    if (typeof filters.maxPrice === 'number' && !isNaN(filters.maxPrice) && filters.maxPrice > 0)
        result = result.filter(p => p.price <= filters.maxPrice);

    if (filters.availability === 'in') result = result.filter(isProductAvailable);
    else if (filters.availability === 'out') result = result.filter(p => !isProductAvailable(p));

    if (filters.minRating) result = result.filter(p => p.rating >= filters.minRating);
    if (filters.discountOnly === true) result = result.filter(p => p.discount > 0);

    if (filters.search) {
        const q = filters.search.toLowerCase();
        result = result.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
    }

    const sort = filters.sort || 'pertinence';
    switch (sort) {
        case 'prix-asc': result.sort((a, b) => a.price - b.price); break;
        case 'prix-desc': result.sort((a, b) => b.price - a.price); break;
        case 'nouveautes': result.sort((a, b) => (b.newProduct === true) - (a.newProduct === true)); break;
        case 'meilleures-ventes': result.sort((a, b) => (b.bestseller === true) - (a.bestseller === true)); break;
        default: result.sort((a, b) => b.rating - a.rating);
    }
    return result;
}