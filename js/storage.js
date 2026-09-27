// ============================================================
// storage.js — Gestion du localStorage + configuration globale
// ============================================================

// ⚙️ CONFIGURATION — Remplacez par votre numéro WhatsApp (sans +)
const SHOP_WHATSAPP_NUMBER = "212674303890"; // ← MODIFIEZ ICI

// Clés de stockage
const STORAGE_KEYS = {
    PRODUCTS: 'marocshop_products',
    CATEGORIES: 'marocshop_categories',
    CART: 'marocshop_cart',
    FAVORITES: 'marocshop_favorites',
    ORDERS: 'marocshop_orders',
    THEME: 'marocshop_theme',
    HERO_SLIDES: 'marchica_hero_slides',
    SHOP_SETTINGS: 'marchica_shop_settings',
    REVIEWS: 'marchica_product_reviews'
};

const DEFAULT_SHOP_SETTINGS = {
    phone: SHOP_WHATSAPP_NUMBER,
    address: 'Nador, Maroc',
    openingHours: 'À renseigner',
    deliveryInfo: 'Livraison partout au Maroc en 24-48h. Livraison gratuite dès 300 DH.',
    returnsInfo: 'Pour toute question sur les retours, contactez-nous par WhatsApp.',
    socialLinks: {
        facebook: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        linkedin: ''
    }
};

const DEFAULT_HERO_SLIDES = [
    {
        tag: 'Offre de lancement',
        title: 'Équipez votre maison au meilleur prix',
        description: 'Découvrez notre sélection de produits pour toute la famille. Livraison rapide partout au Maroc, paiement à la livraison disponible.',
        buttonText: 'Découvrir maintenant',
        buttonLink: '#/categories',
        image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop&auto=format'
    },
    {
        tag: 'Offre limitée',
        title: '-30% sur la mode',
        description: 'Profitez de réductions exceptionnelles sur une large sélection de vêtements et accessoires.',
        buttonText: "J'en profite",
        buttonLink: '#/promotions',
        image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=400&fit=crop&auto=format'
    },
    {
        tag: 'Livraison gratuite',
        title: 'Dès 300 DH d’achat',
        description: 'La livraison est offerte partout au Maroc pour toute commande supérieure à 300 DH.',
        buttonText: 'Voir les produits',
        buttonLink: '#/categories',
        image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=600&h=400&fit=crop&auto=format'
    }
];

// Helpers génériques
function getFromStorage(key, defaultValue = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Erreur lecture localStorage', key, e);
        return defaultValue;
    }
}

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        if (typeof syncSharedData === 'function') syncSharedData(key, value);
    } catch (e) {
        console.warn('Erreur écriture localStorage', key, e);
    }
}

function removeFromStorage(key) {
    localStorage.removeItem(key);
}

function getHeroSlides() {
    const slides = getFromStorage(STORAGE_KEYS.HERO_SLIDES, null);
    if (Array.isArray(slides) && slides.length > 0 &&
        slides.every(slide => slide && ['tag', 'title', 'description', 'buttonText', 'buttonLink', 'image']
            .every(key => typeof slide[key] === 'string'))) return slides;
    if (slides !== null) console.warn('Configuration de la bannière invalide, utilisation des diapositives par défaut.');
    saveToStorage(STORAGE_KEYS.HERO_SLIDES, DEFAULT_HERO_SLIDES);
    return DEFAULT_HERO_SLIDES;
}

function saveHeroSlides(slides) {
    try {
        localStorage.setItem(STORAGE_KEYS.HERO_SLIDES, JSON.stringify(slides));
        if (typeof syncSharedData === 'function') syncSharedData(STORAGE_KEYS.HERO_SLIDES, slides);
        return true;
    } catch (error) {
        console.error('Erreur écriture configuration de la bannière', error);
        return false;
    }
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function getShopSettings() {
    const settings = getFromStorage(STORAGE_KEYS.SHOP_SETTINGS, {});
    return {
        ...DEFAULT_SHOP_SETTINGS,
        ...settings,
        socialLinks: {
            ...DEFAULT_SHOP_SETTINGS.socialLinks,
            ...(settings.socialLinks || {})
        }
    };
}

function saveShopSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEYS.SHOP_SETTINGS, JSON.stringify(settings));
        if (typeof syncSharedData === 'function') syncSharedData(STORAGE_KEYS.SHOP_SETTINGS, settings);
        return true;
    } catch (error) {
        console.error('Erreur écriture des paramètres du magasin', error);
        return false;
    }
}

function getShopWhatsAppNumber() {
    return getShopSettings().phone.replace(/\D/g, '') || SHOP_WHATSAPP_NUMBER;
}

function getProductReviews() {
    return getFromStorage(STORAGE_KEYS.REVIEWS, []);
}

function saveProductReviews(reviews) {
    try {
        localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
        if (typeof syncAdminReviews === 'function' && isSupabaseAdmin()) {
            syncAdminReviews(reviews).catch(error => reportBackgroundError('modération des avis', error));
        }
        return true;
    } catch (error) {
        console.error('Erreur écriture des avis', error);
        return false;
    }
}